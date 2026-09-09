"use client";

import { useEffect, useState } from "react";
import { HardDrive, WifiOff } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { countAll } from "@/lib/offline/db";
import { useOnlineStatus } from "@/lib/offline/use-online-status";

/**
 * What curriculum data is on the tablet, read from IndexedDB.
 *
 * The card above this one is rendered on the server. Offline, a teacher is
 * looking at whatever the service worker cached the last time this page loaded
 * with a connection — accurate when it was taken, but not a live count. This
 * card is the one that is true right now, and says which is which.
 */
export function StoredCurriculum() {
  const { isOnline, hasChecked } = useOnlineStatus();
  const [stored, setStored] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const counts = await countAll();
        if (!cancelled) setStored(counts.curriculum);
      } catch {
        // Storage blocked or unavailable: leave it null rather than reporting
        // a zero that would read as "the catalogue is empty".
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const offline = hasChecked && !isOnline;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="size-4" aria-hidden />
          On this tablet
        </CardTitle>
        <CardDescription>
          Read from this device, so it is accurate with or without a connection.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {stored === null ? (
          <p className="text-muted-foreground">
            Reading on-device storage…
          </p>
        ) : (
          <p>
            <span className="text-2xl font-semibold tabular-nums">{stored}</span>{" "}
            verified learning outcome(s) downloaded here.{" "}
            {stored === 0
              ? "Only outcomes with a real citation are ever downloaded, and none is loaded on the server."
              : "These are readable offline from Saved content."}
          </p>
        )}

        {offline ? (
          <p className="flex items-start gap-2 text-warning-foreground">
            <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden />
            You are offline. The figures above this card were saved the last time
            this page loaded with a connection; the count here is from the tablet
            itself.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
