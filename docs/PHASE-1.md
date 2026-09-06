# Phase 1 — Foundation

Phase 1 builds the parts of ShikshaSetu AI that everything else sits on: the
data model, the language reference data, the application shell, and the
offline-capable PWA skeleton. **No AI feature is implemented in this phase.**

## The rule that shapes this phase

> No fake AI functionality is presented as real.

A teacher using this app cannot tell an invented Santhali translation from a
correct one — they are the person the app exists to help precisely because they
do not read Ol Chiki fluently. A plausible-looking mock is therefore not a
harmless placeholder; it is a wrong answer with no warning label.

So Phase 1 enforces this in two places:

- **`lib/sarvam/client.ts` and `lib/ai/index.ts`** define the real function
  signatures, and every one of them throws `NotImplementedError`. None returns
  a sample string.
- **`components/shared/not-built-yet.tsx`** is the only way an unbuilt feature
  is presented in the UI. It names the phase the feature is planned for and
  lists what it will do, and it renders no mock input, no mock output, and no
  disabled-looking imitation of the real screen.

Numbers on the Dashboard are counted from the database, so an empty install
honestly shows zeros rather than sample data.

## What works

| Area | State |
| --- | --- |
| PostgreSQL + Prisma | 14 models, migrated, indexed |
| Language seed data | Hindi and Santhali active; Ho and Mundari planned |
| App shell | Sidebar, header, responsive/tablet layout, 11 routes |
| Landing page | Static, at `/` |
| PWA | Manifest, icons, app-shell service worker, offline fallback page |
| API | `GET /api/health` only |

## What is deliberately absent

Translator, voice assistant, lesson/worksheet/flashcard generation,
assessments, the audio library, analytics, content sync, authentication, and
the admin dashboard. Each has a route and a `NotBuiltYet` panel; none has an
implementation.

## Data model notes

- `Language` is reference data, seeded from `lib/languages.ts`. Adding a
  language there and re-seeding is the only change needed to list it.
- `Translation.contentHash` is unique per language pair. It is the lookup key
  for reusing a translation, which is what will make a repeated phrase work
  offline in Phase 2.
- `SyncItem` is an outbox: mutations made on a tablet with no connectivity are
  queued as rows here and drained when it reconnects. Phase 1 creates the table
  and counts it; nothing writes to it yet.
- `TranslationCorrection` exists because a teacher's fix is the most valuable
  data this product can collect — corrections are kept, not overwritten.

## Secrets

`lib/env.ts` imports `server-only`, so importing it from a Client Component is
a build error. Nothing in the environment is prefixed `NEXT_PUBLIC_`, and the
Settings page reports only *whether* a key is present, never its value. `.env`
is gitignored; `.env.example` is the committed template.

## Running it

```bash
cp .env.example .env      # then fill in DATABASE_URL
npm install
npm run db:migrate        # create the schema
npm run db:seed           # load languages + a demo school and teacher
npm run dev               # http://localhost:3000
```

Check the install with `curl http://localhost:3000/api/health`.

The service worker is registered only in a production build (`npm run build &&
npm start`), so `next dev` never serves stale code from cache.

## Definition of done

- [x] Project runs locally
- [x] PostgreSQL connects
- [x] Prisma migrations work
- [x] Seed data works
- [x] `.env.example` exists and `.env` is not committed
- [x] Navigation works across all 11 routes
- [x] Responsive, tablet-friendly layout
- [x] No fake AI functionality presented as real

## Phase 2 starts here

Translator first: it is the feature with the clearest value, it exercises
Sarvam, the `Translation` cache and the glossary in one path, and its
correction loop starts collecting the data later features depend on.
