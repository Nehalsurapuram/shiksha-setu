-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "isSample" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastOpenedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Lesson_lastOpenedAt_idx" ON "Lesson"("lastOpenedAt");
