-- Phase 3 — Agriculture: produce order + inventory tracking

CREATE TABLE "g4d_produce_orders" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "buyerName" TEXT NOT NULL,
    "contactId" TEXT,
    "produceName" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'kg',
    "grade" TEXT NOT NULL DEFAULT 'A',
    "ratePerUnit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "harvestDate" TIMESTAMP(3),
    "dispatchDate" TIMESTAMP(3),
    "deliveryDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_produce_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "g4d_produce_stock" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "produceName" TEXT NOT NULL,
    "grade" TEXT NOT NULL DEFAULT 'A',
    "unit" TEXT NOT NULL DEFAULT 'kg',
    "quantityAvailable" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ratePerUnit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "harvestDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'available',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_produce_stock_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "g4d_produce_orders_vendorId_idx" ON "g4d_produce_orders"("vendorId");
CREATE INDEX "g4d_produce_orders_vendorId_status_idx" ON "g4d_produce_orders"("vendorId", "status");
CREATE INDEX "g4d_produce_stock_vendorId_idx" ON "g4d_produce_stock"("vendorId");

ALTER TABLE "g4d_produce_orders" ADD CONSTRAINT "g4d_produce_orders_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "g4d_produce_stock" ADD CONSTRAINT "g4d_produce_stock_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
