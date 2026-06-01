-- AlterEnum
ALTER TYPE "ContentEntryStatus" ADD VALUE 'SCHEDULED';

-- AlterTable
ALTER TABLE "ContentEntry" ADD COLUMN     "excerpt" TEXT,
ADD COLUMN     "seoDescription" TEXT,
ADD COLUMN     "seoTitle" TEXT;
