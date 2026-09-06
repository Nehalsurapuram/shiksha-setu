import Link from "next/link";
import { ArrowRight, PlayCircle, WifiOff } from "lucide-react";

import { Reveal } from "@/components/marketing/reveal";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/marketing";

/**
 * The hero visual is a *frame*, not a sample.
 *
 * It shows the two languages by their real endonyms — हिन्दी and ᱥᱟᱱᱛᱟᱲᱤ, which
 * are facts, not model output — and leaves the translation surface empty with
 * a caption saying so. Filling it with invented Santhali to make a prettier
 * screenshot is exactly the thing this project must not do.
 */
export function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-brand-ink">
      {/* Ambient wash. Purely decorative, hidden from assistive tech. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="ss-drift absolute -left-32 -top-40 size-[34rem] rounded-full bg-brand/25 blur-3xl" />
        <div className="ss-drift absolute -right-24 top-24 size-[28rem] rounded-full bg-marigold/15 blur-3xl [animation-delay:-4s]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_35%,var(--brand-ink)_78%)]" />
      </div>

      <div className="mx-auto grid w-full max-w-6xl gap-12 px-5 py-20 sm:px-6 sm:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:px-8 lg:py-32">
        <div>
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-on-brand/20 bg-on-brand/5 px-3 py-1.5 text-xs font-medium text-on-brand-muted">
              <span className="size-1.5 rounded-full bg-marigold" aria-hidden />
              Mother tongue-based multilingual education
            </span>
          </Reveal>

          <Reveal delay={60}>
            <h1 className="mt-6 text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-on-brand sm:text-5xl lg:text-6xl">
              Teach Every Child in Their Mother Tongue
            </h1>
          </Reveal>

          <Reveal delay={120}>
            <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-on-brand-muted">
              In thousands of schools a Hindi-medium teacher stands in front of
              children who speak Santhali, Ho or Mundari at home. Both are
              fluent — in different languages. ShikshaSetu AI is being built to
              close that gap with translation, voice and lesson tools that keep
              working when the network does not.
            </p>
          </Reveal>

          <Reveal delay={180}>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="bg-marigold text-brand-ink hover:bg-marigold-strong"
              >
                <Link href="/dashboard">
                  Open Teacher Assistant
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-on-brand/30 bg-transparent text-on-brand hover:bg-on-brand/10"
              >
                <Link href="/dashboard">
                  <PlayCircle aria-hidden />
                  Watch Demo
                </Link>
              </Button>
            </div>
          </Reveal>

          <Reveal delay={240}>
            <p className="mt-5 max-w-xl text-sm text-on-brand-muted/80">
              There is no recorded demo yet, so both buttons open the live app.
              The foundation is built; the AI features are not, and every screen
              says which is which.
            </p>
          </Reveal>
        </div>

        {/* Language bridge card */}
        <Reveal delay={140} className="lg:justify-self-end">
          <div className="relative w-full max-w-md rounded-2xl border border-on-brand/15 bg-on-brand/[0.06] p-2 shadow-2xl backdrop-blur-sm">
            <div className="rounded-xl bg-card p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
                  Language bridge
                </p>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[0.7rem] font-medium text-muted-foreground">
                  <WifiOff className="size-3" aria-hidden />
                  Works offline
                </span>
              </div>

              <div className="mt-5 space-y-3">
                <div className="rounded-lg border border-border bg-muted/50 p-4">
                  <p className="text-xs font-medium text-muted-foreground">
                    Language of instruction
                  </p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight">
                    हिन्दी{" "}
                    <span className="text-base font-normal text-muted-foreground">
                      Hindi
                    </span>
                  </p>
                </div>

                <div className="flex items-center justify-center" aria-hidden>
                  <span className="flex size-9 items-center justify-center rounded-full border border-border bg-card text-brand">
                    <ArrowRight className="size-4 rotate-90" />
                  </span>
                </div>

                <div className="rounded-lg border border-brand/30 bg-brand-tint p-4">
                  <p className="text-xs font-medium text-brand">
                    Mother tongue
                  </p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight">
                    <span className="font-ol-chiki">ᱥᱟᱱᱛᱟᱲᱤ</span>{" "}
                    <span className="text-base font-normal text-muted-foreground">
                      Santhali
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Written in Ol Chiki, not transliterated into Devanagari.
                  </p>
                </div>
              </div>

              <p className="mt-5 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
                Interface preview. No translation is shown here because
                translation is not built yet — a sample sentence would be
                indistinguishable from a real one to the teacher it is meant to
                help.
              </p>
            </div>
          </div>
        </Reveal>
      </div>

      <div className="border-t border-on-brand/10">
        <div className="mx-auto w-full max-w-6xl px-5 py-5 sm:px-6 lg:px-8">
          <p className="text-center text-sm font-medium text-on-brand-muted">
            {BRAND.tagline}{" "}
            <span className="text-on-brand-muted/70">{BRAND.secondary}</span>
          </p>
        </div>
      </div>
    </section>
  );
}
