import path from "node:path";
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

/**
 * Prisma 7 reads the connection URL from here rather than from schema.prisma.
 * Only the CLI (migrate / db / studio) uses this file; the runtime client gets
 * its connection from the driver adapter in lib/database/prisma.ts.
 */
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
