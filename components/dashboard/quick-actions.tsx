import Link from "next/link";
import {
  FileText,
  Languages,
  Layers,
  Mic,
  Upload,
  type LucideIcon,
} from "lucide-react";

import { QUICK_ACTIONS } from "@/lib/quick-actions";

const ICONS: Record<string, LucideIcon> = {
  Languages,
  Mic,
  Upload,
  FileText,
  Layers,
};

/**
 * Five large tap targets, each a plain link to the feature's own page.
 *
 * The "Soon" marker is not decoration: these destinations are placeholder
 * screens, and a teacher should know that before tapping rather than after.
 */
export function QuickActions() {
  return (
    <section aria-labelledby="quick-actions-heading">
      <h2
        id="quick-actions-heading"
        className="text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground"
      >
        Quick actions
      </h2>

      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {QUICK_ACTIONS.map((action) => {
          const Icon = ICONS[action.icon] ?? Languages;

          return (
            <li key={action.href}>
              <Link
                href={action.href}
                className="flex min-h-28 flex-col justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted"
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  {action.phase > 1 ? (
                    <span className="rounded-full border border-border px-1.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
                      Soon
                    </span>
                  ) : null}
                </span>
                <span className="mt-3 block">
                  <span className="block text-sm font-semibold leading-tight">
                    {action.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {action.hint}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
