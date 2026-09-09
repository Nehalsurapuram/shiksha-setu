import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

/**
 * Database side of the validation check.
 *
 *   tsx scripts/validation-probe.ts seed-correction <sourceText> <aiText> <teacherText>
 *   tsx scripts/validation-probe.ts correction <translationId>
 *   tsx scripts/validation-probe.ts glossary <sourceTerm>
 *   tsx scripts/validation-probe.ts reset
 *
 * `seed-correction` builds the state the review screen exists for — a
 * translation with a teacher's correction waiting on it — without needing a
 * translation provider, so the check runs on an installation with no API key.
 */
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set.");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const [command, ...args] = process.argv.slice(2);

  if (command === "seed-correction") {
    const [sourceText, aiText, teacherText] = args;
    const [hindi, santhali, teacher] = await Promise.all([
      prisma.language.findUniqueOrThrow({ where: { code: "hi-IN" } }),
      prisma.language.findUniqueOrThrow({ where: { code: "sat-IN" } }),
      prisma.user.findFirstOrThrow({ where: { role: "TEACHER" } }),
    ]);

    const contentHash = `probe-${Buffer.from(sourceText).toString("hex").slice(0, 40)}`;

    const translation = await prisma.translation.upsert({
      where: {
        contentHash_sourceLanguageId_targetLanguageId: {
          contentHash,
          sourceLanguageId: hindi.id,
          targetLanguageId: santhali.id,
        },
      },
      update: { targetText: aiText, reviewStatus: "UNREVIEWED" },
      create: {
        sourceText,
        targetText: aiText,
        source: "SARVAM",
        model: "probe",
        contentHash,
        reviewStatus: "UNREVIEWED",
        createdById: teacher.id,
        sourceLanguageId: hindi.id,
        targetLanguageId: santhali.id,
      },
    });

    const correction = await prisma.translationCorrection.create({
      data: {
        translationId: translation.id,
        correctedById: teacher.id,
        correctedText: teacherText,
        aiTranslation: aiText,
        reason: "probe correction",
        isAccepted: true,
      },
    });

    console.log(JSON.stringify({ translationId: translation.id, correctionId: correction.id }));
    return;
  }

  if (command === "correction") {
    const row = await prisma.translationCorrection.findFirst({
      where: { translationId: args[0] },
      orderBy: { createdAt: "desc" },
      select: {
        status: true,
        correctedText: true,
        aiTranslation: true,
        expertText: true,
        reviewNote: true,
        promotedTermId: true,
        reviewedBy: { select: { name: true, role: true } },
      },
    });
    console.log(JSON.stringify(row));
    return;
  }

  if (command === "glossary") {
    const term = await prisma.glossaryTerm.findFirst({
      where: { sourceTerm: args[0] },
      select: {
        sourceTerm: true,
        targetTerm: true,
        isVerified: true,
        sourceCorrectionId: true,
        createdBy: { select: { name: true, role: true } },
      },
    });
    console.log(JSON.stringify(term));
    return;
  }

  if (command === "reset") {
    const corrections = await prisma.translationCorrection.deleteMany({});
    const glossary = await prisma.glossaryTerm.deleteMany({});
    const translations = await prisma.translation.deleteMany({
      where: { contentHash: { startsWith: "probe-" } },
    });
    console.log(
      JSON.stringify({
        corrections: corrections.count,
        glossary: glossary.count,
        translations: translations.count,
      }),
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
