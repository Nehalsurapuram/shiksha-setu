import "server-only";

import {
  LLMError,
  type LLMProvider,
  type StructuredRequest,
  type StructuredResult,
} from "@/lib/ai/llm-provider";

/**
 * OpenAI, through the Responses API with strict Structured Outputs.
 *
 * Structured Outputs is not a nicety here: the teaching package is rendered
 * into labelled fields, and a model that omitted a key or invented an enum
 * would put a half-built lesson in front of a teacher. `strict: true` makes the
 * shape a guarantee rather than a hope.
 *
 * Docs: https://developers.openai.com/api/docs/guides/structured-outputs
 */
const OPENAI_URL = "https://api.openai.com/v1/responses";
const REQUEST_TIMEOUT_MS = 120_000;

/** Overridable, because model names move faster than this codebase does. */
export const DEFAULT_OPENAI_MODEL = "gpt-6-astra";

type ResponsesPayload = {
  id?: string;
  status?: string;
  output_text?: string;
  incomplete_details?: { reason?: string };
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
      refusal?: string;
    }>;
  }>;
};

export class OpenAILLMProvider implements LLMProvider {
  readonly id = "openai" as const;
  readonly model: string;
  readonly isConfigured = true;

  readonly #apiKey: string;

  constructor(apiKey: string, model = DEFAULT_OPENAI_MODEL) {
    if (!apiKey) {
      throw new LLMError(
        "NOT_CONFIGURED",
        "Lesson generation is not configured on this server.",
        { status: 503 },
      );
    }
    this.#apiKey = apiKey;
    this.model = model;
  }

  async complete<T>(request: StructuredRequest): Promise<StructuredResult<T>> {
    const content: Array<Record<string, unknown>> = [
      { type: "input_text", text: request.user },
    ];
    for (const image of request.images ?? []) {
      content.push({ type: "input_image", image_url: image, detail: "high" });
    }

    let response: Response;
    try {
      response = await fetch(OPENAI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.#apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          input: [
            { role: "system", content: request.system },
            { role: "user", content },
          ],
          text: {
            format: {
              type: "json_schema",
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

    if (!response.ok) {
      // Read only the machine-readable code, never the provider's prose. A 429
      // can mean "slow down" or "you are out of credit", and those need
      // completely different actions from whoever runs this server.
      let providerCode: string | undefined;
      try {
        const body = (await response.json()) as {
          error?: { code?: string; type?: string };
        };
        providerCode = body.error?.code ?? body.error?.type;
      } catch {
        providerCode = undefined;
      }
      throw mapLlmHttpError(response.status, providerCode);
    }

    let payload: ResponsesPayload;
    try {
      payload = (await response.json()) as ResponsesPayload;
    } catch (cause) {
      throw new LLMError(
        "PROVIDER_ERROR",
        "The generation service returned a response we could not read.",
        { status: 502, cause },
      );
    }

    // A refusal is a deliberate answer, not a transport failure, and must not
    // be reported as a broken service.
    const refusal = payload.output
      ?.flatMap((item) => item.content ?? [])
      .find((part) => part.type === "refusal")?.refusal;
    if (refusal) {
      throw new LLMError(
        "CONTENT_REFUSED",
        "The generation service declined to produce material for this text. Check the source content.",
        { status: 422 },
      );
    }

    if (payload.status === "incomplete") {
      throw new LLMError(
        "MALFORMED_OUTPUT",
        "Generation stopped before it finished. Try a shorter lesson.",
        { status: 502 },
      );
    }

    const text =
      payload.output_text ??
      payload.output
        ?.flatMap((item) => item.content ?? [])
        .find((part) => typeof part.text === "string")?.text;

    if (!text) {
      throw new LLMError(
        "MALFORMED_OUTPUT",
        "The generation service returned nothing usable.",
        { status: 502 },
      );
    }

    try {
      return {
        data: JSON.parse(text) as T,
        provider: this.id,
        model: this.model,
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

const QUOTA_CODES = new Set([
  "insufficient_quota",
  "credit_balance_exhausted",
  "billing_hard_limit_reached",
]);

function mapLlmHttpError(status: number, providerCode?: string): LLMError {
  if (status === 401 || status === 403) {
    return new LLMError(
      "INVALID_CREDENTIALS",
      "The generation service rejected this server's credentials. An administrator needs to check the API key.",
      { status: 502 },
    );
  }
  if (providerCode && QUOTA_CODES.has(providerCode)) {
    return new LLMError(
      "QUOTA_EXHAUSTED",
      "The generation account has no credit left. An administrator needs to top up the OpenAI account — waiting will not fix this.",
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
  if (status === 413) {
    return new LLMError(
      "INPUT_TOO_LONG",
      "That lesson is too long to process in one go. Try a shorter extract.",
      { status: 413 },
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
