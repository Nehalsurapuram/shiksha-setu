# Voice Assistant

Hindi speech in, Santhali text out. The last step — speaking that text aloud —
has no provider today, and the reason is documented below rather than papered
over.

## Pipeline

```
Hindi speech
  └─ POST /api/voice/translate         (multipart: audio)
       └─ VoiceTranslationService
            ├─ SpeechService.transcribe   → SarvamSpeechToTextProvider   ✅ works
            ├─ TranslationService         → SarvamTranslationProvider    ✅ works
            └─ SpeechService.synthesize   → SarvamTextToSpeechProvider   ❌ no Santhali voice
```

| File | Role |
| --- | --- |
| `lib/ai/speech-provider.ts` | Interfaces, result types, error codes |
| `lib/ai/SpeechService.ts` | Validation, provider selection, capability check |
| `lib/ai/VoiceTranslationService.ts` | The three-stage pipeline and its timings |
| `lib/sarvam/SarvamSpeechToTextProvider.ts` | Sarvam `saaras:v3` |
| `lib/sarvam/SarvamTextToSpeechProvider.ts` | Sarvam `bulbul:v3` |
| `lib/ai/DemoSpeechProvider.ts` | No-key fallbacks |
| `lib/voice/use-recorder.ts` | MediaRecorder, permissions, states |

## The Santhali audio gap

**Sarvam can hear Santhali but cannot speak it.**

- Speech-to-text (`saaras`) supports 23 languages **including `sat-IN`**.
- Text-to-speech (`bulbul`) supports 11 — `bn, en, gu, hi, kn, ml, mr, od, pa,
  ta, te`. **`sat-IN` is not among them.**

So `SpeechService.canSpeak("sat-IN")` is false, and the pipeline returns
`audioUrl: null` with:

> Santhali audio is unavailable for the current TTS configuration.

The capability is checked *before* any network call, so this costs nothing and
never depends on a request failing.

**It must never fall back to another voice.** Feeding Ol Chiki text to a Hindi
voice would produce confident-sounding audio that is not Santhali, played to
children with no way to tell. The refusal is the feature.

A synthesis failure never fails the request: the transcript and translation are
useful on their own, so audio degrades to an explanation.

## Endpoints

| Route | Body | Returns |
| --- | --- | --- |
| `POST /api/speech/transcribe` | multipart `audio`, optional `languageCode` | `transcript` |
| `POST /api/speech/synthesize` | JSON `text`, `languageCode` | `audioUrl` (data URL) or a refusal |
| `POST /api/voice/translate` | multipart `audio` | `transcript`, `translation`, `audioUrl`, `processingTimeMs` |

`audioUrl` is a `data:` URL. There is no blob storage in this project yet, and
inventing one to hold audio nobody can generate would be premature.

## Timing

`processingTimeMs` is wall-clock, measured in `VoiceTranslationService.run()`
around the real work, including network time to Sarvam. Per-stage figures
(`transcribeMs`, `translateMs`, `synthesizeMs`) come from the same clock.

Nothing is estimated, smoothed or hardcoded. The SIH target is under three
seconds; the UI prints whatever it actually took, which is the only number
worth optimising against.

## Recorder states

`ready → listening → processing → completed`, with `error` from any of them and
`unsupported` when the browser has no `MediaRecorder`.

- Permission is requested on the first press, never on page load.
- The stream is stopped after every recording, so the browser's recording
  indicator goes off — a live mic left open in a classroom is not acceptable.
- Recording is capped at 60 seconds and 10 MB.
- Sub-1.2 KB blobs are rejected as mis-taps rather than sent as "speech".

Handled: permission denied, no microphone, browser without MediaRecorder,
empty/too-short recording, unsupported container, oversized upload, provider
rate limits, invalid credentials, timeouts, and network failure.

## Demo mode

Without `SARVAM_API_KEY`, `DemoSpeechToTextProvider` returns a labelled notice
rather than a plausible Hindi sentence. **A fabricated transcript is worse than
a fabricated translation** — it puts words in a teacher's mouth and then
translates them, and every downstream screen would treat it as something they
actually said.

`DemoTextToSpeechProvider.supports()` returns false for everything, so demo
mode never produces a Play button with nothing behind it. Note the distinction
the service draws: *not configured* (no key) and *language has no voice* are
different problems with different fixes, and reporting the wrong one would send
an administrator hunting for a Hindi voice that already exists.

## Not built

Offline speech. Recognition and translation both require a network round trip
to Sarvam; nothing here runs on the tablet. The page says so.
