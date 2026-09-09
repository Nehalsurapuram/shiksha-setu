import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic route gating — `middleware.ts` renamed in Next 16.
 *
 * This is a **courtesy, not a control.** It reads the session cookie's presence
 * and nothing else: no database, no signature check, because it runs on every
 * request including prefetches. A forged or expired cookie sails straight
 * through here, and that is fine, because the actual decision is made next to
 * the data by `requireCapability` and `requireApiUser`, which re-read the user
 * and their role from Postgres.
 *
 * What it buys is that a signed-out teacher gets the sign-in page instead of a
 * flash of an empty dashboard, and that `/admin` does not render its shell to
 * someone who will be refused a moment later.
 */

/** Public: the marketing page, sign-in, the worker's offline fallback, assets. */
const PUBLIC_PATHS = [
  "/",
  "/login",
  "/forbidden",
  "/offline.html",
  "/manifest.webmanifest",
  "/sw.js",
];

const PUBLIC_PREFIXES = ["/api/auth/", "/_next/", "/icons/", "/favicon"];

function isPublic(pathname: string): boolean {
  return (
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

/**
 * Both cookie names are checked because Auth.js prefixes the secure variant
 * with `__Secure-` over HTTPS, and a deployment behind TLS would otherwise
 * bounce every signed-in user back to the sign-in page.
 */
function hasSessionCookie(request: NextRequest): boolean {
  return Boolean(
    request.cookies.get("authjs.session-token")?.value ??
      request.cookies.get("__Secure-authjs.session-token")?.value,
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  if (hasSessionCookie(request)) return NextResponse.next();

  // API callers get an answer they can parse rather than a redirect to HTML.
  // The handlers check properly again; this only saves a wasted round trip.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHENTICATED", message: "Sign in to use this." } },
      { status: 401 },
    );
  }

  const signIn = new URL("/login", request.url);
  signIn.searchParams.set("from", pathname);
  return NextResponse.redirect(signIn);
}

export const config = {
  // Everything except static output. Auth checks should see as much as
  // possible; the exclusions are files that carry no session at all.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
