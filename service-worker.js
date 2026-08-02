// Bump this on every deploy so clients pick up fresh files.
const CACHE_VERSION = "gpf-passbook-v2";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/styles.css",
  "./js/app.js",
  "./js/data/rateTable.js",
  "./js/lib/gpfCalc.js",
  "./js/lib/storage.js",
  "./js/lib/pdfExport.js",
  "./js/lib/pdfWriter.js",
  "./js/lib/fileExport.js",
  "./js/lib/pinLock.js",
  "./js/components/render.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Cache-first for the app shell; network-first fallback for anything else
// (e.g. the CDN-hosted jsPDF module, which we still want fresh when online).
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const isAppShell = APP_SHELL.some((path) => req.url.endsWith(path.replace("./", "/")));

  if (isAppShell) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req))
    );
  } else {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
  }
});
