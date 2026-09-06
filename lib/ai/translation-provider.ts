import "server-only";

export { MAX_INPUT_CHARS } from "@/lib/ai/translation-limits";

/**
 * The contract every translation provider implements.
 *
 * TranslationService depends on this interface, never on a concrete provider,
 * so adding a second real provider later is a new file plus one line in the
 * service's selection logic.
 */
export type ProviderId = "sarvam" | "demo";

export type TranslationRequest = {
  text: string;
  /** BCP-47-ish code as stored in the Language table, e.g. "hi-IN". */
  sourceLanguage: string;
  targetLanguage: string;
};

export type TranslationResult = {
  translatedText: string;
  provider: ProviderId;
  /** Model identifier the provider actually used, for the audit trail. */
  model: string;
  /**
   * Only set when the provider genuinely returns one.
   *
   * Sarvam's translate endpoint does not return a confidence score, so this is
   * null for Sarvam results. Inventing a number here would put a fake quality
   * signal in front of a teacher deciding whether to trust a translation.
   */
  confidence: number | null;
  /** Provider-side request id, when available. Useful for support tickets. */
  requestId: string | null;
};

export interface TranslationProvider {
  readonly id: ProviderId;
  /** True when this provider can handle the pair. Checked before calling. */
  supports(sourceLanguage: string, targetLanguage: string): boolean;
  translate(request: TranslationRequest): Promise<TranslationResult>;
}

/**
 * Every failure the translator can surface, as a closed set.
 *
 * The API route maps these to messages. Raw provider errors and exception
 * messages never reach the client: they can carry request URLs, key fragments
 * and internal hostnames.
 */
export type TranslationErrorCode =
  | "EMPTY_INPUT"
  | "INPUT_TOO_LONG"
  | "UNSUPPORTED_LANGUAGE"
  | "SAME_LANGUAGE"
  | "NOT_CONFIGURED"
  | "INVALID_CREDENTIALS"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_ERROR"
  | "EMPTY_RESULT";

export class TranslationError extends Error {
  readonly code: TranslationErrorCode;
  /** Safe to show a teacher: no URLs, no keys, no stack detail. */
  readonly publicMessage: string;
  readonly status: number;

  constructor(
    code: TranslationErrorCode,
    publicMessage: string,
    options?: { status?: number; cause?: unknown },
  ) {
    super(`${code}: ${publicMessage}`, { cause: options?.cause });
    this.name = "TranslationError";
    this.code = code;
    this.publicMessage = publicMessage;
    this.status = options?.status ?? 400;
  }
}
