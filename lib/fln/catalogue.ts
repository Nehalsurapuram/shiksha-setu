import "server-only";

import { prisma } from "@/lib/database/prisma";

export type CatalogueStatus = {
  /** Rows carrying a real citation. */
  verifiedCount: number;
  /** Rows loaded without one — usable as a working list, never as official. */
  unverifiedCount: number;
  /** Distinct citations, so the UI can name what has actually been loaded. */
  sources: string[];
};

/**
 * What curriculum data this installation actually holds.
 *
 * Read before any screen claims alignment. On a fresh install the answer is
 * "nothing", and every alignment shown is a suggestion.
 */
export async function getCatalogueStatus(): Promise<CatalogueStatus> {
  const [verifiedCount, unverifiedCount, sourceRows] = await Promise.all([
    prisma.learningOutcome.count({ where: { verifiedSource: { not: null } } }),
    prisma.learningOutcome.count({ where: { verifiedSource: null } }),
    prisma.learningOutcome.findMany({
      where: { verifiedSource: { not: null } },
      distinct: ["verifiedSource"],
      select: { verifiedSource: true },
      take: 20,
    }),
  ]);

  return {
    verifiedCount,
    unverifiedCount,
    sources: sourceRows
      .map((row) => row.verifiedSource)
      .filter((source): source is string => Boolean(source)),
  };
}

/**
 * Verified outcomes for a class and subject.
 *
 * Only rows with a `verifiedSource` are ever returned. An unverified row in
 * the catalogue is working data for whoever is building the mapping; it must
 * not reach a teacher looking like an official outcome.
 */
export async function findVerifiedOutcomes(options: {
  classLevel: number | null;
  subject: string | null;
  take?: number;
}) {
  return prisma.learningOutcome.findMany({
    where: {
      verifiedSource: { not: null },
      ...(options.classLevel === null
        ? {}
        : { OR: [{ classLevel: options.classLevel }, { classLevel: null }] }),
      ...(options.subject
        ? {
            OR: [
              { subject: { equals: options.subject, mode: "insensitive" } },
              { subject: null },
            ],
          }
        : {}),
    },
    orderBy: [{ learningArea: "asc" }, { competency: "asc" }],
    take: options.take ?? 25,
    select: {
      id: true,
      learningArea: true,
      competency: true,
      outcome: true,
      classLevel: true,
      subject: true,
      verifiedSource: true,
      code: true,
    },
  });
}

export type VerifiedOutcome = Awaited<
  ReturnType<typeof findVerifiedOutcomes>
>[number];
