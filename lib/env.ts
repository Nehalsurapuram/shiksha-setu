import "server-only";

import { z } from "zod";

/**
 * Server-only environment access.
 *
 * Importing this module from a Client Component is a build error (`server-only`),
 * which is the guard that keeps API keys out of the browser bundle. Nothing here
 * is prefixed NEXT_PUBLIC_ and nothing here may ever be.
 *
 * Validation is *lazy*. It used to run at module load, which meant importing
 * anything that touched the database threw during `next build` — and a build
 * should not need production secrets. Vercel builds a commit before its
 * runtime env is necessarily present, and preview deployments often have none
 * at all. Now a missing variable surfaces on the first request that actually
 * needs it, with the same clear message, instead of failing the build with a
 * stack trace pointing at page-data collection.
 */
const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  SARVAM_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),

  NEXTAUTH_SECRET: z.string().optional(),
  NEXTAUTH_URL: z.string().optional(),

  TRANSLATION_PROVIDER: z.enum(["sarvam", "openai"]).default("sarvam"),
  LLM_PROVIDER: z.enum(["openai", "sarvam"]).default("openai"),

  ENABLE_DEMO_MODE: z
    .string()
    .default("true")
    .transform((value) => value !== "false"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** Parses and caches the environment. Throws on the first invalid access. */
export function getEnv(): Env {
  if (cached) return cached;

  const parsed = schema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment configuration.\n${issues}\n\nCopy .env.example to .env and fill it in.`,
    );
  }

  cached = parsed.data;
  return cached;
}

/**
 * `env.DATABASE_URL` reads through to `getEnv()` on first property access, so
 * every existing call site keeps working while nothing is validated at import
 * time.
 */
export const env: Env = new Proxy({} as Env, {
  get(_target, property: string) {
    return getEnv()[property as keyof Env];
  },
  has(_target, property: string) {
    return property in getEnv();
  },
  ownKeys() {
    return Reflect.ownKeys(getEnv());
  },
  getOwnPropertyDescriptor(_target, property: string) {
    return Object.getOwnPropertyDescriptor(getEnv(), property);
  },
});

/** True when a provider credential is actually present, not merely configured. */
export function getProviderStatus(): { sarvam: boolean; openai: boolean } {
  const current = getEnv();
  return {
    sarvam: Boolean(current.SARVAM_API_KEY),
    openai: Boolean(current.OPENAI_API_KEY),
  };
}
