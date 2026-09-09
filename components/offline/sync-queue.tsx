"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  CloudUpload,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listOutbox, pruneSynced, type OutboxItem } from "@/lib/offline/db";
import { pushOutbox, resolveConflict } from "@/lib/offline/outbox";
import { useOnlineStatus } from "@/lib/offline/use-online-status";
import { cn } from "@/lib/utils";

/**
 * The upload half of sync: what this tablet has changed and not yet sent.
 *
 * Content download is the easy direction — the server is the source of truth
 * and a re-download costs nothing. This direction holds the only data in the
 * app that exists nowhere else, so it is the one that has to say plainly what
 * is waiting, what failed, and what clashed with somebody else's work.
 */
export function SyncQueue({ onSynced }: { onSynced?: () => void }) {
  const { isOnline, hasChecked } = useOnlineStatus();
  const [items, setItems] = useState<OutboxItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setItems(await listOutbox());
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await listOutbox();
        if (!cancelled) setItems(rows);
      } catch {
        if (!cancelled) setItems([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const send = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);

    const result = await pushOutbox();

    if (result.error) setError(result.error);
    else if (result.sent === 0) setMessage("Nothing is waiting to upload.");
    else {
      const parts = [`${result.synced} change(s) saved to the server`];
      if (result.conflicts > 0) parts.push(`${result.conflicts} need a decision`);
      if (result.failed > 0) parts.push(`${result.failed} failed`);
      setMessage(`${parts.join(", ")}.`);
      if (result.synced > 0) onSynced?.();
    }

    await refresh();
    setBusy(false);
  };

  const decide = async (id: string, choice: "mine" | "theirs") => {
    setBusy(true);
    await resolveConflict(id, choice);
    await refresh();
    setBusy(false);

    if (choice === "mine") {
      setMessage("Kept your version. Press Upload changes to send it.");
    } else {
      setMessage("Kept the server's version. Your change was discarded.");
    }
  };

  const clearDone = async () => {
    const removed = await pruneSynced();
    await refresh();
    setMessage(removed > 0 ? `Cleared ${removed} completed item(s).` : null);
  };

  const offline = hasChecked && !isOnline;
  const pending = (items ?? []).filter(
    (item) => item.status === "PENDING" || item.status === "SYNCING",
  );
  const conflicts = (items ?? []).filter((item) => item.status === "CONFLICT");
  const failed = (items ?? []).filter((item) => item.status === "FAILED");
  const synced = (items ?? []).filter((item) => item.status === "SYNCED");

  return (
    <Card
      className={cn(
        "mb-6",
        conflicts.length > 0 && "border-warning/50",
        failed.length > 0 && conflicts.length === 0 && "border-destructive/40",
      )}
    >
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <CloudUpload className="size-4" aria-hidden />
          Changes made on this tablet
          {pending.length > 0 ? (
            <Badge variant="warning">{pending.length} waiting</Badge>
          ) : null}
          {conflicts.length > 0 ? (
            <Badge variant="warning">{conflicts.length} to review</Badge>
          ) : null}
        </CardTitle>
        <CardDescription>
          Corrections you type without a connection are stored here and sent when
          the internet comes back. Nothing is lost by closing the app.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {items === null ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Reading the queue from this device…
          </p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing is waiting to upload. Corrections you make offline will appear
            here.
          </p>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </p>
        ) : null}

        {message ? (
          <p className="rounded-lg border border-success/40 bg-success/10 p-3 text-sm text-success">
            {message}
          </p>
        ) : null}

        {/* Conflicts first: they are the only thing here that needs a person. */}
        {conflicts.map((item) => (
          <div
            key={item.id}
            className="rounded-lg border border-warning/50 bg-warning/10 p-4"
          >
            <p className="flex items-start gap-2 text-sm font-semibold text-warning-foreground">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              This translation was changed somewhere else after you edited it
            </p>
            <p className="mt-1 text-sm text-warning-foreground">
              Nothing has been overwritten. Choose which version to keep.
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-border bg-card p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Your version, typed on this tablet
                </p>
                <p className="mt-1 text-sm">{item.payload.correctedText}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {new Date(item.createdAt).toLocaleString("en-IN")}
                </p>
              </div>
              <div className="rounded-md border border-border bg-card p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  The version now on the server
                </p>
                <p className="mt-1 text-sm">{item.conflict?.serverText}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {item.conflict?.serverUpdatedAt
                    ? new Date(item.conflict.serverUpdatedAt).toLocaleString("en-IN")
                    : "unknown time"}
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => decide(item.id, "mine")} disabled={busy}>
                Keep mine
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => decide(item.id, "theirs")}
                disabled={busy}
              >
                Keep the server&apos;s
              </Button>
            </div>
          </div>
        ))}

        {/* Waiting and failed */}
        {[...pending, ...failed].length > 0 ? (
          <ul className="divide-y divide-border">
            {[...pending, ...failed].map((item) => (
              <li key={item.id} className="flex flex-wrap items-start gap-3 py-3">
                <Badge
                  variant={item.status === "FAILED" ? "destructive" : "outline"}
                >
                  {item.status === "SYNCING" ? "Sending" : item.status === "FAILED" ? "Failed" : "Waiting"}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{item.payload.correctedText}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Correction · edited{" "}
                    {new Date(item.createdAt).toLocaleString("en-IN")}
                    {item.force ? " · you chose to keep this over the server's" : ""}
                  </p>
                  {item.lastError ? (
                    <p className="mt-0.5 text-xs text-destructive">{item.lastError}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        {synced.length > 0 ? (
          <div className="rounded-lg border border-success/40 bg-success/10 p-3">
            <p className="flex items-center gap-2 text-sm text-success">
              <Check className="size-4 shrink-0" aria-hidden />
              {synced.length} change(s) successfully synced
            </p>
            <ul className="mt-2 space-y-1 text-xs text-success">
              {synced.slice(0, 5).map((item) => (
                <li key={item.id} className="truncate">
                  {item.payload.correctedText}
                  {item.syncedAt
                    ? ` — ${new Date(item.syncedAt).toLocaleString("en-IN")}`
                    : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <Button onClick={send} disabled={busy || offline || pending.length === 0}>
            {busy ? (
              <>
                <Loader2 className="animate-spin" aria-hidden />
                Uploading…
              </>
            ) : (
              <>
                <RefreshCw aria-hidden />
                Upload changes
              </>
            )}
          </Button>

          {synced.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={clearDone} disabled={busy}>
              <Trash2 aria-hidden />
              Clear completed
            </Button>
          ) : null}

          {offline ? (
            <p className="text-xs text-muted-foreground">
              Uploading needs a connection. These changes are safe on the tablet
              until then.
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
