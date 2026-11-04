-- V3 batch 3 slice 5.13a: seeded sites, batches and the outreach log. ADDITIVE ONLY: new enums, new g4d_ tables, indexes and foreign keys; no existing table, column or row changes.
-- A phone is stored only as a keyed hash. Staging only until the owner approves a production release.

-- CreateEnum
CREATE TYPE "V3SeededLifecycle" AS ENUM ('SEEDED', 'INVITED', 'CLAIMED_FREE', 'PRO', 'REMOVED');
-- CreateEnum
CREATE TYPE "V3SeededSourceKind" AS ENUM ('PUBLIC_LISTING', 'FIELD_VISIT', 'PHONE_CALL', 'REFERRAL');
-- CreateEnum
CREATE TYPE "V3OutreachStatus" AS ENUM ('NOT_CONTACTED', 'CALLED', 'INTERESTED', 'CLAIM_LINK_SENT', 'CLAIMED', 'DECLINED', 'DO_NOT_CONTACT');
-- CreateEnum
CREATE TYPE "V3OutreachKind" AS ENUM ('CALL', 'NOTE', 'CLAIM_LINK', 'REMOVAL');
-- CreateEnum
CREATE TYPE "V3SeededBatchMode" AS ENUM ('DRY_RUN', 'APPLIED');
-- CreateTable
CREATE TABLE "g4d_seeded_sites" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "directoryBusinessId" TEXT,
    "lifecycle" "V3SeededLifecycle" NOT NULL DEFAULT 'SEEDED',
    "sourceKind" "V3SeededSourceKind" NOT NULL,
    "sourceNote" TEXT,
    "publicFactsConfirmed" BOOLEAN NOT NULL,
    "phoneHash" TEXT NOT NULL,
    "emailHash" TEXT,
    "nameKey" TEXT NOT NULL,
    "outreachStatus" "V3OutreachStatus" NOT NULL DEFAULT 'NOT_CONTACTED',
    "outreachOwnerStaffId" TEXT,
    "lastContactAt" TIMESTAMP(3),
    "nextFollowUpAt" TIMESTAMP(3),
    "ownerAgreedToContact" BOOLEAN NOT NULL DEFAULT false,
    "ownerAgreedAt" TIMESTAMP(3),
    "ownerAgreedBy" TEXT,
    "createdByStaffId" TEXT,
    "batchId" TEXT,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_seeded_sites_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "g4d_seeded_batches" (
    "id" TEXT NOT NULL,
    "createdBy" TEXT,
    "fileName" TEXT NOT NULL,
    "rowsTotal" INTEGER NOT NULL,
    "rowsCreated" INTEGER NOT NULL DEFAULT 0,
    "rowsRejected" INTEGER NOT NULL DEFAULT 0,
    "mode" "V3SeededBatchMode" NOT NULL,
    "reportJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "g4d_seeded_batches_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "g4d_seeded_outreach_log" (
    "id" TEXT NOT NULL,
    "seededSiteId" TEXT NOT NULL,
    "kind" "V3OutreachKind" NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "staffId" TEXT,
    "outcome" TEXT,
    "note" TEXT,
    CONSTRAINT "g4d_seeded_outreach_log_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "g4d_seeded_sites_vendorId_key" ON "g4d_seeded_sites"("vendorId");
-- CreateIndex
CREATE UNIQUE INDEX "g4d_seeded_sites_directoryBusinessId_key" ON "g4d_seeded_sites"("directoryBusinessId");
-- CreateIndex
CREATE INDEX "g4d_seeded_sites_lifecycle_idx" ON "g4d_seeded_sites"("lifecycle");
-- CreateIndex
CREATE INDEX "g4d_seeded_sites_phoneHash_idx" ON "g4d_seeded_sites"("phoneHash");
-- CreateIndex
CREATE INDEX "g4d_seeded_sites_emailHash_idx" ON "g4d_seeded_sites"("emailHash");
-- CreateIndex
CREATE INDEX "g4d_seeded_sites_nameKey_idx" ON "g4d_seeded_sites"("nameKey");
-- CreateIndex
CREATE INDEX "g4d_seeded_sites_batchId_idx" ON "g4d_seeded_sites"("batchId");
-- CreateIndex
CREATE INDEX "g4d_seeded_batches_createdAt_idx" ON "g4d_seeded_batches"("createdAt");
-- CreateIndex
CREATE INDEX "g4d_seeded_outreach_log_seededSiteId_at_idx" ON "g4d_seeded_outreach_log"("seededSiteId", "at");
-- AddForeignKey
ALTER TABLE "g4d_seeded_sites" ADD CONSTRAINT "g4d_seeded_sites_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "g4d_seeded_sites" ADD CONSTRAINT "g4d_seeded_sites_directoryBusinessId_fkey" FOREIGN KEY ("directoryBusinessId") REFERENCES "g4d_directory_businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "g4d_seeded_sites" ADD CONSTRAINT "g4d_seeded_sites_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "g4d_seeded_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "g4d_seeded_outreach_log" ADD CONSTRAINT "g4d_seeded_outreach_log_seededSiteId_fkey" FOREIGN KEY ("seededSiteId") REFERENCES "g4d_seeded_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Same rule as every other public table (prisma/sql/enable_rls_public.sql): RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_seeded_sites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_seeded_batches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_seeded_outreach_log" ENABLE ROW LEVEL SECURITY;
