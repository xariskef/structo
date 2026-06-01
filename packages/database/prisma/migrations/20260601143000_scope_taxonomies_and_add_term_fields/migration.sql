-- CreateEnum
CREATE TYPE "TaxonomyScope" AS ENUM ('PAGES', 'CONTENT_TYPE');

-- CreateTable
CREATE TABLE "TaxonomyDefinition" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "contentTypeId" TEXT,
    "scope" "TaxonomyScope" NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "kind" "TaxonomyKind" NOT NULL,
    "fields" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxonomyDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxonomyDefinitionVersion" (
    "id" TEXT NOT NULL,
    "taxonomyDefinitionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "fields" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxonomyDefinitionVersion_pkey" PRIMARY KEY ("id")
);

-- Seed shared page taxonomy definitions for every site.
INSERT INTO "TaxonomyDefinition" (
    "id", "siteId", "scope", "scopeKey", "kind", "updatedAt"
)
SELECT
    'taxonomy_pages_category_' || "id",
    "id",
    'PAGES'::"TaxonomyScope",
    'pages',
    'CATEGORY'::"TaxonomyKind",
    CURRENT_TIMESTAMP
FROM "Site";

INSERT INTO "TaxonomyDefinition" (
    "id", "siteId", "scope", "scopeKey", "kind", "updatedAt"
)
SELECT
    'taxonomy_pages_tag_' || "id",
    "id",
    'PAGES'::"TaxonomyScope",
    'pages',
    'TAG'::"TaxonomyKind",
    CURRENT_TIMESTAMP
FROM "Site";

-- Seed isolated taxonomy definitions for every existing collection.
INSERT INTO "TaxonomyDefinition" (
    "id", "siteId", "contentTypeId", "scope", "scopeKey", "kind", "updatedAt"
)
SELECT
    'taxonomy_collection_category_' || "id",
    "siteId",
    "id",
    'CONTENT_TYPE'::"TaxonomyScope",
    'content-type:' || "id",
    'CATEGORY'::"TaxonomyKind",
    CURRENT_TIMESTAMP
FROM "ContentType"
WHERE "kind" = 'COLLECTION';

INSERT INTO "TaxonomyDefinition" (
    "id", "siteId", "contentTypeId", "scope", "scopeKey", "kind", "updatedAt"
)
SELECT
    'taxonomy_collection_tag_' || "id",
    "siteId",
    "id",
    'CONTENT_TYPE'::"TaxonomyScope",
    'content-type:' || "id",
    'TAG'::"TaxonomyKind",
    CURRENT_TIMESTAMP
FROM "ContentType"
WHERE "kind" = 'COLLECTION';

-- Add the first immutable empty schema version for every seeded definition.
INSERT INTO "TaxonomyDefinitionVersion" (
    "id", "taxonomyDefinitionId", "version", "fields"
)
SELECT
    "id" || '_v1',
    "id",
    1,
    '[]'::JSONB
FROM "TaxonomyDefinition";

-- Existing common terms move to the shared Pages scope. Existing collection
-- assignments are removed because their correct collection scope cannot be
-- inferred safely from a previously shared term pool.
DELETE FROM "ContentEntryTaxonomyTerm"
USING "ContentEntry", "ContentType"
WHERE "ContentEntryTaxonomyTerm"."entryId" = "ContentEntry"."id"
  AND "ContentEntry"."contentTypeId" = "ContentType"."id"
  AND "ContentType"."kind" = 'COLLECTION';

-- AlterTable
ALTER TABLE "TaxonomyTerm"
ADD COLUMN "taxonomyDefinitionId" TEXT,
ADD COLUMN "taxonomyDefinitionVersionId" TEXT,
ADD COLUMN "seoTitle" TEXT,
ADD COLUMN "seoDescription" TEXT,
ADD COLUMN "data" JSONB NOT NULL DEFAULT '{}';

UPDATE "TaxonomyTerm"
SET
    "taxonomyDefinitionId" = CASE
        WHEN "kind" = 'CATEGORY' THEN 'taxonomy_pages_category_' || "siteId"
        ELSE 'taxonomy_pages_tag_' || "siteId"
    END,
    "taxonomyDefinitionVersionId" = CASE
        WHEN "kind" = 'CATEGORY' THEN 'taxonomy_pages_category_' || "siteId" || '_v1'
        ELSE 'taxonomy_pages_tag_' || "siteId" || '_v1'
    END;

ALTER TABLE "TaxonomyTerm"
ALTER COLUMN "taxonomyDefinitionId" SET NOT NULL,
ALTER COLUMN "taxonomyDefinitionVersionId" SET NOT NULL;

-- DropIndex
DROP INDEX "TaxonomyTerm_siteId_kind_slug_key";

-- CreateIndex
CREATE UNIQUE INDEX "TaxonomyDefinition_siteId_scopeKey_kind_key"
ON "TaxonomyDefinition"("siteId", "scopeKey", "kind");

-- CreateIndex
CREATE INDEX "TaxonomyDefinition_contentTypeId_idx"
ON "TaxonomyDefinition"("contentTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "TaxonomyDefinitionVersion_taxonomyDefinitionId_version_key"
ON "TaxonomyDefinitionVersion"("taxonomyDefinitionId", "version");

-- CreateIndex
CREATE INDEX "TaxonomyDefinitionVersion_taxonomyDefinitionId_idx"
ON "TaxonomyDefinitionVersion"("taxonomyDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "TaxonomyTerm_taxonomyDefinitionId_slug_key"
ON "TaxonomyTerm"("taxonomyDefinitionId", "slug");

-- CreateIndex
CREATE INDEX "TaxonomyTerm_taxonomyDefinitionId_idx"
ON "TaxonomyTerm"("taxonomyDefinitionId");

-- AddForeignKey
ALTER TABLE "TaxonomyDefinition"
ADD CONSTRAINT "TaxonomyDefinition_siteId_fkey"
FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxonomyDefinition"
ADD CONSTRAINT "TaxonomyDefinition_contentTypeId_fkey"
FOREIGN KEY ("contentTypeId") REFERENCES "ContentType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxonomyDefinitionVersion"
ADD CONSTRAINT "TaxonomyDefinitionVersion_taxonomyDefinitionId_fkey"
FOREIGN KEY ("taxonomyDefinitionId") REFERENCES "TaxonomyDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxonomyTerm"
ADD CONSTRAINT "TaxonomyTerm_taxonomyDefinitionId_fkey"
FOREIGN KEY ("taxonomyDefinitionId") REFERENCES "TaxonomyDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxonomyTerm"
ADD CONSTRAINT "TaxonomyTerm_taxonomyDefinitionVersionId_fkey"
FOREIGN KEY ("taxonomyDefinitionVersionId") REFERENCES "TaxonomyDefinitionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
