import type { ReactNode } from "react";

import { Brand } from "@/components/layout/brand";
import { Header } from "@/components/layout/header";
import type { SelectableLanguage } from "@/components/layout/language-selector";
import { SidebarNav } from "@/components/layout/sidebar-nav";

/**
 * Fixed sidebar from `lg` up (landscape tablets and desktops), drawer below.
 * The main column scrolls on its own so the sidebar and header stay put while
 * a teacher scrolls a long lesson.
 */
export function AppShell({
  children,
  languages,
  defaultSource,
  defaultTarget,
}: {
  children: ReactNode;
  languages: SelectableLanguage[];
  defaultSource: string | null;
  defaultTarget: string | null;
}) {
  return (
    <div className="flex min-h-dvh bg-background">
      <aside className="hidden w-72 shrink-0 flex-col border-r border-border bg-card lg:flex">
        <div className="flex min-h-16 items-center border-b border-border px-4">
          <Brand href="/dashboard" />
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav />
        </div>
        <div className="border-t border-border px-5 py-4 text-xs text-muted-foreground">
          Phase 1 · foundation only. Features marked P2 / P3 are not built yet.
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          languages={languages}
          defaultSource={defaultSource}
          defaultTarget={defaultTarget}
        />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
