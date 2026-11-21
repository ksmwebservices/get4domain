-- V3 slice 5.6: domains, domain verifications and redirects. ADDITIVE ONLY: new enums, new g4d_ tables, new indexes and foreign keys.
-- No existing table, column or row is changed. Staging only until the owner approves a production release.
-- Generated offline with prisma migrate diff against the slice 5.4 schema; the RLS lines at the end follow prisma/sql/enable_rls_public.sql.

-- CreateEnum
CREATE TYPE "V3DomainKind" AS ENUM ('SUBDOMAIN', 'CUSTOM');

-- CreateEnum
CREATE TYPE "V3DomainStatus" AS ENUM ('PENDING', 'VERIFYING', 'ACTIVE', 'FAILED', 'REMOVED');

-- CreateEnum
CREATE TYPE "V3SslStatus" AS ENUM ('NONE', 'PENDING', 'ACTIVE', 'FAILED');

-- CreateTable
CREATE TABLE "g4d_domains" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "kind" "V3DomainKind" NOT NULL,
    "status" "V3DomainStatus" NOT NULL DEFAULT 'PENDING',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "primaryVendorId" TEXT,
    "subdomainVendorId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "sslStatus" "V3SslStatus" NOT NULL DEFAULT 'NONE',
    "createdByType" TEXT NOT NULL DEFAULT 'VENDOR',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "g4d_domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_domain_verifications" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'TXT',
    "expectedValue" TEXT NOT NULL,
    "lastCheckedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "result" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_domain_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_redirects" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "fromHost" TEXT NOT NULL,
    "fromPath" TEXT NOT NULL DEFAULT '/',
    "toHost" TEXT NOT NULL,
    "toPath" TEXT NOT NULL DEFAULT '/',
    "status" INTEGER NOT NULL DEFAULT 301,
    "source" TEXT NOT NULL DEFAULT 'SYSTEM',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_redirects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "g4d_domains_hostname_key" ON "g4d_domains"("hostname");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_domains_primaryVendorId_key" ON "g4d_domains"("primaryVendorId");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_domains_subdomainVendorId_key" ON "g4d_domains"("subdomainVendorId");

-- CreateIndex
CREATE INDEX "g4d_domains_vendorId_status_idx" ON "g4d_domains"("vendorId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_domain_verifications_domainId_key" ON "g4d_domain_verifications"("domainId");

-- CreateIndex
CREATE INDEX "g4d_redirects_vendorId_idx" ON "g4d_redirects"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_redirects_fromHost_fromPath_key" ON "g4d_redirects"("fromHost", "fromPath");

-- AddForeignKey
ALTER TABLE "g4d_domains" ADD CONSTRAINT "g4d_domains_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_domain_verifications" ADD CONSTRAINT "g4d_domain_verifications_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "g4d_domains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_domain_verifications" ADD CONSTRAINT "g4d_domain_verifications_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_redirects" ADD CONSTRAINT "g4d_redirects_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Same rule as every other public table (prisma/sql/enable_rls_public.sql): RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_domains" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_domain_verifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_redirects" ENABLE ROW LEVEL SECURITY;
