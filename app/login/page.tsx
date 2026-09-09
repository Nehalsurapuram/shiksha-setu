import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { getSessionUser } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  const from = typeof params.from === "string" ? params.from : undefined;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">ShikshaSetu AI</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in to reach your classroom, your saved lessons and anything
          downloaded to this tablet.
        </p>
      </div>

      <LoginForm from={from} />

      <p className="mt-8 text-xs text-muted-foreground">
        Accounts are created by an administrator. There is no self sign-up:
        these accounts carry teachers&apos; and children&apos;s work, and who
        holds one is a decision for the school rather than for whoever finds the
        URL.
      </p>
    </main>
  );
}
