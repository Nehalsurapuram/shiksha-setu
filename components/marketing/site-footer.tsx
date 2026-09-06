import Link from "next/link";

import { Brand } from "@/components/layout/brand";
import { BRAND, FOOTER_LINKS } from "@/lib/marketing";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Brand href="/" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              {BRAND.tagline} {BRAND.secondary}
            </p>
          </div>

          {FOOTER_LINKS.map((group) => (
            <nav key={group.heading} aria-label={group.heading}>
              <h2 className="text-sm font-semibold tracking-tight">
                {group.heading}
              </h2>
              <ul className="mt-4 space-y-1">
                {group.links.map((link) => (
                  <li key={link.label}>
                    {link.href === null ? (
                      // No destination exists yet. A dead link reads as a
                      // broken site; this reads as an unfinished one.
                      <span className="flex min-h-10 items-center gap-2 text-sm text-muted-foreground/70">
                        {link.label}
                        <span className="rounded-full border border-border px-1.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide">
                          Soon
                        </span>
                      </span>
                    ) : link.href.startsWith("#") ? (
                      <a
                        href={link.href}
                        className="flex min-h-10 items-center text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="flex min-h-10 items-center text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            {BRAND.name} · An MTB-MLE teacher assistant for multilingual
            classrooms.
          </p>
          <p className="text-xs">
            In development. Not yet deployed to a classroom.
          </p>
        </div>
      </div>
    </footer>
  );
}
