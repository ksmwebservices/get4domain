-- V3 slice 5.1b: plan orders, the payment event inbox, plan invoices with a gap-free per-financial-year counter, and the renewal reminder log. ADDITIVE ONLY: new enums, new g4d_ tables, new indexes
-- and foreign keys. No existing table, column or row is changed. Staging only until the owner approves a production release.
-- Generated offline with prisma migrate diff against the slice 5.7 schema; the RLS lines at the end follow prisma/sql/enable_rls_public.sql.

-- CreateEnum
CREATE TYPE "V3PlanOrderStatus" AS ENUM ('CREATED', 'PENDING_PAYMENT', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED', 'REVIEW');

-- CreateEnum
CREATE TYPE "V3PlanOrderKind" AS ENUM ('NEW', 'RENEWAL', 'UPGRADE');

-- CreateTable
CREATE TABLE "g4d_plan_orders" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "termMonths" INTEGER NOT NULL,
    "kind" "V3PlanOrderKind" NOT NULL DEFAULT 'NEW',
    "quoteJson" JSONB NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "V3PlanOrderStatus" NOT NULL DEFAULT 'CREATED',
    "providerOrderId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdByType" TEXT NOT NULL DEFAULT 'VENDOR',
    "createdById" TEXT,
    "paymentId" TEXT,
    "paidAmountPaise" INTEGER,
    "paidAt" TIMESTAMP(3),
    "source" TEXT,
    "reason" TEXT,
    "subscriptionId" TEXT,
    "refundRecordedPaise" INTEGER,
    "refundNote" TEXT,
    "refundRecordedBy" TEXT,
    "refundRecordedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_plan_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_payment_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'razorpay',
    "providerEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payloadRedactedJson" JSONB NOT NULL,
    "signatureValid" BOOLEAN NOT NULL,
    "orderId" TEXT,
    "processedAt" TIMESTAMP(3),
    "result" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_plan_invoices" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "snapshotJson" JSONB NOT NULL,
    "taxBreakdownJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_plan_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_invoice_counters" (
    "financialYear" TEXT NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_invoice_counters_pkey" PRIMARY KEY ("financialYear")
);

-- CreateTable
CREATE TABLE "g4d_reminder_log" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "daysBefore" INTEGER NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'SENT',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_reminder_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "g4d_plan_orders_providerOrderId_key" ON "g4d_plan_orders"("providerOrderId");

-- CreateIndex
CREATE INDEX "g4d_plan_orders_vendorId_createdAt_idx" ON "g4d_plan_orders"("vendorId", "createdAt");

-- CreateIndex
CREATE INDEX "g4d_plan_orders_status_expiresAt_idx" ON "g4d_plan_orders"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_plan_orders_vendorId_idempotencyKey_key" ON "g4d_plan_orders"("vendorId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_payment_events_providerEventId_key" ON "g4d_payment_events"("providerEventId");

-- CreateIndex
CREATE INDEX "g4d_payment_events_orderId_idx" ON "g4d_payment_events"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_plan_invoices_orderId_key" ON "g4d_plan_invoices"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_plan_invoices_invoiceNumber_key" ON "g4d_plan_invoices"("invoiceNumber");

-- CreateIndex
CREATE INDEX "g4d_plan_invoices_vendorId_issuedAt_idx" ON "g4d_plan_invoices"("vendorId", "issuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_reminder_log_subscriptionId_daysBefore_endsAt_key" ON "g4d_reminder_log"("subscriptionId", "daysBefore", "endsAt");

-- AddForeignKey
ALTER TABLE "g4d_plan_orders" ADD CONSTRAINT "g4d_plan_orders_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_plan_orders" ADD CONSTRAINT "g4d_plan_orders_planId_fkey" FOREIGN KEY ("planId") REFERENCES "g4d_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_plan_invoices" ADD CONSTRAINT "g4d_plan_invoices_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_plan_invoices" ADD CONSTRAINT "g4d_plan_invoices_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "g4d_plan_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_reminder_log" ADD CONSTRAINT "g4d_reminder_log_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "g4d_plan_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Same rule as every other public table (prisma/sql/enable_rls_public.sql): RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_plan_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_payment_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_plan_invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_invoice_counters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_reminder_log" ENABLE ROW LEVEL SECURITY;
