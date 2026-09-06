import "server-only";

import {
  MAX_INPUT_CHARS,
  TranslationError,
  type TranslationProvider,
  type TranslationRequest,
  type TranslationResult,
} from "@/lib/ai/translation-provider";
import { SARVAM_BASE_URL } from "@/lib/sarvam/client";

/**
 * Sarvam AI translation.
 *
 * Model choice is not a default we can leave alone. Sarvam's default model,
 * `mayura:v1`, covers eleven languages and Santhali is not one of them —
 * `sarvam-translate:v1` is the model that supports sat-IN, so it is pinned
 * explicitly. Falling back to the default would fail every request this
 * product exists to serve.
 *
 * Docs: https://docs.sarvam.ai/api-reference/text/translate-text
 */
const SARVAM_MODEL = "sarvam-translate:v1";
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Languages `sarvam-translate:v1` accepts, from Sarvam's model documentation.
 *
 * Checked before the network call so an unsupported pair fails immediately
 * with a clear message rather than as an opaque 400 from the provider.
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

type SarvamResponse = {
  request_id?: string | null;
  translated_text?: string | null;
  source_language_code?: string | null;
};

export class SarvamTranslationProvider implements TranslationProvider {
  readonly id = "sarvam" as const;

  readonly #apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new TranslationError(
        "NOT_CONFIGURED",
        "Translation is not configured on this server.",
        { status: 503 },
      );
    }
    this.#apiKey = apiKey;
  }

  supports(sourceLanguage: string, targetLanguage: string): boolean {
    return (
      SUPPORTED_LANGUAGES.has(sourceLanguage) &&
      SUPPORTED_LANGUAGES.has(targetLanguage)
    );
  }

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    let response: Response;

    try {
      response = await fetch(`${SARVAM_BASE_URL}/translate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Sarvam authenticates with its own header, not a Bearer token.
          "api-subscription-key": this.#apiKey,
        },
        body: JSON.stringify({
          input: request.text,
          source_language_code: request.sourceLanguage,
          target_language_code: request.targetLanguage,
          model: SARVAM_MODEL,
          mode: "formal",
          // Left unset deliberately: `output_script` transliterates the result,
          // and Santhali must come back in Ol Chiki, not romanised.
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
      });
    } catch (cause) {
      if (cause instanceof Error && cause.name === "TimeoutError") {
        throw new TranslationError(
          "TIMEOUT",
          "The translation service took too long to respond. Try again.",
          { status: 504, cause },
        );
      }
      throw new TranslationError(
        "PROVIDER_UNAVAILABLE",
        "Could not reach the translation service. Check the connection and try again.",
        { status: 502, cause },
      );
    }

    if (!response.ok) {
      throw mapHttpError(response.status);
    }

    let payload: SarvamResponse;
    try {
      payload = (await response.json()) as SarvamResponse;
    } catch (cause) {
      throw new TranslationError(
        "PROVIDER_ERROR",
        "The translation service returned a response we could not read.",
        { status: 502, cause },
      );
    }

    const translatedText = payload.translated_text?.trim();
    if (!translatedText) {
      throw new TranslationError(
        "EMPTY_RESULT",
        "The translation service returned an empty result. Try rephrasing the text.",
        { status: 502 },
      );
    }

    return {
      translatedText,
      provider: this.id,
      model: SARVAM_MODEL,
      // Sarvam's translate endpoint returns no score. Never invent one.
      confidence: null,
      requestId: payload.request_id ?? null,
    };
  }
}

/**
 * Maps provider status codes onto our closed error set.
 *
 * The provider's own error body is deliberately not read into the message: it
 * is written for developers and can echo request contents.
 */
function mapHttpError(status: number): TranslationError {
  if (status === 401 || status === 403) {
    return new TranslationError(
      "INVALID_CREDENTIALS",
      "The translation service rejected this server's credentials. An administrator needs to check the API key.",
      { status: 502 },
    );
  }

  if (status === 429) {
    return new TranslationError(
      "RATE_LIMITED",
      "The translation service is rate limited right now. Wait a moment and try again.",
      { status: 429 },
    );
  }

  if (status === 413) {
    return new TranslationError(
      "INPUT_TOO_LONG",
      `That text is too long to translate in one request. Keep it under ${MAX_INPUT_CHARS} characters.`,
      { status: 413 },
    );
  }

  if (status === 400 || status === 422) {
    return new TranslationError(
      "PROVIDER_ERROR",
      "The translation service could not process that text. Try rephrasing it.",
      { status: 502 },
    );
  }

  return new TranslationError(
    "PROVIDER_ERROR",
    "The translation service failed. Try again in a moment.",
    { status: 502 },
  );
}
