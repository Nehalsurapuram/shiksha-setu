import "server-only";

import {
  MAX_TTS_CHARS,
  SpeechError,
  type SynthesisRequest,
  type SynthesisResult,
  type TextToSpeechProvider,
} from "@/lib/ai/speech-provider";
import { mapSpeechHttpError } from "@/lib/sarvam/SarvamSpeechToTextProvider";
import { SARVAM_BASE_URL } from "@/lib/sarvam/client";

/**
 * Sarvam AI text-to-speech (bulbul).
 *
 * Docs: https://docs.sarvam.ai/api-reference/text-to-speech/convert
 */
const SARVAM_TTS_MODEL = "bulbul:v3";
const REQUEST_TIMEOUT_MS = 45_000;

/**
 * The eleven languages bulbul can speak.
 *
 * **Santhali is not here, and that is the single most important fact about
 * this file.** Sarvam can transcribe Santhali but cannot synthesise it, so the
 * last leg of the voice pipeline — speaking the translation aloud — has no
 * provider today.
 *
 * The pipeline checks `supports()` and reports that plainly. It must never
 * fall back to another language: sending Ol Chiki text to a Hindi voice would
 * produce confident-sounding audio that is not Santhali, in front of children
 * who would have no way to know.
 */
const SUPPORTED_LANGUAGES = new Set([
  "bn-IN",
  "en-IN",
  "gu-IN",
  "hi-IN",
  "kn-IN",
  "ml-IN",
  "mr-IN",
  "od-IN",
  "pa-IN",
  "ta-IN",
  "te-IN",
]);

type SarvamTtsResponse = {
  request_id?: string | null;
  audios?: string[] | null;
};

export class SarvamTextToSpeechProvider implements TextToSpeechProvider {
  readonly id = "sarvam" as const;

  readonly #apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new SpeechError(
        "NOT_CONFIGURED",
        "Audio generation is not configured on this server.",
        { status: 503 },
      );
    }
    this.#apiKey = apiKey;
  }

  supports(languageCode: string): boolean {
    return SUPPORTED_LANGUAGES.has(languageCode);
  }

  async synthesize(request: SynthesisRequest): Promise<SynthesisResult> {
    if (!this.supports(request.languageCode)) {
      // Defensive: callers check supports() first, but a provider must never
      // quietly speak a language it was not asked for.
      throw new SpeechError(
        "TTS_LANGUAGE_UNSUPPORTED",
        "That language is unavailable for the current TTS configuration.",
        { status: 422 },
      );
    }

    if (request.text.length > MAX_TTS_CHARS) {
      throw new SpeechError(
        "TEXT_TOO_LONG",
        `That text is too long to read aloud in one go. Keep it under ${MAX_TTS_CHARS} characters.`,
        { status: 413 },
      );
    }

    let response: Response;
    try {
      response = await fetch(`${SARVAM_BASE_URL}/text-to-speech`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-subscription-key": this.#apiKey,
        },
        body: JSON.stringify({
          text: request.text,
          target_language_code: request.languageCode,
          model: SARVAM_TTS_MODEL,
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
      });
    } catch (cause) {
      if (cause instanceof Error && cause.name === "TimeoutError") {
        throw new SpeechError(
          "TIMEOUT",
          "Audio generation took too long. Try again.",
          { status: 504, cause },
        );
      }
      throw new SpeechError(
        "PROVIDER_UNAVAILABLE",
        "Could not reach the audio service. Check the connection and try again.",
        { status: 502, cause },
      );
    }

    if (!response.ok) throw mapSpeechHttpError(response.status, "audio");

    let payload: SarvamTtsResponse;
    try {
      payload = (await response.json()) as SarvamTtsResponse;
    } catch (cause) {
      throw new SpeechError(
        "PROVIDER_ERROR",
        "The audio service returned a response we could not read.",
        { status: 502, cause },
      );
    }

    const audioBase64 = payload.audios?.[0];
    if (!audioBase64) {
      throw new SpeechError(
        "PROVIDER_ERROR",
        "The audio service returned no audio.",
        { status: 502 },
      );
    }

    return {
      audioBase64,
      mimeType: "audio/wav",
      provider: this.id,
      model: SARVAM_TTS_MODEL,
      requestId: payload.request_id ?? null,
    };
  }
}
