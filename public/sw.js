/*
 * ShikshaSetu AI service worker.
 *
 * What this does: keeps the application shell and the offline-capable routes
 * openable with no network, so a teacher can reach their downloaded content.
 *
 * What it does NOT do, by design:
 *  - Cache any API response. Translation, speech and generation are cloud
 *    calls. Serving a stale one offline would present old output as if it were
 *    a fresh answer, and there is no honest way to do that. They fail cleanly
 *    instead, and the UI explains why.
 *  - Cache anything carrying credentials. Nothing with an Authorization header
 *    or an api key ever reaches the cache.
 *
 * The content itself — lessons, worksheets, flashcards, audio — lives in
 * IndexedDB, not here. This worker only makes the pages that read it reachable.
 */

const VERSION = "v2";
const SHELL_CACHE = `shikshasetu-shell-${VERSION}`;
const ASSET_CACHE = `shikshasetu-assets-${VERSION}`;
const OFFLINE_URL = "/offline.html";

/**
 * Routes that work with no network because they read from IndexedDB.
 *
 * Deliberately excluded: /translator, /voice-assistant, /classroom and the
 * generators. Those need a cloud model; caching their shells would let a
 * teacher open a translator that cannot translate.
 */
const OFFLINE_ROUTES = [
  "/dashboard",
  "/offline-sync",
  "/lessons",
  "/worksheets",
  "/flashcards",
  "/assessments",
  "/curriculum",
  "/settings",
];

const PRECACHE = [
  OFFLINE_URL,
  "/icons/icon.svg",
  "/icons/icon-maskable.svg",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // Individually, so one missing asset cannot fail the whole install.
      .then((cache) =>
        Promise.all(
          [...PRECACHE, ...OFFLINE_ROUTES].map((url) =>
            cache.add(url).catch(() => undefined),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== ASSET_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();

  // Lets the Offline & Sync screen empty the HTTP caches. IndexedDB content is
  // cleared separately by the page itself.
  if (event.data === "clear-caches") {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))),
    );
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache an API response — see the header comment. A stale translation
  // served offline would be indistinguishable from a fresh one.
  if (url.pathname.startsWith("/api/")) return;

  // Never cache a request carrying credentials.
  if (request.headers.has("authorization")) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request, url));
    return;
  }

  // Build output is content-hashed, so cache-first is safe.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/favicon.ico"
  ) {
    event.respondWith(cacheFirst(request));
  }
});

/**
 * Network-first for pages, falling back to the cached shell.
 *
 * Network-first rather than cache-first because a teacher who *is* online
 * should see current content; the cache is the safety net, not the default.
 */
async function handleNavigation(request, url) {
  try {
    const response = await fetch(request);

    if (response.ok && isOfflineRoute(url.pathname)) {
      const copy = response.clone();
      caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
    }

    return response;
  } catch {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;

    const offlinePage = await caches.match(OFFLINE_URL);
    if (offlinePage) return offlinePage;

    return new Response("Offline", {
      status: 503,
      headers: { "Content-Type": "text/plain" },
    });
  }
}

function isOfflineRoute(pathname) {
  return OFFLINE_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const copy = response.clone();
      caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy));
    }
    return response;
  } catch {
    return new Response("", { status: 504 });
  }
}
