-- CreateTable
CREATE TABLE "SiteSetting" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "siteId" TEXT,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SiteSetting_siteId_idx" ON "SiteSetting"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "SiteSetting_siteId_key_key" ON "SiteSetting"("siteId", "key");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_idx" ON "AuditLog"("organizationId");

-- CreateIndex
CREATE INDEX "AuditLog_siteId_idx" ON "AuditLog"("siteId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "SiteSetting" ADD CONSTRAINT "SiteSetting_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
