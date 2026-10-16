-- Industry designs round 2 (16 Oct 2026): imported theme packages, their pictures and fonts, and the yearly marketplace entitlements.
-- Additive only: three new tables, no existing table is touched. Run prisma/sql/enable_rls_public.sql afterwards (it covers every public table, including these three).


-- CreateTable
CREATE TABLE "g4d_theme_packages" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "manifest" JSONB NOT NULL,
    "pages" JSONB NOT NULL,
    "css" TEXT NOT NULL,
    "assetIndex" JSONB NOT NULL,
    "googleFonts" JSONB,
    "families" JSONB NOT NULL,
    "categories" JSONB NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MARKETPLACE',
    "replacesDesign" TEXT,
    "priceYearlyPaise" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "previewPath" TEXT,
    "lint" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_theme_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_theme_assets" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_theme_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_theme_entitlements" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "themeKey" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "paymentRef" TEXT,
    "invoiceRef" TEXT,
    "amountPaise" INTEGER NOT NULL DEFAULT 0,
    "gstPaise" INTEGER NOT NULL DEFAULT 0,
    "remindersSent" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_theme_entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "g4d_theme_packages_status_idx" ON "g4d_theme_packages"("status");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_theme_packages_key_version_key" ON "g4d_theme_packages"("key", "version");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_theme_assets_packageId_path_key" ON "g4d_theme_assets"("packageId", "path");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_theme_entitlements_paymentRef_key" ON "g4d_theme_entitlements"("paymentRef");

-- CreateIndex
CREATE INDEX "g4d_theme_entitlements_vendorId_themeKey_idx" ON "g4d_theme_entitlements"("vendorId", "themeKey");

-- CreateIndex
CREATE INDEX "g4d_theme_entitlements_status_endsAt_idx" ON "g4d_theme_entitlements"("status", "endsAt");

-- AddForeignKey
ALTER TABLE "g4d_theme_assets" ADD CONSTRAINT "g4d_theme_assets_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "g4d_theme_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

