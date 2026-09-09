import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export const metadata: Metadata = { title: "Not allowed" };

/**
 * Where an authorization refusal lands.
 *
 * It names the limit plainly rather than pretending the page does not exist:
 * a teacher who reached an admin screen from a stale link needs to know their
 * account is the reason, not to wonder whether something is broken.
 */
export default function ForbiddenPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-lg bg-warning/15 text-warning-foreground">
        <ShieldAlert className="size-6" aria-hidden />
      </span>
      <h1 className="mt-4 text-xl font-semibold">Your account cannot open this</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This screen is limited to a different role. If you need it, ask an
        administrator to change your account — nothing here can be unlocked from
        this side.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 inline-flex h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
      >
        Back to the dashboard
      </Link>
    </main>
  );
}
