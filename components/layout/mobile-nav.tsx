"use client";

import { useState } from "react";
import { Menu } from "lucide-react";

import { Brand } from "@/components/layout/brand";
import {
  LanguageSelector,
  type SelectableLanguage,
} from "@/components/layout/language-selector";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/** Drawer navigation for phones and portrait tablets (below the lg breakpoint). */
export function MobileNav({
  languages,
  defaultSource,
  defaultTarget,
}: {
  languages: SelectableLanguage[];
  defaultSource: string | null;
  defaultTarget: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Open navigation menu"
        >
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0">
        <div className="border-b border-border px-4 py-4">
          <SheetTitle asChild>
            <Brand href="/dashboard" />
          </SheetTitle>
          <SheetDescription className="sr-only">
            Main navigation for the ShikshaSetu AI teacher assistant.
          </SheetDescription>
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav onNavigate={() => setOpen(false)} />
        </div>

        {/* The header hides the selector below `md`, so phones reach it here. */}
        {defaultSource && defaultTarget ? (
          <div className="border-t border-border px-4 py-4 md:hidden">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Classroom languages
            </p>
            <LanguageSelector
              languages={languages}
              defaultSource={defaultSource}
              defaultTarget={defaultTarget}
            />
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
