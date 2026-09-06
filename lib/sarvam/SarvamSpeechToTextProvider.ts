import "server-only";

import {
  SpeechError,
  type SpeechToTextProvider,
  type TranscriptionRequest,
  type TranscriptionResult,
} from "@/lib/ai/speech-provider";
import { SARVAM_BASE_URL } from "@/lib/sarvam/client";

/**
 * Sarvam AI speech-to-text (saaras).
 *
 * Docs: https://docs.sarvam.ai/api-reference/speech-to-text/transcribe
 */
const SARVAM_STT_MODEL = "saaras:v3";
const REQUEST_TIMEOUT_MS = 45_000;

/**
 * Languages saaras accepts. Note this list includes `sat-IN` — Sarvam can
 * *hear* Santhali even though it cannot speak it, which is why speech-to-text
 * and text-to-speech carry different capability lists here.
 */
const SUPPORTED_LANGUAGES = new Set([
  "as-IN",
  "bn-IN",
  "brx-IN",
  "doi-IN",
  "en-IN",
  "gu-IN",
  "hi-IN",
  "kn-IN",
  "kok-IN",
  "ks-IN",
  "mai-IN",
  "ml-IN",
  "mni-IN",
  "mr-IN",
  "ne-IN",
  "od-IN",
  "pa-IN",
  "sa-IN",
  "sat-IN",
  "sd-IN",
  "ta-IN",
  "te-IN",
  "ur-IN",
]);

type SarvamSttResponse = {
  request_id?: string | null;
  transcript?: string | null;
  language_code?: string | null;
};

export class SarvamSpeechToTextProvider implements SpeechToTextProvider {
  readonly id = "sarvam" as const;

  readonly #apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new SpeechError(
        "NOT_CONFIGURED",
        "Speech recognition is not configured on this server.",
        { status: 503 },
      );
    }
    this.#apiKey = apiKey;
  }

  supports(languageCode: string): boolean {
    return SUPPORTED_LANGUAGES.has(languageCode);
  }

  async transcribe(
    request: TranscriptionRequest,
  ): Promise<TranscriptionResult> {
    const form = new FormData();
    form.append("file", request.audio, request.fileName);
    form.append("model", SARVAM_STT_MODEL);
    form.append("language_code", request.languageCode);

    let response: Response;
    try {
      response = await fetch(`${SARVAM_BASE_URL}/speech-to-text`, {
        method: "POST",
        // Content-Type is deliberately not set: fetch adds the multipart
        // boundary itself, and overriding it corrupts the body.
        headers: { "api-subscription-key": this.#apiKey },
        body: form,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
      });
    } catch (cause) {
      if (cause instanceof Error && cause.name === "TimeoutError") {
        throw new SpeechError(
          "TIMEOUT",
          "Speech recognition took too long. Try a shorter recording.",
          { status: 504, cause },
        );
      }
      throw new SpeechError(
        "PROVIDER_UNAVAILABLE",
        "Could not reach the speech service. Check the connection and try again.",
        { status: 502, cause },
      );
    }

    if (!response.ok) throw mapSpeechHttpError(response.status, "speech");

    let payload: SarvamSttResponse;
    try {
      payload = (await response.json()) as SarvamSttResponse;
    } catch (cause) {
      throw new SpeechError(
        "PROVIDER_ERROR",
        "The speech service returned a response we could not read.",
        { status: 502, cause },
      );
    }

    const transcript = payload.transcript?.trim();
    if (!transcript) {
      throw new SpeechError(
        "EMPTY_TRANSCRIPT",
        "Nothing was recognised in that recording. Speak clearly and try again.",
        { status: 422 },
      );
    }

    return {
      transcript,
      provider: this.id,
      model: SARVAM_STT_MODEL,
      detectedLanguage: payload.language_code ?? null,
      requestId: payload.request_id ?? null,
    };
  }
}

/**
 * Shared status mapping for both speech endpoints.
 *
 * The provider's own error body is never read into the message: it is written
 * for developers and can echo request contents.
 */
export function mapSpeechHttpError(
  status: number,
  what: "speech" | "audio",
): SpeechError {
  if (status === 401 || status === 403) {
    return new SpeechError(
      "INVALID_CREDENTIALS",
      `The ${what} service rejected this server's credentials. An administrator needs to check the API key.`,
      { status: 502 },
    );
  }
  if (status === 429) {
    return new SpeechError(
      "RATE_LIMITED",
      `The ${what} service is rate limited right now. Wait a moment and try again.`,
      { status: 429 },
    );
  }
  if (status === 413) {
    return new SpeechError(
      "AUDIO_TOO_LARGE",
      "That recording is too long. Record a shorter sentence.",
      { status: 413 },
    );
  }
  if (status === 400 || status === 415 || status === 422) {
    return new SpeechError(
      "UNSUPPORTED_AUDIO",
      `The ${what} service could not process that recording. Try recording again.`,
      { status: 502 },
    );
  }
  return new SpeechError(
    "PROVIDER_ERROR",
    `The ${what} service failed. Try again in a moment.`,
    { status: 502 },
  );
}
