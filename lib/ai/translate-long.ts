import "server-only";

import { MAX_INPUT_CHARS } from "@/lib/ai/translation-limits";
import type { TranslationService } from "@/lib/ai/TranslationService";

/** Leaves headroom under the provider's hard limit. */
const CHUNK_LIMIT = Math.floor(MAX_INPUT_CHARS * 0.9);

/**
 * Splits at sentence boundaries, never mid-sentence.
 *
 * A translator handed half a sentence produces half a meaning, and Sarvam's
 * per-request ceiling is well below the length of a teacher script. Devanagari
 * uses the danda (।) as a full stop, so it is a boundary alongside . ! ? and
 * newlines.
 */
export function splitForTranslation(text: string, limit = CHUNK_LIMIT): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= limit) return [trimmed];

  const sentences = trimmed
    .split(/(?<=[।.!?\n])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (sentence.length > limit) {
      // A single sentence longer than the limit: flush, then hard-split it.
      if (current) {
        chunks.push(current);
        current = "";
      }
      for (let i = 0; i < sentence.length; i += limit) {
        chunks.push(sentence.slice(i, i + limit));
      }
      continue;
    }

    if (!current) current = sentence;
    else if (current.length + 1 + sentence.length <= limit)
      current = `${current} ${sentence}`;
    else {
      chunks.push(current);
      current = sentence;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

/**
 * Whether a string has enough context to translate reliably.
 *
 * Measured against the live Sarvam API: `पौधा` on its own comes back as a
 * sentence of meta-commentary about the word, and `तना` comes back truncated,
 * while the same words inside a sentence translate cleanly. An isolated word
 * gives the model nothing to disambiguate against.
 *
 * A teacher who cannot read Ol Chiki cannot catch a wrong word, and the word
 * is what a child copies down. So short fragments are left untranslated and
 * shown as such, rather than filled with something plausible.
 */
export function hasEnoughContextToTranslate(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const words = trimmed.split(/\s+/).filter(Boolean);
  return words.length >= 3 || trimmed.length >= 20;
}

/**
 * Translates text of any length, or returns null if it cannot.
 *
 * Null means "not translated" and every caller renders it as such. A partial
 * or failed translation is never passed off as a complete one.
 */
export async function translateLong(
  service: TranslationService,
  text: string,
  sourceLanguage: string,
  targetLanguage: string,
  userId: string | null,
): Promise<string | null> {
  const chunks = splitForTranslation(text);
  if (chunks.length === 0) return null;

  try {
    const results: string[] = [];
    // Sequential on purpose: the provider rate limits, and a burst of parallel
    // chunks from one lesson is the fastest way to trip it.
    for (const chunk of chunks) {
      const outcome = await service.translate({
        text: chunk,
        sourceLanguage,
        targetLanguage,
        userId,
      });
      if (outcome.isDemo) return null;
      results.push(outcome.translatedText);
    }
    return results.join(" ");
  } catch {
    // Logged by the caller if it matters; a missing translation is a visible,
    // recoverable state rather than a failed lesson.
    return null;
  }
}
