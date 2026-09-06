import "server-only";

export {
  MAX_AUDIO_BYTES,
  MAX_TTS_CHARS,
  ACCEPTED_AUDIO_TYPES,
} from "@/lib/ai/speech-limits";

export type SpeechProviderId = "sarvam" | "demo";

export type TranscriptionRequest = {
  audio: Blob;
  fileName: string;
  /** BCP-47-ish code, e.g. "hi-IN". */
  languageCode: string;
};

export type TranscriptionResult = {
  transcript: string;
  provider: SpeechProviderId;
  model: string;
  /** Only when the provider reports one. Never invented. */
  detectedLanguage: string | null;
  requestId: string | null;
};

export type SynthesisRequest = {
  text: string;
  languageCode: string;
};

export type SynthesisResult = {
  /** Raw audio bytes, base64 encoded, as the provider returned them. */
  audioBase64: string;
  mimeType: string;
  provider: SpeechProviderId;
  model: string;
  requestId: string | null;
};

export interface SpeechToTextProvider {
  readonly id: SpeechProviderId;
  supports(languageCode: string): boolean;
  transcribe(request: TranscriptionRequest): Promise<TranscriptionResult>;
}

export interface TextToSpeechProvider {
  readonly id: SpeechProviderId;
  /**
   * Whether this provider can speak the language at all.
   *
   * Load-bearing: Sarvam's TTS model covers eleven languages and Santhali is
   * not one of them. The pipeline asks this before synthesising so it can say
   * so plainly instead of returning audio in the wrong language.
   */
  supports(languageCode: string): boolean;
  synthesize(request: SynthesisRequest): Promise<SynthesisResult>;
}

export type SpeechErrorCode =
  | "NO_AUDIO"
  | "AUDIO_TOO_LARGE"
  | "UNSUPPORTED_AUDIO"
  | "EMPTY_TRANSCRIPT"
  | "STT_LANGUAGE_UNSUPPORTED"
  | "TTS_LANGUAGE_UNSUPPORTED"
  | "TEXT_TOO_LONG"
  | "NOT_CONFIGURED"
  | "INVALID_CREDENTIALS"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_ERROR";

export class SpeechError extends Error {
  readonly code: SpeechErrorCode;
  /** Safe to show a teacher: no URLs, no keys, no stack detail. */
  readonly publicMessage: string;
  readonly status: number;

  constructor(
    code: SpeechErrorCode,
    publicMessage: string,
    options?: { status?: number; cause?: unknown },
  ) {
    super(`${code}: ${publicMessage}`, { cause: options?.cause });
    this.name = "SpeechError";
    this.code = code;
    this.publicMessage = publicMessage;
    this.status = options?.status ?? 400;
  }
}
