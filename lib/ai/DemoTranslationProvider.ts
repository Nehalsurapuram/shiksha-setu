import "server-only";

import type {
  TranslationProvider,
  TranslationRequest,
  TranslationResult,
} from "@/lib/ai/translation-provider";

/**
 * Stand-in provider used when no SARVAM_API_KEY is configured.
 *
 * It exists so the whole path — API route, validation, persistence, history,
 * corrections — can be built and exercised without a key. It is NOT a
 * translator, and the single most important thing about it is that its output
 * cannot be mistaken for one.
 *
 * So it does not emit invented Ol Chiki. A teacher cannot tell fake Santhali
 * from real Santhali — that is precisely why they need this product — and a
 * plausible-looking string here could be copied onto a blackboard. Instead it
 * returns a plain-language notice saying no translation happened, and every
 * result it produces is tagged `provider: "demo"` and stored with
 * `TranslationSource.DEMO`, so the UI can label it and no caller can quietly
 * present it as a Sarvam result.
 */
export class DemoTranslationProvider implements TranslationProvider {
  readonly id = "demo" as const;

  /** Accepts any pair: it is not translating, so it cannot fail to. */
  supports(): boolean {
    return true;
  }

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    return {
      translatedText: buildDemoNotice(request),
      provider: this.id,
      model: "demo",
      confidence: null,
      requestId: null,
    };
  }
}

function buildDemoNotice(request: TranslationRequest): string {
  return [
    "[Demo mode — this is NOT a translation.]",
    "",
    `No translation model was called, so no ${request.targetLanguage} text was produced.`,
    "Set SARVAM_API_KEY on the server to translate this text for real.",
    "",
    "Your original text was:",
    request.text,
  ].join("\n");
}
