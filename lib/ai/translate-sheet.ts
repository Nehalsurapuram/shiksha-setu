import "server-only";

import type {
  FlashcardDeck,
  WorksheetContent,
} from "@/lib/ai/generated-content";
import {
  hasEnoughContextToTranslate,
  translateLong,
} from "@/lib/ai/translate-long";
import type { TranslationService } from "@/lib/ai/TranslationService";

export type TranslateTarget = {
  service: TranslationService;
  sourceCode: string;
  targetCode: string;
  userId: string | null;
};

export type TranslationOutcome = {
  /** Null when everything that could be translated was. */
  note: string | null;
  translatedCount: number;
  skippedCount: number;
};

/**
 * Fills the `sat` fields of a worksheet or assessment.
 *
 * Sequential rather than parallel: the provider rate limits, and a burst of a
 * dozen chunks from one sheet is the fastest way to trip it.
 */
export async function translateSheet(
  content: WorksheetContent,
  target: TranslateTarget,
): Promise<TranslationOutcome> {
  if (target.service.isDemo) {
    return {
      note: "Not translated: no translation provider is configured, so the mother-tongue column is empty rather than invented.",
      translatedCount: 0,
      skippedCount: 0,
    };
  }

  let translated = 0;
  let skipped = 0;

  const into = async (text: string): Promise<string | null> => {
    if (!hasEnoughContextToTranslate(text)) {
      skipped += 1;
      return null;
    }
    const result = await translateLong(
      target.service,
      text,
      target.sourceCode,
      target.targetCode,
      target.userId,
    );
    if (result) translated += 1;
    return result;
  };

  content.titleSat = await into(content.title);
  content.instructionsSat = await into(content.instructions);

  for (const question of content.questions) {
    question.promptSat = await into(question.prompt);
    // Options and answers are usually one or two words, so they go through the
    // same context check and are normally left alone.
    question.answerSat = await into(question.answer);
  }

  return { note: noteFor(translated, skipped), translatedCount: translated, skippedCount: skipped };
}

/**
 * Fills the `sat` fields of a flashcard deck.
 *
 * The term itself is never machine translated — a single word is exactly the
 * case the context check exists for — but the example sentence is, which is
 * what gives the mother-tongue side of the card its value.
 */
export async function translateDeck(
  deck: FlashcardDeck,
  target: TranslateTarget,
): Promise<TranslationOutcome> {
  if (target.service.isDemo) {
    return {
      note: "Not translated: no translation provider is configured, so the mother-tongue side is empty rather than invented.",
      translatedCount: 0,
      skippedCount: 0,
    };
  }

  let translated = 0;
  let skipped = 0;

  for (const card of deck.cards) {
    // Deliberately skipped, not attempted: see hasEnoughContextToTranslate.
    card.termSat = null;
    skipped += 1;

    if (hasEnoughContextToTranslate(card.exampleSentence)) {
      const result = await translateLong(
        target.service,
        card.exampleSentence,
        target.sourceCode,
        target.targetCode,
        target.userId,
      );
      card.exampleSentenceSat = result;
      if (result) translated += 1;
    } else {
      card.exampleSentenceSat = null;
      skipped += 1;
    }
  }

  return { note: noteFor(translated, skipped), translatedCount: translated, skippedCount: skipped };
}

function noteFor(translated: number, skipped: number): string | null {
  if (translated === 0 && skipped > 0) {
    return "Nothing was translated: every field was too short to translate reliably, or the translation service could not be reached. Fill the mother-tongue fields in by hand.";
  }
  if (skipped > 0) {
    return `${skipped} short field(s) were left untranslated on purpose — single words translate unreliably without a sentence around them. Fill those in by hand.`;
  }
  return null;
}
