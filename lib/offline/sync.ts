"use client";

import {
  LAST_SYNC_KEY,
  getAll,
  put,
  replaceAll,
  setPreference,
  type OfflineAudio,
  type OfflineFlashcard,
} from "@/lib/offline/db";

export type SyncResult = {
  ok: boolean;
  counts: Record<string, number>;
  syncedAt: string | null;
  error: string | null;
};

type BundleResponse =
  | {
      success: true;
      generatedAt: string;
      lessons: unknown[];
      translations: unknown[];
      worksheets: unknown[];
      flashcards: unknown[];
      assessments: unknown[];
      glossary: unknown[];
    }
  | { success: false; error: { code: string; message: string } };

/**
 * Downloads everything this teacher can use offline and writes it to the device.
 *
 * A whole-store replace rather than a merge: the server is the source of truth
 * for this content, nothing is edited on the device yet, and a merge would
 * leave deleted material sitting on tablets indefinitely.
 */
export async function syncNow(): Promise<SyncResult> {
  const empty = { counts: {}, syncedAt: null };

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return {
      ok: false,
      ...empty,
      error: "You are offline. Connect to the internet to download content.",
    };
  }

  let payload: BundleResponse;
  try {
    const response = await fetch("/api/offline/bundle", { cache: "no-store" });
    payload = (await response.json()) as BundleResponse;
  } catch {
    return {
      ok: false,
      ...empty,
      error: "Could not reach the server. Check the connection and try again.",
    };
  }

  if (!payload.success) {
    return { ok: false, ...empty, error: payload.error.message };
  }

  try {
    const counts: Record<string, number> = {};
    counts.lessons = await replaceAll("lessons", payload.lessons as never[]);
    counts.translations = await replaceAll(
      "translations",
      payload.translations as never[],
    );
    counts.worksheets = await replaceAll(
      "worksheets",
      payload.worksheets as never[],
    );
    counts.flashcards = await replaceAll(
      "flashcards",
      payload.flashcards as never[],
    );
    counts.assessments = await replaceAll(
      "assessments",
      payload.assessments as never[],
    );
    counts.glossary = await replaceAll("glossary", payload.glossary as never[]);

    const syncedAt = payload.generatedAt;
    await setPreference(LAST_SYNC_KEY, syncedAt);

    return { ok: true, counts, syncedAt, error: null };
  } catch {
    return {
      ok: false,
      ...empty,
      error:
        "Content downloaded but could not be saved on this device. Storage may be full or blocked.",
    };
  }
}

export type AudioCacheResult = {
  cached: number;
  skipped: number;
  failed: number;
  error: string | null;
};

/**
 * Generates and stores spoken audio for flashcards, so it plays with no network.
 *
 * This is the one place offline audio genuinely comes from: the clip is
 * synthesised while online and the *bytes* are kept. It speaks the language of
 * instruction only — there is no mother-tongue voice, and reading Ol Chiki
 * aloud in a Hindi voice would be confident audio that is not Santhali.
 *
 * Sequential on purpose: a burst of synthesis requests from one tablet is the
 * fastest way to hit the provider's rate limit.
 */
export async function cacheFlashcardAudio(
  languageCode: string,
  onProgress?: (done: number, total: number) => void,
): Promise<AudioCacheResult> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return {
      cached: 0,
      skipped: 0,
      failed: 0,
      error: "You are offline. Audio has to be generated while connected.",
    };
  }

  const cards = (await getAll("flashcards")) as OfflineFlashcard[];
  const existing = new Set(
    ((await getAll("audio")) as OfflineAudio[]).map((clip) => clip.ownerKey),
  );

  const pending = cards.filter(
    (card) =>
      !existing.has(`flashcard:${card.id}`) &&
      (card.exampleSentence?.trim() || card.frontText.trim()),
  );

  let cached = 0;
  let failed = 0;
  const skipped = cards.length - pending.length;

  for (const [index, card] of pending.entries()) {
    const text = card.exampleSentence?.trim() || card.frontText.trim();

    try {
      const response = await fetch("/api/speech/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, languageCode }),
      });
      const payload = (await response.json()) as
        | { success: true; audioUrl: string }
        | { success: false; error: { code: string; message: string } };

      if (!payload.success) {
        failed += 1;
        // A language with no voice fails identically for every card, so stop
        // rather than making the same doomed request a hundred times.
        if (payload.error.code === "TTS_LANGUAGE_UNSUPPORTED") {
          return {
            cached,
            skipped,
            failed: pending.length - cached,
            error: payload.error.message,
          };
        }
        continue;
      }

      const blob = await (await fetch(payload.audioUrl)).blob();
      await put("audio", {
        id: `flashcard:${card.id}`,
        ownerKey: `flashcard:${card.id}`,
        languageCode,
        transcript: text,
        mimeType: blob.type || "audio/wav",
        blob,
        sizeBytes: blob.size,
        cachedAt: new Date().toISOString(),
      });
      cached += 1;
    } catch {
      failed += 1;
    }

    onProgress?.(index + 1, pending.length);
  }

  return { cached, skipped, failed, error: null };
}

/** Plays a cached clip. Returns false when nothing is stored for that owner. */
export async function playCachedAudio(ownerKey: string): Promise<boolean> {
  const clips = (await getAll("audio")) as OfflineAudio[];
  const clip = clips.find((entry) => entry.ownerKey === ownerKey);
  if (!clip) return false;

  const url = URL.createObjectURL(clip.blob);
  const audio = new Audio(url);
  // Revoke once played, so a long session does not leak object URLs.
  audio.addEventListener("ended", () => URL.revokeObjectURL(url), { once: true });
  await audio.play();
  return true;
}
