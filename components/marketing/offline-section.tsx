import { MarketingIcon } from "@/components/marketing/marketing-icon";
import { Reveal } from "@/components/marketing/reveal";
import { Section, SectionHeading } from "@/components/marketing/section";
import { OFFLINE_STEPS } from "@/lib/marketing";

export function OfflineSection() {
  return (
    <Section id="offline" className="bg-muted/40">
      <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start lg:gap-16">
        <SectionHeading
          eyebrow="Offline first"
          title="Built for the hours when there is no signal"
          body="Connectivity in a rural school is intermittent, not absent — so the design assumes a tablet syncs occasionally and teaches constantly."
        />

        <ol className="space-y-4">
          {OFFLINE_STEPS.map((step, index) => (
            <Reveal key={step.step} delay={index * 70} as="li">
              <div className="ss-lift flex gap-5 rounded-xl border border-border bg-card p-6">
                <div className="flex flex-col items-center gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-brand text-on-brand">
                    <MarketingIcon name={step.icon} className="size-5" />
                  </span>
                  {index < OFFLINE_STEPS.length - 1 ? (
                    <span
                      aria-hidden
                      className="w-px flex-1 bg-border"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 pb-1">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-brand">
                    {step.step}
                  </p>
                  <h3 className="mt-1 text-base font-semibold tracking-tight">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {step.body}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>

      <Reveal delay={120}>
        <p className="mt-10 rounded-xl border border-dashed border-border bg-card p-5 text-sm leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Today:</span> the app is
          installable and its shell is cached by a service worker, so it opens
          with no network. Caching lesson content and draining the queue of
          offline edits is designed and scheduled, not yet built.
        </p>
      </Reveal>
    </Section>
  );
}
