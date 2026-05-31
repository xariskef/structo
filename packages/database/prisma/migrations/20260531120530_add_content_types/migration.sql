-- CreateEnum
CREATE TYPE "ContentTypeStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "ContentType" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" "ContentTypeStatus" NOT NULL DEFAULT 'DRAFT',
    "fields" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentTypeVersion" (
    "id" TEXT NOT NULL,
    "contentTypeId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "fields" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentTypeVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentType_siteId_idx" ON "ContentType"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentType_siteId_slug_key" ON "ContentType"("siteId", "slug");

-- CreateIndex
CREATE INDEX "ContentTypeVersion_contentTypeId_idx" ON "ContentTypeVersion"("contentTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentTypeVersion_contentTypeId_version_key" ON "ContentTypeVersion"("contentTypeId", "version");

-- AddForeignKey
ALTER TABLE "ContentType" ADD CONSTRAINT "ContentType_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentTypeVersion" ADD CONSTRAINT "ContentTypeVersion_contentTypeId_fkey" FOREIGN KEY ("contentTypeId") REFERENCES "ContentType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
