# Offline-first PWA

## The rule this phase is built around

**No cloud AI feature works offline, and nothing in the product suggests it
does.** Translation, speech recognition, speech synthesis and generation are
all HTTP calls to Sarvam or OpenAI. Caching cannot change that.

What offline mode gives a teacher is *access to content already synchronised* —
their saved lessons, translations, worksheets, flashcards, assessments and any
audio cached while online.

Two things enforce it:

- **The service worker caches no API response at all.** A stale translation
  served from cache would be indistinguishable from a fresh one, and there is
  no honest way to show that.
- **`RequiresConnection`** appears on Translator, Voice Assistant, Classroom
  and every generator the moment the connection drops, naming what is
  unavailable and what still works — rather than letting a teacher press
  Translate in front of a class and watch it fail.

`/offline-sync` also lists "What does not work offline" explicitly, before
anything goes wrong.

## Where content lives

**IndexedDB** (`lib/offline/db.ts`), eight stores: lessons, translations,
worksheets, flashcards, assessments, audio, glossary, preferences.

`/api/offline/bundle` assembles everything the teacher can use and the client
writes it to the device. Deliberately excluded from the bundle:

- **Anything secret.** No keys, tokens or connection strings. IndexedDB is
  readable by anyone holding the tablet.
- **Demo translations.** A placeholder notice cached as a translation is
  exactly what this product must never put in front of a teacher.

Sync is a whole-store replace, not a merge: the server is the source of truth
and a merge would leave deleted material on tablets indefinitely.

## Audio

Cached audio is stored as **Blob bytes**, not URLs — a URL is useless offline.
Clips are synthesised while online from `/offline-sync` and played from
IndexedDB afterwards.

It speaks the **language of instruction only**. There is no mother-tongue
voice, and reading Ol Chiki aloud with a Hindi voice would be confident audio
that is not Santhali.

## Saved content

`/library` reads **only** from IndexedDB. It behaves identically with the
network on or off because it never had a server to lose — so whatever it shows
is genuinely on the tablet. This also filled a real gap: before it, saved
worksheets and decks were in the database with no screen to open them.

## Service worker

Caches the app shell plus the routes that read from IndexedDB
(`/dashboard`, `/library`, `/offline-sync`, `/lessons`, `/worksheets`,
`/flashcards`, `/assessments`, `/curriculum`, `/settings`).

Deliberately **not** cached: `/translator`, `/voice-assistant`, `/classroom`
and the generators. Caching their shells would let a teacher open a translator
that cannot translate.

Navigation is network-first with a cache fallback, so a connected teacher sees
current content and the cache is the safety net rather than the default.
Registration is skipped in development, where a worker serving cached pages
over a hot-reloading server produces stale-code bugs that look like
application bugs.

## Bug found while testing

The worker was **never registering at all**. Registration waited on
`window.addEventListener("load", …)`, but React hydrates after `load` has
already fired, and a listener added after an event has fired never runs.
Nothing was ever cached. Now it checks `document.readyState` first.

## Test results

Verified with the network genuinely cut (CDP `Network.emulateNetworkConditions`,
`offline: true`, confirmed by `fetch("/api/health")` failing):

| | |
| --- | --- |
| Content downloaded to IndexedDB | 8 lessons, 59 translations, 3 worksheets, 3 flashcards, 1 assessment |
| Read back offline | ✓ lesson "Plants" with full text, worksheet with 5 questions |
| UI renders it offline | ✓ tabs switched, worksheet opened, questions displayed |
| `navigator.onLine` | ✓ false; header shows **Offline** |
| Credentials in bundle | ✓ none |

**Not verified:** the service worker serving cached page shells. Headless
Chrome discards service worker registrations — `register()` resolves with a
scope, then `getRegistration()` returns none — so cached-shell navigation could
not be exercised here. It needs a check in a real browser: load the app, then
use DevTools → Network → Offline and navigate to `/library`.

## Storage management

`/offline-sync` shows what is stored, counted from the device rather than
assumed, plus cached audio size. "Clear downloaded content" empties IndexedDB
and asks the worker to drop its HTTP caches. Preferences survive — they are the
teacher's own settings, not downloaded content.
