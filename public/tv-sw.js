/*
 * Steward Display - the TV's service worker. Scope: /tv only.
 *
 * Lets a paired TV that reboots with no network still load its page; the page
 * then draws the last screen it saved in local storage. The admin is never
 * controlled by this worker.
 *
 * - The /tv page: network first, cached copy when offline.
 * - Built assets (/assets/*, hashed) and brand files: cache first.
 * - Images in screens (any origin): cache first, so a slideshow survives an outage.
 * - /api/*: never cached here. The player keeps its own copy of the screen.
 */
const CACHE = "steward-tv-v1";
const MAX_IMAGES = 150;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith("steward-tv-") && key !== CACHE) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request, { trim } = {}) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || response.type === "opaque") {
    await cache.put(request, response.clone());
    if (trim) await trimImages(cache);
  }
  return response;
}

async function trimImages(cache) {
  const keys = (await cache.keys()).filter(
    (r) => r.destination === "image" || /\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/i.test(r.url),
  );
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_IMAGES))) await cache.delete(key);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  if (sameOrigin && url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate" && sameOrigin && url.pathname === "/tv") {
    event.respondWith(networkFirst(request));
    return;
  }
  if (sameOrigin && (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/brand/"))) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (request.destination === "image") {
    event.respondWith(cacheFirst(request, { trim: true }));
  }
});
