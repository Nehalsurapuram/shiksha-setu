import "server-only";

import { LLMError } from "@/lib/ai/llm-provider";
import { selectLLMProvider } from "@/lib/ai/LLMService";

export type Detection = {
  /** Language code, when the script identifies one unambiguously. */
  languageCode: string | null;
  languageName: string | null;
  /** How the language was decided, so the UI can say. */
  languageMethod: "script" | "none";
  title: string | null;
  grade: number | null;
  subject: string | null;
  topic: string | null;
  /** Which of title/grade/subject/topic came from a model, if any. */
  metadataMethod: "model" | "none";
  /** Set when metadata could not be detected and must be filled in by hand. */
  metadataNote: string | null;
};

/**
 * Language detection by script.
 *
 * Deterministic and offline: Devanagari and Ol Chiki occupy separate Unicode
 * blocks, so counting characters answers the question without a model. This is
 * the only detection step that still works when no LLM is configured, which is
 * why it is kept separate from the rest.
 *
 * It identifies a *script*, not a language — Devanagari also writes Marathi and
 * Nepali. Since this installation's instruction language is the only Devanagari
 * language enabled, that is a safe mapping here, and the UI leaves the field
 * editable regardless.
 */
export function detectScriptLanguage(text: string): {
  code: string | null;
  name: string | null;
} {
  let devanagari = 0;
  let olChiki = 0;
  let latin = 0;

  for (const character of text) {
    const point = character.codePointAt(0) ?? 0;
    if (point >= 0x0900 && point <= 0x097f) devanagari += 1;
    else if (point >= 0x1c50 && point <= 0x1c7f) olChiki += 1;
    else if ((point >= 0x41 && point <= 0x5a) || (point >= 0x61 && point <= 0x7a))
      latin += 1;
  }

  const total = devanagari + olChiki + latin;
  if (total < 10) return { code: null, name: null };

  if (olChiki / total > 0.3) return { code: "sat-IN", name: "Santhali" };
  if (devanagari / total > 0.3) return { code: "hi-IN", name: "Hindi" };
  if (latin / total > 0.6) return { code: "en-IN", name: "English" };
  return { code: null, name: null };
}

const DETECTION_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    grade: {
      type: ["integer", "null"],
      description: "Class 1-8, or null if the text does not indicate one.",
    },
    subject: { type: ["string", "null"] },
    topic: { type: ["string", "null"] },
  },
  required: ["title", "grade", "subject", "topic"],
  additionalProperties: false,
} as const;

/**
 * Detects the lesson's language, class, subject and topic.
 *
 * Language always comes from the script. Class, subject and topic need
 * judgement, so they come from a model when one is configured and are left
 * blank otherwise — a guessed class level is worse than an empty field the
 * teacher fills in, because the teacher would have to notice it was wrong.
 */
export async function detectLessonMetadata(text: string): Promise<Detection> {
  const language = detectScriptLanguage(text);

  const base: Detection = {
    languageCode: language.code,
    languageName: language.name,
    languageMethod: language.code ? "script" : "none",
    title: null,
    grade: null,
    subject: null,
    topic: null,
    metadataMethod: "none",
    metadataNote: null,
  };

  const provider = selectLLMProvider();
  if (!provider.isConfigured) {
    return {
      ...base,
      metadataNote:
        "Class, subject and topic were not detected because the generation service is not configured. Fill them in below.",
    };
  }

  try {
    const { data } = await provider.complete<{
      title: string;
      grade: number | null;
      subject: string | null;
      topic: string | null;
    }>({
      system:
        "You read a page from an Indian primary school textbook and identify what it is. Answer only from what the text actually shows. If the class level, subject or topic is not evident, return null for it rather than guessing.",
      user: `Identify this lesson.\n\n${text.slice(0, 4000)}`,
      schemaName: "lesson_detection",
      schema: DETECTION_SCHEMA,
    });

    return {
      ...base,
      title: data.title?.trim() || null,
      grade: data.grade,
      subject: data.subject?.trim() || null,
      topic: data.topic?.trim() || null,
      metadataMethod: "model",
    };
  } catch (error) {
    // Detection is a convenience. Losing it must not block an upload, so the
    // teacher just fills the fields in by hand.
    return {
      ...base,
      metadataNote:
        error instanceof LLMError
          ? `Class, subject and topic could not be detected: ${error.publicMessage} Fill them in below.`
          : "Class, subject and topic could not be detected. Fill them in below.",
    };
  }
}
