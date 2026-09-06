import "server-only";

import { z } from "zod";

/**
 * Server-only environment access.
 *
 * Importing this module from a Client Component is a build error (`server-only`),
 * which is the guard that keeps API keys out of the browser bundle. Nothing here
 * is prefixed NEXT_PUBLIC_ and nothing here may ever be.
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

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(
    `Invalid environment configuration.\n${issues}\n\nCopy .env.example to .env and fill it in.`,
  );
}

export const env = parsed.data;

/** True when a provider credential is actually present, not merely configured. */
export const providerStatus = {
  sarvam: Boolean(env.SARVAM_API_KEY),
  openai: Boolean(env.OPENAI_API_KEY),
} as const;
