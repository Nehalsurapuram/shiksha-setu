import { MarketingIcon } from "@/components/marketing/marketing-icon";
import { Reveal } from "@/components/marketing/reveal";
import { Section, SectionHeading } from "@/components/marketing/section";
import { PIPELINE } from "@/lib/marketing";

/**
 * The pipeline reads left-to-right on wide screens and top-to-bottom on a
 * phone. The connector is drawn with a border rather than an icon per step so
 * it collapses cleanly between the two directions.
 */
export function HowItWorks() {
  return (
    <Section id="how-it-works">
      <SectionHeading
        eyebrow="How it works"
        title="From the teacher's lesson to the child's language"
        body="One path, six stages. The teacher never leaves the language they are comfortable in, and the child never has to."
      />

      <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PIPELINE.map((stage, index) => (
          <Reveal key={stage.label} delay={index * 55} as="li">
            <div className="ss-lift relative h-full rounded-xl border border-border bg-card p-6">
              <div className="flex items-center gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-brand text-on-brand">
                  <MarketingIcon name={stage.icon} className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Step {index + 1}
                  </p>
                  <h3 className="truncate text-base font-semibold tracking-tight">
                    {stage.label}
                  </h3>
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {stage.detail}
              </p>
            </div>
          </Reveal>
        ))}
      </ol>

      <Reveal delay={100}>
        <div className="mt-8 rounded-xl border border-dashed border-border bg-muted/40 p-5">
          <p className="text-sm leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">
              Where this stands today:
            </span>{" "}
            the first and last stages are real — the teacher opens the app and
            the schema that will hold the lesson, translation and audio is
            migrated and running. The AI stages in the middle are the next build
            phase, and the app does not pretend otherwise.
          </p>
        </div>
      </Reveal>
    </Section>
  );
}
