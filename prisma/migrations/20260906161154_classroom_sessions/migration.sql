-- CreateEnum
CREATE TYPE "ClassroomSpeaker" AS ENUM ('TEACHER', 'STUDENT');

-- CreateTable
CREATE TABLE "ClassroomSession" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "teacherId" TEXT NOT NULL,
    "schoolId" TEXT,
    "instructionLanguageId" TEXT NOT NULL,
    "motherTongueId" TEXT NOT NULL,

    CONSTRAINT "ClassroomSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassroomMessage" (
    "id" TEXT NOT NULL,
    "speaker" "ClassroomSpeaker" NOT NULL,
    "sourceText" TEXT NOT NULL,
    "translatedText" TEXT,
    "hadAudio" BOOLEAN NOT NULL DEFAULT false,
    "latencyMs" INTEGER,
    "spokenAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sessionId" TEXT NOT NULL,
    "sourceLanguageId" TEXT NOT NULL,
    "targetLanguageId" TEXT NOT NULL,
    "translationId" TEXT,

    CONSTRAINT "ClassroomMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClassroomSession_teacherId_savedAt_idx" ON "ClassroomSession"("teacherId", "savedAt");

-- CreateIndex
CREATE INDEX "ClassroomSession_schoolId_idx" ON "ClassroomSession"("schoolId");

-- CreateIndex
CREATE INDEX "ClassroomMessage_sessionId_spokenAt_idx" ON "ClassroomMessage"("sessionId", "spokenAt");

-- CreateIndex
CREATE INDEX "ClassroomMessage_translationId_idx" ON "ClassroomMessage"("translationId");

-- AddForeignKey
ALTER TABLE "ClassroomSession" ADD CONSTRAINT "ClassroomSession_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassroomSession" ADD CONSTRAINT "ClassroomSession_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassroomSession" ADD CONSTRAINT "ClassroomSession_instructionLanguageId_fkey" FOREIGN KEY ("instructionLanguageId") REFERENCES "Language"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassroomSession" ADD CONSTRAINT "ClassroomSession_motherTongueId_fkey" FOREIGN KEY ("motherTongueId") REFERENCES "Language"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassroomMessage" ADD CONSTRAINT "ClassroomMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassroomSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassroomMessage" ADD CONSTRAINT "ClassroomMessage_sourceLanguageId_fkey" FOREIGN KEY ("sourceLanguageId") REFERENCES "Language"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassroomMessage" ADD CONSTRAINT "ClassroomMessage_targetLanguageId_fkey" FOREIGN KEY ("targetLanguageId") REFERENCES "Language"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassroomMessage" ADD CONSTRAINT "ClassroomMessage_translationId_fkey" FOREIGN KEY ("translationId") REFERENCES "Translation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
