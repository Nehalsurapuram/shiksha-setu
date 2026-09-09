# Human validation of AI translations

The model cannot be trusted on Santhali. Neither, on its own, can a single
teacher's correction. This phase is the chain that turns one into the other:

```
AI translation → teacher's correction → language expert's verdict → verified
```

Every screen that shows a translation now says which of those it is showing,
because "a model produced this" and "a person who speaks Santhali approved this"
are very different claims to make in front of a class.

## No model is retrained

**Approved corrections are used as data, never as training.** Two lookups, both
of them reading rows a person approved:

- a **verified glossary term** whose source text is exactly what was asked for
- an **expert-approved correction** on a translation that already exists

That is the entire mechanism (`lib/validation/verified-text.ts`), and it is
deliberately unglamorous. Fine-tuning on this data is a separate project with
its own evaluation; calling a lookup table "learning from teachers" would put
unvalidated output in front of children under a label it has not earned.

One consequence worth stating: a verified term translates **without an API key
at all**, and is not labelled a demo result, because the text came from a
person rather than a placeholder.

## Two levels of human judgement

They are kept apart on purpose, and the schema comments say which is which.

| | Means | Set by |
| --- | --- | --- |
| `isAccepted` | The teacher uses this in **their own** classroom | The teacher, the moment they type it — a lesson cannot wait for review |
| `status` | A language expert's verdict | `/expert/review`, and only there |

Only `APPROVED`/`CORRECTED` text is served to anyone else or promoted to a
verified term. A teacher's unreviewed correction is theirs to teach from; it is
not yet a claim about the language.

## What a correction stores

`TranslationCorrection` carries the spec's shape across its own columns and the
translation it points at: the original text, `aiTranslation`, the teacher's
`correctedText`, the language pair, the teacher, `isAccepted`, `createdAt`.

`aiTranslation` is **snapshotted** when the correction is made rather than read
back through the relation. The point of a correction is the difference between
what the model said and what a person said; re-translating the row later would
erase exactly that. Both paths snapshot it — the translator, and a correction
that arrives from a tablet that was offline.

## /expert/review

Hindi, the AI's Santhali and the teacher's correction, always side by side and
always labelled. An expert approving a Santhali sentence without seeing the
Hindi it came from is not validating a translation, they are rating a sentence.

| Button | Effect |
| --- | --- |
| **Approve** | The teacher's wording becomes the verified text |
| **Correct** | The expert writes their own; the teacher's is kept exactly as typed, because the disagreement between them is the record worth having |
| **Reject** | The translation goes back to unverified — a wrong correction does not make the model's output right |

Every verdict is attributed to a named account and timestamped.

**There is no authentication in this prototype**, and the page says so on
itself: anyone who knows the URL can reach it, and decisions are attributed to
the first account holding the `LANGUAGE_EXPERT` role. A gate that does not exist
must not be implied by a screen that looks official.

## The verified glossary

An approved correction can be promoted to a `GlossaryTerm` with
`isVerified = true`. The term keeps `sourceCorrectionId`, so any verified term
traces back to the approval behind it — `isVerified` is the strongest claim this
product makes about a piece of language, and it has to mean "a person who speaks
it said so", never "a teacher typed it and nobody checked".

Promotion is refused for anything longer than four words. A glossary of
sentences matches nothing, and splicing a term verified in one context into
another sentence would produce a translation no person ever approved — which is
also why matching is exact and never fuzzy or substring.

## Test results

`npm run validation:check` drives a real Chrome against a production build and
reads the database directly rather than believing the screen.

**22 of 22 checks passed.**

| | |
| --- | --- |
| The screen | Hindi, AI Santhali and the correction all shown and labelled |
| | the chain AI → correction → verified is on the page |
| | it states there is no sign-in |
| Approve | recorded `APPROVED`, attributed to `LANGUAGE_EXPERT` |
| | the AI text was kept alongside the correction |
| Reject | recorded `REJECTED`; produced **no** verified term |
| Correct | expert's wording stored **without** overwriting the teacher's |
| Glossary | verified term created, traceable to the approving correction |
| Translation | translating that term returns the **verified** text, provider `glossary` |
| | not labelled a demo result despite no API key |
| | the translator labels it verified, not machine output |

### A false failure worth recording

"Reject does not work" failed twice against a Reject button that works
perfectly by hand. These are Server Action forms: a click fired before React
hydrates does nothing at all, silently, and the page looks identical either way.
The harness now presses, waits for the **database** to show the effect, and
reloads and presses again if it does not.

That is a harness fix, but it points at a real property of the app: every
Server Action form here needs JavaScript, so the first second after a page load
is dead to clicks. It has always been true; this is just the first test fast
enough to notice.
