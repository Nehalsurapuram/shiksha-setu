-- DropForeignKey
ALTER TABLE "LearningOutcome" DROP CONSTRAINT "LearningOutcome_assessmentId_fkey";

-- DropForeignKey
ALTER TABLE "LearningOutcome" DROP CONSTRAINT "LearningOutcome_lessonId_fkey";

-- DropForeignKey
ALTER TABLE "LearningOutcome" DROP CONSTRAINT "LearningOutcome_recordedById_fkey";

-- DropForeignKey
ALTER TABLE "LearningOutcome" DROP CONSTRAINT "LearningOutcome_schoolId_fkey";

-- DropIndex
DROP INDEX "LearningOutcome_grade_subject_idx";

-- DropIndex
DROP INDEX "LearningOutcome_lessonId_idx";

-- DropIndex
DROP INDEX "LearningOutcome_schoolId_idx";

-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN     "alignment" JSONB;

-- AlterTable
ALTER TABLE "LearningOutcome" DROP COLUMN "assessmentId",
DROP COLUMN "description",
DROP COLUMN "grade",
DROP COLUMN "lessonId",
DROP COLUMN "observedAt",
DROP COLUMN "recordedById",
DROP COLUMN "schoolId",
DROP COLUMN "score",
ADD COLUMN     "classLevel" INTEGER,
ADD COLUMN     "competency" TEXT NOT NULL,
ADD COLUMN     "learningArea" TEXT NOT NULL,
ADD COLUMN     "outcome" TEXT NOT NULL,
ADD COLUMN     "verifiedSource" TEXT;

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "alignment" JSONB;

-- AlterTable
ALTER TABLE "Worksheet" ADD COLUMN     "alignment" JSONB;

-- CreateTable
CREATE TABLE "OutcomeObservation" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT NOT NULL,
    "grade" INTEGER,
    "subject" TEXT,
    "score" DOUBLE PRECISION,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lessonId" TEXT,
    "assessmentId" TEXT,
    "schoolId" TEXT,
    "recordedById" TEXT NOT NULL,

    CONSTRAINT "OutcomeObservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OutcomeObservation_lessonId_idx" ON "OutcomeObservation"("lessonId");

-- CreateIndex
CREATE INDEX "OutcomeObservation_schoolId_idx" ON "OutcomeObservation"("schoolId");

-- CreateIndex
CREATE INDEX "OutcomeObservation_grade_subject_idx" ON "OutcomeObservation"("grade", "subject");

-- CreateIndex
CREATE INDEX "LearningOutcome_classLevel_subject_idx" ON "LearningOutcome"("classLevel", "subject");

-- CreateIndex
CREATE INDEX "LearningOutcome_verifiedSource_idx" ON "LearningOutcome"("verifiedSource");

-- CreateIndex
CREATE UNIQUE INDEX "LearningOutcome_learningArea_competency_outcome_classLevel_key" ON "LearningOutcome"("learningArea", "competency", "outcome", "classLevel");

-- AddForeignKey
ALTER TABLE "OutcomeObservation" ADD CONSTRAINT "OutcomeObservation_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutcomeObservation" ADD CONSTRAINT "OutcomeObservation_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutcomeObservation" ADD CONSTRAINT "OutcomeObservation_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutcomeObservation" ADD CONSTRAINT "OutcomeObservation_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

