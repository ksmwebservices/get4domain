-- V3 batch 3 (B3.0b): the record of a business whose site and listing were permanently removed. ADDITIVE ONLY: one new enum, one new g4d_ table, one index, one foreign key.
-- No existing table, column or row is changed. Staging only until the owner approves a production release.

-- CreateEnum
CREATE TYPE "V3SiteRemovalKind" AS ENUM ('VENDOR_REQUEST', 'STAFF_EMPTY_LISTING', 'SEEDED_REMOVAL');

-- CreateTable
CREATE TABLE "g4d_site_removals" (
    "vendorId" TEXT NOT NULL,
    "kind" "V3SiteRemovalKind" NOT NULL,
    "reason" TEXT,
    "phoneHash" TEXT,
    "requestedBy" TEXT,
    "removedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_site_removals_pkey" PRIMARY KEY ("vendorId")
);

-- CreateIndex
CREATE INDEX "g4d_site_removals_removedAt_idx" ON "g4d_site_removals"("removedAt");

-- AddForeignKey
ALTER TABLE "g4d_site_removals" ADD CONSTRAINT "g4d_site_removals_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Same rule as every other public table (prisma/sql/enable_rls_public.sql): RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_site_removals" ENABLE ROW LEVEL SECURITY;
