import Link from "next/link";
import { GraduationCap } from "lucide-react";

import { cn } from "@/lib/utils";

export function Brand({
  href = "/",
  className,
}: {
  href?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("flex items-center gap-2.5 font-semibold", className)}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <GraduationCap className="size-5" aria-hidden />
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-base tracking-tight">ShikshaSetu AI</span>
        <span className="text-[0.7rem] font-normal text-muted-foreground">
          MTB-MLE Teacher Assistant
        </span>
      </span>
    </Link>
  );
}
