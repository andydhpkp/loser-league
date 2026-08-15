const CACHE_NAME = "loser-league-shell-v1";
const STATIC_SHELL = Object.freeze(["/offline.html", "/css/styles.css", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon-maskable-512.png"]);
self.addEventListener("install", (event) => { event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_SHELL))); });
self.addEventListener("activate", (event) => { event.waitUntil(caches.keys().then((names) => Promise.all(names.filter((name) => name.startsWith("loser-league-shell-") && name !== CACHE_NAME).map((name) => caches.delete(name)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (event) => {
  const request = event.request; const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (request.mode === "navigate") { event.respondWith(fetch(request).catch(() => caches.match("/offline.html"))); return; }
  if (!STATIC_SHELL.includes(url.pathname)) return;
  if (url.pathname === "/css/styles.css") {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok) event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone())));
      return response;
    }).catch(() => caches.match(request)));
    return;
  }
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});
self.addEventListener("push", (event) => {
  let notification = null; try { notification = event.data?.json()?.notification; } catch (_error) { notification = null; }
  if (!notification) return;
  event.waitUntil(self.registration.showNotification(notification.title, { body: notification.body, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", data: { navigate: notification.navigate }, tag: "pick-reminder" }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close(); const navigate = event.notification.data?.navigate || "/dashboard.html";
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => { const existing = clients.find((client) => new URL(client.url).origin === self.location.origin); return existing ? existing.focus() : self.clients.openWindow(navigate); }));
});
