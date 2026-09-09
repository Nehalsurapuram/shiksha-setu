import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

import { equaliseTiming, verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/database/prisma";
import { env } from "@/lib/env";

export type AppRole =
  | "TEACHER"
  | "HEAD_TEACHER"
  | "COORDINATOR"
  | "LANGUAGE_EXPERT"
  | "ADMIN";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: AppRole;
      schoolId: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role: AppRole;
    schoolId: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: AppRole;
    schoolId: string | null;
  }
}

const CredentialsSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
});

/**
 * Auth.js with a credentials provider and JWT sessions.
 *
 * Credentials rather than an OAuth provider because these accounts belong to
 * teachers in schools with no institutional Google or Microsoft tenant, and a
 * device shared between two teachers cannot depend on either of them holding a
 * personal account.
 *
 * JWT sessions rather than database sessions because the tablets this runs on
 * are frequently offline: a session that needs a database round trip per
 * request would log a teacher out every time the connection drops, in the one
 * situation where the app is most needed. The trade-off is that a role change
 * takes effect on the next sign-in, and `requireRole` re-reads the user from
 * the database for anything that grants access to another person's data.
 *
 * The secret is read through `lib/env`, which is `server-only`. It is never
 * NEXT_PUBLIC_ and never reaches the browser.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: env.AUTH_SECRET,
  session: {
    strategy: "jwt",
    // A school day plus a margin. Long enough that a teacher is not signing in
    // between lessons, short enough that a lost tablet is not a standing key.
    maxAge: 12 * 60 * 60,
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = CredentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase().trim() },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            schoolId: true,
            passwordHash: true,
            isActive: true,
          },
        });

        // Same work whether or not the account exists, so response time does
        // not answer "is this address registered?".
        if (!user?.passwordHash) {
          await equaliseTiming(password);
          return null;
        }

        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok || !user.isActive) return null;

        await prisma.user
          .update({ where: { id: user.id }, data: { lastSeenAt: new Date() } })
          .catch(() => undefined);

        // Only these fields reach the token. The hash never leaves this scope.
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as AppRole,
          schoolId: user.schoolId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.schoolId = user.schoolId;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      session.user.role = token.role;
      session.user.schoolId = token.schoolId;
      return session;
    },
  },
});
