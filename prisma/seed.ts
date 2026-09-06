import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { LANGUAGES } from "../lib/languages";
import { SAMPLE_LESSONS } from "../lib/sample-lessons";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env first.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  // Languages are the one piece of reference data the app cannot run without.
  for (const language of LANGUAGES) {
    await prisma.language.upsert({
      where: { code: language.code },
      update: {
        name: language.name,
        nativeName: language.nativeName,
        script: language.script,
        status: language.status,
        isSource: language.isSource,
        isTarget: language.isTarget,
        sortOrder: language.sortOrder,
        notes: language.notes,
      },
      create: language,
    });
  }
  console.log(`Seeded ${LANGUAGES.length} languages.`);

  // A single demo school + teacher, so the Dashboard has something real to read
  // rather than hard-coded numbers in the UI.
  const school = await prisma.school.upsert({
    where: { udiseCode: "20010100101" },
    update: {},
    create: {
      name: "Govt. Upgraded Middle School, Dumka",
      udiseCode: "20010100101",
      village: "Kathikund",
      block: "Dumka",
      district: "Dumka",
      state: "Jharkhand",
      pincode: "814102",
    },
  });

  const hindi = await prisma.language.findUniqueOrThrow({
    where: { code: "hi-IN" },
  });
  const santhali = await prisma.language.findUniqueOrThrow({
    where: { code: "sat-IN" },
  });

  const teacher = await prisma.user.upsert({
    where: { email: "teacher@shikshasetu.local" },
    update: {},
    create: {
      email: "teacher@shikshasetu.local",
      name: "Demo Teacher",
      role: "TEACHER",
      schoolId: school.id,
      sourceLanguageId: hindi.id,
      targetLanguageId: santhali.id,
    },
  });
  console.log("Seeded demo school and teacher.");

  // Sample lessons, so the dashboard reads real rows instead of hard-coded
  // numbers. Marked isSample so every screen can label them as such. No
  // Translation rows are created: nothing has actually been translated.
  const DAY_MS = 24 * 60 * 60 * 1000;
  const now = Date.now();

  for (const lesson of SAMPLE_LESSONS) {
    const lastOpenedAt =
      lesson.lastOpenedDaysAgo === null
        ? null
        : new Date(now - lesson.lastOpenedDaysAgo * DAY_MS);

    const data = {
      subject: lesson.subject,
      grade: lesson.grade,
      topic: lesson.topic,
      sourceText: lesson.sourceText,
      status: lesson.status,
      isOfflinePinned: lesson.isOfflinePinned,
      isSample: true,
      lastOpenedAt,
      authorId: teacher.id,
      schoolId: school.id,
      sourceLanguageId: hindi.id,
      targetLanguageId: santhali.id,
    };

    // Lesson has no natural unique key, so match on the sample's title within
    // this seeded teacher's own lessons to keep re-seeding idempotent.
    const existing = await prisma.lesson.findFirst({
      where: { title: lesson.title, authorId: teacher.id, isSample: true },
      select: { id: true },
    });

    if (existing) {
      await prisma.lesson.update({ where: { id: existing.id }, data });
    } else {
      await prisma.lesson.create({ data: { ...data, title: lesson.title } });
    }
  }
  console.log(`Seeded ${SAMPLE_LESSONS.length} sample lessons.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
