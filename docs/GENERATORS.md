# Worksheets, flashcards and assessments

Three generators sharing one pipeline:

```
inputs → LLMService → enforce the request → translate → edit → save
```

| Route | Produces |
| --- | --- |
| `/worksheets` | Bilingual practice sheet, printable |
| `/flashcards` | Vocabulary deck with emoji pictures |
| `/assessments` | Bilingual assessment with an answer key |

## The model does not follow instructions, so the code does

This is the single most important thing in this phase. Measured against
`sarvam-105b`, a request for **2 TRUE_FALSE questions in Hindi** returned:

- **10** questions, not 2
- mixed types, not just true/false
- several in **English**, one in **romanised Hindi**, and on another run a title
  in **Odia**
- one question whose entire text was `नहीं`

The prompt states the count, the formats and the language explicitly. It is not
enough. So `lib/ai/enforce-request.ts` filters the result before a teacher ever
sees it:

1. Questions in a format that was not requested are dropped.
2. Questions whose script is not the requested language are dropped.
3. Questions with no answer, or a prompt under 8 characters, are dropped.
4. The list is truncated to the number asked for.

Everything removed is **reported** — the UI lists what was dropped and why,
rather than silently handing over a shorter sheet. If too few survive, it says
so and suggests regenerating.

Language detection here reuses the script detector from lesson upload. It
identifies a script rather than a language, which is enough: the failure being
caught is a whole question arriving in Odia, not a dialect nuance. Anything the
detector cannot classify is kept, so an unusual but valid question is never
thrown away on a guess.

## Reliability

`SarvamLLMProvider` retries **once** when the model returns empty content or
unparseable JSON. Both were observed on requests that then succeeded unchanged,
so they are flaky generations rather than bad requests. Not retried: a rejected
credential, an exhausted quota, or `finish_reason: length` — those fail
identically every time, and the last needs a bigger budget, not another attempt.

`MAX_TOKENS` is 16000. A four-question worksheet failed at 8000 with
`finish_reason: length` while emitting under 4000 tokens of answer — the
reasoning is where the budget goes, and a larger schema reasons for longer.
Unused budget costs nothing; only emitted tokens are billed.

## Translation

Sections go through the same `TranslationService` as everything else, chunked
at sentence boundaries.

**Short fields are deliberately not translated.**
`hasEnoughContextToTranslate()` requires three words or twenty characters.
Below that, the field stays null and the UI shows "Not translated". This is the
Phase 7 finding applied consistently: an isolated word gives the translator no
context, and it returns meta-commentary or truncated text. It affects flashcard
terms, multiple-choice options and most answers.

A teacher who cannot read Ol Chiki cannot catch a wrong word, and the word is
what a child copies down. Empty is better than wrong.

## Flashcard pictures and audio

The picture is a **single emoji**, chosen by the model for the word. No image
model is configured, and the UI says so — it is an icon, never a generated
photograph presented as one. In practice this works well: 🍎 सेब, 🥔 आलू,
🔴 लाल.

**Listen speaks the language of instruction only.** There is no Santhali voice
(see `docs/` on speech), and reading Ol Chiki aloud with a Hindi voice would
produce confident audio that is not Santhali. The button is labelled with the
language it actually speaks.

## Print and PDF

One button, `Print / Save as PDF`, calling `window.print()`. The browser's
print dialog is also where "Save as PDF" lives, so it is honestly both rather
than two buttons doing one thing.

Print styles in `globals.css` drop the app shell, flatten inputs to plain text,
and prevent a question splitting across a page break. A checkbox hides the
answers so a blank sheet can be printed for the class, and the assessment
answer key starts on its own page.

## Data

Existing Phase 1 models, extended:

- `Worksheet` — `subject`, `topic`, `difficulty`, `provider`, `model`,
  `isEdited`. `WorksheetKind` gained `MULTIPLE_CHOICE`, `TRUE_FALSE`,
  `SHORT_ANSWER`, `COUNTING`, `MIXED`.
- `Assessment` — the same, plus `AssessmentKind.MIXED`. `maxScore` is **summed
  from the questions on the server**, never accepted from the client, so the
  total on the paper always matches the marks on the questions.
- `Flashcard` — `icon`, `deckId`, `deckTitle`, `grade`, `subject`, `provider`,
  `model`, `isEdited`. Cards generated together share a `deckId` so a set can be
  reopened as the set it was.

The stored `kind` is derived from the questions rather than sent by the client,
so it cannot disagree with the content it labels.

## Known limits

- Generation takes **30-90 seconds** on `sarvam-105b`. That exceeds Vercel's
  60s Hobby function limit; `maxDuration` is 300, which needs Pro.
- Question quality is uneven. The enforcement layer removes what is clearly
  wrong; it cannot judge whether a surviving question is *good*. Every screen
  carries a review-before-use warning.
- There is no library screen yet. Saved worksheets, decks and assessments are
  in the database with nothing to list them.
