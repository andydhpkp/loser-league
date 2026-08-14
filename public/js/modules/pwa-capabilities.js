export function detectPwaCapabilities(scope = window) {
  const navigatorValue = scope.navigator || {};
  const standalone = scope.matchMedia?.("(display-mode: standalone)")?.matches === true || navigatorValue.standalone === true;
  return { secureContext: scope.isSecureContext === true, serviceWorker: "serviceWorker" in navigatorValue, notifications: "Notification" in scope, push: "PushManager" in scope, installed: standalone, installPrompt: false };
}
export function derivePushCapabilityState({ capabilities, permission = "default", currentDeviceEnabled = false, operational = true, updateAvailable = false }) {
  if (updateAvailable) return "UPDATE_AVAILABLE";
  if (!operational) return "TEMPORARILY_UNAVAILABLE";
  if (!capabilities.secureContext || !capabilities.serviceWorker || !capabilities.notifications || !capabilities.push) return "UNSUPPORTED";
  if (!capabilities.installed) return "INSTALLATION_REQUIRED";
  if (permission === "denied") return "PERMISSION_DENIED";
  if (currentDeviceEnabled) return "ENABLED_CURRENT_DEVICE";
  return permission === "granted" ? "PUSH_SETUP_REQUIRED" : "PERMISSION_AVAILABLE";
}
export function installationGuidance({ platform = "desktop" } = {}) {
  if (platform === "ios") return "In Safari, choose Share, Add to Home Screen, then launch Loser League and enable push.";
  if (platform === "android") return "Choose Install or Add to Home Screen, then launch Loser League and enable push.";
  return "Install Loser League from your browser where supported, then enable push.";
}
