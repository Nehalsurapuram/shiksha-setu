# Lesson upload and generation

`/lessons/upload` — turn a textbook page into an editable teaching package.

## Flow

```
Upload → extract text → detect language/class/subject/topic
       → review and correct → generate package → translate → edit → save
```

Every detected value is a suggestion the teacher can overwrite before anything
is generated, because the material is built from those fields.

## Extraction

| Input | Method | Verified |
| --- | --- | --- |
| `.txt`, `.md` | direct decode | ✓ |
| `.docx` | mammoth | ✓ Hindi round-tripped |
| PDF with a text layer | pdfjs-dist | ✓ |
| PDF with no text layer (a scan) | — | ✓ reports it and points at the photo route |
| `.jpg`, `.png`, `.webp` | model vision OCR | needs an LLM key |

`pdfjs-dist` and `mammoth` are listed in `serverExternalPackages`. Both parse
correctly under plain Node but break once bundled — pdfjs resolves workers and
standard-font data relative to its own package layout.

A scanned PDF is not an error, it is a picture of words. Rather than saving an
empty lesson, the upload reports it and tells the teacher to photograph the
page instead, which routes through OCR.

## Detection

**Language comes from the script, not a model.** Devanagari and Ol Chiki are
separate Unicode blocks, so counting characters answers it deterministically —
and it keeps working when no LLM is configured, which is why it is kept
separate from the rest.

Class, subject and topic need judgement, so they come from the model when one
is configured and are **left blank otherwise**. A guessed class level is worse
than an empty field: the teacher would have to notice it was wrong.

## Choosing a generation provider

`LLM_PROVIDER` selects it:

| Value | Model | Notes |
| --- | --- | --- |
| `openai` | `gpt-6-astra` | Needs `OPENAI_API_KEY` **with credit**. Faster, better field discipline, and the only option that can read a photographed page. |
| `sarvam` | `sarvam-105b` | Reuses `SARVAM_API_KEY`, so no second funded account. Slower (~40-60s per lesson), more verbose, **no vision** so photo OCR is unavailable. |

Measured on `sarvam-105b`: 42s to generate, 20s to translate, ~62s total for
one lesson. That exceeds Vercel's 60s Hobby function limit — `maxDuration` is
set to 300, which needs a Pro plan to take effect.

`sarvam-105b` is a reasoning model: it spends completion tokens thinking before
answering, and with too small a `max_tokens` it returns HTTP 200 with
`content: null` and no error. `SarvamLLMProvider` budgets 8000 tokens and
catches the empty-content case explicitly, because otherwise it surfaces as
unreadable JSON and looks like a bug.

## Generation

`POST /api/lessons/generate` → `LLMService` → `LLMProvider` →
`OpenAILLMProvider` or `SarvamLLMProvider`, mirroring the translation stack.

`LLMService` exposes `generateLesson()` plus `generateTeacherScript()`,
`generateActivity()`, `generateQuestions()` and `generateHomework()`, so a
teacher who likes eight parts of a package can replace the ninth without losing
their edits to the rest.

Uses the Responses API with **strict Structured Outputs**. That is not a
nicety: the package is rendered into labelled fields, and a model that omitted
a key would put a half-built lesson in front of a teacher.

The system prompt closes specific doors — no NCERT or state curriculum codes,
no textbook page numbers, no policy citations, no materials a rural classroom
does not have, and nothing not grounded in the supplied text.

Sections are translated into the mother tongue afterwards through the existing
`TranslationService`, chunked at sentence boundaries to respect Sarvam's
2000-character per-request limit. A failed translation leaves the field null,
which the editor renders as "Not translated" rather than blank.

**Vocabulary terms are deliberately not machine translated.** A single word
with no surrounding sentence gives the translator nothing to disambiguate
against, and it shows — measured against the live API:

| Input | Output |
| --- | --- |
| `पौधा` (one word) | a sentence of Santhali meta-commentary about the word, not the word |
| `तना` (one word) | `ᱛᱟᱭᱚᱢ ᱛᱮ,` — truncated |
| `पौधे का तना मजबूत होता है।` (sentence) | `ᱫᱟᱨᱮ ᱨᱮᱭᱟᱜ ᱠᱚᱱᱴᱚ ᱫᱚ ᱠᱮᱴᱮᱡ ᱜᱮᱭᱟ ᱾` — clean |

A teacher who cannot read Ol Chiki has no way to catch a wrong word, and the
word is what gets written on the blackboard. So the column stays empty and the
teacher fills it in — which is the glossary this product is meant to build.

## Suggested FLN Alignment

Named "suggested" everywhere it appears, and badged **Not verified**.

No NCERT or state curriculum document has been loaded into this product and
nothing is checked against one. Presenting this as alignment would be a claim
about official policy that this project cannot support. It is a model's guess
at which foundational goals a lesson touches, for a teacher to confirm against
their own syllabus.

## Demo mode

There is **no demo teaching content anywhere in this codebase**.
`DemoLLMProvider` refuses rather than inventing a lesson.

Everywhere else demo mode returns a labelled placeholder, but a teaching
package is where a plausible fake is most dangerous: a lesson plan reads as
authoritative, gets printed, and is taught. "Generate a Class 2 science lesson"
is exactly what a language model answers fluently and wrongly, and a teacher
checking a subject they were not trained in has no way to catch it.

## Errors

`QUOTA_EXHAUSTED` is deliberately separate from `RATE_LIMITED`. A 429 can mean
"slow down" or "you are out of credit", and only the machine-readable error
code — never the provider's prose — is read to tell them apart. Telling an
administrator to "wait a moment" when the account needs topping up would send
them chasing the wrong problem.

## Data

`Lesson` gained `translatedText` plus `originalFileName`, `sourceFormat` and
`extractionMethod`, so a teacher can see whether words came from a PDF text
layer, OCR of a photo, a Word file, or their own typing.

`TeachingPackage` holds the whole editable package as JSON with the generating
provider and model, and an `isEdited` flag recording that a human has been
through it — which matters when judging whether generated text was ever
reviewed.

## Not built

The lesson library. Saved lessons are in the database, but there is no screen
listing or reopening them yet; `/lessons` says so.
