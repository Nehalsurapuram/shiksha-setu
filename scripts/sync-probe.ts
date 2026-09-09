import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

/**
 * Server-side half of the sync check: reads and edits the database directly,
 * so the browser test can prove what actually landed rather than trusting the
 * UI's own report of itself.
 *
 *   tsx scripts/sync-probe.ts latest-correction <translationId>
 *   tsx scripts/sync-probe.ts sync-items
 *   tsx scripts/sync-probe.ts rival-correction <translationId> <text>
 *
 * `rival-correction` stands in for another teacher's tablet: it writes a
 * correction the device under test has never seen, which is what a conflict is.
 */
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env first.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const [command, ...args] = process.argv.slice(2);

  if (command === "latest-correction") {
    const correction = await prisma.translationCorrection.findFirst({
      where: { translationId: args[0] },
      orderBy: { createdAt: "desc" },
      select: { correctedText: true, reason: true, createdAt: true },
    });
    console.log(JSON.stringify(correction));
    return;
  }

  if (command === "sync-items") {
    const items = await prisma.syncItem.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        entityType: true,
        entityId: true,
        operation: true,
        status: true,
        attempts: true,
        lastError: true,
        syncedAt: true,
      },
    });
    console.log(JSON.stringify(items));
    return;
  }

  if (command === "rival-correction") {
    const [translationId, text] = args;
    const teacher = await prisma.user.findFirst({ select: { id: true } });
    if (!teacher) throw new Error("No user to attribute the correction to.");

    await prisma.$transaction([
      prisma.translationCorrection.create({
        data: {
          translationId,
          correctedById: teacher.id,
          correctedText: text,
          reason: "written by another device",
          isAccepted: true,
        },
      }),
      prisma.translation.update({
        where: { id: translationId },
        data: { reviewStatus: "CORRECTED" },
      }),
    ]);
    console.log("ok");
    return;
  }

  if (command === "reset") {
    // Leaves translations alone; only the artefacts this check creates go.
    const corrections = await prisma.translationCorrection.deleteMany({});
    const items = await prisma.syncItem.deleteMany({});
    console.log(
      JSON.stringify({ corrections: corrections.count, syncItems: items.count }),
    );
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
