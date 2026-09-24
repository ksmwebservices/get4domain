-- Real per-vendor product Category taxonomy (dispatch 24-Sep-2026). Fixes a real gap:
-- VendorProduct.category was a bare free-text column with no dedicated table, so a
-- vendor dashboard entering a same-named category twice silently created two
-- disconnected values with nothing tying them together. Additive only — the existing
-- `category` string column stays (denormalized display name, kept in sync by
-- CmsService.findOrCreateCategory), so no existing reader breaks; `categoryId` is the
-- new real relational link, nullable so pre-existing product rows are unaffected.
ALTER TABLE "VendorProduct" ADD COLUMN     "categoryId" TEXT;

-- CreateTable
CREATE TABLE "g4d_categories" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameNormalized" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "g4d_categories_vendorId_idx" ON "g4d_categories"("vendorId");

-- Case-insensitive uniqueness per vendor: nameNormalized is the lowercased/trimmed
-- name, so "Sneakers" and "sneakers" resolve to the SAME row (Postgres's own @unique
-- is case-sensitive, which is why this is a separate stored column, not `name` itself).
CREATE UNIQUE INDEX "g4d_categories_vendorId_nameNormalized_key" ON "g4d_categories"("vendorId", "nameNormalized");

-- CreateIndex
CREATE INDEX "VendorProduct_categoryId_idx" ON "VendorProduct"("categoryId");

-- AddForeignKey
ALTER TABLE "VendorProduct" ADD CONSTRAINT "VendorProduct_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "g4d_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_categories" ADD CONSTRAINT "g4d_categories_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
