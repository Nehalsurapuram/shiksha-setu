import "server-only";

import { prisma } from "@/lib/database/prisma";

/**
 * Read helpers for the Phase 1 screens.
 *
 * Every number the dashboard shows is counted here rather than hard-coded in a
 * component, so an empty database honestly renders zeros.
 */
export type WorkspaceSnapshot = {
  counts: {
    schools: number;
    teachers: number;
    activeLanguages: number;
    lessons: number;
    translations: number;
    glossaryTerms: number;
    pendingSyncItems: number;
  };
  languages: Awaited<ReturnType<typeof listLanguages>>;
};

export async function listLanguages() {
  return prisma.language.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      nativeName: true,
      script: true,
      status: true,
      isSource: true,
      isTarget: true,
      notes: true,
    },
  });
}

export async function getWorkspaceSnapshot(): Promise<WorkspaceSnapshot> {
  const [
    schools,
    teachers,
    activeLanguages,
    lessons,
    translations,
    glossaryTerms,
    pendingSyncItems,
    languages,
  ] = await Promise.all([
    prisma.school.count(),
    prisma.user.count(),
    prisma.language.count({ where: { status: "ACTIVE" } }),
    prisma.lesson.count(),
    prisma.translation.count(),
    prisma.glossaryTerm.count(),
    prisma.syncItem.count({ where: { status: "PENDING" } }),
    listLanguages(),
  ]);

  return {
    counts: {
      schools,
      teachers,
      activeLanguages,
      lessons,
      translations,
      glossaryTerms,
      pendingSyncItems,
    },
    languages,
  };
}

/**
 * The default language pair, read from the seeded demo teacher when present and
 * otherwise from the Language table. Returns null rather than inventing a pair.
 */
export async function getDefaultLanguagePair() {
  const source = await prisma.language.findFirst({
    where: { status: "ACTIVE", isSource: true },
    orderBy: { sortOrder: "asc" },
  });
  const target = await prisma.language.findFirst({
    where: { status: "ACTIVE", isTarget: true },
    orderBy: { sortOrder: "asc" },
  });

  if (!source || !target) return null;
  return { source, target };
}

/**
 * The signed-in teacher.
 *
 * Authentication is not built yet, so this resolves to the seeded demo teacher.
 * Every caller goes through here rather than assuming a user, so wiring real
 * auth later is a change to this one function.
 */
export async function getCurrentTeacher() {
  return prisma.user.findFirst({
    where: { role: "TEACHER" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      school: { select: { id: true, name: true, district: true, state: true } },
      sourceLanguage: { select: { id: true, code: true, name: true } },
      targetLanguage: { select: { id: true, code: true, name: true } },
    },
  });
}

/**
 * Dashboard counters.
 *
 * All four are `count` queries against real tables. Three of them are expected
 * to be zero until the generation features exist — that is the correct answer,
 * not a broken widget, and the dashboard says so rather than substituting a
 * plausible-looking number.
 */
export async function getTeacherStats(teacherId: string) {
  const [translations, worksheets, audioLessons, savedLessons] =
    await Promise.all([
      prisma.translation.count({ where: { createdById: teacherId } }),
      prisma.worksheet.count({ where: { createdById: teacherId } }),
      prisma.audio.count({ where: { createdById: teacherId } }),
      prisma.lesson.count({ where: { authorId: teacherId } }),
    ]);

  return { translations, worksheets, audioLessons, savedLessons };
}

const LESSON_CARD_SELECT = {
  id: true,
  title: true,
  subject: true,
  grade: true,
  topic: true,
  status: true,
  isSample: true,
  isOfflinePinned: true,
  updatedAt: true,
  lastOpenedAt: true,
  sourceLanguage: { select: { code: true, name: true, script: true } },
  targetLanguage: { select: { code: true, name: true, script: true } },
  _count: { select: { translations: true, worksheets: true, audios: true } },
} as const;

export type LessonCard = Awaited<ReturnType<typeof listRecentLessons>>[number];

/** Most recently updated lessons, for the Recent Lessons table. */
export async function listRecentLessons(teacherId: string, take = 6) {
  return prisma.lesson.findMany({
    where: { authorId: teacherId },
    orderBy: { updatedAt: "desc" },
    take,
    select: LESSON_CARD_SELECT,
  });
}

/**
 * Lessons the teacher has actually opened, most recent first.
 *
 * Ordered by `lastOpenedAt`, and lessons never opened are excluded — otherwise
 * "Continue teaching" would offer to resume something that was never started.
 */
export async function listContinueTeaching(teacherId: string, take = 3) {
  return prisma.lesson.findMany({
    where: { authorId: teacherId, lastOpenedAt: { not: null } },
    orderBy: { lastOpenedAt: "desc" },
    take,
    select: LESSON_CARD_SELECT,
  });
}

const TRANSLATION_SELECT = {
  id: true,
  sourceText: true,
  targetText: true,
  source: true,
  model: true,
  confidence: true,
  reviewStatus: true,
  createdAt: true,
  updatedAt: true,
  sourceLanguage: { select: { code: true, name: true, script: true } },
  targetLanguage: { select: { code: true, name: true, script: true } },
  corrections: {
    orderBy: { createdAt: "desc" },
    take: 1,
    select: {
      id: true,
      correctedText: true,
      reason: true,
      createdAt: true,
    },
  },
} as const;

export type TranslationRecord = Awaited<
  ReturnType<typeof listTranslationHistory>
>[number];

/** Translation history for the translator page. */
export async function listTranslationHistory(userId: string, take = 20) {
  return prisma.translation.findMany({
    where: { createdById: userId },
    orderBy: { updatedAt: "desc" },
    take,
    select: TRANSLATION_SELECT,
  });
}

export async function getTranslation(id: string) {
  return prisma.translation.findUnique({
    where: { id },
    select: TRANSLATION_SELECT,
  });
}

/** Cheap liveness probe used by the dashboard and /api/health. */
export async function checkDatabase(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown database error",
    };
  }
}
