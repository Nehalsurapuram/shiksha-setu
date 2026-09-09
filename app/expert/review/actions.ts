"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { MAX_INPUT_CHARS } from "@/lib/ai/translation-provider";
import { prisma } from "@/lib/database/prisma";
import { getCurrentExpert, isPromotable } from "@/lib/validation/review";

export type ReviewState = {
  status: "idle" | "done" | "error";
  message?: string;
};

const DecisionSchema = z.object({
  correctionId: z.string().min(1),
  decision: z.enum(["APPROVED", "CORRECTED", "REJECTED"]),
  /** Required for CORRECTED: the expert's own wording. */
  expertText: z.string().trim().max(MAX_INPUT_CHARS * 2).optional(),
  note: z.string().trim().max(500).optional(),
});

/**
 * Records a language expert's verdict on one teacher correction.
 *
 * Three outcomes, and none of them edits the teacher's text:
 *
 *   Approve — the teacher's wording is right. It becomes the verified text.
 *   Correct — the expert writes their own, stored alongside; the teacher's
 *             correction stays exactly as typed, because the disagreement
 *             between them is the record worth keeping.
 *   Reject  — the correction is wrong. The translation goes back to being
 *             unverified rather than pretending the model's output was right.
 *
 * Server Actions are reachable by direct POST, so the acting expert is read
 * server-side and never taken from the client.
 */
export async function recordDecision(
  _previous: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const parsed = DecisionSchema.safeParse({
    correctionId: formData.get("correctionId"),
    decision: formData.get("decision"),
    expertText: formData.get("expertText") || undefined,
    note: formData.get("note") || undefined,
  });

  if (!parsed.success) {
    return { status: "error", message: "That decision was not in a usable shape." };
  }

  const { correctionId, decision, expertText, note } = parsed.data;

  if (decision === "CORRECTED" && !expertText) {
    return {
      status: "error",
      message: "Write the corrected translation before saving it.",
    };
  }

  const expert = await getCurrentExpert();
  if (!expert) {
    return {
      status: "error",
      message:
        "No language expert account exists on this installation, so nothing can be verified here.",
    };
  }

  const correction = await prisma.translationCorrection.findUnique({
    where: { id: correctionId },
    select: { id: true, translationId: true },
  });

  if (!correction) {
    return { status: "error", message: "That correction no longer exists." };
  }

  await prisma.$transaction([
    prisma.translationCorrection.update({
      where: { id: correction.id },
      data: {
        status: decision,
        expertText: decision === "CORRECTED" ? expertText : null,
        reviewNote: note ?? null,
        reviewedById: expert.id,
        reviewedAt: new Date(),
      },
    }),
    prisma.translation.update({
      where: { id: correction.translationId },
      data: {
        // REJECTED puts the row back to unreviewed rather than marking it
        // approved: a rejected correction says the human text was wrong, not
        // that the model's was right.
        reviewStatus: decision === "REJECTED" ? "UNREVIEWED" : "APPROVED",
      },
    }),
  ]);

  revalidatePath("/expert/review");
  revalidatePath("/translator");

  return {
    status: "done",
    message:
      decision === "APPROVED"
        ? "Approved. This is now the verified translation."
        : decision === "CORRECTED"
          ? "Saved your wording as the verified translation."
          : "Rejected. The translation is marked unverified.",
  };
}

const PromoteSchema = z.object({
  correctionId: z.string().min(1),
  sourceTerm: z.string().trim().min(1).max(120),
  targetTerm: z.string().trim().min(1).max(200),
  domain: z.string().trim().max(60).optional(),
});

/**
 * Promotes an approved correction into a verified glossary term.
 *
 * Only from an APPROVED or CORRECTED correction: `isVerified` on a glossary
 * term is the strongest claim this product makes about a piece of language, and
 * it must mean "a person who speaks it said so", never "a teacher typed it and
 * nobody checked".
 *
 * The term keeps a pointer back to the correction it came from, so any verified
 * term can be traced to the approval behind it.
 */
export async function promoteToGlossary(
  _previous: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const parsed = PromoteSchema.safeParse({
    correctionId: formData.get("correctionId"),
    sourceTerm: formData.get("sourceTerm"),
    targetTerm: formData.get("targetTerm"),
    domain: formData.get("domain") || undefined,
  });

  if (!parsed.success) {
    return { status: "error", message: "Fill in both the term and its translation." };
  }

  const expert = await getCurrentExpert();
  if (!expert) {
    return {
      status: "error",
      message: "No language expert account exists, so nothing can be verified.",
    };
  }

  const correction = await prisma.translationCorrection.findUnique({
    where: { id: parsed.data.correctionId },
    select: {
      id: true,
      status: true,
      correctedText: true,
      expertText: true,
      promotedTermId: true,
      translation: {
        select: {
          sourceText: true,
          sourceLanguageId: true,
          targetLanguageId: true,
        },
      },
    },
  });

  if (!correction) {
    return { status: "error", message: "That correction no longer exists." };
  }

  if (correction.status !== "APPROVED" && correction.status !== "CORRECTED") {
    return {
      status: "error",
      message: "Only an approved correction can become a verified term.",
    };
  }

  if (correction.promotedTermId) {
    return { status: "error", message: "This correction is already in the glossary." };
  }

  if (!isPromotable(parsed.data.sourceTerm)) {
    return {
      status: "error",
      message:
        "A glossary term is a word or short phrase. Shorten it, or leave this one as a verified translation.",
    };
  }

  try {
    const term = await prisma.glossaryTerm.upsert({
      where: {
        sourceTerm_sourceLanguageId_targetLanguageId: {
          sourceTerm: parsed.data.sourceTerm,
          sourceLanguageId: correction.translation.sourceLanguageId,
          targetLanguageId: correction.translation.targetLanguageId,
        },
      },
      // An unverified term for the same word already existing is the normal
      // case, not a clash: this is exactly how it earns its verification.
      update: {
        targetTerm: parsed.data.targetTerm,
        domain: parsed.data.domain ?? null,
        isVerified: true,
        sourceCorrectionId: correction.id,
        createdById: expert.id,
      },
      create: {
        sourceTerm: parsed.data.sourceTerm,
        targetTerm: parsed.data.targetTerm,
        domain: parsed.data.domain ?? null,
        isVerified: true,
        sourceCorrectionId: correction.id,
        createdById: expert.id,
        sourceLanguageId: correction.translation.sourceLanguageId,
        targetLanguageId: correction.translation.targetLanguageId,
      },
      select: { id: true },
    });

    await prisma.translationCorrection.update({
      where: { id: correction.id },
      data: { promotedTermId: term.id },
    });
  } catch (error) {
    console.error("[promoteToGlossary]", error);
    return { status: "error", message: "Could not save the glossary term." };
  }

  revalidatePath("/expert/review");
  revalidatePath("/settings");

  return {
    status: "done",
    message: `Added “${parsed.data.sourceTerm}” to the verified glossary.`,
  };
}
