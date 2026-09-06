import type { ReactNode } from "react";

import { Reveal } from "@/components/marketing/reveal";
import { cn } from "@/lib/utils";

/** Consistent vertical rhythm and max width for every band of the page. */
export function Section({
  id,
  children,
  className,
  bleed = false,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  /** True when the section paints its own full-width background. */
  bleed?: boolean;
}) {
  return (
    <section
      id={id}
      className={cn("scroll-mt-24 py-16 sm:py-20 lg:py-28", className)}
    >
      <div className={cn(bleed ? "w-full" : "mx-auto w-full max-w-6xl px-5 sm:px-6 lg:px-8")}>
        {children}
      </div>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  body,
  align = "start",
  tone = "default",
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  align?: "start" | "center";
  tone?: "default" | "inverse";
}) {
  const centered = align === "center";
  const inverse = tone === "inverse";

  return (
    <Reveal
      className={cn(
        "max-w-2xl",
        centered && "mx-auto text-center",
      )}
    >
      {eyebrow ? (
        <p
          className={cn(
            "text-xs font-semibold uppercase tracking-[0.14em]",
            inverse ? "text-marigold" : "text-brand",
          )}
        >
          {eyebrow}
        </p>
      ) : null}
      <h2
        className={cn(
          "mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl",
          inverse ? "text-on-brand" : "text-foreground",
        )}
      >
        {title}
      </h2>
      {body ? (
        <p
          className={cn(
            "mt-4 text-pretty text-base leading-relaxed sm:text-lg",
            inverse ? "text-on-brand-muted" : "text-muted-foreground",
          )}
        >
          {body}
        </p>
      ) : null}
    </Reveal>
  );
}
