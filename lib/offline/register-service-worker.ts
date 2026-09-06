"use client";

/**
 * Registers the app-shell service worker. Phase 1 caches the shell only, so the
 * app opens without a network; it does not yet cache lessons, audio, or any API
 * response. Real offline content sync lands with the Offline & Sync feature.
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
