-- Final 3 — Retail: product stock (sales reuse g4d_pos_sales from 20260826000000).

CREATE TABLE "g4d_retail_products" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "category" TEXT,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stockQty" INTEGER NOT NULL DEFAULT 0,
    "reorderLevel" INTEGER NOT NULL DEFAULT 5,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_retail_products_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "g4d_retail_products_vendorId_idx" ON "g4d_retail_products"("vendorId");

ALTER TABLE "g4d_retail_products" ADD CONSTRAINT "g4d_retail_products_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
