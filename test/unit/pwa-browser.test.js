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
