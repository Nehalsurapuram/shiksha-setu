import { z } from "zod";

import { TranslationService } from "@/lib/ai/TranslationService";
import {
  MAX_INPUT_CHARS,
  TranslationError,
} from "@/lib/ai/translation-provider";
import { getCurrentTeacher } from "@/lib/database/queries";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  sourceLanguage: z.string().min(2).max(16),
  targetLanguage: z.string().min(2).max(16),
  text: z.string().max(MAX_INPUT_CHARS * 4),
});

/**
 * POST /api/translate
 *
 * The API key never leaves the server: this route runs server-side, reads the
 * key through `lib/env` (which is `server-only`), and returns nothing beyond
 * the fields below. No provider URL, status code, or error body is echoed.
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
      "The request is missing text or a language pair.",
      400,
    );
  }

  const { sourceLanguage, targetLanguage, text } = parsed.data;

  try {
    const teacher = await getCurrentTeacher();
    const service = new TranslationService();

    const outcome = await service.translate({
      text,
      sourceLanguage,
      targetLanguage,
      userId: teacher?.id ?? null,
    });

    return Response.json({
      success: true,
      sourceLanguage: outcome.sourceLanguage,
      targetLanguage: outcome.targetLanguage,
      sourceText: outcome.sourceText,
      translatedText: outcome.translatedText,
      provider: outcome.provider,
      // Beyond the base contract, for the UI's status line. `isDemo` is the
      // flag that stops a demo result being read as a Sarvam one.
      isDemo: outcome.isDemo,
      cached: outcome.cached,
      model: outcome.model,
      confidence: outcome.confidence,
      durationMs: outcome.durationMs,
      translationId: outcome.translationId,
      // Null unless a person's approved wording was served instead of a
      // model's. The UI must be able to tell the two apart.
      verifiedBy: outcome.verifiedBy,
      verifiedApprover: outcome.verifiedApprover,
    });
  } catch (error) {
    if (error instanceof TranslationError) {
      // Logged server-side with its cause; only publicMessage goes out.
      if (error.status >= 500) console.error("[translate]", error);
      return fail(error.code, error.publicMessage, error.status);
    }

    console.error("[translate] unexpected", error);
    return fail(
      "PROVIDER_ERROR",
      "Something went wrong while translating. Try again.",
      500,
    );
  }
}

function fail(code: string, message: string, status: number) {
  return Response.json(
    { success: false, error: { code, message } },
    { status },
  );
}
