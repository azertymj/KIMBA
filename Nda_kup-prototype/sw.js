/* Ndakup — service worker : l'application s'ouvre et fonctionne sans réseau */
const CACHE = "Ndakup-v1";
const FILES = [
  "./", "index.html", "manifest.webmanifest", "icons/icon.svg",
  "css/style.css",
  "js/vendor/qrcode.js", "js/data.js", "js/store.js", "js/ui.js", "js/views.js", "js/app.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

// Réseau d'abord (pour recevoir les mises à jour), cache en secours (hors connexion)
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match("index.html")))
  );
});
