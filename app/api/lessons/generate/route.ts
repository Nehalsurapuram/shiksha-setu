import { z } from "zod";

import { LLMService } from "@/lib/ai/LLMService";
import { LLMError, MAX_LESSON_CHARS } from "@/lib/ai/llm-provider";
import { toPackageContent } from "@/lib/ai/teaching-package";
import { translateLong } from "@/lib/ai/translate-long";
import { TranslationService } from "@/lib/ai/TranslationService";
import { fail } from "@/lib/api/speech-responses";
import {
  getCurrentTeacher,
  getDefaultLanguagePair,
} from "@/lib/database/queries";

export const dynamic = "force-dynamic";
/** Generation plus a dozen translation calls needs more than the default. */
export const maxDuration = 300;

const BodySchema = z.object({
  sourceText: z.string().trim().min(1).max(MAX_LESSON_CHARS),
  title: z.string().trim().max(300).nullable().optional(),
  grade: z.number().int().min(1).max(12).nullable().optional(),
  subject: z.string().trim().max(120).nullable().optional(),
  topic: z.string().trim().max(300).nullable().optional(),
  /** Skip translation to get the package back faster. */
  translate: z.boolean().default(true),
});

/**
 * POST /api/lessons/generate
 *
 * Generates the teaching package, then translates the teacher-facing parts
 * into the mother tongue. Translation failures do not fail the request: those
 * fields come back null and the UI shows them as untranslated.
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
      `Provide the lesson text, up to ${MAX_LESSON_CHARS} characters.`,
      400,
    );
  }

  const pair = await getDefaultLanguagePair();
  if (!pair) {
    return fail("PROVIDER_ERROR", "No language pair is configured.", 503);
  }

  const startedAt = Date.now();

  try {
    const llm = new LLMService();
    const generated = await llm.generateLesson({
      sourceText: parsed.data.sourceText,
      title: parsed.data.title ?? null,
      grade: parsed.data.grade ?? null,
      subject: parsed.data.subject ?? null,
      topic: parsed.data.topic ?? null,
      languageName: pair.source.name,
    });
    const generateMs = Date.now() - startedAt;

    const content = toPackageContent(generated);

    let translateMs = 0;
    let translationNote: string | null = null;

    if (parsed.data.translate) {
      const translateStart = Date.now();
      const teacher = await getCurrentTeacher();
      const translation = new TranslationService();

      if (translation.isDemo) {
        translationNote =
          "Not translated: no translation provider is configured, so the mother-tongue column is empty rather than invented.";
      } else {
        const into = (text: string) =>
          translateLong(
            translation,
            text,
            pair.source.code,
            pair.target.code,
            teacher?.id ?? null,
          );

        // Student-facing material first; the teacher script is long and is the
        // least useful to translate, since the teacher reads the source.
        content.learningObjective.sat = await into(generated.learningObjective);
        content.teacherExplanation.sat = await into(
          generated.teacherExplanation,
        );
        content.homework.sat = await into(generated.homework);
        content.activity.sat = await into(
          [generated.activity.title, ...generated.activity.steps].join(" "),
        );
        content.assessment.sat = await into(generated.assessment.description);

        // Vocabulary terms are deliberately NOT machine translated.
        //
        // A single word with no surrounding sentence gives the translator
        // nothing to disambiguate against, and it shows: "पौधा" comes back as
        // a sentence of meta-commentary about the word rather than the word,
        // and "तना" comes back truncated. Full sentences translate cleanly.
        //
        // A teacher who cannot read Ol Chiki has no way to catch a wrong word,
        // and a wrong word is what gets written on the blackboard. So these
        // stay null — the editor shows "Not translated" and the teacher fills
        // them in, which is the glossary this product is meant to build.
        for (const item of content.practiceQuestions) {
          item.sat = await into(item.question);
        }

        const attempted = [
          content.learningObjective.sat,
          content.teacherExplanation.sat,
          content.homework.sat,
        ];
        if (attempted.every((value) => value === null)) {
          translationNote =
            "The mother-tongue translation could not be produced for this lesson. The material is still usable in the source language.";
        }
      }
      translateMs = Date.now() - translateStart;
    } else {
      translationNote = "Translation was skipped for this run.";
    }

    return Response.json({
      success: true,
      content,
      provider: llm.providerId,
      model: llm.model,
      sourceLanguage: { code: pair.source.code, name: pair.source.name },
      targetLanguage: { code: pair.target.code, name: pair.target.name },
      translationNote,
      processingTimeMs: Date.now() - startedAt,
      timings: { generateMs, translateMs },
    });
  } catch (error) {
    if (error instanceof LLMError) {
      if (error.status >= 500) console.error("[lessons/generate]", error);
      return fail(error.code, error.publicMessage, error.status);
    }
    console.error("[lessons/generate] unexpected", error);
    return fail(
      "PROVIDER_ERROR",
      "Something went wrong while generating. Try again.",
      500,
    );
  }
}
