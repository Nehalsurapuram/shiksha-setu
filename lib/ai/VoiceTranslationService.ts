import "server-only";

import { SpeechService, ttsUnavailableMessage } from "@/lib/ai/SpeechService";
import { SpeechError } from "@/lib/ai/speech-provider";
import { TranslationService } from "@/lib/ai/TranslationService";

export type VoiceTranslationInput = {
  audio: Blob;
  fileName: string;
  sourceLanguage: { code: string; name: string };
  targetLanguage: { code: string; name: string };
  userId?: string | null;
};

export type VoiceTranslationOutcome = {
  transcript: string;
  translation: string;
  /** Data URL, or null when the target language cannot be synthesised. */
  audioUrl: string | null;
  /** Why there is no audio. Null when audio was produced. */
  audioUnavailableReason: string | null;
  processingTimeMs: number;
  timings: { transcribeMs: number; translateMs: number; synthesizeMs: number };
  isDemo: boolean;
  translationId: string;
};

/**
 * The whole voice flow:
 *
 *   Hindi speech → speech-to-text → Hindi text → translate → Santhali text
 *                → text-to-speech → audio
 *
 * The last step is the one that does not currently work. Sarvam transcribes
 * Santhali but cannot speak it, so for a Santhali target this returns a null
 * `audioUrl` with a reason. It never substitutes another language's voice: Ol
 * Chiki read by a Hindi voice would be confident-sounding audio that is not
 * Santhali, played to children who could not tell.
 *
 * A synthesis failure never fails the request. The transcript and translation
 * are useful on their own, so audio degrades to an explanation.
 */
export class VoiceTranslationService {
  readonly #speech: SpeechService;
  readonly #translation: TranslationService;

  constructor(speech?: SpeechService, translation?: TranslationService) {
    this.#speech = speech ?? new SpeechService();
    this.#translation = translation ?? new TranslationService();
  }

  get isDemo(): boolean {
    return this.#speech.isDemo || this.#translation.isDemo;
  }

  canSpeak(languageCode: string): boolean {
    return this.#speech.canSpeak(languageCode);
  }

  async run(input: VoiceTranslationInput): Promise<VoiceTranslationOutcome> {
    // Measured, never assumed. Every number returned comes from this clock.
    const startedAt = Date.now();

    const transcribeStart = Date.now();
    const transcription = await this.#speech.transcribe(
      input.audio,
      input.fileName,
      input.sourceLanguage.code,
    );
    const transcribeMs = Date.now() - transcribeStart;

    const translateStart = Date.now();
    const translated = await this.#translation.translate({
      text: transcription.transcript,
      sourceLanguage: input.sourceLanguage.code,
      targetLanguage: input.targetLanguage.code,
      userId: input.userId ?? null,
    });
    const translateMs = Date.now() - translateStart;

    let audioUrl: string | null = null;
    let audioUnavailableReason: string | null = null;
    let synthesizeMs = 0;

    if (!this.#speech.canSpeak(input.targetLanguage.code)) {
      audioUnavailableReason = ttsUnavailableMessage(input.targetLanguage.name);
    } else if (translated.isDemo) {
      // The "translation" is a demo notice, not language. Reading it aloud
      // would be audio of a placeholder.
      audioUnavailableReason =
        "No audio in demo mode, because nothing was actually translated.";
    } else {
      const synthesizeStart = Date.now();
      try {
        const audio = await this.#speech.synthesize(
          translated.translatedText,
          input.targetLanguage.code,
          input.targetLanguage.name,
        );
        audioUrl = `data:${audio.mimeType};base64,${audio.audioBase64}`;
      } catch (error) {
        // Audio is the optional leg: keep the transcript and translation.
        audioUnavailableReason =
          error instanceof SpeechError
            ? error.publicMessage
            : "Audio could not be generated for this translation.";
        if (!(error instanceof SpeechError)) {
          console.error("[voice] synthesis", error);
        }
      }
      synthesizeMs = Date.now() - synthesizeStart;
    }

    return {
      transcript: transcription.transcript,
      translation: translated.translatedText,
      audioUrl,
      audioUnavailableReason,
      processingTimeMs: Date.now() - startedAt,
      timings: { transcribeMs, translateMs, synthesizeMs },
      isDemo: translated.isDemo || transcription.provider === "demo",
      translationId: translated.translationId,
    };
  }
}
