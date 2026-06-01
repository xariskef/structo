-- CreateEnum
CREATE TYPE "TaxonomyKind" AS ENUM ('CATEGORY', 'TAG');

-- CreateTable
CREATE TABLE "TaxonomyTerm" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "kind" "TaxonomyKind" NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxonomyTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentTypeTaxonomy" (
    "siteId" TEXT NOT NULL,
    "contentTypeId" TEXT NOT NULL,
    "taxonomy" "TaxonomyKind" NOT NULL,

    CONSTRAINT "ContentTypeTaxonomy_pkey" PRIMARY KEY ("contentTypeId","taxonomy")
);

-- CreateTable
CREATE TABLE "ContentEntryTaxonomyTerm" (
    "siteId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,

    CONSTRAINT "ContentEntryTaxonomyTerm_pkey" PRIMARY KEY ("entryId","termId")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaxonomyTerm_siteId_kind_slug_key" ON "TaxonomyTerm"("siteId", "kind", "slug");

-- CreateIndex
CREATE INDEX "TaxonomyTerm_siteId_kind_idx" ON "TaxonomyTerm"("siteId", "kind");

-- CreateIndex
CREATE INDEX "TaxonomyTerm_parentId_idx" ON "TaxonomyTerm"("parentId");

-- CreateIndex
CREATE INDEX "ContentTypeTaxonomy_siteId_taxonomy_idx" ON "ContentTypeTaxonomy"("siteId", "taxonomy");

-- CreateIndex
CREATE INDEX "ContentEntryTaxonomyTerm_siteId_idx" ON "ContentEntryTaxonomyTerm"("siteId");

-- CreateIndex
CREATE INDEX "ContentEntryTaxonomyTerm_termId_idx" ON "ContentEntryTaxonomyTerm"("termId");

-- AddForeignKey
ALTER TABLE "TaxonomyTerm" ADD CONSTRAINT "TaxonomyTerm_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxonomyTerm" ADD CONSTRAINT "TaxonomyTerm_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "TaxonomyTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentTypeTaxonomy" ADD CONSTRAINT "ContentTypeTaxonomy_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentTypeTaxonomy" ADD CONSTRAINT "ContentTypeTaxonomy_contentTypeId_fkey" FOREIGN KEY ("contentTypeId") REFERENCES "ContentType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentEntryTaxonomyTerm" ADD CONSTRAINT "ContentEntryTaxonomyTerm_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentEntryTaxonomyTerm" ADD CONSTRAINT "ContentEntryTaxonomyTerm_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "ContentEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentEntryTaxonomyTerm" ADD CONSTRAINT "ContentEntryTaxonomyTerm_termId_fkey" FOREIGN KEY ("termId") REFERENCES "TaxonomyTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
