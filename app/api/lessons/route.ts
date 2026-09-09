import { z } from "zod";

import { TeachingPackageSchema } from "@/lib/ai/teaching-package";
import { StoredAlignmentSchema } from "@/lib/fln/alignment";
import { fail } from "@/lib/api/speech-responses";
import { prisma } from "@/lib/database/prisma";
import type { Prisma } from "@prisma/client";
import { isDenied, requireApiUser } from "@/lib/auth/guards";
import {
  getDefaultLanguagePair,
} from "@/lib/database/queries";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  title: z.string().trim().min(1).max(300),
  grade: z.number().int().min(1).max(12).nullable().optional(),
  subject: z.string().trim().max(120).nullable().optional(),
  topic: z.string().trim().max(300).nullable().optional(),
  sourceText: z.string().trim().min(1).max(60_000),
  translatedText: z.string().trim().max(60_000).nullable().optional(),
  originalFileName: z.string().trim().max(300).nullable().optional(),
  sourceFormat: z.string().trim().max(30).nullable().optional(),
  extractionMethod: z.string().trim().max(40).nullable().optional(),
  status: z.enum(["DRAFT", "READY"]).default("DRAFT"),
  package: TeachingPackageSchema.nullable().optional(),
  packageProvider: z.string().trim().max(40).nullable().optional(),
  packageModel: z.string().trim().max(80).nullable().optional(),
  /** True once a teacher has changed any generated field. */
  packageIsEdited: z.boolean().default(false),
  alignment: StoredAlignmentSchema.nullable().default(null),
});

/**
 * POST /api/lessons
 *
 * Saves an uploaded lesson and, when present, its teaching package. The author
 * and language pair are resolved server-side rather than trusted from the
 * client.
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
    return fail("PROVIDER_ERROR", "Give the lesson a title and some text.", 400);
  }

  const authorized = await requireApiUser();
  if (isDenied(authorized)) return authorized.response;

  const teacher = authorized.user;
  const pair = await getDefaultLanguagePair();

  if (!teacher) {
    return fail(
      "PROVIDER_ERROR",
      "No teacher account is set up on this installation.",
      503,
    );
  }
  if (!pair) {
    return fail("PROVIDER_ERROR", "No language pair is configured.", 503);
  }

  const input = parsed.data;

  try {
    const lesson = await prisma.lesson.create({
      data: {
        title: input.title,
        grade: input.grade ?? null,
        subject: input.subject ?? null,
        topic: input.topic ?? null,
        sourceText: input.sourceText,
        translatedText: input.translatedText ?? null,
        originalFileName: input.originalFileName ?? null,
        sourceFormat: input.sourceFormat ?? null,
        extractionMethod: input.extractionMethod ?? null,
        status: input.status,
        authorId: teacher.id,
        schoolId: teacher.schoolId,
        sourceLanguageId: pair.source.id,
        targetLanguageId: pair.target.id,
        lastOpenedAt: new Date(),
        alignment: (input.alignment ?? undefined) as Prisma.InputJsonValue | undefined,
        ...(input.package
          ? {
              teachingPackage: {
                create: {
                  content: input.package,
                  provider: input.packageProvider ?? null,
                  model: input.packageModel ?? null,
                  isEdited: input.packageIsEdited,
                },
              },
            }
          : {}),
      },
      select: { id: true, title: true },
    });

    return Response.json({
      success: true,
      lessonId: lesson.id,
      title: lesson.title,
    });
  } catch (error) {
    console.error("[lessons] create", error);
    return fail("PROVIDER_ERROR", "Could not save the lesson. Try again.", 500);
  }
}
