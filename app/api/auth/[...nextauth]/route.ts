import { handlers } from "@/auth";

/**
 * Auth.js's own endpoints: sign in, sign out, session, CSRF.
 *
 * Nothing else lives here. The credential check itself is in `auth.ts`, and the
 * password hash never leaves the server.
 */
export const { GET, POST } = handlers;
