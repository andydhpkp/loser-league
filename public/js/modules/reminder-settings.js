const URLS = Object.freeze({ push: "/api/user/reminders/push/configuration", email: "/api/user/reminders/email", calendar: "/api/user/reminders/calendar" });

async function loadOne(fetchImpl, url) {
  const response = await fetchImpl(url, { headers: { Accept: "application/json" } });
  if (response.status === 401) throw new Error("SESSION_EXPIRED");
  if (!response.ok) return { error: "UNAVAILABLE" };
  try { const value = await response.json(); return value && typeof value.state === "string" ? { value } : { error: "MALFORMED" }; }
  catch (_error) { return { error: "MALFORMED" }; }
}

export async function loadChannelStatuses(fetchImpl = fetch) {
  const values = await Promise.all(Object.entries(URLS).map(async ([name, url]) => [name, await loadOne(fetchImpl, url)]));
  return Object.fromEntries(values);
}

function decodeKey(value) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const raw = globalThis.atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export async function enablePushOnDevice({ configuration, notificationApi = globalThis.Notification, navigatorValue = globalThis.navigator, fetchImpl = fetch } = {}) {
  if (!configuration || configuration.state !== "AVAILABLE" || !configuration.publicKey) return { state: "TEMPORARILY_UNAVAILABLE" };
  const permission = notificationApi.permission === "granted" ? "granted" : await notificationApi.requestPermission();
  if (permission !== "granted") return { state: "PERMISSION_DENIED" };
  const registration = await navigatorValue.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(configuration.publicKey) });
  const response = await fetchImpl("/api/user/reminders/push/subscription", { method: "PUT", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ subscription: subscription.toJSON() }) });
  if (response.status === 401) throw new Error("SESSION_EXPIRED");
  if (!response.ok) return { state: "TEMPORARILY_UNAVAILABLE" };
  return response.json();
}

export async function mutateEmpty(url, fetchImpl = fetch) {
  const response = await fetchImpl(url, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: "{}" });
  if (response.status === 401) throw new Error("SESSION_EXPIRED");
  if (!response.ok && response.status !== 429) return { state: "TEMPORARILY_UNAVAILABLE" };
  return response.json();
}
