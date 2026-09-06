import { z } from "zod";

/**
 * The teaching package: the ten things a teacher gets from one source text.
 *
 * `hi` is the language of instruction, `sat` the mother tongue. Every `sat`
 * field is nullable because translation can be unavailable, and a null there
 * must read as "not translated" rather than as an empty lesson.
 *
 * Every field is editable by the teacher. Nothing here is authoritative.
 */
export const BilingualSchema = z.object({
  hi: z.string(),
  sat: z.string().nullable().default(null),
});
export type Bilingual = z.infer<typeof BilingualSchema>;

export const VocabularyItemSchema = z.object({
  term: z.string(),
  meaning: z.string(),
  sat: z.string().nullable().default(null),
});

export const QuestionSchema = z.object({
  question: z.string(),
  answer: z.string(),
  sat: z.string().nullable().default(null),
});

export const TeachingPackageSchema = z.object({
  learningObjective: BilingualSchema,
  teacherExplanation: BilingualSchema,
  teacherScript: BilingualSchema,
  vocabulary: z.array(VocabularyItemSchema),
  activity: z.object({
    title: z.string(),
    materials: z.array(z.string()),
    steps: z.array(z.string()),
    sat: z.string().nullable().default(null),
  }),
  practiceQuestions: z.array(QuestionSchema),
  assessment: z.object({
    description: z.string(),
    criteria: z.array(z.string()),
    sat: z.string().nullable().default(null),
  }),
  homework: BilingualSchema,
  /**
   * Deliberately named "suggested".
   *
   * This is a model's guess at which foundational literacy and numeracy goals
   * the lesson touches. No NCERT or state curriculum document has been loaded
   * into this product, nothing has been checked against one, and presenting
   * this as verified alignment would be a claim about official policy that
   * nobody here is in a position to make.
   */
  suggestedFlnAlignment: z.array(z.string()),
});

export type TeachingPackageContent = z.infer<typeof TeachingPackageSchema>;

/** Wire schema for the model. Strict mode forbids optional keys and defaults. */
export const TEACHING_PACKAGE_JSON_SCHEMA = {
  type: "object",
  properties: {
    learningObjective: { type: "string" },
    teacherExplanation: { type: "string" },
    teacherScript: { type: "string" },
    vocabulary: {
      type: "array",
      items: {
        type: "object",
        properties: {
          term: { type: "string" },
          meaning: { type: "string" },
        },
        required: ["term", "meaning"],
        additionalProperties: false,
      },
    },
    activity: {
      type: "object",
      properties: {
        title: { type: "string" },
        materials: { type: "array", items: { type: "string" } },
        steps: { type: "array", items: { type: "string" } },
      },
      required: ["title", "materials", "steps"],
      additionalProperties: false,
    },
    practiceQuestions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          answer: { type: "string" },
        },
        required: ["question", "answer"],
        additionalProperties: false,
      },
    },
    assessment: {
      type: "object",
      properties: {
        description: { type: "string" },
        criteria: { type: "array", items: { type: "string" } },
      },
      required: ["description", "criteria"],
      additionalProperties: false,
    },
    homework: { type: "string" },
    suggestedFlnAlignment: { type: "array", items: { type: "string" } },
  },
  required: [
    "learningObjective",
    "teacherExplanation",
    "teacherScript",
    "vocabulary",
    "activity",
    "practiceQuestions",
    "assessment",
    "homework",
    "suggestedFlnAlignment",
  ],
  additionalProperties: false,
} as const;

/** What the model returns, before translation fills in the `sat` fields. */
export type GeneratedPackage = {
  learningObjective: string;
  teacherExplanation: string;
  teacherScript: string;
  vocabulary: Array<{ term: string; meaning: string }>;
  activity: { title: string; materials: string[]; steps: string[] };
  practiceQuestions: Array<{ question: string; answer: string }>;
  assessment: { description: string; criteria: string[] };
  homework: string;
  suggestedFlnAlignment: string[];
};

export function toPackageContent(
  generated: GeneratedPackage,
): TeachingPackageContent {
  return {
    learningObjective: { hi: generated.learningObjective, sat: null },
    teacherExplanation: { hi: generated.teacherExplanation, sat: null },
    teacherScript: { hi: generated.teacherScript, sat: null },
    vocabulary: generated.vocabulary.map((item) => ({ ...item, sat: null })),
    activity: { ...generated.activity, sat: null },
    practiceQuestions: generated.practiceQuestions.map((item) => ({
      ...item,
      sat: null,
    })),
    assessment: { ...generated.assessment, sat: null },
    homework: { hi: generated.homework, sat: null },
    suggestedFlnAlignment: generated.suggestedFlnAlignment,
  };
}
