"use server";

import { AuthError } from "next-auth";
import { z } from "zod";

import { signIn } from "@/auth";

export type LoginState = { error?: string };

const LoginSchema = z.object({
  email: z.string().email("Enter the email address your account uses."),
  password: z.string().min(1, "Enter your password."),
  from: z.string().optional(),
});

/**
 * Signs a user in.
 *
 * Every failure returns the same sentence. "No such account" and "wrong
 * password" are different facts, and telling them apart hands an attacker a way
 * to enumerate which teachers exist on an installation.
 */
export async function login(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    from: formData.get("from") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  const target =
    parsed.data.from && parsed.data.from.startsWith("/")
      ? // Only same-site paths: an absolute URL here would be an open redirect,
        // and a sign-in page is exactly where one gets phished through.
        parsed.data.from
      : "/dashboard";

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: target,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "That email address and password do not match an account." };
    }
    // signIn throws a redirect on success; rethrowing lets Next handle it.
    throw error;
  }

  return {};
}
