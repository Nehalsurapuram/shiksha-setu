import "server-only";

import { env, providerStatus } from "@/lib/env";
import { NotImplementedError, isSarvamConfigured } from "@/lib/sarvam/client";

/**
 * Provider registry - PHASE 2.
 *
 * Phase 1 only reports which providers are *configured*. It never calls one.
 * `getTranslationProvider()` returns the selected name so Settings can show the
 * truth; the generation entry points below all throw.
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
      credentialPresent: providerStatus.openai,
    },
  ];
}

export function isDemoMode(): boolean {
  return env.ENABLE_DEMO_MODE;
}

export async function generateLesson(): Promise<never> {
  throw new NotImplementedError("Lesson generation", 2);
}

export async function generateWorksheet(): Promise<never> {
  throw new NotImplementedError("Worksheet generation", 2);
}

export async function generateFlashcards(): Promise<never> {
  throw new NotImplementedError("Flashcard generation", 2);
}

export async function generateAssessment(): Promise<never> {
  throw new NotImplementedError("Assessment generation", 3);
}

export { NotImplementedError };
