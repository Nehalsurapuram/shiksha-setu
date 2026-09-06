import "server-only";

import { DemoLLMProvider } from "@/lib/ai/DemoLLMProvider";
import {
  LLMError,
  MAX_LESSON_CHARS,
  type LLMProvider,
  type LLMProviderId,
} from "@/lib/ai/llm-provider";
import {
  TEACHING_PACKAGE_JSON_SCHEMA,
  type GeneratedPackage,
} from "@/lib/ai/teaching-package";
import { env } from "@/lib/env";
import { OpenAILLMProvider } from "@/lib/openai/OpenAILLMProvider";
import { SarvamLLMProvider } from "@/lib/sarvam/SarvamLLMProvider";

export type LessonContext = {
  sourceText: string;
  title?: string | null;
  grade?: number | null;
  subject?: string | null;
  topic?: string | null;
  /** Name of the language the source is written in, e.g. "Hindi". */
  languageName: string;
};

/**
 * The system instruction every call shares.
 *
 * The constraints are the point. A model asked for a lesson will happily
 * invent curriculum codes, cite policy documents and assert facts it has not
 * checked; each line below closes one of those doors.
 */
const SYSTEM = [
  "You write teaching material for government primary schools in tribal-majority districts of India.",
  "The teacher is trained in Hindi. The children speak a tribal mother tongue at home and are still acquiring Hindi.",
  "",
  "Rules:",
  "- Write in the SAME language as the source text. Do not translate; a separate system handles that.",
  "- Use simple, concrete language a Class 1-5 child can follow. Short sentences.",
  "- Use only examples a rural Indian classroom can actually do: no printed worksheets, no internet, no lab equipment. Assume a blackboard, chalk, and objects found in a village.",
  "- Base everything on the supplied source text. Do not add facts that are not in it or that you cannot verify.",
  "- NEVER cite NCERT codes, state curriculum codes, textbook page numbers, or policy documents. You do not have those documents.",
  "- For suggestedFlnAlignment, describe foundational literacy or numeracy goals in plain words (e.g. 'reads simple sentences aloud with understanding'). These are suggestions for a teacher to check, not official alignment.",
].join("\n");

/**
 * Lesson generation.
 *
 * LLMService → LLMProvider → OpenAILLMProvider, mirroring the translation
 * stack. Nothing here knows how OpenAI's HTTP API is shaped.
 */
export class LLMService {
  readonly #provider: LLMProvider;

  constructor(provider?: LLMProvider) {
    this.#provider = provider ?? selectLLMProvider();
  }

  get providerId(): LLMProviderId {
    return this.#provider.id;
  }

  get model(): string {
    return this.#provider.model;
  }

  get isConfigured(): boolean {
    return this.#provider.isConfigured;
  }

  /** The whole package in one call: objective through homework. */
  async generateLesson(context: LessonContext): Promise<GeneratedPackage> {
    const result = await this.#provider.complete<GeneratedPackage>({
      system: SYSTEM,
      user: buildPrompt(
        context,
        [
          "Produce a complete teaching package for this lesson.",
          // Counts are stated because the schema cannot express them: an array
          // of one is as valid as an array of five, and smaller models return
          // the minimum they can get away with.
          "Include at least 5 vocabulary words, exactly 5 practice questions with answers, at least 4 activity steps, and 2-3 suggested FLN goals.",
          "Keep each field to its own purpose: the objective is one or two sentences, not a summary of the whole lesson.",
        ].join(" "),
      ),
      schemaName: "teaching_package",
      schema: TEACHING_PACKAGE_JSON_SCHEMA,
    });
    return result.data;
  }

  /**
   * The individual generators below regenerate one section at a time, so a
   * teacher who likes eight parts of a package can replace the ninth without
   * losing their edits to the rest.
   */
  async generateTeacherScript(context: LessonContext): Promise<string> {
    const { data } = await this.#provider.complete<{ teacherScript: string }>({
      system: SYSTEM,
      user: buildPrompt(
        context,
        "Write what the teacher says aloud, start to finish, as a script. Include the questions they ask the class and pauses for answers.",
      ),
      schemaName: "teacher_script",
      schema: objectSchema({ teacherScript: { type: "string" } }),
    });
    return data.teacherScript;
  }

  async generateActivity(
    context: LessonContext,
  ): Promise<GeneratedPackage["activity"]> {
    const { data } = await this.#provider.complete<{
      activity: GeneratedPackage["activity"];
    }>({
      system: SYSTEM,
      user: buildPrompt(
        context,
        "Design one classroom activity that a teacher with only a blackboard and village objects can run in 15 minutes.",
      ),
      schemaName: "classroom_activity",
      schema: objectSchema({
        activity: TEACHING_PACKAGE_JSON_SCHEMA.properties.activity,
      }),
    });
    return data.activity;
  }

  async generateQuestions(
    context: LessonContext,
  ): Promise<GeneratedPackage["practiceQuestions"]> {
    const { data } = await this.#provider.complete<{
      practiceQuestions: GeneratedPackage["practiceQuestions"];
    }>({
      system: SYSTEM,
      user: buildPrompt(
        context,
        "Write five practice questions with their answers, in increasing difficulty.",
      ),
      schemaName: "practice_questions",
      schema: objectSchema({
        practiceQuestions: TEACHING_PACKAGE_JSON_SCHEMA.properties
          .practiceQuestions,
      }),
    });
    return data.practiceQuestions;
  }

  async generateHomework(context: LessonContext): Promise<string> {
    const { data } = await this.#provider.complete<{ homework: string }>({
      system: SYSTEM,
      user: buildPrompt(
        context,
        "Write one homework task a child can do at home with no printed material and no help from a literate adult.",
      ),
      schemaName: "homework",
      schema: objectSchema({ homework: { type: "string" } }),
    });
    return data.homework;
  }
}

function buildPrompt(context: LessonContext, instruction: string): string {
  const text = context.sourceText.trim();
  if (!text) {
    throw new LLMError("EMPTY_INPUT", "There is no lesson text to work from.", {
      status: 400,
    });
  }
  if (text.length > MAX_LESSON_CHARS) {
    throw new LLMError(
      "INPUT_TOO_LONG",
      `That lesson is ${text.length} characters. Use at most ${MAX_LESSON_CHARS} — try one chapter section at a time.`,
      { status: 413 },
    );
  }

  const facts = [
    context.title ? `Title: ${context.title}` : null,
    context.grade ? `Class: ${context.grade}` : null,
    context.subject ? `Subject: ${context.subject}` : null,
    context.topic ? `Topic: ${context.topic}` : null,
    `Source language: ${context.languageName}`,
  ].filter(Boolean);

  return [instruction, "", ...facts, "", "Source text:", text].join("\n");
}

function objectSchema(properties: Record<string, unknown>) {
  return {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}

/**
 * Picks the generation provider from configuration.
 *
 * `LLM_PROVIDER=sarvam` runs lesson generation on the same Sarvam account that
 * already pays for translation and speech, which avoids needing a second
 * funded provider. It is a smaller model than OpenAI's and noticeably more
 * verbose, so the choice is left explicit rather than being guessed at.
 */
export function selectLLMProvider(): LLMProvider {
  if (env.LLM_PROVIDER === "sarvam" && env.SARVAM_API_KEY) {
    return new SarvamLLMProvider(env.SARVAM_API_KEY);
  }
  if (env.LLM_PROVIDER === "openai" && env.OPENAI_API_KEY) {
    return new OpenAILLMProvider(env.OPENAI_API_KEY);
  }
  return new DemoLLMProvider();
}
