"use client";

import { useSyncExternalStore } from "react";

import { useHydrated } from "@/lib/offline/use-hydrated";

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);
  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

const getSnapshot = () => navigator.onLine;

// The server has no opinion on this tablet's connectivity, so it renders the
// optimistic value and the client corrects it on hydration.
const getServerSnapshot = () => true;

/**
 * Tracks browser connectivity by subscribing to the platform's own events
 * rather than mirroring them into React state.
 *
 * `hasChecked` is false until hydration finishes; until then `isOnline` is the
 * optimistic default, not a real reading.
 */
export function useOnlineStatus(): { isOnline: boolean; hasChecked: boolean } {
  const isOnline = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  return { isOnline, hasChecked: useHydrated() };
}
