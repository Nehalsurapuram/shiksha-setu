import "server-only";

import {
  DemoSpeechToTextProvider,
  DemoTextToSpeechProvider,
} from "@/lib/ai/DemoSpeechProvider";
import {
  MAX_AUDIO_BYTES,
  SpeechError,
  type SpeechProviderId,
  type SpeechToTextProvider,
  type SynthesisResult,
  type TextToSpeechProvider,
  type TranscriptionResult,
} from "@/lib/ai/speech-provider";
import { isAcceptedAudioType, MIN_AUDIO_BYTES } from "@/lib/ai/speech-limits";
import { env } from "@/lib/env";
import { SarvamSpeechToTextProvider } from "@/lib/sarvam/SarvamSpeechToTextProvider";
import { SarvamTextToSpeechProvider } from "@/lib/sarvam/SarvamTextToSpeechProvider";

/**
 * Validation and provider selection for both speech directions.
 *
 * SpeechService → SpeechToTextProvider / TextToSpeechProvider → Sarvam*.
 * Nothing here knows how Sarvam's HTTP APIs are shaped.
 */
export class SpeechService {
  readonly #stt: SpeechToTextProvider;
  readonly #tts: TextToSpeechProvider;

  constructor(options?: {
    stt?: SpeechToTextProvider;
    tts?: TextToSpeechProvider;
  }) {
    this.#stt = options?.stt ?? selectSpeechToTextProvider();
    this.#tts = options?.tts ?? selectTextToSpeechProvider();
  }

  get sttProviderId(): SpeechProviderId {
    return this.#stt.id;
  }

  get ttsProviderId(): SpeechProviderId {
    return this.#tts.id;
  }

  get isDemo(): boolean {
    return this.#stt.id === "demo";
  }

  /** Whether the configured TTS provider can speak this language at all. */
  canSpeak(languageCode: string): boolean {
    return this.#tts.supports(languageCode);
  }

  async transcribe(
    audio: Blob,
    fileName: string,
    languageCode: string,
  ): Promise<TranscriptionResult> {
    if (audio.size === 0) {
      throw new SpeechError(
        "NO_AUDIO",
        "The recording was empty. Hold the button and speak, then release.",
        { status: 400 },
      );
    }

    if (audio.size < MIN_AUDIO_BYTES) {
      throw new SpeechError(
        "NO_AUDIO",
        "That recording was too short to contain speech. Try again and speak for a moment longer.",
        { status: 400 },
      );
    }

    if (audio.size > MAX_AUDIO_BYTES) {
      throw new SpeechError(
        "AUDIO_TOO_LARGE",
        "That recording is too large. Record a shorter sentence.",
        { status: 413 },
      );
    }

    if (audio.type && !isAcceptedAudioType(audio.type)) {
      throw new SpeechError(
        "UNSUPPORTED_AUDIO",
        "That audio format is not supported. Record with the button on this page.",
        { status: 415 },
      );
    }

    if (!this.#stt.supports(languageCode)) {
      throw new SpeechError(
        "STT_LANGUAGE_UNSUPPORTED",
        "Speech recognition is not available for that language.",
        { status: 400 },
      );
    }

    return this.#stt.transcribe({ audio, fileName, languageCode });
  }

  /**
   * Synthesises speech, or refuses when the provider cannot speak the
   * language. `languageName` is used so the refusal names the actual language.
   */
  async synthesize(
    text: string,
    languageCode: string,
    languageName: string,
  ): Promise<SynthesisResult> {
    const trimmed = text.trim();
    if (!trimmed) {
      throw new SpeechError("NO_AUDIO", "There is no text to read aloud.", {
        status: 400,
      });
    }

    if (!this.#tts.supports(languageCode)) {
      throw new SpeechError(
        "TTS_LANGUAGE_UNSUPPORTED",
        ttsUnavailableMessage(languageName),
        { status: 422 },
      );
    }

    return this.#tts.synthesize({ text: trimmed, languageCode });
  }
}

/**
 * The exact wording shown wherever audio cannot be produced.
 *
 * Kept in one place so the API, the voice pipeline and the UI cannot drift
 * into describing the same limitation three different ways.
 */
export function ttsUnavailableMessage(languageName: string): string {
  return `${languageName} audio is unavailable for the current TTS configuration.`;
}

export function selectSpeechToTextProvider(): SpeechToTextProvider {
  if (env.SARVAM_API_KEY) {
    return new SarvamSpeechToTextProvider(env.SARVAM_API_KEY);
  }
  return new DemoSpeechToTextProvider();
}

export function selectTextToSpeechProvider(): TextToSpeechProvider {
  if (env.SARVAM_API_KEY) {
    return new SarvamTextToSpeechProvider(env.SARVAM_API_KEY);
  }
  return new DemoTextToSpeechProvider();
}
