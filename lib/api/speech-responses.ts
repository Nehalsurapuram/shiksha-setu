import "server-only";

import { SpeechError } from "@/lib/ai/speech-provider";

/**
 * Shared response helpers for the speech routes.
 *
 * These live outside `route.ts` because App Router route files may only export
 * HTTP handlers and route config — any other export fails the build.
 */
export function fail(code: string, message: string, status: number) {
  return Response.json(
    { success: false, error: { code, message } },
    { status },
  );
}

export function handleSpeechError(error: unknown, scope: string) {
  if (error instanceof SpeechError) {
    // Logged with its cause server-side; only publicMessage goes out.
    if (error.status >= 500) console.error(`[${scope}]`, error);
    return fail(error.code, error.publicMessage, error.status);
  }
  console.error(`[${scope}] unexpected`, error);
  return fail("PROVIDER_ERROR", "Something went wrong. Try again.", 500);
}

/** Sarvam infers the container from the filename, so give it a truthful one. */
export function fileNameFor(audio: Blob): string {
  const base = audio.type.split(";")[0]?.trim().toLowerCase() ?? "";
  const extension =
    base === "audio/webm"
      ? "webm"
      : base === "audio/ogg"
        ? "ogg"
        : base === "audio/mp4"
          ? "m4a"
          : base === "audio/mpeg"
            ? "mp3"
            : base === "audio/flac"
              ? "flac"
              : base === "audio/aac"
                ? "aac"
                : "wav";
  return `recording.${extension}`;
}
