"use client";

/**
 * Registers the service worker.
 *
 * It caches the application shell and the routes that read from IndexedDB, so
 * a teacher can reach their downloaded content with no network. It caches no
 * API response: translation, speech and generation are cloud calls, and a
 * stale one served offline would look like a fresh answer.
 *
 * Development is deliberately excluded. A service worker serving cached pages
 * over a hot-reloading dev server produces stale-code bugs that look like
 * application bugs. Test offline behaviour against `next build && next start`.
 */
export function registerServiceWorker(): void {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  if (process.env.NODE_ENV !== "production") return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("Service worker registration failed", error);
    });
  });
}
