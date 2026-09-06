"use client";

import { Wifi, WifiOff } from "lucide-react";

import { useOnlineStatus } from "@/lib/offline/use-online-status";
import { cn } from "@/lib/utils";

/**
 * Connectivity is the single most important piece of status in a rural
 * classroom, so it lives in the header on every screen rather than being
 * buried in Offline & Sync.
 */
export function OnlineStatus({ className }: { className?: string }) {
  const { isOnline, hasChecked } = useOnlineStatus();

  // Before the first client-side check, render the neutral online state so the
  // server and client markup agree.
  const offline = hasChecked && !isOnline;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        offline
          ? "border-warning bg-warning/15 text-warning-foreground"
          : "border-border text-muted-foreground",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {offline ? (
        <WifiOff className="size-3.5" aria-hidden />
      ) : (
        <Wifi className="size-3.5" aria-hidden />
      )}
      {offline ? "Offline" : "Online"}
    </span>
  );
}
