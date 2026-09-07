# FLN / NIPUN Bharat alignment

Every lesson, worksheet and assessment carries an **Alignment card**. It has
exactly two states, and they never share wording.

| | Heading | Badge | When |
| --- | --- | --- | --- |
| Verified | "FLN Alignment" | Verified source | A `LearningOutcome` row with a `verifiedSource` matched the class and subject |
| Suggested | **"Suggested FLN Alignment"** | Not verified | Everything else |

**This installation ships with the catalogue empty.** No NIPUN Bharat, NCERT or
state curriculum document has been obtained or loaded, so every alignment in
the product today is a suggestion. `/curriculum` states this in one place, and
because every screen reads the same table, if that page says nothing is loaded
then nothing anywhere can be claiming otherwise.

## No codes, ever

Suggested alignment carries **no outcome codes at all**. Not "FLN 2.3", not
"LO-M-104", not a page reference.

A code is the part that looks authoritative. A headmaster or block officer
reading "NIPUN FLN 2.3" on a printed worksheet has no way to tell a real code
from a fabricated one, and a language model will produce either with equal
fluency. The whole product's credibility rests on not doing that.

Three layers enforce it:

1. **Prompt** — the alignment system instruction forbids codes, framework
   citations and page numbers, and states plainly that the model does not have
   those documents.
2. **`stripInventedCodes()`** — removes codes *and framework names* from every
   generated field. Framework names too, because a stray `(NIPUN )` left behind
   after removing the number still reads as an official mapping. Tested against
   the shapes models actually emit; over-removal is the acceptable direction,
   since these fields describe what a child can do and lose nothing by dropping
   the word "NCERT".
3. **Code is never populated from a model.** `StoredAlignment.code` is only
   ever copied from a verified catalogue row. The generated branch hard-codes
   `code: null` regardless of what came back.

## What each material shows

- **Lesson** — Learning Area, Competency, Learning Outcome, Activity,
  Assessment.
- **Worksheet** — Aligned Learning Outcome, plus a per-question table of
  Question Type, Skill and Difficulty.
- **Assessment** — Learning Outcome, plus a per-question table of Question,
  Skill Tested and Expected Response.

Skills come from the model, one per question. Question type, difficulty and
expected response are **derived from the material itself**, not generated
again, so they cannot disagree with the questions they describe.

## Data model

`LearningOutcome` is now a **catalogue of definitions**:

```
id · learningArea · competency · outcome · classLevel · subject
verifiedSource · code
```

`verifiedSource` is the whole point of the table. A row with one came from a
real published document that somebody loaded and can be checked; a row without
one did not, and `findVerifiedOutcomes()` will not return it. Unverified rows
are working data for whoever is building a mapping — they must not reach a
teacher looking official.

The Phase 1 model of the same name recorded **observations** of a child's
progress (score, observedAt, recordedById). That is a different thing, so it
was renamed `OutcomeObservation`. It was empty and unreferenced, so nothing was
lost.

Materials store their alignment in an `alignment` JSON column, carrying
`status` and `verifiedSource` with the payload. A stored suggestion therefore
cannot be re-rendered later as though it were verified.

## Failure behaviour

Alignment is additive. If it fails, `tryBuildAlignment()` returns null with a
note and the worksheet is still a worksheet — a teacher who has already waited
a minute does not lose the generation because a secondary call failed.

## Performance

Alignment and translation are independent and hit different providers, so they
run concurrently. Sequentially, one worksheet measured **230s**; in parallel,
**90s**. Still over Vercel's 60s Hobby limit — `maxDuration` is 300, needing
Pro.

## To load real data

Insert `LearningOutcome` rows with `verifiedSource` set to a citation you can
defend — document title, edition and page, or a URL. The alignment path picks
them up automatically and switches the card to its verified state. There is no
importer yet; `/curriculum` says so.
