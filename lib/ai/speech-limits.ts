/**
 * Limits shared by the server and the browser, so the recorder and the API
 * enforce the same numbers from one definition.
 */

/** ~10 MB. Comfortably more than a minute of Opus at classroom quality. */
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

/** Hard stop for a single recording. A teacher speaks a sentence, not a lecture. */
export const MAX_RECORDING_MS = 60_000;

/** Anything shorter is a mis-tap, not speech. */
export const MIN_AUDIO_BYTES = 1_200;

/** Sarvam's bulbul:v3 ceiling for one synthesis request. */
export const MAX_TTS_CHARS = 2500;

/**
 * Container types Sarvam's speech-to-text accepts that browsers actually
 * produce. MediaRecorder gives WebM/Opus in Chrome and MP4/AAC in Safari.
 */
export const ACCEPTED_AUDIO_TYPES = [
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/flac",
  "audio/aac",
] as const;

export function isAcceptedAudioType(mimeType: string): boolean {
  const base = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  return (ACCEPTED_AUDIO_TYPES as readonly string[]).includes(base);
}
