-- Slice 5.17d (Batch 5): the vendor receipts and invoices. Additive only: four new tables and two new enums.
-- CreateEnum
CREATE TYPE "V3DocKind" AS ENUM ('TAX_INVOICE', 'BILL_OF_SUPPLY', 'BILL', 'FEE_RECEIPT');
-- CreateEnum
CREATE TYPE "V3SendStatus" AS ENUM ('NONE', 'PENDING', 'SENT_SANDBOX', 'FAILED', 'SKIPPED');
-- CreateTable
CREATE TABLE "g4d_vendor_tax_profiles" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "gstRegistered" BOOLEAN NOT NULL DEFAULT false,
    "gstin" TEXT,
    "stateCode" TEXT,
    "legalName" TEXT,
    "address" TEXT,
    "compositionScheme" BOOLEAN NOT NULL DEFAULT false,
    "invoicePrefix" TEXT NOT NULL DEFAULT 'INV',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_vendor_tax_profiles_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "g4d_invoice_series" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_invoice_series_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "g4d_vendor_documents" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "kind" "V3DocKind" NOT NULL,
    "number" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "periodKey" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "customerSnapshot" JSONB NOT NULL DEFAULT '{}',
    "itemsJson" JSONB NOT NULL DEFAULT '[]',
    "taxJson" JSONB NOT NULL DEFAULT '{}',
    "totalPaise" INTEGER NOT NULL,
    "pdfRef" TEXT,
    "publicCode" TEXT NOT NULL,
    "whatsappStatus" "V3SendStatus" NOT NULL DEFAULT 'NONE',
    "emailStatus" "V3SendStatus" NOT NULL DEFAULT 'NONE',
    "resendCount" INTEGER NOT NULL DEFAULT 0,
    "flagsJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "g4d_vendor_documents_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "g4d_outbox" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT,
    "channel" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "toHash" TEXT NOT NULL,
    "toMasked" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL DEFAULT '{}',
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "g4d_outbox_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "g4d_vendor_tax_profiles_vendorId_key" ON "g4d_vendor_tax_profiles"("vendorId");
CREATE UNIQUE INDEX "g4d_invoice_series_vendorId_periodKey_key" ON "g4d_invoice_series"("vendorId", "periodKey");
CREATE UNIQUE INDEX "g4d_vendor_documents_paymentId_key" ON "g4d_vendor_documents"("paymentId");
CREATE UNIQUE INDEX "g4d_vendor_documents_publicCode_key" ON "g4d_vendor_documents"("publicCode");
CREATE UNIQUE INDEX "g4d_vendor_documents_vendorId_number_key" ON "g4d_vendor_documents"("vendorId", "number");
CREATE UNIQUE INDEX "g4d_vendor_documents_vendorId_periodKey_seq_key" ON "g4d_vendor_documents"("vendorId", "periodKey", "seq");
CREATE INDEX "g4d_vendor_documents_vendorId_createdAt_idx" ON "g4d_vendor_documents"("vendorId", "createdAt");
CREATE UNIQUE INDEX "g4d_outbox_idempotencyKey_key" ON "g4d_outbox"("idempotencyKey");
CREATE INDEX "g4d_outbox_status_createdAt_idx" ON "g4d_outbox"("status", "createdAt");
-- AddForeignKey
ALTER TABLE "g4d_vendor_tax_profiles" ADD CONSTRAINT "g4d_vendor_tax_profiles_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "g4d_invoice_series" ADD CONSTRAINT "g4d_invoice_series_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "g4d_vendor_documents" ADD CONSTRAINT "g4d_vendor_documents_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "g4d_vendor_documents" ADD CONSTRAINT "g4d_vendor_documents_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "g4d_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Same rule as every other public table (prisma/sql/enable_rls_public.sql): RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_vendor_tax_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_invoice_series" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_vendor_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_outbox" ENABLE ROW LEVEL SECURITY;
