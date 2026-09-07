-- AlterEnum
ALTER TYPE "AssessmentKind" ADD VALUE 'MIXED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WorksheetKind" ADD VALUE 'MULTIPLE_CHOICE';
ALTER TYPE "WorksheetKind" ADD VALUE 'TRUE_FALSE';
ALTER TYPE "WorksheetKind" ADD VALUE 'SHORT_ANSWER';
ALTER TYPE "WorksheetKind" ADD VALUE 'COUNTING';
ALTER TYPE "WorksheetKind" ADD VALUE 'MIXED';

-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN     "difficulty" TEXT,
ADD COLUMN     "isEdited" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "subject" TEXT,
ADD COLUMN     "topic" TEXT;

-- AlterTable
ALTER TABLE "Flashcard" ADD COLUMN     "deckId" TEXT,
ADD COLUMN     "deckTitle" TEXT,
ADD COLUMN     "grade" INTEGER,
ADD COLUMN     "icon" TEXT,
ADD COLUMN     "isEdited" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "subject" TEXT;

-- AlterTable
ALTER TABLE "Worksheet" ADD COLUMN     "difficulty" TEXT,
ADD COLUMN     "isEdited" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "subject" TEXT,
ADD COLUMN     "topic" TEXT;

-- CreateIndex
CREATE INDEX "Flashcard_deckId_idx" ON "Flashcard"("deckId");
