-- Add snapshot fields to ContentRevision
ALTER TABLE "ContentRevision" ADD COLUMN "title"         TEXT NOT NULL DEFAULT '';
ALTER TABLE "ContentRevision" ADD COLUMN "slug"          TEXT NOT NULL DEFAULT '';
ALTER TABLE "ContentRevision" ADD COLUMN "excerpt"       TEXT;
ALTER TABLE "ContentRevision" ADD COLUMN "seoTitle"      TEXT;
ALTER TABLE "ContentRevision" ADD COLUMN "seoDescription" TEXT;

-- Backfill snapshot fields from the parent entry for existing published revisions
UPDATE "ContentRevision" cr
SET
  title          = e.title,
  slug           = e.slug,
  excerpt        = e.excerpt,
  "seoTitle"     = e."seoTitle",
  "seoDescription" = e."seoDescription"
FROM "ContentEntry" e
WHERE cr."entryId" = e.id
  AND cr.status = 'PUBLISHED';

-- Add publishedRevisionId to ContentEntry (nullable, unique)
ALTER TABLE "ContentEntry" ADD COLUMN "publishedRevisionId" TEXT UNIQUE;

-- Add FK: ContentEntry.publishedRevisionId → ContentRevision.id  ON DELETE SET NULL
ALTER TABLE "ContentEntry"
  ADD CONSTRAINT "ContentEntry_publishedRevisionId_fkey"
  FOREIGN KEY ("publishedRevisionId")
  REFERENCES "ContentRevision"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill publishedRevisionId: point each PUBLISHED entry at its latest PUBLISHED revision
UPDATE "ContentEntry" e
SET "publishedRevisionId" = (
  SELECT r.id
  FROM "ContentRevision" r
  WHERE r."entryId" = e.id
    AND r.status = 'PUBLISHED'
  ORDER BY r.revision DESC
  LIMIT 1
)
WHERE e.status = 'PUBLISHED';

-- Create RevisionTaxonomyTerm snapshot table
CREATE TABLE "RevisionTaxonomyTerm" (
  "revisionId" TEXT NOT NULL,
  "termId"     TEXT NOT NULL,
  "kind"       TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "slug"       TEXT NOT NULL,

  CONSTRAINT "RevisionTaxonomyTerm_pkey" PRIMARY KEY ("revisionId", "termId"),
  CONSTRAINT "RevisionTaxonomyTerm_revisionId_fkey"
    FOREIGN KEY ("revisionId")
    REFERENCES "ContentRevision"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "RevisionTaxonomyTerm_revisionId_idx"
  ON "RevisionTaxonomyTerm"("revisionId");

-- Backfill RevisionTaxonomyTerm from existing ContentEntryTaxonomyTerm for published entries
INSERT INTO "RevisionTaxonomyTerm" ("revisionId", "termId", "kind", "name", "slug")
SELECT
  e."publishedRevisionId",
  ett."termId",
  t.kind::text,
  t.name,
  t.slug
FROM "ContentEntry" e
JOIN "ContentEntryTaxonomyTerm" ett ON ett."entryId" = e.id
JOIN "TaxonomyTerm" t ON t.id = ett."termId"
WHERE e."publishedRevisionId" IS NOT NULL;
