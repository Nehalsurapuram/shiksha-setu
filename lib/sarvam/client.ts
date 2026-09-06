import "server-only";

import { env } from "@/lib/env";

/**
 * Sarvam AI client - PHASE 2.
 *
 * Deliberately unimplemented. Every method throws `NotImplementedError` rather
 * than returning a plausible-looking string, so no screen can ever show an
 * invented Santhali translation to a teacher and pass it off as real output.
 */
export const SARVAM_BASE_URL = "https://api.sarvam.ai";

export class NotImplementedError extends Error {
  constructor(feature: string, phase: number) {
    super(`${feature} is not implemented yet (planned for Phase ${phase}).`);
    this.name = "NotImplementedError";
  }
}

export type TranslateInput = {
  text: string;
  sourceLanguageCode: string;
  targetLanguageCode: string;
};

export type TranslateResult = {
  text: string;
  model: string;
};

export function isSarvamConfigured(): boolean {
  return Boolean(env.SARVAM_API_KEY);
}

export async function translate(_input: TranslateInput): Promise<TranslateResult> {
  throw new NotImplementedError("Sarvam translation", 2);
}

export async function textToSpeech(
  _text: string,
  _languageCode: string,
): Promise<ArrayBuffer> {
  throw new NotImplementedError("Sarvam text-to-speech", 2);
}

export async function speechToText(
  _audio: ArrayBuffer,
  _languageCode: string,
): Promise<string> {
  throw new NotImplementedError("Sarvam speech-to-text", 2);
}
