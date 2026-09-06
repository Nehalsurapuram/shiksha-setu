import { MarketingIcon } from "@/components/marketing/marketing-icon";
import { Reveal } from "@/components/marketing/reveal";
import { Section, SectionHeading } from "@/components/marketing/section";
import { PROBLEMS } from "@/lib/marketing";

export function ProblemSection() {
  return (
    <Section id="problem">
      <SectionHeading
        eyebrow="The problem"
        title="A classroom where teacher and child do not share a language"
        body="None of this is a shortage of effort. It is a structural mismatch between where teachers are trained, what language children arrive speaking, and which languages have any digital tooling at all."
      />

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {PROBLEMS.map((problem, index) => (
          <Reveal
            key={problem.title}
            delay={index * 60}
            className={
              // The last card spans the empty column on 3-up so the grid does
              // not end on a lonely orphan.
              index === PROBLEMS.length - 1 ? "sm:col-span-2 lg:col-span-1" : ""
            }
          >
            <article className="ss-lift h-full rounded-xl border border-border bg-card p-6">
              <span className="flex size-11 items-center justify-center rounded-lg bg-marigold-tint text-marigold-strong">
                <MarketingIcon name={problem.icon} className="size-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold tracking-tight">
                {problem.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {problem.body}
              </p>
            </article>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
