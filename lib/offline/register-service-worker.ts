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

  const register = () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("Service worker registration failed", error);
    });
  };

  // `load` has usually already fired by the time React hydrates and calls this,
  // and a listener added after an event has fired never runs — so waiting for
  // it unconditionally meant the worker was never registered at all, and
  // nothing was ever cached for offline use.
  if (document.readyState === "complete") {
    register();
  } else {
    window.addEventListener("load", register, { once: true });
  }
}
