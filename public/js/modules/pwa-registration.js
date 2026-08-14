export async function registerPwa({ navigatorValue = globalThis.navigator, onUpdate = () => {} } = {}) {
  if (!("serviceWorker" in navigatorValue)) return { supported: false };
  try {
    const registration = await navigatorValue.serviceWorker.register("/service-worker.js", { scope: "/" });
    if (registration.waiting) onUpdate(registration);
    registration.addEventListener?.("updatefound", () => { const worker = registration.installing; worker?.addEventListener("statechange", () => { if (worker.state === "installed" && navigatorValue.serviceWorker.controller) onUpdate(registration); }); });
    return { supported: true, registration };
  } catch (_error) { return { supported: true, unavailable: true }; }
}
export async function requestPushPermissionFromUserGesture({ notificationApi = globalThis.Notification } = {}) { return notificationApi.requestPermission(); }
