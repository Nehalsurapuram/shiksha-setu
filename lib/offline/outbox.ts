"use client";

import {
  enqueue,
  get,
  isSendable,
  listOutbox,
  put,
  removeOutboxItem,
  updateOutboxItem,
  type OfflineTranslation,
  type OutboxItem,
} from "@/lib/offline/db";
import { getDeviceId } from "@/lib/offline/device";

export type PushResult = {
  sent: number;
  synced: number;
  conflicts: number;
  failed: number;
  error: string | null;
};

type ServerResult = {
  id: string;
  status: "SYNCED" | "CONFLICT" | "FAILED";
  message?: string;
  server?: { text: string; updatedAt: string };
  applied?: { updatedAt: string; correctedText: string };
};

/**
 * Queues a correction typed on this tablet.
 *
 * The correction is written into the local translation immediately, so the
 * teacher sees their own text where they typed it whether or not a network
 * ever appears. The queue entry is what eventually carries it to the server.
 */
export async function queueCorrection(options: {
  translationId: string;
  correctedText: string;
  reason: string | null;
}): Promise<OutboxItem | { error: string }> {
  const translation = (await get("translations", options.translationId)) as
    | OfflineTranslation
    | undefined;

  if (!translation) {
    return { error: "That translation is not saved on this device." };
  }

  const current = translation.correctedText ?? translation.targetText;
  if (current.trim() === options.correctedText.trim()) {
    return { error: "The text is unchanged, so there is nothing to correct." };
  }

  const item = await enqueue({
    entityType: "TranslationCorrection",
    entityId: options.translationId,
    // A correction is a new row on the server, never an edit of the model's
    // output — the original is what makes the correction worth collecting.
    operation: "CREATE",
    payload: { correctedText: options.correctedText, reason: options.reason },
    baseUpdatedAt: translation.updatedAt,
    baseText: current,
    createdAt: new Date().toISOString(),
  });

  await put("translations", {
    ...translation,
    correctedText: options.correctedText,
    reviewStatus: "CORRECTED",
  });

  return item;
}

/**
 * Sends everything queued, one request, and records what came back per item.
 *
 * Conflicts are not errors and are not retried: they are a question for the
 * teacher, so the item stays in the queue carrying the server's version until
 * they answer it.
 */
export async function pushOutbox(): Promise<PushResult> {
  const empty = { sent: 0, synced: 0, conflicts: 0, failed: 0 };

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { ...empty, error: "You are offline. Changes stay queued on this tablet." };
  }

  const deviceId = getDeviceId();
  if (!deviceId) {
    return {
      ...empty,
      error:
        "This browser is blocking site data, so changes cannot be queued or sent from this device.",
    };
  }

  const queued = (await listOutbox()).filter(isSendable);
  if (queued.length === 0) return { ...empty, error: null };

  await Promise.all(
    queued.map((item) => updateOutboxItem(item.id, { status: "SYNCING" })),
  );

  let payload: { success: boolean; results?: ServerResult[] };
  try {
    const response = await fetch("/api/sync/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId,
        items: queued.map((item) => ({
          id: item.id,
          entityType: item.entityType,
          entityId: item.entityId,
          operation: item.operation,
          payload: item.payload,
          baseUpdatedAt: item.baseUpdatedAt,
          createdAt: item.createdAt,
          force: item.force || undefined,
        })),
      }),
    });
    payload = (await response.json()) as { success: boolean; results?: ServerResult[] };
  } catch {
    // The send failed as a whole: put every item back rather than leaving the
    // queue stuck in SYNCING, which would never be retried.
    await Promise.all(
      queued.map((item) =>
        updateOutboxItem(item.id, {
          status: "PENDING",
          lastError: "Could not reach the server.",
        }),
      ),
    );
    return { ...empty, error: "Could not reach the server. Changes stay queued." };
  }

  if (!payload.success || !payload.results) {
    await Promise.all(
      queued.map((item) => updateOutboxItem(item.id, { status: "PENDING" })),
    );
    return { ...empty, error: "The server rejected the sync. Changes stay queued." };
  }

  let synced = 0;
  let conflicts = 0;
  let failed = 0;

  for (const result of payload.results) {
    const item = queued.find((candidate) => candidate.id === result.id);
    if (!item) continue;

    if (result.status === "SYNCED") {
      synced += 1;
      await updateOutboxItem(item.id, {
        status: "SYNCED",
        syncedAt: new Date().toISOString(),
        lastError: null,
        force: false,
        conflict: null,
      });

      // Move this device's base forward, so a later edit of the same row is
      // measured against what the server now holds rather than clashing with
      // this tablet's own accepted change.
      if (result.applied) {
        const translation = (await get("translations", item.entityId)) as
          | OfflineTranslation
          | undefined;
        if (translation) {
          await put("translations", {
            ...translation,
            correctedText: result.applied.correctedText,
            reviewStatus: "CORRECTED",
            updatedAt: result.applied.updatedAt,
          });
        }
      }
    } else if (result.status === "CONFLICT") {
      conflicts += 1;
      await updateOutboxItem(item.id, {
        status: "CONFLICT",
        attempts: item.attempts + 1,
        lastError: null,
        conflict: {
          serverText: result.server?.text ?? "",
          serverUpdatedAt: result.server?.updatedAt ?? "",
          message: result.message ?? "This row changed on the server.",
        },
      });
    } else {
      failed += 1;
      await updateOutboxItem(item.id, {
        status: "FAILED",
        attempts: item.attempts + 1,
        lastError: result.message ?? "The server could not apply this change.",
      });
    }
  }

  return { sent: queued.length, synced, conflicts, failed, error: null };
}

/**
 * Applies the teacher's answer to a conflict.
 *
 * "mine" marks the item to be sent again with `force`, which is the only way
 * anything overwrites a newer row — and it happens because a person looked at
 * both versions and chose. "theirs" drops the queued change and takes the
 * server's text onto the device.
 */
export async function resolveConflict(
  itemId: string,
  choice: "mine" | "theirs",
): Promise<void> {
  const items = await listOutbox();
  const item = items.find((candidate) => candidate.id === itemId);
  if (!item) return;

  if (choice === "mine") {
    await updateOutboxItem(itemId, {
      // Back into the sendable queue, now carrying the teacher's decision and
      // the base they actually saw when they made it.
      status: "PENDING",
      force: true,
      baseUpdatedAt: item.conflict?.serverUpdatedAt ?? item.baseUpdatedAt,
      lastError: null,
    });
    return;
  }

  const translation = (await get("translations", item.entityId)) as
    | OfflineTranslation
    | undefined;

  if (translation && item.conflict) {
    await put("translations", {
      ...translation,
      correctedText: item.conflict.serverText,
      updatedAt: item.conflict.serverUpdatedAt || translation.updatedAt,
    });
  }

  await removeOutboxItem(itemId);
}
