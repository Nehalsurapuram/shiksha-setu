import path from "node:path";
import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 reads the connection URL from here rather than from schema.prisma.
 * Only the CLI (migrate / db / studio) uses this file; the runtime client gets
 * its connection from the driver adapter in lib/database/prisma.ts.
 *
 * The URL is read straight from the environment rather than through Prisma's
 * `env()` helper, which throws when the variable is absent. That threw during
 * `prisma generate` — a command that only reads the schema and needs no
 * database — and so broke any build environment without DATABASE_URL. Commands
 * that genuinely need a connection still fail, just at connect time.
 */
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
