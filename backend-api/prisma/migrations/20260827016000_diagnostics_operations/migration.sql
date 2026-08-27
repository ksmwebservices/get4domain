-- Phase 3 — Diagnostics & Lab: test-order + report tracking

CREATE TABLE "g4d_test_orders" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "contactId" TEXT,
    "referringDoctor" TEXT,
    "status" TEXT NOT NULL DEFAULT 'booked',
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sampleId" TEXT,
    "testDate" TIMESTAMP(3),
    "collectedAt" TIMESTAMP(3),
    "reportReadyAt" TIMESTAMP(3),
    "reportUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_test_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "g4d_test_order_items" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "testName" TEXT NOT NULL,
    "sampleType" TEXT NOT NULL DEFAULT 'Blood',
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_test_order_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "g4d_test_orders_vendorId_idx" ON "g4d_test_orders"("vendorId");
CREATE INDEX "g4d_test_orders_vendorId_status_idx" ON "g4d_test_orders"("vendorId", "status");
CREATE INDEX "g4d_test_order_items_vendorId_idx" ON "g4d_test_order_items"("vendorId");
CREATE INDEX "g4d_test_order_items_orderId_idx" ON "g4d_test_order_items"("orderId");

ALTER TABLE "g4d_test_orders" ADD CONSTRAINT "g4d_test_orders_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "g4d_test_order_items" ADD CONSTRAINT "g4d_test_order_items_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "g4d_test_order_items" ADD CONSTRAINT "g4d_test_order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "g4d_test_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
