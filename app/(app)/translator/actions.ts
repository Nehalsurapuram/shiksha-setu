"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { MAX_INPUT_CHARS } from "@/lib/ai/translation-provider";
import { prisma } from "@/lib/database/prisma";
import { getSessionUser } from "@/lib/auth/guards";

export type CorrectionState = {
  status: "idle" | "saved" | "error";
  message?: string;
};

const CorrectionSchema = z.object({
  translationId: z.string().min(1),
  correctedText: z.string().trim().min(1).max(MAX_INPUT_CHARS * 2),
  reason: z.string().trim().max(500).optional(),
});

/**
 * Saves a teacher's correction to a translation.
 *
 * The original `targetText` is deliberately left untouched. The correction is
 * a separate row, so the audit trail keeps what the model produced alongside
 * what the teacher actually wanted — that difference is the most valuable data
 * this product can collect, and overwriting it would throw it away.
 *
 * Server Actions are reachable by direct POST, so this re-reads the current
 * teacher server-side rather than trusting anything the client sent.
 */
export async function saveCorrection(
  _previous: CorrectionState,
  formData: FormData,
): Promise<CorrectionState> {
  const parsed = CorrectionSchema.safeParse({
    translationId: formData.get("translationId"),
    correctedText: formData.get("correctedText"),
    reason: formData.get("reason") || undefined,
  });

  if (!parsed.success) {
    return { status: "error", message: "Enter the corrected text before saving." };
  }

  // Server Actions are reachable by direct POST, so the acting user is read
  // from the session here and never taken from the form.
  const teacher = await getSessionUser();
  if (!teacher) {
    return { status: "error", message: "Sign in to save a correction." };
  }

  const translation = await prisma.translation.findUnique({
    where: { id: parsed.data.translationId },
    select: { id: true, targetText: true },
  });

  if (!translation) {
    return { status: "error", message: "That translation no longer exists." };
  }

  if (translation.targetText.trim() === parsed.data.correctedText.trim()) {
    return {
      status: "error",
      message: "The text is unchanged, so there is nothing to correct.",
    };
  }

  try {
    await prisma.$transaction([
      prisma.translationCorrection.create({
        data: {
          translationId: translation.id,
          correctedById: teacher.id,
          correctedText: parsed.data.correctedText,
          reason: parsed.data.reason ?? null,
          // Snapshot what the model said, so the pair survives even if this
          // translation is later re-translated. The difference between the two
          // is the whole value of the correction.
          aiTranslation: translation.targetText,
          // The teacher uses their own correction in their own classroom
          // immediately — a lesson cannot wait for review. Whether it becomes
          // *verified* is a language expert's call, on /expert/review.
          isAccepted: true,
        },
      }),
      prisma.translation.update({
        where: { id: translation.id },
        data: { reviewStatus: "CORRECTED" },
      }),
    ]);
  } catch (error) {
    console.error("[saveCorrection]", error);
    return {
      status: "error",
      message: "Could not save the correction. Try again.",
    };
  }

  revalidatePath("/translator");
  return { status: "saved", message: "Correction saved." };
}
