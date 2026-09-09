import "server-only";

import { redirect } from "next/navigation";

import { auth, type AppRole } from "@/auth";
import { prisma } from "@/lib/database/prisma";

/**
 * The authorization layer, sitting next to the data rather than in front of the
 * router.
 *
 * `proxy.ts` redirects signed-out visitors, which is a courtesy: it makes the
 * app behave sensibly. It is **not** the protection. Every page that reads a
 * person's data and every route handler that writes any calls one of these,
 * because a redirect is trivially bypassed by anything that is not a browser —
 * and `curl` is not a browser.
 */

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  schoolId: string | null;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  return {
    id: session.user.id,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    role: session.user.role,
    schoolId: session.user.schoolId,
  };
}

/** For pages: send a signed-out visitor to sign in, remembering where they were. */
export async function requireUser(returnTo?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    redirect(
      returnTo ? `/login?from=${encodeURIComponent(returnTo)}` : "/login",
    );
  }
  return user;
}

/**
 * What each role may do, in one place.
 *
 * Written as capabilities rather than route lists: a route can be renamed or
 * split without quietly widening who can reach it, and a reviewer can read this
 * table against the specification without tracing imports.
 */
export const CAPABILITIES = {
  /** Translate, speak, generate, upload, and read their own saved work. */
  classroom: ["TEACHER", "HEAD_TEACHER", "COORDINATOR", "LANGUAGE_EXPERT", "ADMIN"],
  /** Validate corrections and manage verified terminology. */
  review: ["LANGUAGE_EXPERT", "ADMIN"],
  /** Teachers, schools, languages, glossary, analytics, curriculum. */
  administer: ["ADMIN"],
} as const satisfies Record<string, readonly AppRole[]>;

export type Capability = keyof typeof CAPABILITIES;

export function can(role: AppRole, capability: Capability): boolean {
  return (CAPABILITIES[capability] as readonly AppRole[]).includes(role);
}

/**
 * For pages: require a capability, re-reading the role from the database.
 *
 * The JWT carries a role, and for a teacher's own screens that is enough. This
 * one hits the database because it guards other people's data: a session minted
 * before someone's role was revoked would otherwise stay administrative until
 * it expired, which is exactly the window an account is demoted to close.
 */
export async function requireCapability(
  capability: Capability,
  returnTo?: string,
): Promise<SessionUser> {
  const user = await requireUser(returnTo);

  const current = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true, isActive: true },
  });

  if (!current?.isActive || !can(current.role as AppRole, capability)) {
    redirect("/forbidden");
  }

  return { ...user, role: current.role as AppRole };
}

/* ------------------------------------------------------------- API side */

export class AuthError extends Error {
  constructor(
    readonly status: 401 | 403,
    readonly code: "UNAUTHENTICATED" | "FORBIDDEN",
    message: string,
  ) {
    super(message);
  }
}

/**
 * For route handlers: returns the user, or a Response to send back.
 *
 * Deliberately not a redirect. An API answering a fetch with a 302 to an HTML
 * sign-in page produces a JSON parse error at the caller and a bug report about
 * something unrelated; 401 and 403 say what actually happened.
 */
export async function requireApiUser(
  capability: Capability = "classroom",
): Promise<{ user: SessionUser } | { response: Response }> {
  const user = await getSessionUser();

  if (!user) {
    return {
      response: Response.json(
        {
          success: false,
          error: { code: "UNAUTHENTICATED", message: "Sign in to use this." },
        },
        { status: 401 },
      ),
    };
  }

  const current = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true, isActive: true },
  });

  if (!current?.isActive || !can(current.role as AppRole, capability)) {
    return {
      response: Response.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Your account does not have access to this.",
          },
        },
        { status: 403 },
      ),
    };
  }

  return { user: { ...user, role: current.role as AppRole } };
}

/** Narrowing helper so route handlers read as a two-liner. */
export function isDenied(
  result: Awaited<ReturnType<typeof requireApiUser>>,
): result is { response: Response } {
  return "response" in result;
}
