# Translation

Hindi (`hi-IN`) → Santhali (`sat-IN`), the first real AI feature in the
product.

## Architecture

```
POST /api/translate
      └─ TranslationService          validate, cache, persist
           └─ TranslationProvider    interface
                ├─ SarvamTranslationProvider   real, when a key is configured
                └─ DemoTranslationProvider     fallback, when it is not
```

`TranslationService` never imports a concrete provider except in
`selectProvider()`. Adding a second real provider is a new file implementing
`TranslationProvider` plus one branch there.

| File | Role |
| --- | --- |
| `lib/ai/translation-provider.ts` | Interface, result type, error codes |
| `lib/ai/TranslationService.ts` | Validation, provider selection, cache, persistence |
| `lib/sarvam/SarvamTranslationProvider.ts` | Sarvam HTTP client |
| `lib/ai/DemoTranslationProvider.ts` | No-key fallback |
| `app/api/translate/route.ts` | Request/response contract |
| `app/(app)/translator/actions.ts` | `saveCorrection` Server Action |

## Sarvam specifics

`POST https://api.sarvam.ai/translate`, authenticated with the
`api-subscription-key` header.

**The model is pinned to `sarvam-translate:v1` and that is not incidental.**
Sarvam's default model, `mayura:v1`, covers eleven languages and Santhali is
not among them. Leaving the model unset would fail every request this product
exists to serve. `sarvam-translate:v1` supports 23 languages including
`sat-IN`, with a 2000-character limit per request — which is where
`MAX_INPUT_CHARS` comes from.

`output_script` is deliberately left unset. Setting it would transliterate the
result, and Santhali has to come back in Ol Chiki.

Sarvam's translate endpoint returns `{request_id, translated_text,
source_language_code}` and **no confidence score**, so `Translation.confidence`
stays null for Sarvam results. Nothing in the codebase invents one: a fake
quality number in front of a teacher deciding whether to trust a translation is
worse than no number at all.

## Demo mode

With no `SARVAM_API_KEY`, `selectProvider()` returns `DemoTranslationProvider`.
It does **not** emit invented Ol Chiki. A teacher cannot tell fake Santhali from
real Santhali — that is why they need this product — and a plausible string
could be copied onto a blackboard. It returns a plain-language notice saying no
translation happened, and:

- the response carries `provider: "demo"` and `isDemo: true`;
- the row is stored with `TranslationSource.DEMO`;
- the page shows a banner, the output panel a **Demo Translation** badge, and
  every history row a **Demo** badge;
- the Ol Chiki font is not applied, because the text is not Santhali.

Once a real key is configured, cached `DEMO` rows are ignored and re-translated,
so switching the key on does not leave placeholders in front of teachers.

## Errors

Provider errors never reach the browser raw — they can carry request URLs, key
fragments and internal hostnames. Everything maps onto a closed set of codes
with a message written for a teacher:

| Code | Cause | HTTP |
| --- | --- | --- |
| `EMPTY_INPUT` | No text | 400 |
| `INPUT_TOO_LONG` | Over 2000 characters | 413 |
| `SAME_LANGUAGE` | Source equals target | 400 |
| `UNSUPPORTED_LANGUAGE` | Not active/usable, or provider cannot do the pair | 400 |
| `INVALID_CREDENTIALS` | Sarvam 401/403 | 502 |
| `RATE_LIMITED` | Sarvam 429 | 429 |
| `TIMEOUT` | 30s exceeded | 504 |
| `PROVIDER_UNAVAILABLE` | Network failure | 502 |
| `PROVIDER_ERROR` | Anything else | 502 |
| `EMPTY_RESULT` | Provider returned nothing | 502 |

Language availability is decided by the `Language` table, not the provider's
list. Sarvam supports Ho? Irrelevant — until `hoc-IN` is `ACTIVE` here, the
translator refuses it.

## Caching

`contentHash = sha256(source|target|whitespace-collapsed text)`, unique per
language pair, so the same sentence can be translated into several mother
tongues. A repeat request returns the stored row with `cached: true` and does
not call the provider.

## Corrections

A correction is a new `TranslationCorrection` row. The original `targetText` is
never overwritten — the gap between what the model produced and what the
teacher actually wanted is the most valuable data this product can collect, and
overwriting it would throw it away. Saving a correction sets the translation's
`reviewStatus` to `CORRECTED`.

## Secrets

`SARVAM_API_KEY` is read through `lib/env.ts`, which imports `server-only`.
Verified: no client bundle references the key, the `api-subscription-key`
header, or `api.sarvam.ai`.

## Not built here

Text-to-speech and speech-to-text still throw `NotImplementedError` in
`lib/sarvam/client.ts`. The translator's **Listen** button is present but
disabled, with the reason stated next to it — no offline translation either.
