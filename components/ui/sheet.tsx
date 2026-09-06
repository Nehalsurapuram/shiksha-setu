"use client";

import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;
export const SheetTitle = SheetPrimitive.Title;
export const SheetDescription = SheetPrimitive.Description;

export function SheetContent({
  className,
  children,
  side = "left",
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "left" | "right";
}) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "fixed inset-y-0 z-50 flex w-[19rem] max-w-[85vw] flex-col border-border bg-card shadow-xl",
          side === "left" ? "left-0 border-r" : "right-0 border-l",
          className,
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close
          aria-label="Close menu"
          className="absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
        >
          <XIcon className="size-5" />
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}
