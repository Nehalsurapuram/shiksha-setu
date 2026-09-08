"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  CloudDownload,
  Loader2,
  Trash2,
  Volume2,
  X,
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
import {
  LAST_SYNC_KEY,
  audioBytes,
  clearContent,
  countAll,
  getPreference,
  type StoreName,
} from "@/lib/offline/db";
import { cacheFlashcardAudio, syncNow } from "@/lib/offline/sync";
import { useOnlineStatus } from "@/lib/offline/use-online-status";
import { cn } from "@/lib/utils";

type Counts = Record<StoreName, number>;

const AVAILABLE_OFFLINE: Array<{ store: StoreName; label: string }> = [
  { store: "lessons", label: "Saved lessons" },
  { store: "translations", label: "Saved translations" },
  { store: "worksheets", label: "Worksheets" },
  { store: "flashcards", label: "Flashcards" },
  { store: "assessments", label: "Assessments" },
  { store: "audio", label: "Cached audio" },
  { store: "glossary", label: "Glossary" },
];

/**
 * Everything the teacher can do about offline content, on one screen.
 *
 * The availability list is counted from IndexedDB rather than assumed, so a
 * tick means the content is genuinely on this device. A zero reads as zero.
 */
export function OfflineManager({
  sourceLanguage,
  curriculumVerifiedCount,
}: {
  sourceLanguage: { code: string; name: string };
  curriculumVerifiedCount: number;
}) {
  const { isOnline, hasChecked } = useOnlineStatus();

  const [counts, setCounts] = useState<Counts | null>(null);
  const [bytes, setBytes] = useState(0);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "sync" | "audio" | "clear">(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [storageBlocked, setStorageBlocked] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [next, size, synced] = await Promise.all([
        countAll(),
        audioBytes(),
        getPreference<string>(LAST_SYNC_KEY),
      ]);
      setCounts(next);
      setBytes(size);
      setLastSynced(synced);
    } catch {
      setStorageBlocked(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const download = async () => {
    setBusy("sync");
    setError(null);
    setMessage(null);

    const result = await syncNow();
    if (!result.ok) setError(result.error);
    else {
      const total = Object.values(result.counts).reduce((a, b) => a + b, 0);
      setMessage(`Downloaded ${total} items to this device.`);
    }

    await refresh();
    setBusy(null);
  };

  const downloadAudio = async () => {
    setBusy("audio");
    setError(null);
    setMessage(null);
    setProgress({ done: 0, total: 0 });

    const result = await cacheFlashcardAudio(sourceLanguage.code, (done, total) =>
      setProgress({ done, total }),
    );

    if (result.error) setError(result.error);
    else {
      setMessage(
        `Cached ${result.cached} clip(s). ${result.skipped} already stored${
          result.failed ? `, ${result.failed} failed` : ""
        }.`,
      );
    }

    setProgress(null);
    await refresh();
    setBusy(null);
  };

  const clear = async () => {
    setBusy("clear");
    setError(null);
    setMessage(null);

    try {
      await clearContent();
      // The HTTP caches belong to the service worker, so it clears those.
      navigator.serviceWorker?.controller?.postMessage("clear-caches");
      setMessage("Downloaded content removed from this device.");
    } catch {
      setError("Could not clear the stored content.");
    }

    await refresh();
    setBusy(null);
  };

  const offline = hasChecked && !isOnline;
  const totalItems = counts
    ? AVAILABLE_OFFLINE.reduce((sum, row) => sum + (counts[row.store] ?? 0), 0)
    : 0;

  return (
    <div className="space-y-6">
      {/* Status */}
      <Card className={offline ? "border-warning/50 bg-warning/10" : undefined}>
        <CardContent className="flex flex-wrap items-center gap-3 p-4 sm:p-5">
          <Badge variant={offline ? "warning" : "success"}>
            {!hasChecked ? "Checking…" : offline ? "Offline" : "Online"}
          </Badge>
          <p className="min-w-0 flex-1 text-sm">
            {offline
              ? "No internet connection. Downloaded content below still opens."
              : "Connected. Download content now so it is there when the network is not."}
          </p>
          <p className="text-xs text-muted-foreground">
            {lastSynced
              ? `Last downloaded ${new Date(lastSynced).toLocaleString("en-IN")}`
              : "Never downloaded"}
          </p>
        </CardContent>
      </Card>

      {storageBlocked ? (
        <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          This browser is blocking on-device storage, so nothing can be saved
          for offline use. Check that site data is allowed and that you are not
          in a private window.
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

      {/* What works offline */}
      <Card>
        <CardHeader>
          <CardTitle>Available offline</CardTitle>
          <CardDescription>
            Counted from this device, not from the server. A tick means it is
            actually stored here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {AVAILABLE_OFFLINE.map((row) => {
              const count = counts?.[row.store] ?? 0;
              const has = count > 0;
              return (
                <li
                  key={row.store}
                  className="flex items-center gap-3 py-2.5 text-sm"
                >
                  {has ? (
                    <Check className="size-4 shrink-0 text-success" aria-hidden />
                  ) : (
                    <X className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                  <span className={cn("flex-1", !has && "text-muted-foreground")}>
                    {row.label}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {count}
                  </span>
                </li>
              );
            })}
            <li className="flex items-center gap-3 py-2.5 text-sm">
              {curriculumVerifiedCount > 0 ? (
                <Check className="size-4 shrink-0 text-success" aria-hidden />
              ) : (
                <X className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <span
                className={cn(
                  "flex-1",
                  curriculumVerifiedCount === 0 && "text-muted-foreground",
                )}
              >
                Curriculum{" "}
                {curriculumVerifiedCount === 0 ? (
                  <span className="text-xs">
                    — no verified outcomes are loaded on the server yet
                  </span>
                ) : null}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {curriculumVerifiedCount}
              </span>
            </li>
          </ul>

          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <Button onClick={download} disabled={busy !== null || offline}>
              {busy === "sync" ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden />
                  Downloading…
                </>
              ) : (
                <>
                  <CloudDownload aria-hidden />
                  Download for offline
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={downloadAudio}
              disabled={busy !== null || offline || (counts?.flashcards ?? 0) === 0}
              title={
                (counts?.flashcards ?? 0) === 0
                  ? "Download flashcards first"
                  : undefined
              }
            >
              {busy === "audio" ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden />
                  {progress
                    ? `Generating ${progress.done}/${progress.total}…`
                    : "Generating…"}
                </>
              ) : (
                <>
                  <Volume2 aria-hidden />
                  Cache {sourceLanguage.name} audio
                </>
              )}
            </Button>
            {offline ? (
              <p className="text-xs text-muted-foreground">
                Downloading needs a connection.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* What does not work offline — stated plainly, not discovered mid-lesson */}
      <Card className="border-warning/40 bg-warning/5">
        <CardHeader>
          <CardTitle>What does not work offline</CardTitle>
          <CardDescription className="text-warning-foreground">
            These need a live connection to an AI service. Nothing on this
            device can produce new AI output, and caching cannot change that.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">
                New translations
              </span>{" "}
              — translations you have already made are stored and readable
              offline; translating new text is a cloud call.
            </li>
            <li>
              <span className="font-medium text-foreground">
                Voice assistant and the classroom
              </span>{" "}
              — speech recognition and speech synthesis both run on a server.
            </li>
            <li>
              <span className="font-medium text-foreground">
                Generating lessons, worksheets, flashcards and assessments
              </span>{" "}
              — generation runs on a language model in the cloud. Material you
              have already generated and saved opens offline.
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Cache management */}
      <Card>
        <CardHeader>
          <CardTitle>Storage on this device</CardTitle>
          <CardDescription>
            {totalItems} item(s) stored{bytes > 0 ? `, including ${formatBytes(bytes)} of audio` : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={clear} disabled={busy !== null}>
            {busy === "clear" ? (
              <>
                <Loader2 className="animate-spin" aria-hidden />
                Clearing…
              </>
            ) : (
              <>
                <Trash2 aria-hidden />
                Clear downloaded content
              </>
            )}
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Removes downloaded content and cached pages from this tablet.
            Nothing on the server is deleted, and you can download again.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
