const CACHE_NAME = "openfm-audio-cache-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function isGenerateRequest(request) {
  try {
    const url = new URL(request.url);
    return url.origin === self.location.origin && url.pathname === "/api/generate";
  } catch {
    return false;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;
  if (!isGenerateRequest(request)) return;

  // Audio elements may use range requests; avoid caching partial content.
  if (request.headers.get("range")) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      const cached = await cache.match(request);
      if (cached) return cached;

      const response = await fetch(request);
      if (!response || !response.ok) return response;

      event.waitUntil(
        (async () => {
          try {
            const cloneForCache = response.clone();
            const cloneForBlob = response.clone();

            await cache.put(request, cloneForCache);

            const blob = await cloneForBlob.blob();
            const clients = await self.clients.matchAll({
              type: "window",
              includeUncontrolled: true,
            });

            for (const client of clients) {
              client.postMessage({ type: "ADD_TO_CACHE", url: request.url, blob });
            }
          } catch {
            // Best-effort caching.
          }
        })(),
      );

      return response;
    })(),
  );
});
