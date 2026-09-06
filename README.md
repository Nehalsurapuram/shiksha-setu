# ShikshaSetu AI

An AI-powered Mother Tongue-Based Multilingual Education (MTB-MLE) teacher
assistant. Initial language pair: **Hindi → Santhali**. Ho and Mundari are
planned.

Built to run on low-cost Android tablets with offline-first classroom usage.

> **Status: foundation + public site.** The database, language data,
> application shell, PWA skeleton and the marketing site are in place.
> Translation, voice, and content generation are **not implemented** — see
> [docs/PHASE-1.md](docs/PHASE-1.md) and
> [docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md). Every unbuilt screen says so
> plainly rather than showing sample output.

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
