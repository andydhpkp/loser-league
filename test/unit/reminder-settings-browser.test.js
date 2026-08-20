const assert = require("node:assert/strict");
const test = require("node:test");

test("settings loads channel contracts independently and preserves partial success", async () => {
  const { loadChannelStatuses } = await import("../../public/js/modules/reminder-settings.js");
  const result = await loadChannelStatuses(async (url) => {
    if (url.endsWith("/email")) return { ok: false, status: 503, json: async () => ({}) };
    if (url.endsWith("/calendar")) return { ok: true, status: 200, json: async () => ({ state: "AVAILABLE", subscriptionUrl: "https://example.invalid/calendar/pick-deadlines.ics", webcalUrl: "webcal://example.invalid/calendar/pick-deadlines.ics" }) };
    return { ok: true, status: 200, json: async () => ({ state: "AVAILABLE", publicKey: "safe-public-key" }) };
  });
  assert.equal(result.push.value.state, "AVAILABLE");
  assert.equal(result.email.error, "UNAVAILABLE");
  assert.equal(result.calendar.value.state, "AVAILABLE");
});

test("settings treats an expired session as page-wide authority loss", async () => {
  const { loadChannelStatuses } = await import("../../public/js/modules/reminder-settings.js");
  await assert.rejects(loadChannelStatuses(async () => ({ ok: false, status: 401 })), /SESSION_EXPIRED/);
});

test("push permission is requested only by the explicit enable operation", async () => {
  const { enablePushOnDevice } = await import("../../public/js/modules/reminder-settings.js");
  let permissions = 0;
  const result = await enablePushOnDevice({
    configuration: { state: "AVAILABLE", publicKey: "AQID" },
    notificationApi: { permission: "default", requestPermission: async () => { permissions += 1; return "denied"; } },
  });
  assert.equal(permissions, 1);
  assert.deepEqual(result, { state: "PERMISSION_DENIED" });
});

test("existing push opt-in repairs a stale server device without another permission prompt", async () => {
  const { reconcileExistingPushSubscription } = await import("../../public/js/modules/reminder-settings.js");
  let permissionRequests = 0;
  let unsubscribed = 0;
  let subscribed = 0;
  const oldSubscription = {
    endpoint: "https://push.example.test/old",
    options: { applicationServerKey: Uint8Array.from([1, 2, 3]).buffer },
    async unsubscribe() { unsubscribed += 1; return true; },
  };
  const newSubscription = { toJSON: () => ({ endpoint: "https://push.example.test/new", expirationTime: null, keys: { p256dh: "p", auth: "a" } }) };
  const navigatorValue = { serviceWorker: { ready: Promise.resolve({ pushManager: {
    getSubscription: async () => oldSubscription,
    subscribe: async () => { subscribed += 1; return newSubscription; },
  } }) } };
  const fetchImpl = async (url) => url.endsWith("/status")
    ? { ok: true, status: 200, json: async () => ({ state: "SETUP_REQUIRED", currentDeviceEnabled: false, deviceCount: 0 }) }
    : { ok: true, status: 200, json: async () => ({ state: "ENABLED_CURRENT_DEVICE", currentDeviceEnabled: true, deviceCount: 1 }) };
  const result = await reconcileExistingPushSubscription({
    configuration: { state: "AVAILABLE", publicKey: "AQID" },
    notificationApi: { permission: "granted", requestPermission: async () => { permissionRequests += 1; } },
    navigatorValue,
    fetchImpl,
  });
  assert.equal(permissionRequests, 0);
  assert.equal(unsubscribed, 1);
  assert.equal(subscribed, 1);
  assert.equal(result.status.currentDeviceEnabled, true);
  assert.equal(result.subscription, newSubscription);
});

test("existing push opt-in replaces a subscription bound to an old VAPID key", async () => {
  const { reconcileExistingPushSubscription } = await import("../../public/js/modules/reminder-settings.js");
  let unsubscribed = 0;
  let subscribed = 0;
  const oldSubscription = { endpoint: "https://push.example.test/old-key", options: { applicationServerKey: Uint8Array.from([9, 9, 9]).buffer }, async unsubscribe() { unsubscribed += 1; return true; } };
  const newSubscription = { toJSON: () => ({ endpoint: "https://push.example.test/new-key", expirationTime: null, keys: { p256dh: "p", auth: "a" } }) };
  const fetchImpl = async (url) => url.endsWith("/status")
    ? { ok: true, status: 200, json: async () => ({ state: "ENABLED_CURRENT_DEVICE", currentDeviceEnabled: true, deviceCount: 1 }) }
    : { ok: true, status: 200, json: async () => ({ state: "ENABLED_CURRENT_DEVICE", currentDeviceEnabled: true, deviceCount: 1 }) };
  const result = await reconcileExistingPushSubscription({
    configuration: { state: "AVAILABLE", publicKey: "AQID" },
    notificationApi: { permission: "granted" },
    navigatorValue: { serviceWorker: { ready: Promise.resolve({ pushManager: { getSubscription: async () => oldSubscription, subscribe: async () => { subscribed += 1; return newSubscription; } } }) } },
    fetchImpl,
  });
  assert.equal(unsubscribed, 1);
  assert.equal(subscribed, 1);
  assert.equal(result.repaired, true);
});

test("push reconciliation neither auto-enrolls nor replaces a healthy matching device", async () => {
  const { reconcileExistingPushSubscription } = await import("../../public/js/modules/reminder-settings.js");
  let subscribed = 0;
  const pushManager = { getSubscription: async () => null, subscribe: async () => { subscribed += 1; } };
  const base = { configuration: { state: "AVAILABLE", publicKey: "AQID" }, notificationApi: { permission: "granted" }, navigatorValue: { serviceWorker: { ready: Promise.resolve({ pushManager }) } }, fetchImpl: async () => { throw new Error("status should not load"); } };
  assert.deepEqual(await reconcileExistingPushSubscription(base), { subscription: null, status: null, repaired: false });
  assert.equal(subscribed, 0);

  const subscription = { endpoint: "https://push.example.test/current", options: { applicationServerKey: Uint8Array.from([1, 2, 3]).buffer } };
  pushManager.getSubscription = async () => subscription;
  base.fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ state: "ENABLED_CURRENT_DEVICE", currentDeviceEnabled: true, deviceCount: 1 }) });
  assert.deepEqual(await reconcileExistingPushSubscription(base), { subscription, status: { state: "ENABLED_CURRENT_DEVICE", currentDeviceEnabled: true, deviceCount: 1 }, repaired: false });
  assert.equal(subscribed, 0);
});

test("resend countdown formatting is stable across minute and daily limits", async () => {
  const { formatResendDelay } = await import("../../public/js/modules/reminder-settings.js");
  assert.equal(formatResendDelay(0), "");
  assert.equal(formatResendDelay(1), "0:01");
  assert.equal(formatResendDelay(599), "9:59");
  assert.equal(formatResendDelay(600), "10:00");
  assert.equal(formatResendDelay(48_060), "13h 21m");
});
