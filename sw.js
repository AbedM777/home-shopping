// App shell cache + push notifications.
// The page opens even without a connection; Firestore keeps the list data offline itself.
const CACHE = "kniyot-v3";
const SHELL = ["./", "index.html", "db.js", "firebase-config.js", "manifest.webmanifest", "icon-192.png", "apple-touch-icon.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  // network first, so updates arrive right away; cache when offline
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match("index.html"))));
});

// A push from the server: show the notification and put the count on the icon.
self.addEventListener("push", e => {
  let p = {};
  try { p = e.data ? e.data.json() : {}; } catch (err) { p = { title: e.data && e.data.text() }; }
  const d = p.data || p.notification || p;
  const title = d.title || "קניות הבית";
  const badge = parseInt(d.badge, 10);
  e.waitUntil(Promise.all([
    self.registration.showNotification(title, { body: d.body || "", icon: "icon-192.png", badge: "icon-192.png", tag: "kniyot", renotify: true, lang: "he", dir: "rtl", data: { url: "./" } }),
    (self.navigator && self.navigator.setAppBadge && badge > 0) ? self.navigator.setAppBadge(badge).catch(() => {}) : Promise.resolve(),
  ]));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const c of list) if ("focus" in c) return c.focus();
    return self.clients.openWindow(self.registration.scope);
  }));
});
