import "server-only";

import {
  LLMError,
  type LLMProvider,
  type StructuredRequest,
  type StructuredResult,
} from "@/lib/ai/llm-provider";
import { SARVAM_BASE_URL } from "@/lib/sarvam/client";

/**
 * Sarvam's own LLM, through its OpenAI-compatible chat completions API.
 *
 * Exists so lesson generation can run on the Sarvam account that already pays
 * for translation and speech, instead of needing a second funded provider.
 *
 * Two things differ from OpenAI and both matter:
 *
 * 1. `sarvam-105b` is a reasoning model. It spends completion tokens thinking
 *    before it answers, and if `max_tokens` is too low it burns the whole
 *    budget on reasoning and returns `content: null` with no error. Hence the
 *    generous budget and `reasoning_effort: "low"`.
 * 2. It has no vision input, so it cannot read a photographed page.
 *
 * Docs: https://docs.sarvam.ai/api-reference/chat/chat-completions
 */
const SARVAM_CHAT_MODEL = "sarvam-105b";
const REQUEST_TIMEOUT_MS = 180_000;
/**
 * Must cover reasoning tokens *plus* the answer, not just the answer.
 *
 * Measured: a four-question worksheet failed with `finish_reason: length` at
 * 8000 and completed at 16000, having emitted under 4000 tokens of actual
 * answer. The reasoning is where the budget goes, and a larger schema reasons
 * for longer, so this is sized for the biggest schema here rather than the
 * average one. Unused budget costs nothing — only emitted tokens are billed.
 */
const MAX_TOKENS = 16_000;

type ChatResponse = {
  id?: string;
  model?: string;
  choices?: Array<{
    finish_reason?: string;
    message?: {
      content?: string | null;
      refusal?: string | null;
    };
  }>;
};

export class SarvamLLMProvider implements LLMProvider {
  readonly id = "sarvam" as const;
  readonly model = SARVAM_CHAT_MODEL;
  readonly isConfigured = true;

  readonly #apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new LLMError(
        "NOT_CONFIGURED",
        "Lesson generation is not configured on this server.",
        { status: 503 },
      );
    }
    this.#apiKey = apiKey;
  }

  /**
   * Retries once when the model returns an empty answer.
   *
   * Observed in practice: the same request fails with `content: null` and then
   * succeeds unchanged on the next attempt. That is a flaky generation, not a
   * bad request, and asking a teacher to press Generate again for it wastes a
   * minute of their time. Retried only for that case — a rejected credential
   * or a schema the model cannot satisfy fails identically every time, and
   * `finish_reason: length` needs a bigger budget, not another attempt.
   */
  async complete<T>(request: StructuredRequest): Promise<StructuredResult<T>> {
    try {
      return await this.#attempt<T>(request);
    } catch (error) {
      if (error instanceof LLMError && error.code === "MALFORMED_OUTPUT" && error.retryable) {
        return this.#attempt<T>(request);
      }
      throw error;
    }
  }

  async #attempt<T>(request: StructuredRequest): Promise<StructuredResult<T>> {
    if (request.images?.length) {
      // Refuse rather than silently ignoring the image and answering from the
      // prompt alone, which would invent a transcript of a page it never saw.
      throw new LLMError(
        "PROVIDER_ERROR",
        "Reading text from a photo is not supported by the Sarvam language model. Upload a PDF, Word or text file instead.",
        { status: 422 },
      );
    }

    let response: Response;
    try {
      response = await fetch(`${SARVAM_BASE_URL}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-subscription-key": this.#apiKey,
        },
        body: JSON.stringify({
          model: SARVAM_CHAT_MODEL,
          messages: [
            { role: "system", content: request.system },
            { role: "user", content: request.user },
          ],
          max_tokens: MAX_TOKENS,
          reasoning_effort: "low",
          temperature: 0.2,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: request.schemaName,
              schema: request.schema,
              strict: true,
            },
          },
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
      });
    } catch (cause) {
      if (cause instanceof Error && cause.name === "TimeoutError") {
        throw new LLMError(
          "TIMEOUT",
          "Generating this took too long. Try a shorter lesson.",
          { status: 504, cause },
        );
      }
      throw new LLMError(
        "PROVIDER_UNAVAILABLE",
        "Could not reach the lesson generation service. Check the connection and try again.",
        { status: 502, cause },
      );
    }

    if (!response.ok) throw mapChatHttpError(response.status);

    let payload: ChatResponse;
    try {
      payload = (await response.json()) as ChatResponse;
    } catch (cause) {
      throw new LLMError(
        "PROVIDER_ERROR",
        "The generation service returned a response we could not read.",
        { status: 502, cause },
      );
    }

    const choice = payload.choices?.[0];

    if (choice?.message?.refusal) {
      throw new LLMError(
        "CONTENT_REFUSED",
        "The generation service declined to produce material for this text. Check the source content.",
        { status: 422 },
      );
    }

    const content = choice?.message?.content;

    // The reasoning-budget failure: HTTP 200, no error, empty content. Without
    // this check it would surface as unreadable JSON and look like a bug.
    if (!content) {
      const ranOutOfRoom = choice?.finish_reason === "length";
      throw new LLMError(
        "MALFORMED_OUTPUT",
        ranOutOfRoom
          ? "Generation ran out of room before finishing. Ask for fewer questions."
          : "The generation service returned nothing usable. Try again.",
        // A longer budget is the fix for "length"; another attempt is not.
        { status: 502, retryable: !ranOutOfRoom },
      );
    }

    try {
      return {
        data: JSON.parse(content) as T,
        provider: this.id,
        model: payload.model ?? SARVAM_CHAT_MODEL,
        requestId: payload.id ?? null,
      };
    } catch (cause) {
      throw new LLMError(
        "MALFORMED_OUTPUT",
        "The generated material could not be read. Try again.",
        { status: 502, cause },
      );
    }
  }
}

function mapChatHttpError(status: number): LLMError {
  if (status === 401 || status === 403) {
    return new LLMError(
      "INVALID_CREDENTIALS",
      "The generation service rejected this server's credentials. An administrator needs to check the API key.",
      { status: 502 },
    );
  }
  if (status === 402) {
    return new LLMError(
      "QUOTA_EXHAUSTED",
      "The Sarvam account has no credit left. An administrator needs to top it up — waiting will not fix this.",
      { status: 502 },
    );
  }
  if (status === 429) {
    return new LLMError(
      "RATE_LIMITED",
      "The generation service is rate limited right now. Wait a moment and try again.",
      { status: 429 },
    );
  }
  if (status === 400 || status === 422) {
    return new LLMError(
      "PROVIDER_ERROR",
      "The generation service could not process that text.",
      { status: 502 },
    );
  }
  return new LLMError(
    "PROVIDER_ERROR",
    "The generation service failed. Try again in a moment.",
    { status: 502 },
  );
}
