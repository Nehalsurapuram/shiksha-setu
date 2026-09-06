import { CircleAlert, CircleCheck } from "lucide-react";

import { cn } from "@/lib/utils";

/** A checklist line: green tick when satisfied, amber warning when not. */
export function StatusRow({
  label,
  detail,
  ok,
}: {
  label: string;
  detail: string;
  ok: boolean;
}) {
  const Icon = ok ? CircleCheck : CircleAlert;

  return (
    <li className="flex items-start gap-3 py-3">
      <Icon
        className={cn(
          "mt-0.5 size-5 shrink-0",
          ok ? "text-success" : "text-warning",
        )}
        aria-hidden
      />
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{detail}</p>
      </div>
      <span className="sr-only">{ok ? "Ready" : "Needs attention"}</span>
    </li>
  );
}
