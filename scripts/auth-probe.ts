import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

/**
 * Database side of the auth check: what is actually stored for an account.
 *
 *   tsx scripts/auth-probe.ts hash <email>
 *   tsx scripts/auth-probe.ts roles
 */
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set.");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const [command, ...args] = process.argv.slice(2);

  if (command === "hash") {
    const user = await prisma.user.findUnique({
      where: { email: args[0] },
      select: { email: true, role: true, passwordHash: true },
    });
    console.log(
      JSON.stringify({
        found: Boolean(user),
        role: user?.role ?? null,
        // The hash itself is never printed — only its shape, which is what the
        // check needs and what a log file can safely hold.
        algorithm: user?.passwordHash?.split("$")[0] ?? null,
        parameters: user?.passwordHash?.split("$").slice(1, 5).join(",") ?? null,
        length: user?.passwordHash?.length ?? 0,
        looksHashed: Boolean(user?.passwordHash?.startsWith("scrypt$")),
      }),
    );
    return;
  }

  if (command === "roles") {
    const users = await prisma.user.findMany({
      orderBy: { email: "asc" },
      select: { email: true, role: true, isActive: true },
    });
    console.log(JSON.stringify(users));
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
