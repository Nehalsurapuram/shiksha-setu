import { LogOut } from "lucide-react";

import { signOut } from "@/auth";
import { Badge } from "@/components/ui/badge";

const ROLE_LABELS: Record<string, string> = {
  TEACHER: "Teacher",
  HEAD_TEACHER: "Head teacher",
  COORDINATOR: "Coordinator",
  LANGUAGE_EXPERT: "Language expert",
  ADMIN: "Administrator",
};

/**
 * Who is signed in, and the way out.
 *
 * The role is shown rather than implied: on a tablet shared between two
 * teachers, "which account is this?" is a question that gets asked several
 * times a day, and the answer changes what the screens will let them do.
 */
export function AccountPanel({
  user,
}: {
  user: { name: string; email: string; role: string };
}) {
  return (
    <div className="border-t border-border px-5 py-4">
      <p className="truncate text-sm font-medium">{user.name}</p>
      <p className="truncate text-xs text-muted-foreground">{user.email}</p>
      <Badge variant="outline" className="mt-2">
        {ROLE_LABELS[user.role] ?? user.role}
      </Badge>

      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <button
          type="submit"
          className="mt-3 inline-flex min-h-11 items-center gap-2 text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          <LogOut className="size-3.5" aria-hidden />
          Sign out
        </button>
      </form>
    </div>
  );
}
