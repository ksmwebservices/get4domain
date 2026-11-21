-- CreateEnum
CREATE TYPE "V3ThemeSwitchKind" AS ENUM ('FREE_INCLUDED', 'PAID', 'COMPLIMENTARY_STAFF', 'RESTORE');

-- CreateEnum
CREATE TYPE "V3ThemeSwitchStatus" AS ENUM ('PENDING', 'APPLIED', 'FAILED');

-- CreateTable
CREATE TABLE "g4d_theme_switches" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "siteId" TEXT,
    "fromThemeKey" TEXT,
    "toThemeKey" TEXT NOT NULL,
    "kind" "V3ThemeSwitchKind" NOT NULL,
    "performedByType" TEXT NOT NULL,
    "performedById" TEXT,
    "serviceRequestId" TEXT,
    "ledgerEntryId" TEXT,
    "packPurchaseId" TEXT,
    "priceSnapshotPaise" INTEGER,
    "taxSnapshotJson" JSONB NOT NULL DEFAULT '{}',
    "publicationId" TEXT,
    "status" "V3ThemeSwitchStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "reason" TEXT,
    "failureReason" TEXT,
    "hiddenFieldsJson" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_theme_switches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "g4d_theme_switches_ledgerEntryId_key" ON "g4d_theme_switches"("ledgerEntryId");

-- CreateIndex
CREATE INDEX "g4d_theme_switches_vendorId_createdAt_idx" ON "g4d_theme_switches"("vendorId", "createdAt");

-- CreateIndex
CREATE INDEX "g4d_theme_switches_status_updatedAt_idx" ON "g4d_theme_switches"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_theme_switches_vendorId_idempotencyKey_key" ON "g4d_theme_switches"("vendorId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "g4d_theme_switches" ADD CONSTRAINT "g4d_theme_switches_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A PAID switch always says what paid for it (a wallet charge, a pack unit or the service request that carries the fee); a free, complimentary or restoring switch never has a charge. A staff gift always has a reason.
ALTER TABLE "g4d_theme_switches" ADD CONSTRAINT "g4d_theme_switches_paid_chk" CHECK (("kind" = 'PAID' AND ("ledgerEntryId" IS NOT NULL OR "packPurchaseId" IS NOT NULL OR "serviceRequestId" IS NOT NULL)) OR ("kind" <> 'PAID' AND "ledgerEntryId" IS NULL AND "packPurchaseId" IS NULL));

ALTER TABLE "g4d_theme_switches" ADD CONSTRAINT "g4d_theme_switches_gift_reason_chk" CHECK ("kind" <> 'COMPLIMENTARY_STAFF' OR ("reason" IS NOT NULL AND length("reason") >= 5));

ALTER TABLE "g4d_theme_switches" ADD CONSTRAINT "g4d_theme_switches_amount_chk" CHECK ("priceSnapshotPaise" IS NULL OR "priceSnapshotPaise" > 0);

-- Same rule as every other public table (prisma/sql/enable_rls_public.sql): RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_theme_switches" ENABLE ROW LEVEL SECURITY;
