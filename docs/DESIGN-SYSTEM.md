# Design system

The visual identity for ShikshaSetu AI: a public-education product that has to
look trustworthy to a headmaster and work in the hands of a teacher holding a
low-cost Android tablet in a bright classroom.

## Brand

| | |
| --- | --- |
| Name | ShikshaSetu AI |
| Tagline | Bridging Teachers and Learners Through Language. |
| Secondary | Teach in the language every child understands. |

## Colour

Two token layers, defined in [app/globals.css](../app/globals.css).

**App tokens** (`--background`, `--card`, `--primary`, …) drive the teacher
assistant. **Brand tokens** (`--brand`, `--marigold`, `--brand-ink`, …) drive
the public site. They are separate on purpose: restyling the marketing site
must never change the contrast a teacher reads a lesson against.

- **Deep teal** (`--brand`) carries the "trustworthy public institution"
  register without being the saturated blue every translation product uses.
- **Marigold** (`--marigold`) is the accent — an Indian classroom warmth that
  does not reach for flag colours.
- **Brand ink** (`--brand-ink`) is the dark band behind the hero and the impact
  figures.

Every token is defined at `:root` for light and redefined under
`prefers-color-scheme: dark`. Both schemes are checked.

## Type and spacing

Geist Sans throughout, plus **Noto Sans Ol Chiki** for Santhali — Geist has no
Ol Chiki coverage, so without it every Santhali string is tofu boxes on a stock
Android tablet. Apply `.font-ol-chiki` to any element rendering `sat-IN` text.

Sections use one rhythm (`py-16 sm:py-20 lg:py-28`) and one container
(`max-w-6xl`), both from `components/marketing/section.tsx`.

## Touch targets

The button sizes in `components/ui/button.tsx` are larger than the shadcn
defaults — `default` is 44px tall, `lg` is 52px, and icon buttons are 44px
square. Navigation and footer links carry `min-h-10`/`min-h-12`. The target is
a teacher tapping while standing in front of a class, not a mouse.

## Motion

Three rules, in priority order:

1. **Motion never gates content.** Text is readable before, during and without
   JavaScript.
2. **Above the fold uses CSS only.** `.ss-enter` is a pure CSS entrance
   animation. It runs and completes whether or not the bundle ever arrives.
3. **Below the fold uses `Reveal`.** The server renders no hidden state; after
   mount, `Reveal` measures each element and hides *only* what is off-screen,
   then fades it in on scroll.

This ordering was not theoretical. An earlier version hid every animated
element by default and revealed it after hydration, which rendered the whole
page blank until the JavaScript landed — precisely the failure a teacher on a
weak rural connection would hit. `components/marketing/reveal.tsx` documents
the failure modes it now covers.

`prefers-reduced-motion: reduce` disables all of it and renders finished
states. Hover lifts (`.ss-lift`) apply only under `(hover: hover)`, so a tap on
a tablet never triggers one.

## Honesty rules that shape the UI

Carried over from Phase 1 and enforced in the marketing components:

- **No invented output.** The hero visual is a frame with the translation
  surface deliberately empty and captioned as such. The only non-English text
  on the page is the two endonyms — हिन्दी and ᱥᱟᱱᱛᱟᱲᱤ — which are facts, not
  model output.
- **Feature cards carry a build-state badge.** "In progress" or "Planned",
  from `lib/marketing.ts`.
- **Impact figures are labelled targets**, in the eyebrow, on each card, and in
  a closing line. Nothing has been measured in a classroom.
- **Dead links are not links.** Footer entries with no destination yet (GitHub,
  Documentation, Contact) render as text marked "Soon" rather than as links
  that go nowhere.

## Breakpoints

Verified at 390 (mobile), 800 (10-inch tablet portrait), 1280 (tablet
landscape) and 1440 (laptop), in both colour schemes.
