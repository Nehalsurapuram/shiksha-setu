"use client";

import { useSyncExternalStore } from "react";

/** A store that never changes: the snapshot alone tells us where we are. */
const subscribe = () => () => {};

/**
 * False during server render and the hydration pass, true afterwards.
 *
 * Anything that reads browser-only state (connectivity, localStorage) needs
 * this so the first client render matches the server's, without the cascading
 * re-render that a `setState` in an effect would cause.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
