import { z } from "zod";

import {
  DIFFICULTIES,
  WorksheetContentSchema,
  worksheetKindFor,
} from "@/lib/ai/generated-content";
import { fail } from "@/lib/api/speech-responses";
import { prisma } from "@/lib/database/prisma";
import { getCurrentTeacher } from "@/lib/database/queries";
import type { Prisma, WorksheetKind } from "@prisma/client";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  grade: z.number().int().min(1).max(12).nullable().default(null),
  subject: z.string().trim().max(120).nullable().default(null),
  topic: z.string().trim().max(300).nullable().default(null),
  difficulty: z.enum(DIFFICULTIES).nullable().default(null),
  content: WorksheetContentSchema,
  provider: z.string().trim().max(40).nullable().default(null),
  model: z.string().trim().max(80).nullable().default(null),
  isEdited: z.boolean().default(false),
});

/**
 * POST /api/worksheets
 *
 * The author is resolved server-side rather than trusted from the client, and
 * the stored `kind` is derived from the questions instead of being sent in, so
 * it cannot disagree with the content it labels.
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
    return fail("PROVIDER_ERROR", "The worksheet is missing required fields.", 400);
  }

  const teacher = await getCurrentTeacher();
  if (!teacher) {
    return fail(
      "PROVIDER_ERROR",
      "No teacher account is set up on this installation.",
      503,
    );
  }

  const input = parsed.data;

  try {
    const worksheet = await prisma.worksheet.create({
      data: {
        title: input.content.title || "Untitled worksheet",
        kind: worksheetKindFor(input.content.questions) as WorksheetKind,
        grade: input.grade,
        subject: input.subject,
        topic: input.topic,
        difficulty: input.difficulty,
        instructions: input.content.instructions,
        content: input.content as unknown as Prisma.InputJsonValue,
        provider: input.provider,
        model: input.model,
        isEdited: input.isEdited,
        createdById: teacher.id,
      },
      select: { id: true, title: true },
    });

    return Response.json({ success: true, id: worksheet.id, title: worksheet.title });
  } catch (error) {
    console.error("[worksheets] create", error);
    return fail("PROVIDER_ERROR", "Could not save the worksheet. Try again.", 500);
  }
}
