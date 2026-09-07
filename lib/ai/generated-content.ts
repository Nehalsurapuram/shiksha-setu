import { z } from "zod";

/**
 * Shapes for the three Phase 8 generators.
 *
 * Every learner-facing string is a pair: `hi` in the language of instruction
 * and `sat` in the mother tongue, where `sat` is nullable. Null means "not
 * translated" and every screen renders it as such — never as a blank that
 * could be mistaken for an empty question.
 */

export const QUESTION_TYPES = [
  "MULTIPLE_CHOICE",
  "FILL_IN_BLANK",
  "TRUE_FALSE",
  "MATCHING",
  "PICTURE_BASED",
  "COUNTING",
  "SHORT_ANSWER",
  "ORAL",
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  MULTIPLE_CHOICE: "Multiple choice",
  FILL_IN_BLANK: "Fill in the blank",
  TRUE_FALSE: "True or false",
  MATCHING: "Matching",
  PICTURE_BASED: "Picture-based",
  COUNTING: "Counting",
  SHORT_ANSWER: "Short answer",
  ORAL: "Oral",
};

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

const nullableString = z.string().nullable().default(null);

/**
 * One question, in any of the supported formats.
 *
 * The optional arrays carry format-specific detail: `options` for multiple
 * choice, `pairs` for matching. A format that does not use them leaves them
 * empty rather than the schema branching into a union, which smaller models
 * handle badly.
 */
export const GeneratedQuestionSchema = z.object({
  type: z.enum(QUESTION_TYPES),
  prompt: z.string(),
  promptSat: nullableString,
  options: z.array(z.string()).default([]),
  optionsSat: z.array(z.string()).default([]),
  pairs: z
    .array(z.object({ left: z.string(), right: z.string() }))
    .default([]),
  answer: z.string(),
  answerSat: nullableString,
  /** Emoji stand-in for picture and counting questions. Never a photograph. */
  icon: z.string().nullable().default(null),
  marks: z.number().int().min(1).max(10).default(1),
});

export type GeneratedQuestion = z.infer<typeof GeneratedQuestionSchema>;

export const WorksheetContentSchema = z.object({
  title: z.string(),
  titleSat: nullableString,
  instructions: z.string(),
  instructionsSat: nullableString,
  questions: z.array(GeneratedQuestionSchema),
});
export type WorksheetContent = z.infer<typeof WorksheetContentSchema>;

export const AssessmentContentSchema = z.object({
  title: z.string(),
  titleSat: nullableString,
  instructions: z.string(),
  instructionsSat: nullableString,
  questions: z.array(GeneratedQuestionSchema),
});
export type AssessmentContent = z.infer<typeof AssessmentContentSchema>;

export const GeneratedCardSchema = z.object({
  term: z.string(),
  termSat: nullableString,
  meaning: z.string(),
  exampleSentence: z.string(),
  exampleSentenceSat: nullableString,
  icon: z.string().nullable().default(null),
});
export type GeneratedCard = z.infer<typeof GeneratedCardSchema>;

export const FlashcardDeckSchema = z.object({
  title: z.string(),
  cards: z.array(GeneratedCardSchema),
});
export type FlashcardDeck = z.infer<typeof FlashcardDeckSchema>;

/* ------------------------------------------------------------------ wire */

/**
 * JSON Schema sent to the model.
 *
 * Deliberately narrower than the Zod shapes above: the `sat` fields are absent
 * because the model must not produce Santhali. Translation goes through Sarvam
 * afterwards, which is the only thing in this system qualified to do it.
 */
const QUESTION_JSON_SCHEMA = {
  type: "object",
  properties: {
    type: { type: "string", enum: QUESTION_TYPES },
    prompt: { type: "string", description: "The question, in the source language." },
    options: {
      type: "array",
      items: { type: "string" },
      description: "Four options for MULTIPLE_CHOICE, otherwise an empty array.",
    },
    pairs: {
      type: "array",
      items: {
        type: "object",
        properties: { left: { type: "string" }, right: { type: "string" } },
        required: ["left", "right"],
        additionalProperties: false,
      },
      description: "Pairs for MATCHING, otherwise an empty array.",
    },
    answer: { type: "string", description: "The correct answer." },
    icon: {
      type: ["string", "null"],
      description:
        "A single emoji for PICTURE_BASED and COUNTING questions, otherwise null.",
    },
    marks: { type: "integer", description: "Marks for this question, usually 1." },
  },
  required: ["type", "prompt", "options", "pairs", "answer", "icon", "marks"],
  additionalProperties: false,
} as const;

export const WORKSHEET_JSON_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    instructions: {
      type: "string",
      description: "One or two sentences telling the child what to do.",
    },
    questions: { type: "array", items: QUESTION_JSON_SCHEMA },
  },
  required: ["title", "instructions", "questions"],
  additionalProperties: false,
} as const;

export const ASSESSMENT_JSON_SCHEMA = WORKSHEET_JSON_SCHEMA;

export const FLASHCARD_JSON_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    cards: {
      type: "array",
      items: {
        type: "object",
        properties: {
          term: { type: "string", description: "A single word in the source language." },
          meaning: {
            type: "string",
            description: "A short child-friendly meaning, in the source language.",
          },
          exampleSentence: {
            type: "string",
            description: "One short sentence using the word.",
          },
          icon: {
            type: ["string", "null"],
            description: "A single emoji that pictures the word, or null if none fits.",
          },
        },
        required: ["term", "meaning", "exampleSentence", "icon"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "cards"],
  additionalProperties: false,
} as const;

/** What the model returns, before translation fills in the `sat` fields. */
export type RawQuestion = {
  type: QuestionType;
  prompt: string;
  options: string[];
  pairs: Array<{ left: string; right: string }>;
  answer: string;
  icon: string | null;
  marks: number;
};

export type RawSheet = {
  title: string;
  instructions: string;
  questions: RawQuestion[];
};

export type RawDeck = {
  title: string;
  cards: Array<{
    term: string;
    meaning: string;
    exampleSentence: string;
    icon: string | null;
  }>;
};

export function toQuestion(raw: RawQuestion): GeneratedQuestion {
  return {
    type: raw.type,
    prompt: raw.prompt,
    promptSat: null,
    options: raw.options ?? [],
    optionsSat: [],
    pairs: raw.pairs ?? [],
    answer: raw.answer,
    answerSat: null,
    icon: raw.icon,
    marks: raw.marks || 1,
  };
}

export function toSheetContent(raw: RawSheet): WorksheetContent {
  return {
    title: raw.title,
    titleSat: null,
    instructions: raw.instructions,
    instructionsSat: null,
    questions: raw.questions.map(toQuestion),
  };
}

export function toDeck(raw: RawDeck): FlashcardDeck {
  return {
    title: raw.title,
    cards: raw.cards.map((card) => ({
      term: card.term,
      termSat: null,
      meaning: card.meaning,
      exampleSentence: card.exampleSentence,
      exampleSentenceSat: null,
      icon: card.icon,
    })),
  };
}

/**
 * Picks the enum value stored on the row.
 *
 * A sheet whose questions are all one format records that format; anything
 * else is MIXED, which is more useful than recording whichever type happened
 * to come first.
 */
export function worksheetKindFor(questions: GeneratedQuestion[]): string {
  const types = new Set(questions.map((question) => question.type));
  if (types.size !== 1) return "MIXED";
  const only = [...types][0];
  const map: Record<string, string> = {
    MULTIPLE_CHOICE: "MULTIPLE_CHOICE",
    FILL_IN_BLANK: "FILL_IN_BLANKS",
    TRUE_FALSE: "TRUE_FALSE",
    MATCHING: "MATCHING",
    PICTURE_BASED: "PICTURE_LABELLING",
    COUNTING: "COUNTING",
    SHORT_ANSWER: "SHORT_ANSWER",
    ORAL: "SHORT_ANSWER",
  };
  return map[only] ?? "MIXED";
}

export function assessmentKindFor(questions: GeneratedQuestion[]): string {
  const types = new Set(questions.map((question) => question.type));
  if (types.size === 1 && types.has("ORAL")) return "ORAL";
  if (types.size === 1 && types.has("PICTURE_BASED")) return "PICTURE_BASED";
  if (types.has("ORAL")) return "MIXED";
  return "WRITTEN";
}
