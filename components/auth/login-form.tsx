"use client";

import { useActionState } from "react";
import { AlertTriangle, LogIn } from "lucide-react";

import { login, type LoginState } from "@/app/login/actions";
import { Button } from "@/components/ui/button";

const INITIAL: LoginState = {};

export function LoginForm({ from }: { from?: string }) {
  const [state, action, pending] = useActionState(login, INITIAL);

  return (
    <form action={action} className="space-y-4">
      {from ? <input type="hidden" name="from" value={from} /> : null}

      <div>
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className="mt-1.5 h-11 w-full rounded-md border border-input bg-card px-3 text-base"
        />
      </div>

      <div>
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1.5 h-11 w-full rounded-md border border-input bg-card px-3 text-base"
        />
      </div>

      {state.error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {state.error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        <LogIn aria-hidden />
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
