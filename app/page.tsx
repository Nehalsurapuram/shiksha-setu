import Link from "next/link";
import { ArrowRight, PlayCircle } from "lucide-react";

import { Brand } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LANGUAGES } from "@/lib/languages";

const PILLARS = [
  {
    title: "Translation a teacher can correct",
    body: "Hindi to Santhali, with every result stored so a teacher can fix it once and have the fix reused. Corrections become glossary entries rather than being thrown away.",
  },
  {
    title: "Built for the tablet in the room",
    body: "Large tap targets, high contrast for classroom glare, and an app shell that opens without a network — because connectivity in a rural school is not a given.",
  },
  {
    title: "Mother tongue first",
    body: "Children learn to read fastest in the language they already speak. Santhali is written in Ol Chiki here, not transliterated into Devanagari for convenience.",
  },
];

export default function LandingPage() {
  const active = LANGUAGES.filter((language) => language.status === "ACTIVE");
  const planned = LANGUAGES.filter((language) => language.status === "PLANNED");

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex min-h-16 items-center justify-between gap-4 border-b border-border px-4 sm:px-6 lg:px-8">
        <Brand href="/" />
        <Button asChild variant="ghost" size="sm" className="hidden sm:flex">
          <Link href="/dashboard">Open Teacher Assistant</Link>
        </Button>
      </header>

      <main className="flex-1">
        <section className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <p className="text-sm font-medium uppercase tracking-wide text-primary">
            Mother tongue-based multilingual education
          </p>
          <h1 className="mt-4 max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            Teach Every Child in Their Mother Tongue
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            AI-powered translation, voice assistance and curriculum generation
            for multilingual classrooms.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/dashboard">
                Open Teacher Assistant
                <ArrowRight aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/dashboard">
                <PlayCircle aria-hidden />
                Watch Demo
              </Link>
            </Button>
          </div>

          <p className="mt-6 max-w-2xl text-sm text-muted-foreground">
            There is no recorded demo yet, so <strong className="font-medium">Watch Demo</strong>{" "}
            opens the live app. This is an early build: the foundation — database, languages,
            navigation and the offline shell — is in place; translation, voice
            and generation are still being built, and every screen says so
            rather than showing sample output.
          </p>
        </section>

        <section className="border-y border-border bg-card">
          <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-12 sm:px-6 md:grid-cols-3 lg:px-8">
            {PILLARS.map((pillar) => (
              <Card key={pillar.title} className="border-0 shadow-none">
                <CardContent className="p-0">
                  <h2 className="text-base font-semibold tracking-tight">
                    {pillar.title}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {pillar.body}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
          <h2 className="text-lg font-semibold tracking-tight">Languages</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {active.map((language) => (
              <div
                key={language.code}
                className="rounded-lg border border-border p-4"
              >
                <p className="font-medium">
                  {language.name}{" "}
                  <span
                    className={
                      language.script === "OL_CHIKI"
                        ? "font-ol-chiki text-muted-foreground"
                        : "text-muted-foreground"
                    }
                  >
                    {language.nativeName}
                  </span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {language.notes}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Planned next: {planned.map((language) => language.name).join(", ")}.
          </p>
        </section>
      </main>

      <footer className="border-t border-border px-4 py-6 text-sm text-muted-foreground sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-5xl">
          ShikshaSetu AI · An MTB-MLE teacher assistant for multilingual
          classrooms.
        </div>
      </footer>
    </div>
  );
}
