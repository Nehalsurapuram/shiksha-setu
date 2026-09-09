"use client";

import Link from "next/link";
import { WifiOff } from "lucide-react";

import { useOnlineStatus } from "@/lib/offline/use-online-status";

/**
 * Shown on a feature that cannot work without a network.
 *
 * Renders nothing while online, so it costs a connected teacher nothing. When
 * the connection drops it says plainly which part is unavailable and what is
 * still readable, rather than letting a teacher press Translate in front of a
 * class and watch it fail.
 *
 * This is the counterpart to the offline cache: caching makes *saved* content
 * readable, and no amount of it makes a cloud model reachable.
 */
export function RequiresConnection({
  feature,
  stillAvailable,
}: {
  /** What is unavailable, e.g. "Translating new text". */
  feature: string;
  /** What the teacher can still do, phrased for this screen. */
  stillAvailable: string;
}) {
  const { isOnline, hasChecked } = useOnlineStatus();

  if (!hasChecked || isOnline) return null;

  return (
    <div
      role="status"
      className="mb-6 flex items-start gap-3 rounded-lg border border-warning/50 bg-warning/10 p-4"
    >
      <WifiOff
        className="mt-0.5 size-5 shrink-0 text-warning-foreground"
        aria-hidden
      />
      <div className="text-sm text-warning-foreground">
        <p className="font-semibold">
          You are offline — {feature} needs an internet connection.
        </p>
        <p className="mt-1">
          {stillAvailable} Everything you have already downloaded is listed on{" "}
          <Link href="/offline" className="underline underline-offset-2">
            Offline &amp; Sync
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
