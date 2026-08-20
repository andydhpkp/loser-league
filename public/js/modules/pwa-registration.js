async function clearSupportedAppBadge(navigatorValue) {
  if (typeof navigatorValue?.clearAppBadge !== "function") return;
  try { await navigatorValue.clearAppBadge(); } catch (_error) {}
}

export async function registerPwa({ navigatorValue = globalThis.navigator, documentValue = globalThis.document, onUpdate = () => {} } = {}) {
  await clearSupportedAppBadge(navigatorValue);
  documentValue?.addEventListener?.("visibilitychange", () => { if (documentValue.visibilityState === "visible") void clearSupportedAppBadge(navigatorValue); });
  if (!("serviceWorker" in navigatorValue)) return { supported: false };
  try {
    const registration = await navigatorValue.serviceWorker.register("/service-worker.js", { scope: "/" });
    if (registration.waiting) onUpdate(registration);
    registration.addEventListener?.("updatefound", () => { const worker = registration.installing; worker?.addEventListener("statechange", () => { if (worker.state === "installed" && navigatorValue.serviceWorker.controller) onUpdate(registration); }); });
    return { supported: true, registration };
  } catch (_error) { return { supported: true, unavailable: true }; }
}
export function activateWaitingServiceWorker({ registration, navigatorValue = globalThis.navigator, reload = () => globalThis.location.reload() } = {}) {
  if (!registration?.waiting || !("serviceWorker" in navigatorValue)) return false;
  navigatorValue.serviceWorker.addEventListener("controllerchange", reload, { once: true });
  registration.waiting.postMessage({ type: "SKIP_WAITING" });
  return true;
}
export async function requestPushPermissionFromUserGesture({ notificationApi = globalThis.Notification } = {}) { return notificationApi.requestPermission(); }
