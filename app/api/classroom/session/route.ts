import { z } from "zod";

import { fail } from "@/lib/api/speech-responses";
import { prisma } from "@/lib/database/prisma";
import { isDenied, requireApiUser } from "@/lib/auth/guards";
import {
  getDefaultLanguagePair,
} from "@/lib/database/queries";

export const dynamic = "force-dynamic";

const MessageSchema = z.object({
  speaker: z.enum(["teacher", "student"]),
  sourceText: z.string().min(1).max(20_000),
  translatedText: z.string().max(20_000).nullable().optional(),
  sourceLanguage: z.string().min(2).max(16),
  targetLanguage: z.string().min(2).max(16),
  hadAudio: z.boolean().default(false),
  latencyMs: z.number().int().nonnegative().nullable().optional(),
  spokenAt: z.string().datetime(),
  translationId: z.string().nullable().optional(),
});

const BodySchema = z.object({
  title: z.string().trim().max(200).optional(),
  startedAt: z.string().datetime(),
  messages: z.array(MessageSchema).min(1).max(500),
});

/**
 * POST /api/classroom/session
 *
 * Saves a conversation. The client sends what it displayed, but nothing is
 * trusted blindly: the teacher and the language pair are resolved server-side,
 * and any `translationId` is verified to exist before it is linked.
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
    return fail("PROVIDER_ERROR", "There is nothing to save yet.", 400);
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

  const languages = await prisma.language.findMany({
    select: { id: true, code: true },
  });
  const idByCode = new Map(languages.map((l) => [l.code, l.id]));

  // Drop any message naming a language this installation does not have,
  // rather than failing the whole save over one bad row.
  const rows = parsed.data.messages.flatMap((message) => {
    const sourceLanguageId = idByCode.get(message.sourceLanguage);
    const targetLanguageId = idByCode.get(message.targetLanguage);
    if (!sourceLanguageId || !targetLanguageId) return [];
    return [{ message, sourceLanguageId, targetLanguageId }];
  });

  if (rows.length === 0) {
    return fail("PROVIDER_ERROR", "There is nothing to save yet.", 400);
  }

  // Only link translations that actually exist; a stale id must not fail the save.
  const candidateIds = rows
    .map((row) => row.message.translationId)
    .filter((id): id is string => Boolean(id));
  const existing = candidateIds.length
    ? await prisma.translation.findMany({
        where: { id: { in: candidateIds } },
        select: { id: true },
      })
    : [];
  const knownTranslationIds = new Set(existing.map((t) => t.id));

  try {
    const session = await prisma.classroomSession.create({
      data: {
        title: parsed.data.title || null,
        startedAt: new Date(parsed.data.startedAt),
        teacherId: teacher.id,
        schoolId: teacher.schoolId,
        instructionLanguageId: pair.source.id,
        motherTongueId: pair.target.id,
        messages: {
          create: rows.map(({ message, sourceLanguageId, targetLanguageId }) => ({
            speaker: message.speaker === "teacher" ? "TEACHER" : "STUDENT",
            sourceText: message.sourceText,
            translatedText: message.translatedText ?? null,
            hadAudio: message.hadAudio,
            latencyMs: message.latencyMs ?? null,
            spokenAt: new Date(message.spokenAt),
            sourceLanguageId,
            targetLanguageId,
            translationId:
              message.translationId &&
              knownTranslationIds.has(message.translationId)
                ? message.translationId
                : null,
          })),
        },
      },
      select: { id: true, savedAt: true, _count: { select: { messages: true } } },
    });

    return Response.json({
      success: true,
      sessionId: session.id,
      savedAt: session.savedAt.toISOString(),
      messageCount: session._count.messages,
    });
  } catch (error) {
    console.error("[classroom/session]", error);
    return fail("PROVIDER_ERROR", "Could not save the session. Try again.", 500);
  }
}
