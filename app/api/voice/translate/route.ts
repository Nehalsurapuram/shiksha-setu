import { VoiceTranslationService } from "@/lib/ai/VoiceTranslationService";
import { TranslationError } from "@/lib/ai/translation-provider";
import {
  fail,
  fileNameFor,
  handleSpeechError,
} from "@/lib/api/speech-responses";
import { isDenied, requireApiUser } from "@/lib/auth/guards";
import { getDefaultLanguagePair } from "@/lib/database/queries";

export const dynamic = "force-dynamic";

/**
 * POST /api/voice/translate
 *
 * multipart/form-data: `audio` (file).
 *
 * Runs the whole pipeline and reports the measured wall-clock time. Every
 * millisecond reported is read from the clock around the real work — nothing
 * here is estimated or hardcoded.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("UNSUPPORTED_AUDIO", "Could not read the recording.", 400);
  }

  const audio = form.get("audio");
  if (!(audio instanceof Blob)) {
    return fail("NO_AUDIO", "No recording was uploaded.", 400);
  }

  const pair = await getDefaultLanguagePair();
  if (!pair) {
    return fail(
      "STT_LANGUAGE_UNSUPPORTED",
      "No language pair is configured on this installation.",
      503,
    );
  }

  try {
    const authorized = await requireApiUser();
  if (isDenied(authorized)) return authorized.response;
  const teacher = authorized.user;
    const service = new VoiceTranslationService();

    const outcome = await service.run({
      audio,
      fileName: fileNameFor(audio),
      sourceLanguage: { code: pair.source.code, name: pair.source.name },
      targetLanguage: { code: pair.target.code, name: pair.target.name },
      userId: teacher?.id ?? null,
    });

    return Response.json({
      success: true,
      transcript: outcome.transcript,
      translation: outcome.translation,
      audioUrl: outcome.audioUrl,
      processingTimeMs: outcome.processingTimeMs,
      // Beyond the base contract, for the UI's status line.
      audioUnavailableReason: outcome.audioUnavailableReason,
      timings: outcome.timings,
      isDemo: outcome.isDemo,
      translationId: outcome.translationId,
      sourceLanguage: pair.source.code,
      targetLanguage: pair.target.code,
    });
  } catch (error) {
    // The translation leg raises TranslationError, the speech legs SpeechError.
    if (error instanceof TranslationError) {
      if (error.status >= 500) console.error("[voice/translate]", error);
      return fail(error.code, error.publicMessage, error.status);
    }
    return handleSpeechError(error, "voice/translate");
  }
}
