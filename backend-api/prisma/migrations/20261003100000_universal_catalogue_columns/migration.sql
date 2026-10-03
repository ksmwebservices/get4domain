-- Universal Catalogue Model (dispatch 03-Oct-2026) — SCHEMA STEP, ADDITIVE ONLY.
--
-- Evolves "VendorProduct" into the single catalogue table for every industry. Adds nullable /
-- defaulted columns, three btree indexes, one unique index and one FK. Nothing is dropped,
-- renamed, retyped or rewritten: every existing row and every existing query keeps working
-- (the only NOT NULL column carries a constant DEFAULT, which Postgres applies without
-- rewriting the table). RetailProduct (g4d_retail_products) and CatalogItem
-- (g4d_catalog_items) are NOT touched by this migration.
--
-- Output below is the exact DDL produced by `prisma migrate diff` (HEAD schema -> new schema).
-- The companion DATA step (copy RetailProduct/CatalogItem, backfill the new columns on the
-- existing rows) is scripts/catalogue-migration/migrate-catalogue.js — run it only AFTER this.
-- Deploy order: apply this migration BEFORE deploying any backend built against the new client.
--
-- Rollback (if ever needed, while no code reads the columns):
--   ALTER TABLE "VendorProduct" DROP CONSTRAINT "VendorProduct_operationKey_fkey";
--   DROP INDEX "VendorProduct_sourceModel_sourceId_key", "VendorProduct_vendorId_sku_idx",
--              "VendorProduct_vendorId_industryType_idx", "VendorProduct_vendorId_status_idx";
--   ALTER TABLE "VendorProduct" DROP COLUMN "industryType", DROP COLUMN "operationKey", ... (the 10 new columns);

-- AlterTable
ALTER TABLE "VendorProduct" ADD COLUMN     "industryType" TEXT,
ADD COLUMN     "operationKey" TEXT,
ADD COLUMN     "priceAmount" DOUBLE PRECISION,
ADD COLUMN     "reorderLevel" INTEGER,
ADD COLUMN     "sku" TEXT,
ADD COLUMN     "sourceId" TEXT,
ADD COLUMN     "sourceModel" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN     "stockQty" INTEGER,
ADD COLUMN     "unit" TEXT;
-- CreateIndex
CREATE INDEX "VendorProduct_vendorId_status_idx" ON "VendorProduct"("vendorId", "status");
-- CreateIndex
CREATE INDEX "VendorProduct_vendorId_industryType_idx" ON "VendorProduct"("vendorId", "industryType");
-- CreateIndex
CREATE INDEX "VendorProduct_vendorId_sku_idx" ON "VendorProduct"("vendorId", "sku");
-- CreateIndex
CREATE UNIQUE INDEX "VendorProduct_sourceModel_sourceId_key" ON "VendorProduct"("sourceModel", "sourceId");
-- AddForeignKey
ALTER TABLE "VendorProduct" ADD CONSTRAINT "VendorProduct_operationKey_fkey" FOREIGN KEY ("operationKey") REFERENCES "g4d_operation_types"("key") ON DELETE SET NULL ON UPDATE CASCADE;
