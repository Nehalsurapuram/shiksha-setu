"use client";

import { useSyncExternalStore } from "react";

import { getDeviceId } from "@/lib/offline/device";

/** The id is persisted in localStorage, so it never changes within a session. */
const subscribe = () => () => {};

const getServerSnapshot = () => null;

/**
 * This tablet's stable device id, or null on the server and in browsers where
 * site data is blocked.
 */
export function useDeviceId(): string | null {
  return useSyncExternalStore(subscribe, getDeviceId, getServerSnapshot);
}
