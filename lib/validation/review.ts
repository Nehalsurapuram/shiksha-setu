import "server-only";

import { prisma } from "@/lib/database/prisma";

/**
 * The human validation chain: model output → a teacher's correction → a
 * language expert's verdict → verified terminology.
 *
 * Nothing here trains or fine-tunes anything. Approved corrections are used as
 * *data* — a verified glossary, and a stored human translation that is served
 * in place of the model's — which is the only claim this prototype can make
 * honestly. Improving a model from this data is a separate project with its own
 * evaluation, and pretending otherwise would put unvalidated output in front of
 * a classroom under the label "learned from teachers".
 */

/** Corrections a language expert has not yet ruled on. */
export async function listPendingReviews(limit = 50) {
  return prisma.translationCorrection.findMany({
    where: { status: "UNREVIEWED" },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: correctionView,
  });
}

export async function listReviewedCorrections(limit = 30) {
  return prisma.translationCorrection.findMany({
    where: { status: { not: "UNREVIEWED" } },
    orderBy: { reviewedAt: "desc" },
    take: limit,
    select: correctionView,
  });
}

const correctionView = {
  id: true,
  correctedText: true,
  aiTranslation: true,
  reason: true,
  status: true,
  expertText: true,
  reviewNote: true,
  reviewedAt: true,
  createdAt: true,
  promotedTermId: true,
  correctedBy: { select: { id: true, name: true } },
  reviewedBy: { select: { id: true, name: true } },
  translation: {
    select: {
      id: true,
      sourceText: true,
      targetText: true,
      source: true,
      sourceLanguage: { select: { code: true, name: true } },
      targetLanguage: { select: { code: true, name: true, script: true } },
    },
  },
} as const;

export type CorrectionForReview = Awaited<
  ReturnType<typeof listPendingReviews>
>[number];

/**
 * The text this correction stands behind.
 *
 * An expert who rewrote the teacher's wording is the authority on it, so their
 * text wins. Otherwise it is the teacher's.
 */
export function verifiedTextOf(correction: {
  expertText: string | null;
  correctedText: string;
}): string {
  return correction.expertText?.trim() || correction.correctedText;
}

/** The wording offered when promoting, so the expert edits rather than retypes. */
export function suggestedTerm(correction: {
  expertText: string | null;
  correctedText: string;
  translation: { sourceText: string };
}) {
  return {
    sourceTerm: correction.translation.sourceText.trim(),
    targetTerm: verifiedTextOf(correction).trim(),
  };
}

export async function getReviewCounts() {
  const [pending, approved, rejected, verifiedTerms] = await Promise.all([
    prisma.translationCorrection.count({ where: { status: "UNREVIEWED" } }),
    prisma.translationCorrection.count({ where: { status: "APPROVED" } }),
    prisma.translationCorrection.count({ where: { status: "REJECTED" } }),
    prisma.glossaryTerm.count({ where: { isVerified: true } }),
  ]);

  return { pending, approved, rejected, verifiedTerms };
}

/**
 * Whoever is acting as the language expert on this installation.
 *
 * There is no authentication in this prototype, so this reads the first user
 * holding the role rather than an authenticated session. The review screen says
 * so on the page: an unsigned-in browser can reach it, and that has to be
 * visible rather than implied by an empty-looking gate.
 */
export async function getCurrentExpert() {
  return prisma.user.findFirst({
    where: { role: { in: ["LANGUAGE_EXPERT", "ADMIN"] }, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true },
  });
}

/**
 * A term short enough to be terminology rather than a sentence.
 *
 * A glossary of paragraphs is not a glossary: it would match nothing, and it
 * would put a whole sentence's worth of one context in front of a translation
 * of another. Four words is the line, and the UI explains it rather than
 * disabling the button with no reason given.
 */
export const MAX_GLOSSARY_WORDS = 4;

export function isPromotable(sourceText: string): boolean {
  const words = sourceText.trim().split(/\s+/).filter(Boolean);
  return words.length > 0 && words.length <= MAX_GLOSSARY_WORDS;
}
