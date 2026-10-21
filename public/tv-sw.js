/*
 * Steward Display - the TV's service worker.
 *
 * Lets a paired TV that reboots with no network still load its page; the page
 * then draws the last screen it saved in local storage.
 *
 * Registered with scope /tv, which as a prefix also covers /tvs (the admin's
 * TVs page). So every handler below first checks that the request comes from
 * the TV page itself, and leaves everything else to the network untouched.
 *
 * - The /tv page and its built assets are cached on install, so the very first
 *   power cut after pairing is already covered.
 * - The /tv page: network first, cached copy when offline.
 * - Built assets (/assets/*, content-hashed) and brand files: cache first.
 * - Images in screens (any origin): served from cache at once and refreshed in
 *   the background, so a replaced "this-week.jpg" shows up on the next load.
 * - /api/*: never cached here. The player keeps its own copy of the screen.
 */
const CACHE = "steward-tv-v2";
const MAX_IMAGES = 150;
const TV_PATH = "/tv";

/** The page and every same-origin script, style and font it references. */
async function precache() {
  const cache = await caches.open(CACHE);
  const response = await fetch(TV_PATH, { cache: "no-store" });
  if (!response.ok) return;
  const html = await response.clone().text();
  await cache.put(TV_PATH, response);
  const assets = new Set(
    [...html.matchAll(/(?:src|href)="(\/(?:assets|brand)\/[^"]+)"/g)].map((m) => m[1]),
  );
  await Promise.all(
    [...assets].map((url) =>
      cache.add(url).catch(() => {
        // One missing asset should not stop the rest being cached.
      }),
    ),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    precache()
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

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

/** Storage is best-effort: a full cache must never stop a response reaching the TV. */
async function tryPut(request, response) {
  try {
    const cache = await caches.open(CACHE);
    await cache.put(request, response);
  } catch {
    // Quota or an uncacheable response: serve it, just don't keep it.
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) await tryPut(TV_PATH, response.clone());
    return response;
  } catch (error) {
    const cached = await caches.match(TV_PATH);
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await tryPut(request, response.clone());
  return response;
}

async function staleWhileRevalidate(event) {
  const { request } = event;
  const cached = await caches.match(request);
  const refresh = fetch(request)
    .then(async (response) => {
      if (response.ok || response.type === "opaque") {
        await tryPut(request, response.clone());
        await trimImages();
      }
      return response;
    })
    .catch(() => cached);
  if (cached) {
    event.waitUntil(refresh);
    return cached;
  }
  return refresh;
}

async function trimImages() {
  try {
    const cache = await caches.open(CACHE);
    const keys = (await cache.keys()).filter((r) => {
      const { origin, pathname } = new URL(r.url);
      const builtAsset = origin === self.location.origin && /^\/(assets|brand)\//.test(pathname);
      return !builtAsset && pathname !== TV_PATH;
    });
    for (const key of keys.slice(0, Math.max(0, keys.length - MAX_IMAGES))) await cache.delete(key);
  } catch {
    // Trimming is housekeeping; never let it fail a response.
  }
}

/** Whether this request belongs to the TV page (and not to /tvs or anything else). */
async function fromTvPage(event) {
  if (event.request.mode === "navigate") return new URL(event.request.url).pathname === TV_PATH;
  const client = event.clientId ? await self.clients.get(event.clientId) : null;
  return !!client && new URL(client.url).pathname === TV_PATH;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  const isTvNavigation = request.mode === "navigate" && sameOrigin && url.pathname === TV_PATH;
  const isBuiltAsset = sameOrigin && /^\/(assets|brand)\//.test(url.pathname);
  const isImage = request.destination === "image";
  // Anything else (navigations to /tvs, the API, server functions) never
  // reaches respondWith and goes to the network exactly as without a worker.
  if (!isTvNavigation && !isBuiltAsset && !isImage) return;

  event.respondWith(
    (async () => {
      if (isTvNavigation) return networkFirst(request);
      if (!(await fromTvPage(event))) return fetch(request);
      if (isBuiltAsset) return cacheFirst(request);
      return staleWhileRevalidate(event);
    })(),
  );
});
