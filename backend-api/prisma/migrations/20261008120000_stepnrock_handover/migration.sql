-- Stepnrock handover (2026-10-08). ADDITIVE ONLY: new columns are nullable or defaulted, one new table + enum, no backfill.
-- VendorProduct.trackStock (default false => nothing changes for existing products); StockMovement ledger;
-- PosSale customer/address/idempotency columns for storefront order requests; VendorPaymentConfig.checkoutMode;
-- Category.sortOrder/hidden. Rollback: columns/table can stay unused.
-- CreateEnum
CREATE TYPE "StockMovementReason" AS ENUM ('ONLINE_ORDER', 'SHOP_SALE', 'ADJUSTMENT', 'RETURN', 'CANCEL', 'OPENING', 'DAMAGE', 'RECOUNT');

-- AlterTable
ALTER TABLE "VendorProduct" ADD COLUMN     "trackStock" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "g4d_categories" ADD COLUMN     "hidden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "g4d_vendor_payment_config" ADD COLUMN     "checkoutMode" TEXT;

-- AlterTable
ALTER TABLE "g4d_pos_sales" ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "customerEmail" TEXT,
ADD COLUMN     "customerName" TEXT,
ADD COLUMN     "customerPhone" TEXT,
ADD COLUMN     "deliveryAddress" TEXT,
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "orderNote" TEXT,
ADD COLUMN     "orderSource" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "g4d_stock_movements" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" "StockMovementReason" NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "note" TEXT,
    "balanceAfter" INTEGER NOT NULL,
    "createdBy" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "g4d_stock_movements_idempotencyKey_key" ON "g4d_stock_movements"("idempotencyKey");

-- CreateIndex
CREATE INDEX "g4d_stock_movements_vendorId_productId_createdAt_idx" ON "g4d_stock_movements"("vendorId", "productId", "createdAt");

-- CreateIndex
CREATE INDEX "g4d_stock_movements_refType_refId_idx" ON "g4d_stock_movements"("refType", "refId");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_pos_sales_vendorId_idempotencyKey_key" ON "g4d_pos_sales"("vendorId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "g4d_stock_movements" ADD CONSTRAINT "g4d_stock_movements_productId_fkey" FOREIGN KEY ("productId") REFERENCES "VendorProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
