import { z } from "zod";

import { SpeechService } from "@/lib/ai/SpeechService";
import { MAX_TTS_CHARS } from "@/lib/ai/speech-limits";
import { fail, handleSpeechError } from "@/lib/api/speech-responses";
import { listLanguages } from "@/lib/database/queries";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  text: z.string().min(1).max(MAX_TTS_CHARS * 2),
  languageCode: z.string().min(2).max(16),
});

/**
 * POST /api/speech/synthesize
 *
 * Refuses rather than substituting another language's voice. For Santhali this
 * always refuses today: Sarvam's TTS model has no Santhali voice.
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
    return fail("NO_AUDIO", "Provide text and a language to read it in.", 400);
  }

  const { text, languageCode } = parsed.data;

  // Name the language properly in any refusal, rather than echoing a code.
  const languages = await listLanguages();
  const language = languages.find((entry) => entry.code === languageCode);
  const languageName = language?.name ?? languageCode;

  try {
    const service = new SpeechService();
    const started = Date.now();
    const result = await service.synthesize(text, languageCode, languageName);

    return Response.json({
      success: true,
      audioUrl: `data:${result.mimeType};base64,${result.audioBase64}`,
      languageCode,
      provider: result.provider,
      model: result.model,
      processingTimeMs: Date.now() - started,
    });
  } catch (error) {
    return handleSpeechError(error, "synthesize");
  }
}
