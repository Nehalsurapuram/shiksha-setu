import "server-only";

import type {
  GeneratedQuestion,
  QuestionType,
  WorksheetContent,
} from "@/lib/ai/generated-content";
import { detectScriptLanguage } from "@/lib/extraction/detect";

export type EnforcementResult = {
  /** Notes for the teacher about what was dropped and why. Empty when clean. */
  warnings: string[];
};

/**
 * Makes the generated sheet match what was actually asked for.
 *
 * This is not defensive tidying — it is load-bearing. Measured against
 * `sarvam-105b`: a request for two TRUE_FALSE questions in Hindi came back as
 * ten questions of mixed types, several in English and one in romanised Hindi.
 * The prompt states the count, the types and the language explicitly; the model
 * still does not honour them.
 *
 * A teacher who asked for two true/false questions and got ten in the wrong
 * language has been handed a mess to clean up. Filtering is deterministic and
 * happens here, and anything dropped is reported rather than quietly removed.
 */
export function enforceSheetRequest(
  content: WorksheetContent,
  request: { count: number; questionTypes: QuestionType[]; languageCode: string },
): EnforcementResult {
  const warnings: string[] = [];
  const wanted = new Set(request.questionTypes);
  const original = content.questions.length;

  // 1. Only the formats the teacher chose.
  let questions = content.questions.filter((question) =>
    wanted.has(question.type),
  );
  const wrongType = original - questions.length;

  // 2. Only questions actually written in the requested language. A worksheet
  //    with English questions in it is worse than a shorter one.
  const beforeLanguage = questions.length;
  questions = questions.filter((question) =>
    isInExpectedLanguage(question, request.languageCode),
  );
  const wrongLanguage = beforeLanguage - questions.length;

  // 3. Drop anything too short to be a question at all — bare answers and
  //    stray fragments have both been observed.
  const beforeEmpty = questions.length;
  questions = questions.filter(
    (question) => question.prompt.trim().length >= 8 && question.answer.trim(),
  );
  const malformed = beforeEmpty - questions.length;

  // 4. The number asked for, no more.
  const beforeCount = questions.length;
  questions = questions.slice(0, request.count);
  const extra = beforeCount - questions.length;

  content.questions = questions;

  if (wrongType > 0) {
    warnings.push(
      `${wrongType} question(s) came back in a format you did not ask for and were removed.`,
    );
  }
  if (wrongLanguage > 0) {
    warnings.push(
      `${wrongLanguage} question(s) came back in the wrong language and were removed.`,
    );
  }
  if (malformed > 0) {
    warnings.push(`${malformed} incomplete question(s) were removed.`);
  }
  if (extra > 0) {
    warnings.push(`${extra} extra question(s) beyond the number you asked for were removed.`);
  }
  if (questions.length < request.count) {
    warnings.push(
      `You asked for ${request.count} questions and ${questions.length} usable one(s) came back. Press Regenerate for more.`,
    );
  }

  return { warnings };
}

/**
 * Whether a question is written in the expected script.
 *
 * Script, not language: Devanagari does not by itself distinguish Hindi from
 * Marathi. It is enough here, because the failure being caught is a whole
 * question arriving in English or Odia, not a subtle dialect difference.
 * Anything the detector cannot classify is kept, so an unusual but valid
 * question is never thrown away on a guess.
 */
function isInExpectedLanguage(
  question: GeneratedQuestion,
  expectedCode: string,
): boolean {
  const detected = detectScriptLanguage(question.prompt);
  if (!detected.code) return true;
  return detected.code === expectedCode;
}
