-- Entry-scoped preview tokens must not become site-wide tokens after their
-- referenced content entry is deleted.
ALTER TABLE "PreviewToken"
  DROP CONSTRAINT "PreviewToken_entryId_fkey";

ALTER TABLE "PreviewToken"
  ADD CONSTRAINT "PreviewToken_entryId_fkey"
  FOREIGN KEY ("entryId") REFERENCES "ContentEntry"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
