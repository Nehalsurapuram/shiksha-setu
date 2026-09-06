import { MarketingIcon } from "@/components/marketing/marketing-icon";
import { Reveal } from "@/components/marketing/reveal";
import { Section, SectionHeading } from "@/components/marketing/section";
import { Badge } from "@/components/ui/badge";
import { FEATURES } from "@/lib/marketing";

/**
 * Every card carries a build-state badge. This section describes what the
 * product is for, and the badge keeps it from reading as a list of things that
 * already work.
 */
export function FeaturesSection() {
  return (
    <Section id="features" className="bg-muted/40">
      <SectionHeading
        eyebrow="The solution"
        title="Six tools built around one classroom"
        body="Each one exists to remove a specific obstacle between a lesson in Hindi and a child who thinks in Santhali. The badge on each card says whether it is built."
      />

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature, index) => (
          <Reveal key={feature.title} delay={index * 55}>
            <article className="ss-lift group flex h-full flex-col rounded-xl border border-border bg-card p-6">
              <div className="flex items-start justify-between gap-3">
                <span className="flex size-12 items-center justify-center rounded-lg bg-brand-tint text-brand">
                  <MarketingIcon name={feature.icon} className="size-6" />
                </span>
                <Badge
                  variant={feature.state === "in-progress" ? "outline" : "secondary"}
                >
                  {feature.state === "in-progress" ? "In progress" : "Planned"}
                </Badge>
              </div>

              <h3 className="mt-5 text-lg font-semibold tracking-tight">
                {feature.title}
              </h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </article>
          </Reveal>
        ))}
      </div>

      <Reveal delay={120}>
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Nothing above calls a model today. The data model, language reference
          data and offline shell behind these features are built and running.
        </p>
      </Reveal>
    </Section>
  );
}
