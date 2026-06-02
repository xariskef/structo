-- Published revisions must carry the schema and publication timestamp used to
-- render them. Existing rows receive the best available values from their
-- owning entry before the columns become required.
ALTER TABLE "ContentRevision"
  ADD COLUMN "contentTypeVersionId" TEXT,
  ADD COLUMN "publishedAt" TIMESTAMP(3);

UPDATE "ContentRevision" AS revision
SET
  "contentTypeVersionId" = entry."contentTypeVersionId",
  "publishedAt" = COALESCE(entry."publishedAt", revision."createdAt")
FROM "ContentEntry" AS entry
WHERE revision."entryId" = entry."id";

ALTER TABLE "ContentRevision"
  ALTER COLUMN "contentTypeVersionId" SET NOT NULL,
  ALTER COLUMN "publishedAt" SET NOT NULL;

ALTER TABLE "ContentRevision"
  ADD CONSTRAINT "ContentRevision_contentTypeVersionId_fkey"
  FOREIGN KEY ("contentTypeVersionId") REFERENCES "ContentTypeVersion"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "ContentRevision_contentTypeVersionId_idx"
  ON "ContentRevision"("contentTypeVersionId");
