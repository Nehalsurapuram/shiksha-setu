import "server-only";

import { createHash } from "node:crypto";

import { DemoTranslationProvider } from "@/lib/ai/DemoTranslationProvider";
import {
  MAX_INPUT_CHARS,
  TranslationError,
  type ProviderId,
  type TranslationProvider,
  type TranslationResult,
} from "@/lib/ai/translation-provider";
import { prisma } from "@/lib/database/prisma";
import { env } from "@/lib/env";
import { SarvamTranslationProvider } from "@/lib/sarvam/SarvamTranslationProvider";

export type TranslateInput = {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  /** Null when there is no teacher record; the row is still stored. */
  userId?: string | null;
};

export type TranslateOutcome = {
  translationId: string;
  sourceLanguage: string;
  targetLanguage: string;
  sourceText: string;
  translatedText: string;
  provider: ProviderId;
  model: string;
  confidence: number | null;
  isDemo: boolean;
  /** True when this came from a stored translation rather than the provider. */
  cached: boolean;
  durationMs: number;
  createdAt: Date;
};

/**
 * Orchestrates translation: validate, pick a provider, reuse a stored result
 * when there is one, call the provider, persist, return.
 *
 * TranslationService → TranslationProvider → SarvamTranslationProvider.
 * Nothing here knows how Sarvam's HTTP API is shaped.
 */
export class TranslationService {
  readonly #provider: TranslationProvider;

  constructor(provider?: TranslationProvider) {
    this.#provider = provider ?? selectProvider();
  }

  get providerId(): ProviderId {
    return this.#provider.id;
  }

  get isDemo(): boolean {
    return this.#provider.id === "demo";
  }

  async translate(input: TranslateInput): Promise<TranslateOutcome> {
    const text = input.text.trim();

    if (!text) {
      throw new TranslationError(
        "EMPTY_INPUT",
        "Enter some text to translate.",
        { status: 400 },
      );
    }

    if (text.length > MAX_INPUT_CHARS) {
      throw new TranslationError(
        "INPUT_TOO_LONG",
        `That text is ${text.length} characters. Translate at most ${MAX_INPUT_CHARS} at a time — try one paragraph.`,
        { status: 413 },
      );
    }

    if (input.sourceLanguage === input.targetLanguage) {
      throw new TranslationError(
        "SAME_LANGUAGE",
        "Pick two different languages to translate between.",
        { status: 400 },
      );
    }

    // Languages must exist and be usable in the direction requested. This is
    // the authority, not the provider's list: a language Sarvam supports but
    // that we have not enabled must not be translatable here.
    const [source, target] = await Promise.all([
      prisma.language.findUnique({ where: { code: input.sourceLanguage } }),
      prisma.language.findUnique({ where: { code: input.targetLanguage } }),
    ]);

    if (!source || source.status !== "ACTIVE" || !source.isSource) {
      throw new TranslationError(
        "UNSUPPORTED_LANGUAGE",
        `${source?.name ?? input.sourceLanguage} is not available as a language of instruction yet.`,
        { status: 400 },
      );
    }

    if (!target || target.status !== "ACTIVE" || !target.isTarget) {
      throw new TranslationError(
        "UNSUPPORTED_LANGUAGE",
        `${target?.name ?? input.targetLanguage} is not available for translation yet.`,
        { status: 400 },
      );
    }

    if (!this.#provider.supports(source.code, target.code)) {
      throw new TranslationError(
        "UNSUPPORTED_LANGUAGE",
        `Translating ${source.name} to ${target.name} is not supported by the configured translation service.`,
        { status: 400 },
      );
    }

    const contentHash = hashContent(text, source.code, target.code);
    const startedAt = Date.now();

    // Reuse a stored translation for the same text and pair. Demo rows are
    // skipped once a real provider is configured, so switching a key on does
    // not leave placeholder text cached in front of teachers.
    const existing = await prisma.translation.findUnique({
      where: {
        contentHash_sourceLanguageId_targetLanguageId: {
          contentHash,
          sourceLanguageId: source.id,
          targetLanguageId: target.id,
        },
      },
    });

    const existingIsUsable =
      existing && (this.isDemo || existing.source !== "DEMO");

    if (existing && existingIsUsable) {
      return {
        translationId: existing.id,
        sourceLanguage: source.code,
        targetLanguage: target.code,
        sourceText: existing.sourceText,
        translatedText: existing.targetText,
        provider: existing.source === "DEMO" ? "demo" : "sarvam",
        model: existing.model ?? "unknown",
        confidence: existing.confidence,
        isDemo: existing.source === "DEMO",
        cached: true,
        durationMs: Date.now() - startedAt,
        createdAt: existing.createdAt,
      };
    }

    const result: TranslationResult = await this.#provider.translate({
      text,
      sourceLanguage: source.code,
      targetLanguage: target.code,
    });

    const durationMs = Date.now() - startedAt;

    const record = await prisma.translation.upsert({
      where: {
        contentHash_sourceLanguageId_targetLanguageId: {
          contentHash,
          sourceLanguageId: source.id,
          targetLanguageId: target.id,
        },
      },
      create: {
        sourceText: text,
        targetText: result.translatedText,
        source: result.provider === "demo" ? "DEMO" : "SARVAM",
        model: result.model,
        confidence: result.confidence,
        reviewStatus: "UNREVIEWED",
        contentHash,
        createdById: input.userId ?? null,
        sourceLanguageId: source.id,
        targetLanguageId: target.id,
      },
      update: {
        // Reached when a demo row is being replaced by a real translation.
        targetText: result.translatedText,
        source: result.provider === "demo" ? "DEMO" : "SARVAM",
        model: result.model,
        confidence: result.confidence,
        reviewStatus: "UNREVIEWED",
      },
    });

    return {
      translationId: record.id,
      sourceLanguage: source.code,
      targetLanguage: target.code,
      sourceText: text,
      translatedText: result.translatedText,
      provider: result.provider,
      model: result.model,
      confidence: result.confidence,
      isDemo: result.provider === "demo",
      cached: false,
      durationMs,
      createdAt: record.createdAt,
    };
  }
}

/**
 * Picks the provider from configuration.
 *
 * No key means the demo provider — never a silent failure, and never a real
 * provider pretending to work.
 */
export function selectProvider(): TranslationProvider {
  if (env.TRANSLATION_PROVIDER === "sarvam" && env.SARVAM_API_KEY) {
    return new SarvamTranslationProvider(env.SARVAM_API_KEY);
  }
  return new DemoTranslationProvider();
}

/**
 * Cache key for a translation.
 *
 * Whitespace is collapsed so trivially different input does not miss the
 * cache, and the language pair is part of the hash so the same sentence can be
 * translated into several mother tongues without colliding.
 */
export function hashContent(
  text: string,
  sourceLanguage: string,
  targetLanguage: string,
): string {
  const normalised = text.trim().replace(/\s+/g, " ");
  return createHash("sha256")
    .update(`${sourceLanguage}|${targetLanguage}|${normalised}`)
    .digest("hex");
}
