import "server-only";

import {
  SpeechError,
  type SpeechToTextProvider,
  type SynthesisRequest,
  type SynthesisResult,
  type TextToSpeechProvider,
  type TranscriptionRequest,
  type TranscriptionResult,
} from "@/lib/ai/speech-provider";

/**
 * Stand-ins used when no SARVAM_API_KEY is configured.
 *
 * As with the demo translator, the point is that the output cannot be mistaken
 * for the real thing. A fabricated transcript is worse than a fabricated
 * translation: it would put words in a teacher's mouth and then translate
 * them, and every downstream screen would treat it as something the teacher
 * actually said.
 *
 * So this returns a plain notice rather than plausible Hindi, and the response
 * is tagged `isDemo` everywhere it travels.
 */
export class DemoSpeechToTextProvider implements SpeechToTextProvider {
  readonly id = "demo" as const;

  supports(): boolean {
    return true;
  }

  async transcribe(
    request: TranscriptionRequest,
  ): Promise<TranscriptionResult> {
    return {
      transcript: [
        "[Demo mode — this is NOT a transcript.]",
        `No speech model was called, so your recording was not transcribed from ${request.languageCode}.`,
        "Set SARVAM_API_KEY on the server to transcribe speech for real.",
      ].join("\n"),
      provider: this.id,
      model: "demo",
      detectedLanguage: null,
      requestId: null,
    };
  }
}

/**
 * Never produces audio.
 *
 * Returning silence or a beep would be a working-looking Play button with
 * nothing behind it. Demo mode reports that audio is unavailable instead.
 */
export class DemoTextToSpeechProvider implements TextToSpeechProvider {
  readonly id = "demo" as const;

  supports(): boolean {
    return false;
  }

  async synthesize(_request: SynthesisRequest): Promise<SynthesisResult> {
    throw new SpeechError(
      "NOT_CONFIGURED",
      "Audio generation is not configured on this server.",
      { status: 503 },
    );
  }
}
