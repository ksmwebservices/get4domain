-- CreateEnum
CREATE TYPE "V3ServiceDoneBy" AS ENUM ('VENDOR', 'TEAM', 'EITHER');

-- CreateEnum
CREATE TYPE "V3ServiceDelivery" AS ENUM ('INSTANT', 'TEAM_REQUEST');

-- CreateEnum
CREATE TYPE "V3ServicePlanRule" AS ENUM ('PRO_ACTIVE_OR_GRACE', 'ANY');

-- CreateEnum
CREATE TYPE "V3CatalogStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "V3ServicePriceStatus" AS ENUM ('PROPOSED', 'APPROVED', 'RETIRED');

-- CreateTable
CREATE TABLE "g4d_services" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "includesText" TEXT NOT NULL,
    "approvalText" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'GENERAL',
    "doneBy" "V3ServiceDoneBy" NOT NULL DEFAULT 'TEAM',
    "deliveryKind" "V3ServiceDelivery" NOT NULL DEFAULT 'TEAM_REQUEST',
    "planStateRule" "V3ServicePlanRule" NOT NULL DEFAULT 'PRO_ACTIVE_OR_GRACE',
    "trackScope" TEXT[],
    "publicVisible" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "V3CatalogStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_service_prices" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "taxCategory" TEXT NOT NULL DEFAULT 'ALL',
    "taxInclusive" BOOLEAN NOT NULL DEFAULT false,
    "effectiveFrom" TIMESTAMP(3),
    "status" "V3ServicePriceStatus" NOT NULL DEFAULT 'PROPOSED',
    "note" TEXT,
    "createdBy" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_service_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_addon_packs" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "itemsJson" JSONB NOT NULL,
    "validityDays" INTEGER,
    "status" "V3CatalogStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_addon_packs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_addon_pack_prices" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "taxCategory" TEXT NOT NULL DEFAULT 'ALL',
    "taxInclusive" BOOLEAN NOT NULL DEFAULT false,
    "effectiveFrom" TIMESTAMP(3),
    "status" "V3ServicePriceStatus" NOT NULL DEFAULT 'PROPOSED',
    "note" TEXT,
    "createdBy" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_addon_pack_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_pack_purchases" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "remainingJson" JSONB NOT NULL,
    "priceSnapshotPaise" INTEGER NOT NULL,
    "taxSnapshotJson" JSONB NOT NULL DEFAULT '{}',
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "ledgerEntryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_pack_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "g4d_services_key_key" ON "g4d_services"("key");

-- CreateIndex
CREATE INDEX "g4d_service_prices_serviceId_status_idx" ON "g4d_service_prices"("serviceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_service_prices_serviceId_effectiveFrom_key" ON "g4d_service_prices"("serviceId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_addon_packs_key_key" ON "g4d_addon_packs"("key");

-- CreateIndex
CREATE INDEX "g4d_addon_pack_prices_packId_status_idx" ON "g4d_addon_pack_prices"("packId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_addon_pack_prices_packId_effectiveFrom_key" ON "g4d_addon_pack_prices"("packId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_pack_purchases_ledgerEntryId_key" ON "g4d_pack_purchases"("ledgerEntryId");

-- CreateIndex
CREATE INDEX "g4d_pack_purchases_vendorId_purchasedAt_idx" ON "g4d_pack_purchases"("vendorId", "purchasedAt");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_pack_purchases_vendorId_idempotencyKey_key" ON "g4d_pack_purchases"("vendorId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "g4d_service_prices" ADD CONSTRAINT "g4d_service_prices_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "g4d_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_addon_pack_prices" ADD CONSTRAINT "g4d_addon_pack_prices_packId_fkey" FOREIGN KEY ("packId") REFERENCES "g4d_addon_packs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_pack_purchases" ADD CONSTRAINT "g4d_pack_purchases_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_pack_purchases" ADD CONSTRAINT "g4d_pack_purchases_packId_fkey" FOREIGN KEY ("packId") REFERENCES "g4d_addon_packs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A price is a whole, positive number of paise; a pack that expires lasts at least a day; a pack purchase copies a price that is not negative. The database refuses anything else, whatever the application does.
ALTER TABLE "g4d_service_prices" ADD CONSTRAINT "g4d_service_prices_amount_chk" CHECK ("amountPaise" > 0);

ALTER TABLE "g4d_addon_pack_prices" ADD CONSTRAINT "g4d_addon_pack_prices_amount_chk" CHECK ("amountPaise" > 0);

ALTER TABLE "g4d_addon_packs" ADD CONSTRAINT "g4d_addon_packs_validity_chk" CHECK ("validityDays" IS NULL OR "validityDays" > 0);

ALTER TABLE "g4d_pack_purchases" ADD CONSTRAINT "g4d_pack_purchases_price_chk" CHECK ("priceSnapshotPaise" >= 0);

-- An APPROVED price must say from when it applies.
ALTER TABLE "g4d_service_prices" ADD CONSTRAINT "g4d_service_prices_approved_dated_chk" CHECK ("status" <> 'APPROVED' OR ("effectiveFrom" IS NOT NULL AND "approvedBy" IS NOT NULL));

ALTER TABLE "g4d_addon_pack_prices" ADD CONSTRAINT "g4d_addon_pack_prices_approved_dated_chk" CHECK ("status" <> 'APPROVED' OR ("effectiveFrom" IS NOT NULL AND "approvedBy" IS NOT NULL));

-- Same rule as every other public table (prisma/sql/enable_rls_public.sql): RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_services" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_service_prices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_addon_packs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_addon_pack_prices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_pack_purchases" ENABLE ROW LEVEL SECURITY;
