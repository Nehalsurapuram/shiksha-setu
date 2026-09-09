import "server-only";

import { prisma } from "@/lib/database/prisma";

/**
 * Human-validated language, used as data.
 *
 * **Nothing here trains or fine-tunes a model.** Two lookups, both of them just
 * reading rows a person approved:
 *
 *   1. A verified glossary term whose source text is exactly what was asked
 *      for. The answer comes from the expert, not the model.
 *   2. An approved correction on a translation that already exists. The human
 *      text is served in place of the machine's.
 *
 * That is the whole mechanism, and it is deliberately unglamorous. Training a
 * model on this data is a separate project with its own evaluation; describing
 * a lookup table as "learning from teachers" would put unvalidated output in
 * front of a classroom under a label it has not earned.
 */

export type VerifiedSource = "glossary" | "expert";

export type VerifiedText = {
  text: string;
  from: VerifiedSource;
  /** Who approved it, for the UI to attribute the claim. */
  approvedBy: string | null;
};

/**
 * A verified glossary term for exactly this text.
 *
 * Exact match on the trimmed, case-folded source. No fuzzy matching and no
 * substitution inside a longer sentence: "जड़" verified as a term says nothing
 * about how it should read inside a particular sentence, and splicing it in
 * would produce a translation no person ever approved.
 */
export async function findVerifiedTerm(
  text: string,
  sourceLanguageId: string,
  targetLanguageId: string,
): Promise<VerifiedText | null> {
  const term = await prisma.glossaryTerm.findFirst({
    where: {
      isVerified: true,
      sourceLanguageId,
      targetLanguageId,
      sourceTerm: { equals: text.trim(), mode: "insensitive" },
    },
    select: {
      targetTerm: true,
      createdBy: { select: { name: true } },
    },
  });

  if (!term) return null;

  return {
    text: term.targetTerm,
    from: "glossary",
    approvedBy: term.createdBy?.name ?? null,
  };
}

/**
 * The expert-approved text for a translation, when there is one.
 *
 * Only APPROVED and CORRECTED count. A teacher's unreviewed correction is used
 * on that teacher's own device — they made it and they are teaching from it —
 * but it is not served to anyone else as verified until someone who speaks the
 * language has said so.
 */
export async function findApprovedCorrection(
  translationId: string,
): Promise<VerifiedText | null> {
  const correction = await prisma.translationCorrection.findFirst({
    where: {
      translationId,
      status: { in: ["APPROVED", "CORRECTED"] },
    },
    orderBy: { reviewedAt: "desc" },
    select: {
      correctedText: true,
      expertText: true,
      reviewedBy: { select: { name: true } },
    },
  });

  if (!correction) return null;

  return {
    text: correction.expertText?.trim() || correction.correctedText,
    from: "expert",
    approvedBy: correction.reviewedBy?.name ?? null,
  };
}
