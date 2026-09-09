import { fail } from "@/lib/api/speech-responses";
import { prisma } from "@/lib/database/prisma";
import { isDenied, requireApiUser } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";
/** A full bundle is a lot of rows to assemble. */
export const maxDuration = 120;

/** Caps so one sync cannot try to pull an entire district onto a tablet. */
const LIMITS = {
  lessons: 200,
  translations: 500,
  worksheets: 200,
  flashcards: 1000,
  assessments: 200,
  glossary: 2000,
  curriculum: 1000,
} as const;

/**
 * GET /api/offline/bundle
 *
 * Everything this teacher can use without a network, in one response.
 *
 * Deliberately excluded:
 *  - Anything secret. No keys, no tokens, no connection strings — this lands
 *    in IndexedDB, which anyone holding the tablet can read.
 *  - Unreviewed demo translations, which are placeholders rather than
 *    translations and must not be cached as if they were usable.
 *  - Learning outcomes with no `verifiedSource`. Offline there is no server to
 *    re-check a row against, so an unsourced outcome sitting beside verified
 *    ones is exactly the thing that starts looking official.
 *
 * This is content only. It does not make translation, speech or generation
 * work offline; those are cloud calls and the UI says so.
 */
export async function GET() {
  const authorized = await requireApiUser();
  if (isDenied(authorized)) return authorized.response;
  const teacher = authorized.user;
  if (!teacher) {
    return fail(
      "PROVIDER_ERROR",
      "No teacher account is set up on this installation.",
      503,
    );
  }

  try {
    const [
      lessons,
      translations,
      worksheets,
      flashcards,
      assessments,
      glossary,
      curriculum,
    ] = await Promise.all([
        prisma.lesson.findMany({
          where: { authorId: teacher.id },
          orderBy: { updatedAt: "desc" },
          take: LIMITS.lessons,
          select: {
            id: true,
            title: true,
            grade: true,
            subject: true,
            topic: true,
            sourceText: true,
            translatedText: true,
            status: true,
            isSample: true,
            alignment: true,
            updatedAt: true,
            sourceLanguage: { select: { code: true } },
            targetLanguage: { select: { code: true } },
            teachingPackage: { select: { content: true } },
          },
        }),
        // Demo rows are excluded: a placeholder notice cached as a translation
        // is exactly the thing this product must not put in front of a teacher.
        prisma.translation.findMany({
          where: { createdById: teacher.id, source: { not: "DEMO" } },
          orderBy: { updatedAt: "desc" },
          take: LIMITS.translations,
          select: {
            id: true,
            sourceText: true,
            targetText: true,
            reviewStatus: true,
            updatedAt: true,
            sourceLanguage: { select: { code: true } },
            targetLanguage: { select: { code: true } },
            corrections: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { correctedText: true },
            },
          },
        }),
        prisma.worksheet.findMany({
          where: { createdById: teacher.id },
          orderBy: { updatedAt: "desc" },
          take: LIMITS.worksheets,
          select: {
            id: true,
            title: true,
            kind: true,
            grade: true,
            subject: true,
            topic: true,
            difficulty: true,
            instructions: true,
            content: true,
            alignment: true,
            updatedAt: true,
          },
        }),
        prisma.flashcard.findMany({
          where: { createdById: teacher.id },
          orderBy: { updatedAt: "desc" },
          take: LIMITS.flashcards,
          select: {
            id: true,
            deckId: true,
            deckTitle: true,
            frontText: true,
            backText: true,
            icon: true,
            exampleSentence: true,
            grade: true,
            subject: true,
            updatedAt: true,
          },
        }),
        prisma.assessment.findMany({
          where: { createdById: teacher.id },
          orderBy: { updatedAt: "desc" },
          take: LIMITS.assessments,
          select: {
            id: true,
            title: true,
            kind: true,
            grade: true,
            subject: true,
            topic: true,
            questions: true,
            alignment: true,
            maxScore: true,
            updatedAt: true,
          },
        }),
        prisma.glossaryTerm.findMany({
          orderBy: { updatedAt: "desc" },
          take: LIMITS.glossary,
          select: {
            id: true,
            sourceTerm: true,
            targetTerm: true,
            domain: true,
            isVerified: true,
            updatedAt: true,
          },
        }),
        // Verified rows only — see the header. On an installation with an
        // empty catalogue this is correctly zero rows, and the device says so.
        prisma.learningOutcome.findMany({
          where: { verifiedSource: { not: null } },
          orderBy: [{ learningArea: "asc" }, { competency: "asc" }],
          take: LIMITS.curriculum,
          select: {
            id: true,
            learningArea: true,
            competency: true,
            outcome: true,
            classLevel: true,
            subject: true,
            verifiedSource: true,
            code: true,
            updatedAt: true,
          },
        }),
      ]);

    return Response.json({
      success: true,
      generatedAt: new Date().toISOString(),
      lessons: lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        grade: lesson.grade,
        subject: lesson.subject,
        topic: lesson.topic,
        sourceText: lesson.sourceText,
        translatedText: lesson.translatedText,
        status: lesson.status,
        isSample: lesson.isSample,
        sourceLanguage: lesson.sourceLanguage.code,
        targetLanguage: lesson.targetLanguage.code,
        teachingPackage: lesson.teachingPackage?.content ?? null,
        alignment: lesson.alignment ?? null,
        updatedAt: lesson.updatedAt.toISOString(),
      })),
      translations: translations.map((row) => ({
        id: row.id,
        sourceText: row.sourceText,
        targetText: row.targetText,
        correctedText: row.corrections[0]?.correctedText ?? null,
        sourceLanguage: row.sourceLanguage.code,
        targetLanguage: row.targetLanguage.code,
        reviewStatus: row.reviewStatus,
        updatedAt: row.updatedAt.toISOString(),
      })),
      worksheets: worksheets.map((row) => ({
        ...row,
        updatedAt: row.updatedAt.toISOString(),
      })),
      flashcards: flashcards.map((row) => ({
        ...row,
        updatedAt: row.updatedAt.toISOString(),
      })),
      assessments: assessments.map((row) => ({
        ...row,
        updatedAt: row.updatedAt.toISOString(),
      })),
      glossary: glossary.map((row) => ({
        ...row,
        updatedAt: row.updatedAt.toISOString(),
      })),
      curriculum: curriculum.map((row) => ({
        ...row,
        // Narrowed for the client: the query already excluded null sources,
        // but Prisma's type cannot know that.
        verifiedSource: row.verifiedSource ?? "",
        updatedAt: row.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("[offline/bundle]", error);
    return fail(
      "PROVIDER_ERROR",
      "Could not prepare the offline bundle. Try again.",
      500,
    );
  }
}
