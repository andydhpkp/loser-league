const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");
test("capability states use feature detection and distinguish installation, permission, setup, outage, and updates", async () => {
  const { detectPwaCapabilities, derivePushCapabilityState, installationGuidance } = await import("../../public/js/modules/pwa-capabilities.js");
  const capabilities = detectPwaCapabilities({ isSecureContext: true, navigator: { serviceWorker: {} }, Notification: {}, PushManager: function PushManager() {}, matchMedia: () => ({ matches: true }) });
  assert.equal(derivePushCapabilityState({ capabilities }), "PERMISSION_AVAILABLE");
  assert.equal(derivePushCapabilityState({ capabilities, permission: "granted" }), "PUSH_SETUP_REQUIRED");
  assert.equal(derivePushCapabilityState({ capabilities, permission: "denied" }), "PERMISSION_DENIED");
  assert.equal(derivePushCapabilityState({ capabilities, currentDeviceEnabled: true }), "ENABLED_CURRENT_DEVICE");
  assert.equal(derivePushCapabilityState({ capabilities, operational: false }), "TEMPORARILY_UNAVAILABLE");
  assert.equal(derivePushCapabilityState({ capabilities, updateAvailable: true }), "UPDATE_AVAILABLE");
  assert.equal(derivePushCapabilityState({ capabilities: { ...capabilities, installed: false } }), "INSTALLATION_REQUIRED");
  assert.match(installationGuidance({ platform: "ios" }), /Share, Add to Home Screen/);
});

test("notification permission is requested only through the explicit gesture seam", async () => {
  const { requestPushPermissionFromUserGesture } = await import("../../public/js/modules/pwa-registration.js");
  let calls = 0; const permission = await requestPushPermissionFromUserGesture({ notificationApi: { requestPermission: async () => { calls += 1; return "denied"; } } });
  assert.equal(permission, "denied"); assert.equal(calls, 1);
});

test("a user-requested update activates the waiting worker before reloading", async () => {
  const { activateWaitingServiceWorker } = await import("../../public/js/modules/pwa-registration.js");
  const messages = [];
  let controllerChange;
  let reloads = 0;
  const navigatorValue = { serviceWorker: { addEventListener: (type, listener, options) => { assert.equal(type, "controllerchange"); assert.deepEqual(options, { once: true }); controllerChange = listener; } } };
  const registration = { waiting: { postMessage: (message) => messages.push(message) } };

  const activated = activateWaitingServiceWorker({ registration, navigatorValue, reload: () => { reloads += 1; } });

  assert.equal(activated, true);
  assert.deepEqual(messages, [{ type: "SKIP_WAITING" }]);
  assert.equal(reloads, 0);
  controllerChange();
  assert.equal(reloads, 1);
});

test("the service worker accepts an explicit activation request", () => {
  const listeners = {};
  let skipWaitingCalls = 0;
  const self = { addEventListener: (type, listener) => { listeners[type] = listener; }, skipWaiting: () => { skipWaitingCalls += 1; } };
  vm.runInNewContext(fs.readFileSync("public/service-worker.js", "utf8"), { self, caches: {}, URL });

  listeners.message({ data: { type: "SKIP_WAITING" } });

  assert.equal(skipWaitingCalls, 1);
});

test("a reminder push sets an app badge without risking notification display", async () => {
  const listeners = {};
  let badges = 0;
  let notifications = 0;
  const self = {
    addEventListener: (type, listener) => { listeners[type] = listener; },
    navigator: { setAppBadge: async () => { badges += 1; throw new Error("platform badge unavailable"); } },
    registration: { showNotification: async () => { notifications += 1; } },
  };
  vm.runInNewContext(fs.readFileSync("public/service-worker.js", "utf8"), { self, caches: {}, URL });
  let work;
  listeners.push({ data: { json: () => ({ notification: { title: "Reminder", body: "Body", navigate: "/dashboard.html" } }) }, waitUntil: (promise) => { work = promise; } });
  await work;
  assert.equal(badges, 1);
  assert.equal(notifications, 1);
});

test("notification activation clears the app badge before focusing the app", async () => {
  const listeners = {};
  let clears = 0;
  let focuses = 0;
  const self = {
    addEventListener: (type, listener) => { listeners[type] = listener; },
    navigator: { clearAppBadge: async () => { clears += 1; } },
    location: { origin: "https://example.test" },
    clients: { matchAll: async () => [{ url: "https://example.test/dashboard.html", focus: async () => { focuses += 1; } }], openWindow: async () => {} },
  };
  vm.runInNewContext(fs.readFileSync("public/service-worker.js", "utf8"), { self, caches: {}, URL });
  let work;
  listeners.notificationclick({ notification: { close() {}, data: { navigate: "/dashboard.html" } }, waitUntil: (promise) => { work = promise; } });
  await work;
  assert.equal(clears, 1);
  assert.equal(focuses, 1);
});

test("PWA registration clears a supported app badge now and on foreground return", async () => {
  const { registerPwa } = await import("../../public/js/modules/pwa-registration.js");
  let clears = 0;
  let visibilityListener;
  const navigatorValue = { clearAppBadge: async () => { clears += 1; }, serviceWorker: { register: async () => ({ addEventListener() {} }) } };
  const documentValue = { visibilityState: "visible", addEventListener: (type, listener) => { assert.equal(type, "visibilitychange"); visibilityListener = listener; } };
  await registerPwa({ navigatorValue, documentValue });
  assert.equal(clears, 1);
  documentValue.visibilityState = "hidden"; await visibilityListener(); assert.equal(clears, 1);
  documentValue.visibilityState = "visible"; await visibilityListener(); assert.equal(clears, 2);
});
