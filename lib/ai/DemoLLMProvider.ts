import "server-only";

import {
  LLMError,
  type LLMProvider,
  type StructuredRequest,
  type StructuredResult,
} from "@/lib/ai/llm-provider";

/**
 * Stand-in used when no OPENAI_API_KEY is configured.
 *
 * It refuses rather than inventing a lesson. Everywhere else in this product
 * demo mode returns a labelled placeholder, and it does here too — but a
 * teaching package is the case where a plausible fake is most dangerous. A
 * lesson plan reads as authoritative, gets printed, and is taught to children;
 * "generate me a Class 2 science lesson" is exactly the kind of thing a
 * language model will answer fluently and wrongly, and a teacher checking a
 * subject they were not trained in has no way to catch it.
 *
 * So there is no demo teaching content anywhere in this codebase. The caller
 * gets an error it can show plainly.
 */
export class DemoLLMProvider implements LLMProvider {
  readonly id = "demo" as const;
  readonly model = "demo";
  readonly isConfigured = false;

  async complete<T>(_request: StructuredRequest): Promise<StructuredResult<T>> {
    throw new LLMError(
      "NOT_CONFIGURED",
      "Lesson generation is not configured on this server. Set OPENAI_API_KEY to generate teaching material — nothing is invented in the meantime.",
      { status: 503 },
    );
  }
}
