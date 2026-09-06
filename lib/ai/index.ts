import "server-only";

import { env, getProviderStatus } from "@/lib/env";
import { NotImplementedError, isSarvamConfigured } from "@/lib/sarvam/client";

/**
 * Provider registry.
 *
 * Reports which providers are configured, for Settings and the dashboard.
 * Translation is implemented — see `TranslationService`. The generation entry
 * points below still throw rather than returning invented content.
 */
export type ProviderName = "sarvam" | "openai";

export type ProviderReadiness = {
  name: ProviderName;
  /** Display name, so the UI never has to prettify an identifier itself. */
  label: string;
  role: "translation" | "llm";
  roleLabel: string;
  selected: boolean;
  credentialPresent: boolean;
};

export function getProviderReadiness(): ProviderReadiness[] {
  return [
    {
      name: "sarvam",
      label: "Sarvam AI",
      role: "translation",
      roleLabel: "translation",
      selected: env.TRANSLATION_PROVIDER === "sarvam",
      credentialPresent: isSarvamConfigured(),
    },
    {
      name: "openai",
      label: "OpenAI",
      role: "llm",
      roleLabel: "content generation",
      selected: env.LLM_PROVIDER === "openai",
      credentialPresent: getProviderStatus().openai,
    },
  ];
}

export function isDemoMode(): boolean {
  return env.ENABLE_DEMO_MODE;
}

export async function generateLesson(): Promise<never> {
  throw new NotImplementedError("Lesson generation");
}

export async function generateWorksheet(): Promise<never> {
  throw new NotImplementedError("Worksheet generation");
}

export async function generateFlashcards(): Promise<never> {
  throw new NotImplementedError("Flashcard generation");
}

export async function generateAssessment(): Promise<never> {
  throw new NotImplementedError("Assessment generation");
}

export { NotImplementedError };
