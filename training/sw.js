// Offline cache. Pages: network first, so a new upload shows up; everything else: cache first.
const C = "htp-364d1c83e9";
const CORE = ["./", "index.html", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png", "firebase.js"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(C).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== C).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const r = e.request; if (r.method !== "GET") return;
  if (new URL(r.url).origin !== location.origin && !/fonts\.(googleapis|gstatic)\.com/.test(r.url)) return;   // Firebase traffic goes straight to the network
  if (r.mode === "navigate") {
    e.respondWith(fetch(r).then((res) => { const cp = res.clone(); caches.open(C).then((c) => c.put("index.html", cp)); return res; }).catch(() => caches.match("index.html")));
    return;
  }
  e.respondWith(caches.match(r).then((hit) => hit || fetch(r).then((res) => {
    if (res && (res.ok || res.type === "opaque")) { const cp = res.clone(); caches.open(C).then((c) => c.put(r, cp)); }
    return res;
  })));
});
