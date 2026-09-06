# Interactive Classroom

`/classroom` — a live two-way conversation between a Hindi-speaking teacher and
a Santhali-speaking student. Each turn is translated and shown to both sides.

## Both directions

```
Teacher turn:  Hindi speech/text → STT → Hindi text → translate → Santhali text → ✗ no audio
Student turn:  Santhali speech/text → STT → Santhali text → translate → Hindi text → ✓ audio
```

**The two directions are not symmetrical, and the page says so before anyone
presses anything.** Sarvam's coverage differs between the two speech APIs:

| | Hindi | Santhali |
| --- | --- | --- |
| Speech-to-text (`saaras`) | ✓ | ✓ |
| Text-to-speech (`bulbul`) | ✓ | ✗ |

So a student can speak or type Santhali and the teacher hears the Hindi read
aloud — but the teacher's Santhali translation is text only. Measured on the
live API: a teacher turn from real audio took **1.65s** (399ms transcribe,
1253ms translate); a student turn producing Hindi audio took **2.33s** (1408ms
translate, 922ms synthesis).

Audio is never substituted across languages. Ol Chiki read by a Hindi voice
would be confident-sounding audio that is not Santhali, played to a child who
could not tell.

## The reverse-direction change

`TranslationService` previously enforced one direction: a language of
instruction (`isSource`) into a mother tongue (`isTarget`). Santhali → Hindi
failed that check, which would have made a student unable to answer.

Rather than flipping the seed flags — which would have changed the Translator's
dropdowns — `TranslateInput` gained an opt-in `allowReverseDirection`. Off by
default, so the Translator keeps its one-way contract. The classroom turns it
on for student turns only, and it permits exactly the configured pair read
backwards, not an arbitrary pair.

## API

| Route | Body | Notes |
| --- | --- | --- |
| `POST /api/classroom/turn` | multipart: `speaker`, and `audio` or `text` | One endpoint, both directions; the speaker decides which way the pair is read |
| `POST /api/classroom/session` | JSON: `startedAt`, `messages[]` | Saves the conversation |

`VoiceTranslationService` gained an optional `text` input so a turn can skip
speech-to-text entirely. Its stage cost is then genuinely zero rather than
unmeasured.

Session saving does not trust the client: the teacher, school and language pair
are resolved server-side, `translationId`s are verified to exist before being
linked, and a message naming an unknown language is dropped rather than failing
the whole save.

## Data model

`ClassroomSession` and `ClassroomMessage` (migration
`20260906161154_classroom_sessions`). A message records the speaker, what was
said, what the other side was shown, whether audio was produced, and the
measured latency for that turn. This is the record of what was actually said in
a classroom — where the evidence for whether this product helps will eventually
come from.

## UI

Three bubble roles — Teacher, AI translation, Student — each showing language,
text, timestamp, an audio button where audio exists, and the measured latency.

Bubbles are laid out by **who the message is for**, not who produced it: a
teacher's translation sits in the student's column and vice versa, so each side
can follow one column down the screen.

Both panels offer a large microphone *and* a text box. A child who will not
speak in front of the class can type; a teacher in a loud classroom can too.

Controls: **Start Classroom**, **Pause** / Resume, **Clear Conversation**
(confirms first), **Save Session**.

## Not built

Offline operation — every turn needs a network round trip to Sarvam. No student
authentication: the "student" side is the same tablet, for a teacher working
one-to-one or projecting to the class.
