import "server-only";

import { LLMError } from "@/lib/ai/llm-provider";
import type { LLMService } from "@/lib/ai/LLMService";
import {
  LESSON_ALIGNMENT_JSON_SCHEMA,
  SHEET_ALIGNMENT_JSON_SCHEMA,
  stripInventedCodes,
  type StoredAlignment,
} from "@/lib/fln/alignment";
import { findVerifiedOutcomes } from "@/lib/fln/catalogue";

const ALIGNMENT_SYSTEM = [
  "You map primary-school teaching material to foundational literacy and numeracy goals.",
  "",
  "Hard rules:",
  "- Write in plain English. Describe what a child can DO.",
  "- NEVER produce a code, number, clause or document reference of any kind. No 'FLN 2.3', no 'LO-M-104', no NIPUN Bharat or NCERT citations, no page numbers, no chapter references.",
  "- You do not have the NIPUN Bharat, NCERT or any state curriculum document. Do not act as if you do, and do not claim a mapping to one.",
  "- If the material does not clearly build a foundational skill, say so plainly rather than stretching to fit one.",
].join("\n");

export type AlignmentContext = {
  title: string;
  grade: number | null;
  subject: string | null;
  topic: string | null;
  /** The material itself, so the mapping describes what is actually there. */
  body: string;
};

/**
 * Produces the alignment shown on a lesson.
 *
 * Verified catalogue rows win outright: if this installation has real mappings
 * for the class and subject, the first is returned with its citation and no
 * model is called. Otherwise a suggestion is generated and clearly marked.
 */
export async function buildLessonAlignment(
  llm: LLMService,
  context: AlignmentContext,
): Promise<StoredAlignment> {
  const verified = await findVerifiedOutcomes({
    classLevel: context.grade,
    subject: context.subject,
    take: 1,
  });

  if (verified.length > 0) {
    const match = verified[0];
    return {
      status: "verified",
      verifiedSource: match.verifiedSource,
      code: match.code,
      learningArea: match.learningArea,
      competency: match.competency,
      outcome: match.outcome,
      activity: null,
      assessment: null,
      questions: [],
      provider: null,
      model: null,
      generatedAt: new Date().toISOString(),
    };
  }

  const { data } = await llm.completeStructured<{
    learningArea: string;
    competency: string;
    outcome: string;
    activity: string;
    assessment: string;
  }>({
    system: ALIGNMENT_SYSTEM,
    user: buildPrompt(context, "lesson"),
    schemaName: "lesson_alignment",
    schema: LESSON_ALIGNMENT_JSON_SCHEMA,
  });

  return {
    status: "suggested",
    verifiedSource: null,
    // Never populated from a model, whatever it returns.
    code: null,
    learningArea: stripInventedCodes(data.learningArea),
    competency: stripInventedCodes(data.competency),
    outcome: stripInventedCodes(data.outcome),
    activity: stripInventedCodes(data.activity),
    assessment: stripInventedCodes(data.assessment),
    questions: [],
    provider: llm.providerId,
    model: llm.model,
    generatedAt: new Date().toISOString(),
  };
}

/** The same, for a worksheet or assessment, with a skill per question. */
export async function buildSheetAlignment(
  llm: LLMService,
  context: AlignmentContext,
  questionCount: number,
): Promise<StoredAlignment> {
  const verified = await findVerifiedOutcomes({
    classLevel: context.grade,
    subject: context.subject,
    take: 1,
  });

  const { data } = await llm.completeStructured<{
    learningArea: string;
    competency: string;
    outcome: string;
    questions: Array<{ questionIndex: number; skill: string }>;
  }>({
    system: ALIGNMENT_SYSTEM,
    user: `${buildPrompt(context, "worksheet or assessment")}\n\nGive one entry per question, ${questionCount} in total, indexed from 0.`,
    schemaName: "sheet_alignment",
    schema: SHEET_ALIGNMENT_JSON_SCHEMA,
  });

  // Only skills come from the model when a verified outcome exists; the
  // outcome itself then comes from the catalogue with its citation attached.
  const match = verified[0];

  return {
    status: match ? "verified" : "suggested",
    verifiedSource: match?.verifiedSource ?? null,
    code: match?.code ?? null,
    learningArea: match?.learningArea ?? stripInventedCodes(data.learningArea),
    competency: match?.competency ?? stripInventedCodes(data.competency),
    outcome: match?.outcome ?? stripInventedCodes(data.outcome),
    activity: null,
    assessment: null,
    questions: (data.questions ?? [])
      .filter(
        (entry) =>
          entry.questionIndex >= 0 && entry.questionIndex < questionCount,
      )
      .map((entry) => ({
        questionIndex: entry.questionIndex,
        skill: stripInventedCodes(entry.skill),
      })),
    provider: llm.providerId,
    model: llm.model,
    generatedAt: new Date().toISOString(),
  };
}

function buildPrompt(context: AlignmentContext, what: string): string {
  return [
    `Map this ${what} to a foundational learning goal.`,
    "",
    `Title: ${context.title}`,
    context.grade ? `Class: ${context.grade}` : "",
    context.subject ? `Subject: ${context.subject}` : "",
    context.topic ? `Topic: ${context.topic}` : "",
    "",
    "Material:",
    context.body.slice(0, 6000),
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Alignment is a nice-to-have on top of the material.
 *
 * If it fails, the worksheet is still a worksheet — so callers use this and
 * carry on with a null alignment rather than losing a generation the teacher
 * has already waited a minute for.
 */
export async function tryBuildAlignment(
  build: () => Promise<StoredAlignment>,
): Promise<{ alignment: StoredAlignment | null; note: string | null }> {
  try {
    return { alignment: await build(), note: null };
  } catch (error) {
    const message =
      error instanceof LLMError
        ? error.publicMessage
        : "The alignment could not be generated.";
    console.error("[fln] alignment", error);
    return {
      alignment: null,
      note: `No FLN alignment was produced: ${message} The material itself is unaffected.`,
    };
  }
}
