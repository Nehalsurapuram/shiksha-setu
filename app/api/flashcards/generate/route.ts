import { z } from "zod";

import { LLMService } from "@/lib/ai/LLMService";
import { LLMError } from "@/lib/ai/llm-provider";
import { toDeck } from "@/lib/ai/generated-content";
import { translateDeck } from "@/lib/ai/translate-sheet";
import { TranslationService } from "@/lib/ai/TranslationService";
import { fail } from "@/lib/api/speech-responses";
import { isDenied, requireApiUser } from "@/lib/auth/guards";
import {
  getDefaultLanguagePair,
} from "@/lib/database/queries";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BodySchema = z.object({
  grade: z.number().int().min(1).max(12).nullable().default(null),
  subject: z.string().trim().max(120).nullable().default(null),
  topic: z.string().trim().min(1).max(300),
  count: z.number().int().min(1).max(20).default(8),
  translate: z.boolean().default(true),
});

/** POST /api/flashcards/generate */
export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return fail("PROVIDER_ERROR", "Could not read the request.", 400);
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return fail("EMPTY_INPUT", "Give a topic for the flashcards.", 400);
  }

  const pair = await getDefaultLanguagePair();
  if (!pair) return fail("PROVIDER_ERROR", "No language pair is configured.", 503);

  const startedAt = Date.now();

  try {
    const llm = new LLMService();
    const generated = await llm.generateFlashcards({
      ...parsed.data,
      languageName: pair.source.name,
    });
    const generateMs = Date.now() - startedAt;

    const deck = toDeck(generated);

    let translateMs = 0;
    let translationNote: string | null = "Translation was skipped for this run.";

    if (parsed.data.translate) {
      const translateStart = Date.now();
      const authorized = await requireApiUser();
  if (isDenied(authorized)) return authorized.response;
  const teacher = authorized.user;
      const outcome = await translateDeck(deck, {
        service: new TranslationService(),
        sourceCode: pair.source.code,
        targetCode: pair.target.code,
        userId: teacher?.id ?? null,
      });
      translationNote = outcome.note;
      translateMs = Date.now() - translateStart;
    }

    return Response.json({
      success: true,
      deck,
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
      if (error.status >= 500) console.error("[flashcards/generate]", error);
      return fail(error.code, error.publicMessage, error.status);
    }
    console.error("[flashcards/generate] unexpected", error);
    return fail("PROVIDER_ERROR", "Something went wrong while generating.", 500);
  }
}
