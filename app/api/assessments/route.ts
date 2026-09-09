import { z } from "zod";

import {
  AssessmentContentSchema,
  assessmentKindFor,
  DIFFICULTIES,
} from "@/lib/ai/generated-content";
import { StoredAlignmentSchema } from "@/lib/fln/alignment";
import { fail } from "@/lib/api/speech-responses";
import { prisma } from "@/lib/database/prisma";
import { isDenied, requireApiUser } from "@/lib/auth/guards";
import type { AssessmentKind, Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  grade: z.number().int().min(1).max(12).nullable().default(null),
  subject: z.string().trim().max(120).nullable().default(null),
  topic: z.string().trim().max(300).nullable().default(null),
  difficulty: z.enum(DIFFICULTIES).nullable().default(null),
  content: AssessmentContentSchema,
  provider: z.string().trim().max(40).nullable().default(null),
  model: z.string().trim().max(80).nullable().default(null),
  isEdited: z.boolean().default(false),
  alignment: StoredAlignmentSchema.nullable().default(null),
});

/**
 * POST /api/assessments
 *
 * `maxScore` is summed from the questions rather than accepted from the client,
 * so the total on the paper always matches the marks on the questions.
 */
export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return fail("PROVIDER_ERROR", "Could not read the request.", 400);
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return fail("PROVIDER_ERROR", "The assessment is missing required fields.", 400);
  }

  const authorized = await requireApiUser();
  if (isDenied(authorized)) return authorized.response;
  const teacher = authorized.user;
  if (!teacher) {
    return fail(
      "PROVIDER_ERROR",
      "No teacher account is set up on this installation.",
      503,
    );
  }

  const input = parsed.data;
  const maxScore = input.content.questions.reduce(
    (total, question) => total + (question.marks || 1),
    0,
  );

  try {
    const assessment = await prisma.assessment.create({
      data: {
        title: input.content.title || "Untitled assessment",
        kind: assessmentKindFor(input.content.questions) as AssessmentKind,
        grade: input.grade,
        subject: input.subject,
        topic: input.topic,
        difficulty: input.difficulty,
        questions: input.content as unknown as Prisma.InputJsonValue,
        maxScore: maxScore || 1,
        provider: input.provider,
        model: input.model,
        isEdited: input.isEdited,
        alignment: (input.alignment ?? undefined) as Prisma.InputJsonValue | undefined,
        createdById: teacher.id,
      },
      select: { id: true, title: true, maxScore: true },
    });

    return Response.json({
      success: true,
      id: assessment.id,
      title: assessment.title,
      maxScore: assessment.maxScore,
    });
  } catch (error) {
    console.error("[assessments] create", error);
    return fail("PROVIDER_ERROR", "Could not save the assessment. Try again.", 500);
  }
}
