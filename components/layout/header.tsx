"use client";

import { usePathname } from "next/navigation";

import {
  LanguageSelector,
  type SelectableLanguage,
} from "@/components/layout/language-selector";
import { MobileNav } from "@/components/layout/mobile-nav";
import { OnlineStatus } from "@/components/layout/online-status";
import { NAV_ITEMS } from "@/lib/navigation";

/**
 * Derives its title from the route so pages do not each have to repeat it.
 * Unknown routes fall back to the product name rather than rendering blank.
 */
export function Header({
  languages,
  defaultSource,
  defaultTarget,
}: {
  languages: SelectableLanguage[];
  defaultSource: string | null;
  defaultTarget: string | null;
}) {
  const pathname = usePathname();
  const current =
    NAV_ITEMS.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    ) ?? null;

  const canSelect = Boolean(defaultSource && defaultTarget);

  return (
    <header className="sticky top-0 z-30 flex min-h-16 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6">
      <MobileNav />

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-semibold tracking-tight">
          {current?.label ?? "ShikshaSetu AI"}
        </h1>
        {current ? (
          <p className="hidden truncate text-sm text-muted-foreground sm:block">
            {current.description}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {canSelect ? (
          <div className="hidden md:block">
            <LanguageSelector
              languages={languages}
              defaultSource={defaultSource as string}
              defaultTarget={defaultTarget as string}
            />
          </div>
        ) : (
          <span className="hidden rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground md:inline-flex">
            No language pair configured
          </span>
        )}
        <OnlineStatus />
      </div>
    </header>
  );
}
