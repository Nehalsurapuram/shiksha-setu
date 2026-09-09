# ShikshaSetu AI

An AI-powered Mother Tongue-Based Multilingual Education (MTB-MLE) teacher
assistant. Initial language pair: **Hindi → Santhali**. Ho and Mundari are
planned.

Built to run on low-cost Android tablets with offline-first classroom usage.

> **Status: translation, voice, the two-way classroom, lesson and content
> generation, and offline access are live.** Hindi → Santhali translation runs
> against Sarvam AI with history and teacher corrections
> ([docs/TRANSLATION.md](docs/TRANSLATION.md)), the Voice Assistant
> transcribes Hindi speech and translates it ([docs/VOICE.md](docs/VOICE.md)),
> and the Interactive Classroom carries a conversation both ways
> ([docs/CLASSROOM.md](docs/CLASSROOM.md)).
>
> **Santhali audio is not available.** Sarvam's speech-to-text supports
> Santhali; its text-to-speech does not, so the read-aloud step has no provider
> and the app says so rather than substituting another language's voice. Hindi
> audio does work, so in the classroom a student's reply can be read aloud to
> the teacher even though the teacher's cannot be read to the student.
>
> Lesson upload and AI lesson generation are built
> ([docs/LESSONS.md](docs/LESSONS.md)): PDF, Word, photo and text files are
> read, and a teaching package is generated and translated. It needs an
> `OPENAI_API_KEY` with credit; without one, uploading and saving still work
> and no lesson content is invented.
>
> Worksheets, flashcards and assessments generate bilingual, printable material
> ([docs/GENERATORS.md](docs/GENERATORS.md)). The model does not reliably follow
> the request — count, question type and language — so the code enforces it
> after generation rather than trusting the output.
>
> Every lesson, worksheet and assessment carries an FLN / NIPUN Bharat alignment
> card ([docs/FLN-ALIGNMENT.md](docs/FLN-ALIGNMENT.md)). The outcome catalogue
> ships empty, so today every alignment is labelled **Suggested** and carries no
> outcome codes — a fabricated "FLN 2.3" on a printed worksheet is
> indistinguishable from a real one.
>
> Offline sync downloads saved content to IndexedDB and `/library` reads only
> from the device ([docs/OFFLINE.md](docs/OFFLINE.md)). No cloud AI feature works
> offline — translation, speech and generation are all HTTP calls — and every
> screen that needs the network says so the moment the connection drops.
>
> Sync runs both ways ([docs/SYNC.md](docs/SYNC.md)). A teacher can **correct a
> translation with no connection**; the change is queued on the tablet and sent
> when the network returns. A correction made against a copy the server has
> since moved past is never applied silently — it comes back as a conflict
> showing both versions, and only the teacher's explicit choice overwrites
> newer work.
>
> Audio Library and Analytics are **not built**; see
> [docs/PHASE-1.md](docs/PHASE-1.md) and
> [docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md). Every unbuilt screen says so
> plainly rather than showing sample output.
>
> Translations are **validated by people** ([docs/VALIDATION.md](docs/VALIDATION.md)).
> A teacher corrects what the model produced; a language expert approves,
> rewrites or rejects that correction on `/expert/review`; an approved
> correction can become a `GlossaryTerm` marked verified, traceable to the
> approval behind it. Verified text is then served in place of the model's, and
> labelled as a person's work rather than a machine's. **No model is retrained**
> — approved corrections are used as terminology and context data, which is the
> only claim this prototype can make honestly.
>
> Without a `SARVAM_API_KEY` the translator and voice assistant run in demo
> mode, returning labelled placeholders — never invented Santhali, and never a
> fabricated transcript.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui-style
components · Prisma 7 · PostgreSQL · PWA-ready

## Getting started

```bash
cp .env.example .env      # fill in DATABASE_URL at minimum
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Open <http://localhost:3000>. Health check: `GET /api/health`.

## Scripts

| Script | Does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and serve (service worker is active here) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run offline:check` | Drives a real Chrome with the network cut and verifies saved content still opens (needs `npm run build && npm start` first) |
| `npm run sync:check` | Types corrections offline in a real Chrome, then verifies they reach Postgres and that conflicts never overwrite newer work |
| `npm run validation:check` | Drives the expert review screen and verifies that only an approval produces verified text and a verified glossary term |
| `npm run db:migrate` | Create/apply a migration in development |
| `npm run db:deploy` | Apply migrations in production |
| `npm run db:seed` | Load languages, demo school and teacher |
| `npm run db:studio` | Prisma Studio |

## Layout

```
app/            routes — landing page, (app) shell group, api/
components/     ui/ (primitives), layout/ (shell), marketing/ (public site),
                shared/ (page-level)
lib/            ai/ sarvam/ database/ offline/ + env, languages, navigation,
                marketing (public-site copy)
prisma/         schema, migrations, seed
docs/           phase notes
types/          shared types
```

## Secrets

Never commit `.env`. Nothing in the environment is prefixed `NEXT_PUBLIC_`:
API keys are server-only, enforced by `server-only` in `lib/env.ts`.
