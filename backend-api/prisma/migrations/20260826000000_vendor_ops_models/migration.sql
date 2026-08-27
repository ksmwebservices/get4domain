-- Vendor App — Phase 4 operations models (dispatch 26 Aug 2026). Additive only.
-- Dedicated, vendorId-scoped tables for Task board, POS (tables/kitchen/sales),
-- appointments, payments ledger and GST filing tracker. Priority industries
-- clinic/restaurant/retail; other industries backlogged.

-- Retail POS live-stock (nullable = untracked).
ALTER TABLE "g4d_catalog_items" ADD COLUMN "stock" INTEGER;

-- Kanban task / process board.
CREATE TABLE "g4d_vendor_tasks" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'new',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "assignee" TEXT,
    "segment" TEXT,
    "subtasks" JSONB,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_vendor_tasks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "g4d_vendor_tasks_vendorId_idx" ON "g4d_vendor_tasks"("vendorId");
CREATE INDEX "g4d_vendor_tasks_vendorId_stage_idx" ON "g4d_vendor_tasks"("vendorId", "stage");
ALTER TABLE "g4d_vendor_tasks" ADD CONSTRAINT "g4d_vendor_tasks_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Restaurant floor / table map.
CREATE TABLE "g4d_pos_tables" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "seats" INTEGER NOT NULL DEFAULT 2,
    "status" TEXT NOT NULL DEFAULT 'available',
    "orderTotal" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_pos_tables_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "g4d_pos_tables_vendorId_idx" ON "g4d_pos_tables"("vendorId");
ALTER TABLE "g4d_pos_tables" ADD CONSTRAINT "g4d_pos_tables_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Kitchen order queue.
CREATE TABLE "g4d_kitchen_tickets" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "tableName" TEXT,
    "items" TEXT NOT NULL,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'preparing',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_kitchen_tickets_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "g4d_kitchen_tickets_vendorId_idx" ON "g4d_kitchen_tickets"("vendorId");
CREATE INDEX "g4d_kitchen_tickets_vendorId_status_idx" ON "g4d_kitchen_tickets"("vendorId", "status");
ALTER TABLE "g4d_kitchen_tickets" ADD CONSTRAINT "g4d_kitchen_tickets_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Completed POS sale (retail/food).
CREATE TABLE "g4d_pos_sales" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'retail',
    "items" JSONB NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL,
    "paymentMethod" TEXT NOT NULL DEFAULT 'cash',
    "status" TEXT NOT NULL DEFAULT 'completed',
    "tableName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_pos_sales_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "g4d_pos_sales_vendorId_idx" ON "g4d_pos_sales"("vendorId");
CREATE INDEX "g4d_pos_sales_vendorId_createdAt_idx" ON "g4d_pos_sales"("vendorId", "createdAt");
ALTER TABLE "g4d_pos_sales" ADD CONSTRAINT "g4d_pos_sales_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Booking / appointment.
CREATE TABLE "g4d_appointments" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "contactId" TEXT,
    "customerName" TEXT NOT NULL,
    "phone" TEXT,
    "service" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 30,
    "status" TEXT NOT NULL DEFAULT 'booked',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_appointments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "g4d_appointments_vendorId_idx" ON "g4d_appointments"("vendorId");
CREATE INDEX "g4d_appointments_vendorId_startAt_idx" ON "g4d_appointments"("vendorId", "startAt");
ALTER TABLE "g4d_appointments" ADD CONSTRAINT "g4d_appointments_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Business payments ledger.
CREATE TABLE "g4d_payment_records" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "party" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'cleared',
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_payment_records_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "g4d_payment_records_vendorId_idx" ON "g4d_payment_records"("vendorId");
CREATE INDEX "g4d_payment_records_vendorId_date_idx" ON "g4d_payment_records"("vendorId", "date");
ALTER TABLE "g4d_payment_records" ADD CONSTRAINT "g4d_payment_records_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- GST filing-status tracker.
CREATE TABLE "g4d_gst_filings" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "formType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "dueDate" TIMESTAMP(3),
    "filedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_gst_filings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "g4d_gst_filings_vendorId_period_formType_key" ON "g4d_gst_filings"("vendorId", "period", "formType");
CREATE INDEX "g4d_gst_filings_vendorId_idx" ON "g4d_gst_filings"("vendorId");
ALTER TABLE "g4d_gst_filings" ADD CONSTRAINT "g4d_gst_filings_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
