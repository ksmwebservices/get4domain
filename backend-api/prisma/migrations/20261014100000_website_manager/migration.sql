-- Website Manager (14 Oct 2026): draft/publish/versions on the vendor's one site row, a media ledger for the shared upload service, and category packs.
-- Additive only: nullable columns or columns with a default on "VendorCMS", and three new tables. No existing row is touched or rewritten.

-- AlterTable
ALTER TABLE "VendorCMS" ADD COLUMN     "draft" JSONB,
ADD COLUMN     "layout" JSONB,
ADD COLUMN     "ogImage" TEXT,
ADD COLUMN     "testimonials" JSONB,
ADD COLUMN     "pages" JSONB,
ADD COLUMN     "packKey" TEXT,
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "siteVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "g4d_site_versions" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_site_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_media_assets" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "originalUrl" TEXT,
    "mime" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "originalBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_category_packs" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_category_packs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "g4d_site_versions_vendorId_createdAt_idx" ON "g4d_site_versions"("vendorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_site_versions_vendorId_version_key" ON "g4d_site_versions"("vendorId", "version");

-- CreateIndex
CREATE INDEX "g4d_media_assets_vendorId_createdAt_idx" ON "g4d_media_assets"("vendorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_category_packs_key_key" ON "g4d_category_packs"("key");
