-- Amendment 13 Part A (with V3A add-on packs): the pack engine. Additive only: new tables, no existing object is touched (the Vendor model only gains back-relations, no column).
-- CreateTable
CREATE TABLE "g4d_packs" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "disclaimerKey" TEXT,
    "reviewStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "config" JSONB NOT NULL DEFAULT '{}',
    "updatedByStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_packs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_pack_tabs" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "ownerKey" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "minTier" TEXT,
    "capabilityKey" TEXT,
    "freeTrial" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedByStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_pack_tabs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_capabilities" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_capabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_tier_capabilities" (
    "id" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "capabilityKey" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT false,
    "basis" TEXT NOT NULL DEFAULT 'AMENDMENT_13_V3',
    "updatedByStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_tier_capabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_pack_categories" (
    "id" TEXT NOT NULL,
    "categoryKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "packKey" TEXT NOT NULL,
    "minTier" TEXT NOT NULL,
    "optionalCapabilities" JSONB NOT NULL DEFAULT '[]',
    "starterServices" JSONB NOT NULL DEFAULT '[]',
    "fieldHints" JSONB NOT NULL DEFAULT '[]',
    "addonPacks" JSONB NOT NULL DEFAULT '[]',
    "onlineShopNote" TEXT,
    "statusNote" TEXT,
    "needsBlueprint" BOOLEAN NOT NULL DEFAULT false,
    "ownerNotes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedByStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_pack_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_vendor_packs" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "packKey" TEXT NOT NULL,
    "categoryKey" TEXT NOT NULL,
    "starterPicks" JSONB NOT NULL DEFAULT '[]',
    "setByType" TEXT NOT NULL DEFAULT 'VENDOR',
    "setById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_vendor_packs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_vendor_capabilities" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "capabilityKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL DEFAULT 'VENDOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_vendor_capabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_pack_addons" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "grantsCapabilities" JSONB NOT NULL DEFAULT '[]',
    "priceStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "bundleDiscountStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "config" JSONB NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedByStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_pack_addons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_vendor_pack_addons" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "addonKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "setByType" TEXT NOT NULL DEFAULT 'STAFF',
    "setById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_vendor_pack_addons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "g4d_packs_key_key" ON "g4d_packs"("key");

-- CreateIndex
CREATE INDEX "g4d_pack_tabs_scope_ownerKey_sortOrder_idx" ON "g4d_pack_tabs"("scope", "ownerKey", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_pack_tabs_scope_ownerKey_key_key" ON "g4d_pack_tabs"("scope", "ownerKey", "key");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_capabilities_key_key" ON "g4d_capabilities"("key");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_tier_capabilities_tier_capabilityKey_key" ON "g4d_tier_capabilities"("tier", "capabilityKey");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_pack_categories_categoryKey_key" ON "g4d_pack_categories"("categoryKey");

-- CreateIndex
CREATE INDEX "g4d_pack_categories_packKey_idx" ON "g4d_pack_categories"("packKey");

-- CreateIndex
CREATE INDEX "g4d_pack_categories_family_idx" ON "g4d_pack_categories"("family");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_vendor_packs_vendorId_key" ON "g4d_vendor_packs"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_vendor_packs_packKey_idx" ON "g4d_vendor_packs"("packKey");

-- CreateIndex
CREATE INDEX "g4d_vendor_capabilities_vendorId_idx" ON "g4d_vendor_capabilities"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_vendor_capabilities_vendorId_capabilityKey_key" ON "g4d_vendor_capabilities"("vendorId", "capabilityKey");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_pack_addons_key_key" ON "g4d_pack_addons"("key");

-- CreateIndex
CREATE INDEX "g4d_vendor_pack_addons_vendorId_idx" ON "g4d_vendor_pack_addons"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_vendor_pack_addons_vendorId_addonKey_key" ON "g4d_vendor_pack_addons"("vendorId", "addonKey");

-- AddForeignKey
ALTER TABLE "g4d_tier_capabilities" ADD CONSTRAINT "g4d_tier_capabilities_capabilityKey_fkey" FOREIGN KEY ("capabilityKey") REFERENCES "g4d_capabilities"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_pack_categories" ADD CONSTRAINT "g4d_pack_categories_packKey_fkey" FOREIGN KEY ("packKey") REFERENCES "g4d_packs"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_vendor_packs" ADD CONSTRAINT "g4d_vendor_packs_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_vendor_packs" ADD CONSTRAINT "g4d_vendor_packs_packKey_fkey" FOREIGN KEY ("packKey") REFERENCES "g4d_packs"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_vendor_capabilities" ADD CONSTRAINT "g4d_vendor_capabilities_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_vendor_capabilities" ADD CONSTRAINT "g4d_vendor_capabilities_capabilityKey_fkey" FOREIGN KEY ("capabilityKey") REFERENCES "g4d_capabilities"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_vendor_pack_addons" ADD CONSTRAINT "g4d_vendor_pack_addons_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_vendor_pack_addons" ADD CONSTRAINT "g4d_vendor_pack_addons_addonKey_fkey" FOREIGN KEY ("addonKey") REFERENCES "g4d_pack_addons"("key") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Same rule as every other public table: RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_packs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_pack_tabs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_capabilities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_tier_capabilities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_pack_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_vendor_packs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_vendor_capabilities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_pack_addons" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_vendor_pack_addons" ENABLE ROW LEVEL SECURITY;
