import "server-only";

import { env } from "@/lib/env";

/**
 * Shared Sarvam configuration.
 *
 * Translation is implemented — see `SarvamTranslationProvider`. Speech is not:
 * the two functions below still throw rather than returning a plausible-looking
 * result, so no screen can present invented audio or a fake transcript.
 */
export const SARVAM_BASE_URL = "https://api.sarvam.ai";

export class NotImplementedError extends Error {
  constructor(feature: string) {
    super(`${feature} is not implemented yet.`);
    this.name = "NotImplementedError";
  }
}

export function isSarvamConfigured(): boolean {
  return Boolean(env.SARVAM_API_KEY);
}

export async function textToSpeech(
  _text: string,
  _languageCode: string,
): Promise<ArrayBuffer> {
  throw new NotImplementedError("Sarvam text-to-speech");
}

export async function speechToText(
  _audio: ArrayBuffer,
  _languageCode: string,
): Promise<string> {
  throw new NotImplementedError("Sarvam speech-to-text");
}
