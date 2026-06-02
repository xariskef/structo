-- CreateTable
CREATE TABLE "SiteApiToken" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "scopes" TEXT[],
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteApiToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SiteApiToken_tokenHash_key" ON "SiteApiToken"("tokenHash");

-- CreateIndex
CREATE INDEX "SiteApiToken_siteId_idx" ON "SiteApiToken"("siteId");

-- AddForeignKey
ALTER TABLE "SiteApiToken" ADD CONSTRAINT "SiteApiToken_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
