import { z } from "zod";

import { LLMService } from "@/lib/ai/LLMService";
import { LLMError, MAX_LESSON_CHARS } from "@/lib/ai/llm-provider";
import {
  DIFFICULTIES,
  QUESTION_TYPES,
  toSheetContent,
} from "@/lib/ai/generated-content";
import { enforceSheetRequest } from "@/lib/ai/enforce-request";
import {
  buildSheetAlignment,
  tryBuildAlignment,
} from "@/lib/fln/generate-alignment";
import { translateSheet } from "@/lib/ai/translate-sheet";
import { TranslationService } from "@/lib/ai/TranslationService";
import { fail } from "@/lib/api/speech-responses";
import { isDenied, requireApiUser } from "@/lib/auth/guards";
import {
  getDefaultLanguagePair,
} from "@/lib/database/queries";

export const dynamic = "force-dynamic";
/** Generation plus a dozen translation calls needs more than the default. */
export const maxDuration = 300;

const BodySchema = z.object({
  grade: z.number().int().min(1).max(12).nullable().default(null),
  subject: z.string().trim().max(120).nullable().default(null),
  topic: z.string().trim().min(1).max(300),
  difficulty: z.enum(DIFFICULTIES).default("easy"),
  count: z.number().int().min(1).max(20).default(6),
  questionTypes: z.array(z.enum(QUESTION_TYPES)).min(1).max(8),
  sourceText: z.string().trim().max(MAX_LESSON_CHARS).nullable().default(null),
  translate: z.boolean().default(true),
});

/**
 * POST /api/worksheets/generate
 *
 * Generates in the language of instruction, then translates the learner-facing
 * strings. A translation failure does not fail the request: those fields come
 * back null and the editor shows them as untranslated.
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
    return fail(
      "EMPTY_INPUT",
      "Give a topic and pick at least one question type.",
      400,
    );
  }

  const authorized = await requireApiUser();
  if (isDenied(authorized)) return authorized.response;

  const pair = await getDefaultLanguagePair();
  if (!pair) return fail("PROVIDER_ERROR", "No language pair is configured.", 503);

  const startedAt = Date.now();

  try {
    const llm = new LLMService();
    const generated = await llm.generateWorksheet({
      ...parsed.data,
      languageName: pair.source.name,
    });
    const generateMs = Date.now() - startedAt;

    const content = toSheetContent(generated);

    // The model does not reliably honour count, format or language, so the
    // request is enforced here rather than hoped for. Anything removed is
    // reported to the teacher instead of vanishing.
    const enforcement = enforceSheetRequest(content, {
      count: parsed.data.count,
      questionTypes: parsed.data.questionTypes,
      languageCode: pair.source.code,
    });

    // Alignment and translation are independent and hit different providers, so
    // they run together. Sequentially they cost the teacher a whole extra model
    // round-trip — measured at over three minutes for one worksheet. Alignment
    // only reads `prompt` and `answer`; translation only writes the `*Sat`
    // fields, so sharing `content` between them is safe.
    const sideWorkStart = Date.now();
    const teacher = parsed.data.translate ? authorized.user : null;

    const [alignmentResult, translationOutcome] = await Promise.all([
      tryBuildAlignment(() =>
        buildSheetAlignment(
          llm,
          {
            title: content.title,
            grade: parsed.data.grade,
            subject: parsed.data.subject,
            topic: parsed.data.topic,
            body: content.questions
              .map((q, i) => `${i}. [${q.type}] ${q.prompt} -> ${q.answer}`)
              .join("\n"),
          },
          content.questions.length,
        ),
      ),
      parsed.data.translate
        ? translateSheet(content, {
            service: new TranslationService(),
            sourceCode: pair.source.code,
            targetCode: pair.target.code,
            userId: teacher?.id ?? null,
          })
        : Promise.resolve(null),
    ]);

    const { alignment, note: alignmentNote } = alignmentResult;
    const translationNote = translationOutcome
      ? translationOutcome.note
      : "Translation was skipped for this run.";
    const translateMs = parsed.data.translate ? Date.now() - sideWorkStart : 0;

    return Response.json({
      success: true,
      content,
      provider: llm.providerId,
      model: llm.model,
      sourceLanguage: { code: pair.source.code, name: pair.source.name },
      targetLanguage: { code: pair.target.code, name: pair.target.name },
      translationNote,
      warnings: enforcement.warnings,
      alignment,
      alignmentNote,
      processingTimeMs: Date.now() - startedAt,
      timings: { generateMs, translateMs },
    });
  } catch (error) {
    if (error instanceof LLMError) {
      if (error.status >= 500) console.error("[worksheets/generate]", error);
      return fail(error.code, error.publicMessage, error.status);
    }
    console.error("[worksheets/generate] unexpected", error);
    return fail("PROVIDER_ERROR", "Something went wrong while generating.", 500);
  }
}
