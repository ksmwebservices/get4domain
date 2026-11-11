-- Slice 5.17b (owner amendment 06, UPI only): pay requests and the payments the vendor confirms. Additive only: two new tables and three new enums.
-- CreateEnum
CREATE TYPE "V3PaySource" AS ENUM ('MANUAL', 'REQUEST', 'ORDER');
-- CreateEnum
CREATE TYPE "V3PayStatus" AS ENUM ('AWAITING', 'CUSTOMER_SAYS_PAID', 'PAID', 'EXPIRED', 'CANCELLED');
-- CreateEnum
CREATE TYPE "V3PaymentConfirmedBy" AS ENUM ('VENDOR', 'GATEWAY');
-- CreateTable
CREATE TABLE "g4d_payment_requests" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "note" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "source" "V3PaySource" NOT NULL DEFAULT 'MANUAL',
    "requestId" TEXT,
    "orderId" TEXT,
    "methodId" TEXT NOT NULL,
    "status" "V3PayStatus" NOT NULL DEFAULT 'AWAITING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "customerSaidAt" TIMESTAMP(3),
    "customerUtr" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_payment_requests_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "g4d_payments" (
    "id" TEXT NOT NULL,
    "paymentRequestId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "provider" TEXT NOT NULL DEFAULT 'UPI_MANUAL',
    "providerPaymentId" TEXT NOT NULL,
    "utr" TEXT,
    "confirmedBy" "V3PaymentConfirmedBy" NOT NULL DEFAULT 'VENDOR',
    "confirmedAt" TIMESTAMP(3) NOT NULL,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "g4d_payments_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "g4d_payment_requests_code_key" ON "g4d_payment_requests"("code");
CREATE INDEX "g4d_payment_requests_vendorId_status_createdAt_idx" ON "g4d_payment_requests"("vendorId", "status", "createdAt");
CREATE INDEX "g4d_payment_requests_status_expiresAt_idx" ON "g4d_payment_requests"("status", "expiresAt");
CREATE INDEX "g4d_payment_requests_vendorId_orderId_idx" ON "g4d_payment_requests"("vendorId", "orderId");
CREATE UNIQUE INDEX "g4d_payments_paymentRequestId_key" ON "g4d_payments"("paymentRequestId");
CREATE UNIQUE INDEX "g4d_payments_provider_providerPaymentId_key" ON "g4d_payments"("provider", "providerPaymentId");
CREATE UNIQUE INDEX "g4d_payments_vendorId_idempotencyKey_key" ON "g4d_payments"("vendorId", "idempotencyKey");
CREATE INDEX "g4d_payments_vendorId_confirmedAt_idx" ON "g4d_payments"("vendorId", "confirmedAt");
-- AddForeignKey
ALTER TABLE "g4d_payment_requests" ADD CONSTRAINT "g4d_payment_requests_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "g4d_payment_requests" ADD CONSTRAINT "g4d_payment_requests_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "g4d_vendor_payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "g4d_payments" ADD CONSTRAINT "g4d_payments_paymentRequestId_fkey" FOREIGN KEY ("paymentRequestId") REFERENCES "g4d_payment_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "g4d_payments" ADD CONSTRAINT "g4d_payments_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Same rule as every other public table (prisma/sql/enable_rls_public.sql): RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_payment_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_payments" ENABLE ROW LEVEL SECURITY;
