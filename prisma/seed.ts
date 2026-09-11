import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { hashPassword } from "../lib/auth/password";
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

  /*
   * Demo accounts, one per role, with a password.
   *
   * The password comes from SEED_PASSWORD when it is set. The fallback is a
   * fixed development value, printed on every run so nobody is left guessing —
   * and so nobody mistakes it for a secret. A deployment that wants real
   * accounts sets SEED_PASSWORD, or creates users some other way; seeding a
   * known password into production is exactly the mistake this comment exists
   * to prevent.
   */
  const seedPassword = process.env.SEED_PASSWORD ?? "shiksha-dev-1234";
  const passwordHash = await hashPassword(seedPassword);

  const teacher = await prisma.user.upsert({
    where: { email: "teacher@shikshasetu.local" },
    update: { passwordHash },
    create: {
      email: "teacher@shikshasetu.local",
      name: "Demo Teacher",
      role: "TEACHER",
      passwordHash,
      schoolId: school.id,
      sourceLanguageId: hindi.id,
      targetLanguageId: santhali.id,
    },
  });
  // A language expert as well as a teacher: /expert/review can only attribute
  // an approval to an account holding the role, and a review screen that cannot
  // approve anything is not a demonstration of anything.
  await prisma.user.upsert({
    where: { email: "expert@shikshasetu.local" },
    update: { passwordHash },
    create: {
      email: "expert@shikshasetu.local",
      name: "Demo Language Expert",
      role: "LANGUAGE_EXPERT",
      passwordHash,
      schoolId: school.id,
      sourceLanguageId: hindi.id,
      targetLanguageId: santhali.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "admin@shikshasetu.local" },
    update: { passwordHash },
    create: {
      email: "admin@shikshasetu.local",
      name: "Demo Administrator",
      role: "ADMIN",
      passwordHash,
      schoolId: school.id,
    },
  });

  console.log("Seeded demo school and three accounts:");
  console.log("  teacher@shikshasetu.local  (TEACHER)");
  console.log("  expert@shikshasetu.local   (LANGUAGE_EXPERT)");
  console.log("  admin@shikshasetu.local    (ADMIN)");
  console.log(
    process.env.SEED_PASSWORD
      ? "  password: from SEED_PASSWORD"
      : `  password: ${seedPassword}  — development only, set SEED_PASSWORD to change`,
  );

  // The owner's own sign-in. Read from OWNER_EMAIL / OWNER_PASSWORD in .env so
  // a personal address and password never land in git; skipped when unset.
  const ownerEmail = process.env.OWNER_EMAIL?.toLowerCase().trim();
  const ownerPassword = process.env.OWNER_PASSWORD;
  if (ownerEmail && ownerPassword) {
    const ownerHash = await hashPassword(ownerPassword);
    await prisma.user.upsert({
      where: { email: ownerEmail },
      update: { passwordHash: ownerHash, role: "ADMIN", isActive: true },
      create: {
        email: ownerEmail,
        name: ownerEmail.split("@")[0],
        role: "ADMIN",
        passwordHash: ownerHash,
        schoolId: school.id,
      },
    });
    console.log(`Seeded owner account: ${ownerEmail}  (ADMIN)`);
  }

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

    // `updatedAt` is @updatedAt, so Prisma would stamp "now" on every row and
    // the recency ordering would be meaningless. Set it explicitly instead.
    const updatedAt = new Date(now - lesson.updatedDaysAgo * DAY_MS);

    const data = {
      updatedAt,
      createdAt: updatedAt,
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
