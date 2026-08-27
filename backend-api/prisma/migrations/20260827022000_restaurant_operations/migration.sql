-- Final 3 — Restaurant: menu-linked order + kitchen flow.
-- Tables reuse the existing g4d_pos_tables (created in 20260826000000_vendor_ops_models).

CREATE TABLE "g4d_restaurant_orders" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "tableId" TEXT,
    "tableName" TEXT,
    "orderType" TEXT NOT NULL DEFAULT 'Dine-in',
    "customerName" TEXT,
    "contactId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentMethod" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_restaurant_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "g4d_restaurant_order_items" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "catalogItemId" TEXT,
    "name" TEXT NOT NULL,
    "station" TEXT NOT NULL DEFAULT 'kitchen',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_restaurant_order_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "g4d_restaurant_orders_vendorId_idx" ON "g4d_restaurant_orders"("vendorId");
CREATE INDEX "g4d_restaurant_orders_vendorId_status_idx" ON "g4d_restaurant_orders"("vendorId", "status");
CREATE INDEX "g4d_restaurant_order_items_vendorId_idx" ON "g4d_restaurant_order_items"("vendorId");
CREATE INDEX "g4d_restaurant_order_items_orderId_idx" ON "g4d_restaurant_order_items"("orderId");

ALTER TABLE "g4d_restaurant_orders" ADD CONSTRAINT "g4d_restaurant_orders_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "g4d_restaurant_order_items" ADD CONSTRAINT "g4d_restaurant_order_items_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "g4d_restaurant_order_items" ADD CONSTRAINT "g4d_restaurant_order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "g4d_restaurant_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
