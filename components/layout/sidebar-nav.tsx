"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NavIcon } from "@/components/layout/nav-icon";
import { NAV_ITEMS } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/**
 * The nav list itself, shared by the fixed desktop sidebar and the mobile
 * drawer. `onNavigate` lets the drawer close itself after a tap.
 */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="flex flex-col gap-1 px-3 py-4">
      {NAV_ITEMS.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <NavIcon name={item.icon} className="size-5 shrink-0" />
            <span className="flex-1 truncate">{item.label}</span>
            {item.phase > 1 ? (
              <span
                className="rounded-full border border-border px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground"
                title={`Planned for Phase ${item.phase}`}
              >
                P{item.phase}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
