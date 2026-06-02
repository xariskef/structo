-- Migration: add_preview_tokens
-- Phase 9.1 — Preview tokens

CREATE TABLE "PreviewToken" (
  "id"          TEXT        NOT NULL,
  "siteId"      TEXT        NOT NULL,
  "entryId"     TEXT,
  "tokenHash"   TEXT        NOT NULL,
  "expiresAt"   TIMESTAMP(3) NOT NULL,
  "revokedAt"   TIMESTAMP(3),
  "label"       TEXT        NOT NULL DEFAULT '',
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PreviewToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PreviewToken_tokenHash_key" ON "PreviewToken"("tokenHash");
CREATE INDEX "PreviewToken_siteId_idx"    ON "PreviewToken"("siteId");
CREATE INDEX "PreviewToken_entryId_idx"   ON "PreviewToken"("entryId");
CREATE INDEX "PreviewToken_expiresAt_idx" ON "PreviewToken"("expiresAt");

ALTER TABLE "PreviewToken" ADD CONSTRAINT "PreviewToken_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PreviewToken" ADD CONSTRAINT "PreviewToken_entryId_fkey"
  FOREIGN KEY ("entryId") REFERENCES "ContentEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PreviewToken" ADD CONSTRAINT "PreviewToken_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
