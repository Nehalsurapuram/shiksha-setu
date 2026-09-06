import "server-only";

export type LLMProviderId = "openai" | "sarvam" | "demo";

export type JsonSchema = Record<string, unknown>;

export type StructuredRequest = {
  /** What the model is for. Becomes the system instruction. */
  system: string;
  user: string;
  /** Strict JSON schema the reply must satisfy. */
  schemaName: string;
  schema: JsonSchema;
  /** Optional images, as data URLs, for reading a photographed page. */
  images?: string[];
};

export type StructuredResult<T> = {
  data: T;
  provider: LLMProviderId;
  model: string;
  requestId: string | null;
};

export interface LLMProvider {
  readonly id: LLMProviderId;
  readonly model: string;
  /** True when a real credential is configured. */
  readonly isConfigured: boolean;
  complete<T>(request: StructuredRequest): Promise<StructuredResult<T>>;
}

export type LLMErrorCode =
  | "NOT_CONFIGURED"
  | "EMPTY_INPUT"
  | "INPUT_TOO_LONG"
  | "INVALID_CREDENTIALS"
  | "QUOTA_EXHAUSTED"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_ERROR"
  | "MALFORMED_OUTPUT"
  | "CONTENT_REFUSED";

export class LLMError extends Error {
  readonly code: LLMErrorCode;
  /** Safe to show a teacher: no URLs, no keys, no prompt contents. */
  readonly publicMessage: string;
  readonly status: number;

  constructor(
    code: LLMErrorCode,
    publicMessage: string,
    options?: { status?: number; cause?: unknown },
  ) {
    super(`${code}: ${publicMessage}`, { cause: options?.cause });
    this.name = "LLMError";
    this.code = code;
    this.publicMessage = publicMessage;
    this.status = options?.status ?? 400;
  }
}

/** Longest source text we will send for analysis or generation. */
export const MAX_LESSON_CHARS = 12_000;
