-- Slice 5.6c (own-domain automation): the connection of one custom domain. Additive only: one new table.
-- CreateTable
CREATE TABLE "g4d_domain_connections" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "connectHost" TEXT NOT NULL,
    "bareDomain" BOOLEAN NOT NULL DEFAULT false,
    "mode" TEXT NOT NULL DEFAULT 'CONNECT',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "certStatus" TEXT NOT NULL DEFAULT 'NONE',
    "cfHostnameId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "failureReason" TEXT,
    "registrar" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_domain_connections_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "g4d_domain_connections_domainId_key" ON "g4d_domain_connections"("domainId");
CREATE INDEX "g4d_domain_connections_vendorId_idx" ON "g4d_domain_connections"("vendorId");
CREATE INDEX "g4d_domain_connections_status_lastCheckedAt_idx" ON "g4d_domain_connections"("status", "lastCheckedAt");
-- AddForeignKey
ALTER TABLE "g4d_domain_connections" ADD CONSTRAINT "g4d_domain_connections_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Same rule as every other public table (prisma/sql/enable_rls_public.sql): RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_domain_connections" ENABLE ROW LEVEL SECURITY;
