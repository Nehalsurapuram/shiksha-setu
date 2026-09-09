-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'LANGUAGE_EXPERT';

-- AlterTable
ALTER TABLE "GlossaryTerm" ADD COLUMN     "sourceCorrectionId" TEXT;

-- AlterTable
ALTER TABLE "TranslationCorrection" ADD COLUMN     "aiTranslation" TEXT,
ADD COLUMN     "expertText" TEXT,
ADD COLUMN     "promotedTermId" TEXT,
ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "status" "ReviewStatus" NOT NULL DEFAULT 'UNREVIEWED';

-- CreateIndex
CREATE INDEX "TranslationCorrection_status_createdAt_idx" ON "TranslationCorrection"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "TranslationCorrection" ADD CONSTRAINT "TranslationCorrection_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
