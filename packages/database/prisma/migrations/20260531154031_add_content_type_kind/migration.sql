-- CreateEnum
CREATE TYPE "ContentTypeKind" AS ENUM ('COLLECTION', 'SINGLE');

-- AlterTable
ALTER TABLE "ContentType" ADD COLUMN     "kind" "ContentTypeKind" NOT NULL DEFAULT 'COLLECTION',
ADD COLUMN     "pluralName" TEXT,
ADD COLUMN     "singularName" TEXT;
