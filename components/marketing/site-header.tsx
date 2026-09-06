"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";

import { Brand } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const SECTIONS = [
  { label: "Problem", href: "#problem" },
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Offline", href: "#offline" },
  { label: "Technology", href: "#technology" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center gap-4 px-5 sm:px-6 lg:px-8">
        <Brand href="/" />

        <nav
          aria-label="Sections"
          className="ml-auto hidden items-center gap-1 lg:flex"
        >
          {SECTIONS.map((section) => (
            <a
              key={section.href}
              href={section.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {section.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-4">
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/dashboard">Open Teacher Assistant</Link>
          </Button>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label="Open menu"
              >
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="p-0">
              <div className="border-b border-border px-5 py-4">
                <SheetTitle asChild>
                  <Brand href="/" />
                </SheetTitle>
                <SheetDescription className="sr-only">
                  Sections of the ShikshaSetu AI site.
                </SheetDescription>
              </div>
              <nav aria-label="Sections" className="flex flex-col gap-1 p-3">
                {SECTIONS.map((section) => (
                  <SheetClose asChild key={section.href}>
                    <a
                      href={section.href}
                      className="flex min-h-12 items-center rounded-md px-3 text-base font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      {section.label}
                    </a>
                  </SheetClose>
                ))}
              </nav>
              <div className="mt-auto border-t border-border p-4">
                <Button asChild size="lg" className="w-full">
                  <Link href="/dashboard">Open Teacher Assistant</Link>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
