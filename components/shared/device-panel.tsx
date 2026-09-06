"use client";

import { useEffect, useState } from "react";

import { StatusRow } from "@/components/shared/status-row";
import { useDeviceId } from "@/lib/offline/use-device-id";
import { useOnlineStatus } from "@/lib/offline/use-online-status";

async function checkServiceWorker(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;
  try {
    return Boolean(await navigator.serviceWorker.getRegistration());
  } catch {
    return false;
  }
}

/**
 * Reports what is true about *this* tablet. All of it is browser state, so it
 * is unavailable during server rendering.
 */
export function DevicePanel() {
  const { isOnline, hasChecked } = useOnlineStatus();
  const deviceId = useDeviceId();
  const [serviceWorkerReady, setServiceWorkerReady] = useState<boolean | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    checkServiceWorker().then((ready) => {
      if (!cancelled) setServiceWorkerReady(ready);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!hasChecked) {
    return (
      <p className="py-3 text-sm text-muted-foreground">
        Reading device status…
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      <StatusRow
        ok={isOnline}
        label={isOnline ? "This tablet is online" : "This tablet is offline"}
        detail={
          isOnline
            ? "Queued changes would upload as soon as sync is built."
            : "The app shell still opens. Anything you change is kept on the device until it reconnects."
        }
      />
      <StatusRow
        ok={Boolean(deviceId)}
        label="Device identity"
        detail={
          deviceId
            ? `This tablet is ${deviceId}. Queued changes will carry this id so two tablets sharing a login never collide.`
            : "Site data is blocked in this browser, so this device cannot queue offline work."
        }
      />
      <StatusRow
        ok={serviceWorkerReady === true}
        label="Offline app shell"
        detail={
          serviceWorkerReady === null
            ? "Checking whether the service worker is registered…"
            : serviceWorkerReady
              ? "The service worker is registered, so the app opens without a network."
              : "Not registered. The service worker only runs in a production build, not in next dev."
        }
      />
    </ul>
  );
}
