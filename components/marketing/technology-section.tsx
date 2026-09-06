import { Reveal } from "@/components/marketing/reveal";
import { Section, SectionHeading } from "@/components/marketing/section";
import { TECHNOLOGY } from "@/lib/marketing";

export function TechnologySection() {
  return (
    <Section id="technology">
      <SectionHeading
        eyebrow="Technology"
        title="Chosen for a tablet on a weak connection"
        body="Server rendering keeps the client small, the schema is typed end to end, and the offline layer is a first-class part of the stack rather than an add-on."
      />

      <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TECHNOLOGY.map((item, index) => (
          <Reveal key={item.name} delay={index * 45}>
            <div className="ss-lift h-full rounded-xl border border-border bg-card p-5">
              <p className="font-semibold tracking-tight">{item.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.role}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
