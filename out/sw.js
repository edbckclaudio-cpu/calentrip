const CACHE_NAME = "calentrip-cache-v4";
const ASSETS = ["/", "/calendar/final", "/manifest.webmanifest", "/globe.svg", "/next.svg", "/vercel.svg", "/window.svg", "/file.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => null)
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  try {
    const url = new URL(req.url);
    const sameOrigin = url.origin === self.location.origin;
    if (!sameOrigin) return;
    if (url.pathname.startsWith("/_next/")) return;
  } catch {}
  const isHtml = req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");
  if (isHtml) {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then((cached) => cached || Promise.reject("offline")))
    );
  } else {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
          return res;
        }).catch(() => cached || Promise.reject("offline"));
        return cached || fetchPromise;
      })
    );
  }
});
