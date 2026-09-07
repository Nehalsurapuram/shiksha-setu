import { z } from "zod";

/**
 * FLN / NIPUN Bharat alignment.
 *
 * Two kinds of thing live here and they must never be confused:
 *
 *  - **Verified** alignment comes from a `LearningOutcome` row that has a
 *    `verifiedSource` — a real published document somebody loaded and that can
 *    be checked. This installation has none.
 *  - **Suggested** alignment is a model's plain-language guess. It is labelled
 *    "Suggested FLN Alignment" everywhere it appears, badged as unverified, and
 *    carries no codes at all.
 *
 * There is deliberately no `code` field on the suggested shape. A learning
 * outcome code looks authoritative and is trivially invented; a headmaster or
 * a block officer reading "FLN 2.3" has no way to tell a real code from a
 * fabricated one, and the whole product's credibility rests on not doing that.
 */
export const AlignmentStatusSchema = z.enum(["verified", "suggested"]);
export type AlignmentStatus = z.infer<typeof AlignmentStatusSchema>;

/** Common to every kind of material. */
export const AlignmentCoreSchema = z.object({
  learningArea: z.string(),
  competency: z.string(),
  outcome: z.string(),
});
export type AlignmentCore = z.infer<typeof AlignmentCoreSchema>;

/** Lessons: the spec's Learning Area, Competency, Outcome, Activity, Assessment. */
export const LessonAlignmentSchema = AlignmentCoreSchema.extend({
  activity: z.string(),
  assessment: z.string(),
});
export type LessonAlignment = z.infer<typeof LessonAlignmentSchema>;

/** One row of the worksheet / assessment alignment table. */
export const QuestionAlignmentSchema = z.object({
  /** Index into the material's own question list. */
  questionIndex: z.number().int().min(0),
  skill: z.string(),
});
export type QuestionAlignment = z.infer<typeof QuestionAlignmentSchema>;

export const SheetAlignmentSchema = AlignmentCoreSchema.extend({
  questions: z.array(QuestionAlignmentSchema),
});
export type SheetAlignment = z.infer<typeof SheetAlignmentSchema>;

/**
 * What gets stored on a lesson, worksheet or assessment.
 *
 * `status` and `verifiedSource` travel with the payload rather than being
 * recomputed by each screen, so a stored alignment cannot be re-rendered later
 * as though it were verified.
 */
export const StoredAlignmentSchema = z.object({
  status: AlignmentStatusSchema,
  /** Citation, only ever present when status is "verified". */
  verifiedSource: z.string().nullable().default(null),
  /** Set only when a verified catalogue row supplied it. Never generated. */
  code: z.string().nullable().default(null),
  learningArea: z.string(),
  competency: z.string(),
  outcome: z.string(),
  activity: z.string().nullable().default(null),
  assessment: z.string().nullable().default(null),
  questions: z.array(QuestionAlignmentSchema).default([]),
  /** Provider and model that produced a suggestion, for the audit trail. */
  provider: z.string().nullable().default(null),
  model: z.string().nullable().default(null),
  generatedAt: z.string().nullable().default(null),
});
export type StoredAlignment = z.infer<typeof StoredAlignmentSchema>;

/* ------------------------------------------------------------------ wire */

export const LESSON_ALIGNMENT_JSON_SCHEMA = {
  type: "object",
  properties: {
    learningArea: {
      type: "string",
      description:
        "Foundational Literacy or Foundational Numeracy, or the school subject area. Plain words only.",
    },
    competency: {
      type: "string",
      description:
        "The broad ability this lesson builds, in plain words. NO codes, NO document references.",
    },
    outcome: {
      type: "string",
      description:
        "What a child should be able to do after this lesson, in plain words, starting with a verb.",
    },
    activity: {
      type: "string",
      description: "The classroom activity that builds towards this outcome.",
    },
    assessment: {
      type: "string",
      description: "How a teacher would check the outcome was reached.",
    },
  },
  required: ["learningArea", "competency", "outcome", "activity", "assessment"],
  additionalProperties: false,
} as const;

export const SHEET_ALIGNMENT_JSON_SCHEMA = {
  type: "object",
  properties: {
    learningArea: { type: "string", description: "Plain words. No codes." },
    competency: { type: "string", description: "Plain words. No codes." },
    outcome: {
      type: "string",
      description: "What a child who does well on this material can do.",
    },
    questions: {
      type: "array",
      description: "One entry per question, in order.",
      items: {
        type: "object",
        properties: {
          questionIndex: { type: "integer" },
          skill: {
            type: "string",
            description:
              "The single skill this question tests, in three to six plain words.",
          },
        },
        required: ["questionIndex", "skill"],
        additionalProperties: false,
      },
    },
  },
  required: ["learningArea", "competency", "outcome", "questions"],
  additionalProperties: false,
} as const;

/**
 * Strips anything that looks like an official code from generated text.
 *
 * The prompt forbids codes; this enforces it. Models emit strings like
 * "NIPUN FLN 2.3" or "LO-M-104" readily, and a teacher forwarding that to a
 * block officer would be passing on a fabricated citation. Belt and braces,
 * because the cost of one slipping through is a false claim about government
 * policy.
 */
const CODE_PATTERNS: RegExp[] = [
  // "FLN 2.3", "NIPUN 1.2.3", "LO 4.1", with or without a separator.
  /\b(?:NIPUN|FLN|LO|NCERT|NCF|CBSE)\b[\s:_-]*\d+(?:\.\d+)*/gi,
  // "LO-M-104", "FLN-L-2"
  /\b(?:LO|FLN|NIPUN)[-_][A-Z]{1,3}[-_]?\d+/gi,
  // Bare bracketed codes: "(Code: 2.3.1)"
  /\(\s*(?:code|ref|reference)\s*:?[^)]*\)/gi,
];

export function stripInventedCodes(text: string): string {
  let cleaned = text;
  for (const pattern of CODE_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }
  return cleaned.replace(/\s{2,}/g, " ").replace(/\s+([.,;:])/g, "$1").trim();
}

export function containsInventedCode(text: string): boolean {
  return CODE_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  });
}
