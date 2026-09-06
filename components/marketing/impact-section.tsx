import { Reveal } from "@/components/marketing/reveal";
import { Section, SectionHeading } from "@/components/marketing/section";
import { IMPACT_TARGETS } from "@/lib/marketing";

/**
 * These are goals, not results.
 *
 * A big number on a dark band is exactly the pattern readers have been trained
 * to read as an achievement, so the section is labelled as targets in the
 * eyebrow, in the heading, on every card, and once more underneath. Nothing
 * here has been measured in a classroom.
 */
export function ImpactSection() {
  return (
    <Section id="about" className="bg-brand-ink">
      <SectionHeading
        tone="inverse"
        align="center"
        eyebrow="Project targets — not results"
        title="What this project is aiming at"
        body="ShikshaSetu AI has not been deployed to a school. The figures below are the goals the project is being designed against, so they can be judged against later."
      />

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {IMPACT_TARGETS.map((target, index) => (
          <Reveal key={target.label} delay={index * 60}>
            <div className="h-full rounded-xl border border-on-brand/15 bg-on-brand/[0.06] p-6 text-center">
              <p className="text-3xl font-semibold tracking-tight text-marigold sm:text-4xl">
                {target.value}
              </p>
              <p className="mt-2 text-sm font-medium text-on-brand">
                {target.label}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-on-brand-muted/85">
                {target.note}
              </p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={140}>
        <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-on-brand-muted/80">
          No school count, language count, latency figure or classroom hour on
          this page has been measured. When the product reaches a classroom,
          these numbers get replaced by what actually happened.
        </p>
      </Reveal>
    </Section>
  );
}
