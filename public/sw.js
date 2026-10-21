// Sudhaar service worker: shows a friendly offline page when the network drops.
// It deliberately does not cache app pages or API data, so nobody ever sees a stale order.
const CACHE = "sudhaar-offline-v1";
const OFFLINE = ["/offline.html", "/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(OFFLINE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("/offline.html")));
    return;
  }
  if (OFFLINE.some((p) => req.url.endsWith(p))) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
  }
});
