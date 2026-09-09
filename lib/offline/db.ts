"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";

/**
 * On-device store for content a teacher has synchronised.
 *
 * What lives here is *content the server already produced* — lessons,
 * approved translations, worksheets, flashcards, assessments, glossary terms,
 * and audio that was generated while online. Nothing here can produce new AI
 * output: translation, speech and generation are cloud calls, and no amount of
 * caching changes that. The UI says so rather than letting a teacher discover
 * it mid-lesson.
 *
 * Nothing secret is ever written here. IndexedDB is readable by anyone with
 * the device, so API keys, tokens and credentials stay on the server.
 */
const DB_NAME = "shikshasetu-offline";
const DB_VERSION = 3;

export type OfflineLesson = {
  id: string;
  title: string;
  grade: number | null;
  subject: string | null;
  topic: string | null;
  sourceText: string;
  translatedText: string | null;
  status: string;
  isSample: boolean;
  sourceLanguage: string;
  targetLanguage: string;
  /** The generated teaching package, when the lesson has one. */
  teachingPackage: unknown | null;
  alignment: unknown | null;
  updatedAt: string;
};

export type OfflineTranslation = {
  id: string;
  sourceText: string;
  targetText: string;
  /** The teacher's correction, when one exists. Shown in preference. */
  correctedText: string | null;
  sourceLanguage: string;
  targetLanguage: string;
  reviewStatus: string;
  updatedAt: string;
};

export type OfflineWorksheet = {
  id: string;
  title: string;
  kind: string;
  grade: number | null;
  subject: string | null;
  topic: string | null;
  difficulty: string | null;
  instructions: string | null;
  content: unknown;
  alignment: unknown | null;
  updatedAt: string;
};

export type OfflineFlashcard = {
  id: string;
  deckId: string | null;
  deckTitle: string | null;
  frontText: string;
  backText: string;
  icon: string | null;
  exampleSentence: string | null;
  grade: number | null;
  subject: string | null;
  updatedAt: string;
};

export type OfflineAssessment = {
  id: string;
  title: string;
  kind: string;
  grade: number | null;
  subject: string | null;
  topic: string | null;
  questions: unknown;
  alignment: unknown | null;
  maxScore: number;
  updatedAt: string;
};

/**
 * A cached audio clip, stored as bytes rather than a URL.
 *
 * A URL is useless offline. The Blob is the only form that actually plays with
 * no network, which is why caching audio means storing the file itself.
 */
export type OfflineAudio = {
  id: string;
  /** What this clip belongs to, e.g. "flashcard:<id>" or "lesson:<id>". */
  ownerKey: string;
  languageCode: string;
  transcript: string | null;
  mimeType: string;
  blob: Blob;
  sizeBytes: number;
  cachedAt: string;
};

/**
 * A learning outcome stored for offline reading.
 *
 * Only rows carrying a `verifiedSource` are ever written here. An unverified
 * row is working data for whoever is building the mapping; putting one on a
 * tablet, where it sits next to verified rows with no server to re-check it
 * against, is how an unsourced outcome starts looking official.
 */
export type OfflineCurriculumOutcome = {
  id: string;
  learningArea: string;
  competency: string;
  outcome: string;
  classLevel: number | null;
  subject: string | null;
  /** Never null in this store — see above. */
  verifiedSource: string;
  code: string | null;
  updatedAt: string;
};

export type OfflineGlossaryTerm = {
  id: string;
  sourceTerm: string;
  targetTerm: string;
  domain: string | null;
  isVerified: boolean;
  updatedAt: string;
};

/** The three operations the queue can carry, mirroring `SyncOperation`. */
export type SyncOperation = "CREATE" | "UPDATE" | "DELETE";

export type SyncItemStatus =
  | "PENDING"
  | "SYNCING"
  | "SYNCED"
  | "FAILED"
  | "CONFLICT";

/**
 * One change made on this tablet, waiting to reach the server.
 *
 * This is the only store holding work that exists **nowhere else**. Everything
 * else in this database is a copy of something the server already has and can
 * be re-downloaded; a queued correction that is dropped is a teacher's typing
 * gone for good. That is why `clearContent` leaves this store alone.
 *
 * `baseUpdatedAt` is the whole conflict story: it records the version of the
 * row this edit was made against, so the server can tell "nobody has touched
 * this since" from "someone else has changed it and applying yours would bury
 * theirs".
 */
export type OutboxItem = {
  id: string;
  entityType: "TranslationCorrection";
  /** The row this change applies to — a translation id, for a correction. */
  entityId: string;
  operation: SyncOperation;
  status: SyncItemStatus;
  payload: { correctedText: string; reason: string | null };
  /** `updatedAt` of the row as this device knew it when the edit was made. */
  baseUpdatedAt: string;
  /** What this device believed the text was, shown side by side in a conflict. */
  baseText: string;
  /** When the teacher made the change, not when it was sent. */
  createdAt: string;
  syncedAt: string | null;
  attempts: number;
  lastError: string | null;
  /**
   * Set only by a teacher answering a conflict with "keep mine". Nothing else
   * ever sets it: this is the single switch that lets a change land on top of
   * a newer row, and it exists so that overwriting is always somebody's
   * decision rather than a default.
   */
  force: boolean;
  /** Filled in when the server refused to overwrite newer data. */
  conflict: {
    serverText: string;
    serverUpdatedAt: string;
    message: string;
  } | null;
};

export type OfflinePreference = {
  key: string;
  value: unknown;
  updatedAt: string;
};

interface ShikshaSetuDB extends DBSchema {
  lessons: { key: string; value: OfflineLesson; indexes: { "by-updated": string } };
  translations: {
    key: string;
    value: OfflineTranslation;
    indexes: { "by-updated": string };
  };
  worksheets: {
    key: string;
    value: OfflineWorksheet;
    indexes: { "by-updated": string };
  };
  flashcards: {
    key: string;
    value: OfflineFlashcard;
    indexes: { "by-deck": string };
  };
  assessments: {
    key: string;
    value: OfflineAssessment;
    indexes: { "by-updated": string };
  };
  audio: { key: string; value: OfflineAudio; indexes: { "by-owner": string } };
  glossary: {
    key: string;
    value: OfflineGlossaryTerm;
    indexes: { "by-source": string };
  };
  curriculum: {
    key: string;
    value: OfflineCurriculumOutcome;
    indexes: { "by-area": string };
  };
  outbox: {
    key: string;
    value: OutboxItem;
    indexes: { "by-status": string; "by-entity": string };
  };
  preferences: { key: string; value: OfflinePreference };
}

/**
 * Written out rather than derived with `keyof ShikshaSetuDB`: DBSchema carries
 * an index signature, so `keyof` widens to `string` and every store name loses
 * its type.
 */
export type StoreName =
  | "lessons"
  | "translations"
  | "worksheets"
  | "flashcards"
  | "assessments"
  | "audio"
  | "glossary"
  | "curriculum"
  | "outbox"
  | "preferences";

export const CONTENT_STORES = [
  "lessons",
  "translations",
  "worksheets",
  "flashcards",
  "assessments",
  "audio",
  "glossary",
  "curriculum",
] as const;

/**
 * Downloaded content only. `outbox` and `preferences` are deliberately absent:
 * one holds changes that exist nowhere else yet, the other the teacher's own
 * settings. Neither is something "clear downloaded content" should touch.
 */

let dbPromise: Promise<IDBPDatabase<ShikshaSetuDB>> | null = null;

/**
 * Opens the database, or returns null where IndexedDB is unavailable.
 *
 * Private windows and locked-down browsers throw on open rather than returning
 * a usable handle, so every caller treats null as "no offline storage" and
 * degrades rather than crashing.
 */
export function getDB(): Promise<IDBPDatabase<ShikshaSetuDB>> | null {
  if (typeof indexedDB === "undefined") return null;

  dbPromise ??= openDB<ShikshaSetuDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // Guarded per store rather than per version: a tablet may arrive at any
      // version, and creating a store that already exists throws.
      if (oldVersion >= 1) {
        if (!db.objectStoreNames.contains("curriculum")) {
          db.createObjectStore("curriculum", { keyPath: "id" }).createIndex(
            "by-area",
            "learningArea",
          );
        }
        if (!db.objectStoreNames.contains("outbox")) {
          const outbox = db.createObjectStore("outbox", { keyPath: "id" });
          outbox.createIndex("by-status", "status");
          outbox.createIndex("by-entity", "entityId");
        }
        return;
      }

      db.createObjectStore("lessons", { keyPath: "id" }).createIndex(
        "by-updated",
        "updatedAt",
      );
      db.createObjectStore("translations", { keyPath: "id" }).createIndex(
        "by-updated",
        "updatedAt",
      );
      db.createObjectStore("worksheets", { keyPath: "id" }).createIndex(
        "by-updated",
        "updatedAt",
      );
      db.createObjectStore("flashcards", { keyPath: "id" }).createIndex(
        "by-deck",
        "deckId",
      );
      db.createObjectStore("assessments", { keyPath: "id" }).createIndex(
        "by-updated",
        "updatedAt",
      );
      db.createObjectStore("audio", { keyPath: "id" }).createIndex(
        "by-owner",
        "ownerKey",
      );
      db.createObjectStore("glossary", { keyPath: "id" }).createIndex(
        "by-source",
        "sourceTerm",
      );
      db.createObjectStore("curriculum", { keyPath: "id" }).createIndex(
        "by-area",
        "learningArea",
      );
      const outbox = db.createObjectStore("outbox", { keyPath: "id" });
      outbox.createIndex("by-status", "status");
      outbox.createIndex("by-entity", "entityId");
      db.createObjectStore("preferences", { keyPath: "key" });
    },
  });

  return dbPromise;
}

/** Replaces a store's contents wholesale. Used by a full sync. */
export async function replaceAll<T extends Exclude<StoreName, "preferences">>(
  store: T,
  rows: ShikshaSetuDB[T]["value"][],
): Promise<number> {
  const db = await getDB();
  if (!db) return 0;

  const tx = db.transaction(store, "readwrite");
  await tx.store.clear();
  for (const row of rows) {
    await tx.store.put(row);
  }
  await tx.done;
  return rows.length;
}

export async function getAll<T extends StoreName>(
  store: T,
): Promise<ShikshaSetuDB[T]["value"][]> {
  const db = await getDB();
  if (!db) return [];
  return db.getAll(store);
}

export async function get<T extends StoreName>(
  store: T,
  key: string,
): Promise<ShikshaSetuDB[T]["value"] | undefined> {
  const db = await getDB();
  if (!db) return undefined;
  return db.get(store, key);
}

export async function put<T extends StoreName>(
  store: T,
  value: ShikshaSetuDB[T]["value"],
): Promise<void> {
  const db = await getDB();
  if (!db) return;
  await db.put(store, value);
}

export async function countAll(): Promise<Record<StoreName, number>> {
  const db = await getDB();
  const empty = {
    lessons: 0,
    translations: 0,
    worksheets: 0,
    flashcards: 0,
    assessments: 0,
    audio: 0,
    glossary: 0,
    curriculum: 0,
    outbox: 0,
    preferences: 0,
  } as Record<StoreName, number>;

  if (!db) return empty;

  for (const store of Object.keys(empty) as StoreName[]) {
    empty[store] = await db.count(store);
  }
  return empty;
}

/** Total bytes of cached audio — the only store big enough to matter. */
export async function audioBytes(): Promise<number> {
  const clips = await getAll("audio");
  return clips.reduce((total, clip) => total + (clip.sizeBytes || 0), 0);
}

/** Wipes downloaded content. Preferences survive: they are the teacher's own. */
export async function clearContent(): Promise<void> {
  const db = await getDB();
  if (!db) return;

  const tx = db.transaction([...CONTENT_STORES], "readwrite");
  await Promise.all(CONTENT_STORES.map((store) => tx.objectStore(store).clear()));
  await tx.done;
}

/* --------------------------------------------------------------- outbox */

/** Everything queued, newest change first. */
export async function listOutbox(): Promise<OutboxItem[]> {
  const rows = (await getAll("outbox")) as OutboxItem[];
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Items the next sync will actually send. */
export function isSendable(item: OutboxItem): boolean {
  return item.status === "PENDING" || item.status === "FAILED";
}

export async function countPendingChanges(): Promise<number> {
  return (await listOutbox()).filter(isSendable).length;
}

/**
 * Queues a change, replacing any unsent change to the same row.
 *
 * One pending edit per row rather than a stack of them: two corrections typed
 * on the same tablet before it next reaches a network are the teacher revising
 * their own work, and sending the superseded version first would put a text
 * they had already rejected into the record. A change that has already reached
 * the server is never replaced — it is history at that point.
 */
export async function enqueue(
  item: Omit<
    OutboxItem,
    "id" | "status" | "attempts" | "lastError" | "syncedAt" | "conflict" | "force"
  >,
): Promise<OutboxItem> {
  const db = await getDB();
  const row: OutboxItem = {
    ...item,
    id: crypto.randomUUID(),
    status: "PENDING",
    attempts: 0,
    lastError: null,
    syncedAt: null,
    force: false,
    conflict: null,
  };

  if (!db) return row;

  const existing = (await getAll("outbox")) as OutboxItem[];
  const superseded = existing.filter(
    (candidate) =>
      candidate.entityId === item.entityId &&
      candidate.entityType === item.entityType &&
      candidate.status !== "SYNCED",
  );

  const tx = db.transaction("outbox", "readwrite");
  for (const stale of superseded) await tx.store.delete(stale.id);
  await tx.store.put(row);
  await tx.done;

  return row;
}

export async function updateOutboxItem(
  id: string,
  changes: Partial<OutboxItem>,
): Promise<void> {
  const db = await getDB();
  if (!db) return;

  const tx = db.transaction("outbox", "readwrite");
  const current = await tx.store.get(id);
  if (current) await tx.store.put({ ...current, ...changes });
  await tx.done;
}

export async function removeOutboxItem(id: string): Promise<void> {
  const db = await getDB();
  if (!db) return;
  await db.delete("outbox", id);
}

/** Drops entries the server has confirmed, keeping the queue a to-do list. */
export async function pruneSynced(): Promise<number> {
  const db = await getDB();
  if (!db) return 0;

  const done = ((await getAll("outbox")) as OutboxItem[]).filter(
    (item) => item.status === "SYNCED",
  );

  const tx = db.transaction("outbox", "readwrite");
  for (const item of done) await tx.store.delete(item.id);
  await tx.done;
  return done.length;
}

/* --------------------------------------------------------- preferences */

export async function getPreference<T>(key: string): Promise<T | null> {
  const row = await get("preferences", key);
  return row ? (row.value as T) : null;
}

export async function setPreference(key: string, value: unknown): Promise<void> {
  await put("preferences", { key, value, updatedAt: new Date().toISOString() });
}

export const LAST_SYNC_KEY = "lastSyncedAt";
