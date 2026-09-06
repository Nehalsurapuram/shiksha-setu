import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { env } from "@/lib/env";

/**
 * Prisma 7 connects through a driver adapter rather than a `url` in the schema.
 * In dev, Next.js hot-reloads modules on every edit, so the client is cached on
 * globalThis to avoid opening a new connection pool per reload.
 *
 * The client is created on first use, not at import time. Constructing it
 * eagerly read DATABASE_URL during `next build`, which made the build fail
 * wherever the database URL is not part of the build environment — a build
 * should not need production secrets to type-check and bundle.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export function getPrismaClient(): PrismaClient {
  const existing = globalForPrisma.prisma;
  if (existing) return existing;

  const client = createPrismaClient();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }
  return client;
}

/**
 * Reads through to the real client on first property access, so every existing
 * `prisma.lesson.findMany(...)` call site is unchanged.
 *
 * Methods are bound to the client because Prisma's own methods rely on `this`;
 * returning them unbound would break `prisma.$transaction` and the raw-query
 * template tags.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property: string | symbol) {
    const client = getPrismaClient();
    const value = Reflect.get(client, property) as unknown;
    return typeof value === "function" ? value.bind(client) : value;
  },
});
