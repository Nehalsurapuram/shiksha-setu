-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "extractionMethod" TEXT,
ADD COLUMN     "originalFileName" TEXT,
ADD COLUMN     "sourceFormat" TEXT,
ADD COLUMN     "translatedText" TEXT;

-- CreateTable
CREATE TABLE "TeachingPackage" (
    "id" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "provider" TEXT,
    "model" TEXT,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lessonId" TEXT NOT NULL,

    CONSTRAINT "TeachingPackage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeachingPackage_lessonId_key" ON "TeachingPackage"("lessonId");

-- AddForeignKey
ALTER TABLE "TeachingPackage" ADD CONSTRAINT "TeachingPackage_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
