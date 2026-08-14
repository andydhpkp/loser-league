const assert = require("node:assert/strict");
const test = require("node:test");
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
