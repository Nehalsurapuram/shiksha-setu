import { SpeechService } from "@/lib/ai/SpeechService";
import {
  fail,
  fileNameFor,
  handleSpeechError,
} from "@/lib/api/speech-responses";
import { getDefaultLanguagePair } from "@/lib/database/queries";

export const dynamic = "force-dynamic";

/**
 * POST /api/speech/transcribe
 *
 * multipart/form-data: `audio` (file), optional `languageCode`.
 * The API key stays server-side; no provider URL or raw error is echoed.
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

  const requested = form.get("languageCode");
  let languageCode = typeof requested === "string" ? requested.trim() : "";

  if (!languageCode) {
    const pair = await getDefaultLanguagePair();
    languageCode = pair?.source.code ?? "hi-IN";
  }

  try {
    const service = new SpeechService();
    const started = Date.now();
    const result = await service.transcribe(
      audio,
      fileNameFor(audio),
      languageCode,
    );

    return Response.json({
      success: true,
      transcript: result.transcript,
      languageCode,
      detectedLanguage: result.detectedLanguage,
      provider: result.provider,
      model: result.model,
      isDemo: result.provider === "demo",
      processingTimeMs: Date.now() - started,
    });
  } catch (error) {
    return handleSpeechError(error, "transcribe");
  }
}
