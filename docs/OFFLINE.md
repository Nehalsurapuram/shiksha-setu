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

`/offline` also lists "What does not work offline" explicitly, before anything
goes wrong.

## Where content lives

**IndexedDB** (`lib/offline/db.ts`), ten stores: lessons, translations,
worksheets, flashcards, assessments, audio, glossary, curriculum, outbox,
preferences. The outbox is the tablet's own changes rather than a copy of
anything — see [SYNC.md](SYNC.md).

`/api/offline/bundle` assembles everything the teacher can use and the client
writes it to the device. Deliberately excluded from the bundle:

- **Anything secret.** No keys, tokens or connection strings. IndexedDB is
  readable by anyone holding the tablet.
- **Demo translations.** A placeholder notice cached as a translation is
  exactly what this product must never put in front of a teacher.
- **Learning outcomes with no `verifiedSource`.** Offline there is no server to
  re-check a row against, so an unsourced outcome sitting beside verified ones
  is precisely how one starts looking official.

Sync is a whole-store replace, not a merge: the server is the source of truth
and a merge would leave deleted material on tablets indefinitely.

## Curriculum

Verified learning outcomes sync to the device like any other content, so
`/library` has a Curriculum tab that reads from the tablet.

`/offline-sync` previously ticked Curriculum from a **server** count, inside a
card whose own description reads "Counted from this device, not from the
server". Every row there is now counted from IndexedDB, and the explanation for
a zero — no verified catalogue is loaded on this installation — sits beneath the
list instead of being implied by the tick.

`/curriculum` is server-rendered, so offline a teacher is looking at whatever
the worker cached the last time that page loaded online. The card added there
reads from the device and says which figure is which, rather than letting a
snapshot pass for a live count.

## Installing

`app/manifest.ts` now ships **PNG icons at 192 and 512** alongside the SVG.
Chrome rasterises an SVG icon; the Android WebView and Samsung Internet builds
these tablets ship with do not reliably do so, and an installer that cannot
produce an icon does not offer the install at all.

`InstallApp` on `/offline-sync` shows a real button **only** when the browser
has actually fired `beforeinstallprompt`. Calling `prompt()` without that stored
event silently does nothing, and a dead button on a tablet someone is setting up
before class is worse than none — so every other browser gets the manual
instructions for its own menu instead. It also states plainly that installing
changes how the app opens, not what it can do without a network.

## Audio

Cached audio is stored as **Blob bytes**, not URLs — a URL is useless offline.
Clips are synthesised while online from `/offline-sync` and played from
IndexedDB afterwards.

`/library` has an Audio tab listing every clip on the device with its size and
the date it was cached, so "cached audio" is something a teacher can look at and
play, not a number on a settings screen.

It speaks the **language of instruction only**. There is no mother-tongue
voice, and reading Ol Chiki aloud with a Hindi voice would be confident audio
that is not Santhali.

## Saved content

`/library` reads **only** from IndexedDB, across seven tabs: lessons,
worksheets, flashcards, assessments, translations, audio and curriculum. It
behaves identically with the network on or off because it never had a server to
lose — so whatever it shows is genuinely on the tablet. This also filled a real gap: before it, saved
worksheets and decks were in the database with no screen to open them.

## Service worker

Caches the app shell plus the routes that read from IndexedDB
(`/dashboard`, `/library`, `/offline`, `/lessons`, `/worksheets`,
`/flashcards`, `/assessments`, `/curriculum`, `/settings`).

Deliberately **not** cached: `/translator`, `/voice-assistant`, `/classroom`
and the generators. Caching their shells would let a teacher open a translator
that cannot translate.

Caching a route means caching **the page and the JavaScript it needs to run**.
These screens render their content from IndexedDB after hydration, so a cached
shell without its chunks shows a spinner offline and never fills in — the
content is on the tablet and the code to read it is not. The worker pulls each
page's `/_next/static/` URLs out of its own HTML and caches those alongside it,
at install and again whenever the teacher presses "Download for offline".

Navigation is network-first with a cache fallback, so a connected teacher sees
current content and the cache is the safety net rather than the default.
Registration is skipped in development, where a worker serving cached pages
over a hot-reloading server produces stale-code bugs that look like
application bugs.

## Bugs found while testing

Three, each of which made the cache useless in a different way, and none of
which is visible without genuinely cutting the network.

**1. The worker never registered.** Registration waited on
`window.addEventListener("load", …)`, but React hydrates after `load` has
already fired, and a listener added after an event has fired never runs. Nothing
was ever cached. It checks `document.readyState` first.

**2. Nothing cached was ever served.** With the worker active and the caches
full, all nine offline routes still fell through to `offline.html`. Next sets
`Vary: RSC, Next-Router-State-Tree, …` on page responses, and Cache Storage
honours `Vary` when matching: the copy stored during an online visit was saved
against a request whose RSC headers differ from the one a cold offline
navigation sends, so the match failed every time. The fallback needs
`ignoreVary: true`.

**3. Cached pages loaded but stayed empty.** With that fixed, `/library` served
its shell offline and rendered the navigation and headings — and no content,
because its JavaScript had never been fetched, so nothing ever read IndexedDB.
Precaching HTML is not precaching a page. The worker now extracts and caches
each route's chunks too.

## Test results

`npm run offline:check` drives a real Chrome over CDP against a production
build, with Chrome's network emulation applied to the page *and* the service
worker target so requests genuinely fail. Headful on purpose: headless Chrome
discards service worker registrations, which is why the cached-shell path could
not be checked before.

**21 of 21 checks passed**, with `fetch("/api/health")` confirmed failing and
`navigator.onLine` false throughout the offline half.

| | |
| --- | --- |
| Service worker | registers and reaches `active` |
| Downloaded to IndexedDB | 8 lessons, 59 translations, 3 worksheets, 3 flashcards, 1 assessment |
| `/library` offline | loads from cache, hydrates, tabs show real device counts |
| Saved lesson offline | opens and renders its Hindi source text |
| Audio offline | a stored clip is listed and plays to `ended` from IndexedDB |
| Curriculum offline | reads from the device; `/curriculum` opens from cache |
| Cached routes offline | `/dashboard`, `/offline-sync`, `/curriculum` all render |
| `/translator` offline | **not** served from cache — says the connection is needed |
| Credentials in bundle | none |
| Manifest | serves the PNG install icons |

**Not verified here:** audio synthesised by the real provider. This machine runs
with `ENABLE_DEMO_MODE=true`, so no clip is generated to cache, and the audio
checks write a WAV into the store directly instead. That exercises the storage
and playback path — bytes in IndexedDB, decoded and played to `ended` with the
network cut — but not the synthesis step that fills it.

## Storage management

`/offline` shows what is stored, counted from the device rather than
assumed, plus cached audio size. "Clear downloaded content" empties IndexedDB
and asks the worker to drop its HTTP caches. Preferences survive — they are the
teacher's own settings, not downloaded content.
