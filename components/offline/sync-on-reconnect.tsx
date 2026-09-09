"use client";

import { useEffect, useRef } from "react";

import { countPendingChanges } from "@/lib/offline/db";
import { pushOutbox } from "@/lib/offline/outbox";

/**
 * Sends queued changes as soon as the network comes back.
 *
 * This is the "internet returns" step of the flow, and it has to be automatic:
 * a teacher who corrected a translation in a classroom with no signal will not
 * think to revisit a sync screen once the bus reaches town, and their typing is
 * the one thing in this app that exists nowhere else.
 *
 * Deliberately silent. It uploads work the teacher already chose to make and
 * reports nothing on success; anything needing attention — a conflict, a
 * failure — is waiting on the Sync Center, which reads the same queue.
 */
export function SyncOnReconnect() {
  const running = useRef(false);

  useEffect(() => {
    const drain = async () => {
      // The `online` event can fire more than once as an interface settles,
      // and two overlapping drains would send the same items twice.
      if (running.current) return;
      running.current = true;

      try {
        if ((await countPendingChanges()) > 0) await pushOutbox();
      } catch {
        // Storage blocked, or the server refused. The queue is unchanged and
        // the Sync Center is where this gets reported.
      } finally {
        running.current = false;
      }
    };

    window.addEventListener("online", drain);

    // Also on mount: the tablet may have been closed while offline and
    // reopened with a connection, which fires no event at all.
    if (navigator.onLine) void drain();

    return () => window.removeEventListener("online", drain);
  }, []);

  return null;
}
