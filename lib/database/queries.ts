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
