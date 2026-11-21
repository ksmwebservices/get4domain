-- Slice 5.24c (Batch 13): the store (Ecommerce): catalogue, variants, stock ledger, recorded returns. Additive only: new tables, no existing object is touched.
CREATE TABLE "g4d_store_products" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sku" TEXT,
    "hsnSac" TEXT,
    "pricePaise" INTEGER NOT NULL,
    "taxRatePercent" DECIMAL(6,3),
    "trackStock" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_store_products_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "g4d_store_variants" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sku" TEXT,
    "pricePaise" INTEGER,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_store_variants_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "g4d_store_stock_moves" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "productRef" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "key" TEXT,
    "balanceAfter" INTEGER NOT NULL,
    "note" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "g4d_store_stock_moves_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "g4d_order_returns" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "g4d_order_returns_pkey" PRIMARY KEY ("id")
);

-- A missing SKU or key is NULL and NULLs never collide, so only a real second copy is refused.
CREATE UNIQUE INDEX "g4d_store_products_vendorId_sku_key" ON "g4d_store_products"("vendorId", "sku");
CREATE INDEX "g4d_store_products_vendorId_createdAt_idx" ON "g4d_store_products"("vendorId", "createdAt");
CREATE UNIQUE INDEX "g4d_store_variants_vendorId_sku_key" ON "g4d_store_variants"("vendorId", "sku");
CREATE INDEX "g4d_store_variants_vendorId_productId_idx" ON "g4d_store_variants"("vendorId", "productId");
CREATE UNIQUE INDEX "g4d_store_stock_moves_vendorId_key_key" ON "g4d_store_stock_moves"("vendorId", "key");
CREATE INDEX "g4d_store_stock_moves_vendorId_productRef_at_idx" ON "g4d_store_stock_moves"("vendorId", "productRef", "at");
CREATE INDEX "g4d_order_returns_vendorId_orderId_idx" ON "g4d_order_returns"("vendorId", "orderId");

ALTER TABLE "g4d_store_products" ADD CONSTRAINT "g4d_store_products_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "g4d_store_variants" ADD CONSTRAINT "g4d_store_variants_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "g4d_store_variants" ADD CONSTRAINT "g4d_store_variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "g4d_store_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "g4d_store_stock_moves" ADD CONSTRAINT "g4d_store_stock_moves_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "g4d_order_returns" ADD CONSTRAINT "g4d_order_returns_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Same rule as every other public table: RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_store_products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_store_variants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_store_stock_moves" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_order_returns" ENABLE ROW LEVEL SECURITY;
