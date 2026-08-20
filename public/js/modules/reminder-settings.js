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

function sameBytes(left, right) {
  const leftBytes = left ? new Uint8Array(left) : null;
  const rightBytes = right ? new Uint8Array(right) : null;
  return Boolean(leftBytes && rightBytes && leftBytes.length === rightBytes.length && leftBytes.every((value, index) => value === rightBytes[index]));
}

async function registerPushSubscription({ registration, configuration, fetchImpl }) {
  const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(configuration.publicKey) });
  const response = await fetchImpl("/api/user/reminders/push/subscription", { method: "PUT", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ subscription: subscription.toJSON() }) });
  if (response.status === 401) throw new Error("SESSION_EXPIRED");
  if (!response.ok) return { subscription, status: { state: "TEMPORARILY_UNAVAILABLE" } };
  return { subscription, status: await response.json() };
}

export async function enablePushOnDevice({ configuration, notificationApi = globalThis.Notification, navigatorValue = globalThis.navigator, fetchImpl = fetch } = {}) {
  if (!configuration || configuration.state !== "AVAILABLE" || !configuration.publicKey) return { state: "TEMPORARILY_UNAVAILABLE" };
  const permission = notificationApi.permission === "granted" ? "granted" : await notificationApi.requestPermission();
  if (permission !== "granted") return { state: "PERMISSION_DENIED" };
  const registration = await navigatorValue.serviceWorker.ready;
  return (await registerPushSubscription({ registration, configuration, fetchImpl })).status;
}

export async function reconcileExistingPushSubscription({ configuration, notificationApi = globalThis.Notification, navigatorValue = globalThis.navigator, fetchImpl = fetch } = {}) {
  if (!configuration || configuration.state !== "AVAILABLE" || !configuration.publicKey || notificationApi?.permission !== "granted") return { subscription: null, status: null, repaired: false };
  const registration = await navigatorValue.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return { subscription: null, status: null, repaired: false };
  const response = await fetchImpl("/api/user/reminders/push/status", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
  if (response.status === 401) throw new Error("SESSION_EXPIRED");
  if (!response.ok) return { subscription, status: null, repaired: false };
  const status = await response.json();
  const keyMatches = sameBytes(subscription.options?.applicationServerKey, decodeKey(configuration.publicKey));
  if (status.currentDeviceEnabled && keyMatches) return { subscription, status, repaired: false };
  if (!await subscription.unsubscribe()) return { subscription, status: { state: "TEMPORARILY_UNAVAILABLE" }, repaired: false };
  const replacement = await registerPushSubscription({ registration, configuration, fetchImpl });
  return { ...replacement, repaired: replacement.status.currentDeviceEnabled === true };
}

export async function mutateEmpty(url, fetchImpl = fetch) {
  const response = await fetchImpl(url, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: "{}" });
  if (response.status === 401) throw new Error("SESSION_EXPIRED");
  if (!response.ok && response.status !== 429) return { state: "TEMPORARILY_UNAVAILABLE" };
  return response.json();
}

export function formatResendDelay(seconds) {
  const remaining = Math.max(0, Math.ceil(Number(seconds) || 0));
  if (!remaining) return "";
  if (remaining >= 3600) return `${Math.floor(remaining / 3600)}h ${Math.ceil(remaining % 3600 / 60)}m`;
  return `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;
}
