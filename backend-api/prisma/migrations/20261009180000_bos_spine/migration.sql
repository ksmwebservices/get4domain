-- Full BOS spine (dispatch 09-Oct-2026). ADDITIVE ONLY: new tables (g4d_bos_*, g4d_plan_overrides), new nullable/defaulted columns on
-- g4d_contacts / VendorProduct / g4d_stock_movements, two new StockMovementReason values. No DROP, no type change, no backfill.
-- Rollback: everything here can stay unused. Apply with 'npx prisma migrate deploy' on the VM only; then re-run prisma/sql/enable_rls_public.sql.

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StockMovementReason" ADD VALUE 'PURCHASE';
ALTER TYPE "StockMovementReason" ADD VALUE 'TRANSFER';

-- AlterTable
ALTER TABLE "VendorProduct" ADD COLUMN     "gstRate" DOUBLE PRECISION,
ADD COLUMN     "hsn" TEXT,
ADD COLUMN     "purchasePriceAmount" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "g4d_contacts" ADD COLUMN     "gstin" TEXT,
ADD COLUMN     "openingBalancePaise" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "shippingAddress" TEXT,
ADD COLUMN     "state" TEXT;

-- AlterTable
ALTER TABLE "g4d_stock_movements" ADD COLUMN     "locationId" TEXT,
ADD COLUMN     "variantKey" TEXT;

-- CreateTable
CREATE TABLE "g4d_bos_settings" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "gstRegistered" BOOLEAN NOT NULL DEFAULT false,
    "gstin" TEXT,
    "legalName" TEXT,
    "state" TEXT,
    "defaultGstRate" DOUBLE PRECISION NOT NULL DEFAULT 18,
    "priceMode" TEXT NOT NULL DEFAULT 'EXCLUSIVE',
    "roundOff" BOOLEAN NOT NULL DEFAULT true,
    "prefixes" JSONB,
    "negativeStock" TEXT NOT NULL DEFAULT 'WARN',
    "orderInvoiceOn" TEXT NOT NULL DEFAULT 'PAID',
    "purchaseUpdatesCost" BOOLEAN NOT NULL DEFAULT true,
    "bankDetails" TEXT,
    "upiId" TEXT,
    "terms" TEXT,
    "notes" TEXT,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_bos_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_bos_doc_series" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "fy" TEXT NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "g4d_bos_doc_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_bos_documents" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "number" TEXT,
    "fy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "partyId" TEXT,
    "partyName" TEXT,
    "partyGstin" TEXT,
    "partyState" TEXT,
    "billingAddress" TEXT,
    "docDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "taxKind" TEXT NOT NULL DEFAULT 'NONE',
    "priceMode" TEXT NOT NULL DEFAULT 'EXCLUSIVE',
    "placeOfSupply" TEXT,
    "intraState" BOOLEAN NOT NULL DEFAULT true,
    "subtotalPaise" INTEGER NOT NULL DEFAULT 0,
    "discountPaise" INTEGER NOT NULL DEFAULT 0,
    "shippingPaise" INTEGER NOT NULL DEFAULT 0,
    "taxablePaise" INTEGER NOT NULL DEFAULT 0,
    "cgstPaise" INTEGER NOT NULL DEFAULT 0,
    "sgstPaise" INTEGER NOT NULL DEFAULT 0,
    "igstPaise" INTEGER NOT NULL DEFAULT 0,
    "roundOffPaise" INTEGER NOT NULL DEFAULT 0,
    "totalPaise" INTEGER NOT NULL DEFAULT 0,
    "paidPaise" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "sourceType" TEXT,
    "sourceId" TEXT,
    "refDocId" TEXT,
    "supplierRef" TEXT,
    "notes" TEXT,
    "terms" TEXT,
    "publicToken" TEXT,
    "idempotencyKey" TEXT,
    "issuedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_bos_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_bos_document_lines" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "itemId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "variantKey" TEXT,
    "hsn" TEXT,
    "unit" TEXT,
    "qty" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "ratePaise" INTEGER NOT NULL DEFAULT 0,
    "discountPaise" INTEGER NOT NULL DEFAULT 0,
    "taxablePaise" INTEGER NOT NULL DEFAULT 0,
    "gstRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cgstPaise" INTEGER NOT NULL DEFAULT 0,
    "sgstPaise" INTEGER NOT NULL DEFAULT 0,
    "igstPaise" INTEGER NOT NULL DEFAULT 0,
    "totalPaise" INTEGER NOT NULL DEFAULT 0,
    "unitCostPaise" INTEGER,
    "stockQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "refLineId" TEXT,
    "restock" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "g4d_bos_document_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_bos_payments" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "number" TEXT,
    "fy" TEXT,
    "partyId" TEXT,
    "partyName" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'CASH',
    "amountPaise" INTEGER NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "sourceId" TEXT,
    "idempotencyKey" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_bos_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_bos_allocations" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "paymentId" TEXT,
    "creditNoteId" TEXT,
    "amountPaise" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_bos_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_bos_expenses" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "number" TEXT,
    "fy" TEXT,
    "expenseDate" TIMESTAMP(3) NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "supplierId" TEXT,
    "taxablePaise" INTEGER NOT NULL,
    "gstRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cgstPaise" INTEGER NOT NULL DEFAULT 0,
    "sgstPaise" INTEGER NOT NULL DEFAULT 0,
    "igstPaise" INTEGER NOT NULL DEFAULT 0,
    "totalPaise" INTEGER NOT NULL,
    "paymentMode" TEXT NOT NULL DEFAULT 'CASH',
    "attachment" TEXT,
    "recurring" TEXT NOT NULL DEFAULT 'NONE',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "idempotencyKey" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_bos_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_bos_accounts" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "system" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "g4d_bos_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_bos_journal_entries" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceVersion" INTEGER NOT NULL DEFAULT 1,
    "memo" TEXT,
    "reversalOfId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_bos_journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_bos_journal_lines" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "partyId" TEXT,
    "debitPaise" INTEGER NOT NULL DEFAULT 0,
    "creditPaise" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "g4d_bos_journal_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_bos_stock_locations" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "g4d_bos_stock_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_bos_recurring" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "nextRunOn" TIMESTAMP(3) NOT NULL,
    "endsOn" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastRunOn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_bos_recurring_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_plan_overrides" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_plan_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "g4d_bos_settings_vendorId_key" ON "g4d_bos_settings"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_bos_doc_series_vendorId_docType_fy_key" ON "g4d_bos_doc_series"("vendorId", "docType", "fy");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_bos_documents_publicToken_key" ON "g4d_bos_documents"("publicToken");

-- CreateIndex
CREATE INDEX "g4d_bos_documents_vendorId_docType_status_idx" ON "g4d_bos_documents"("vendorId", "docType", "status");

-- CreateIndex
CREATE INDEX "g4d_bos_documents_vendorId_partyId_idx" ON "g4d_bos_documents"("vendorId", "partyId");

-- CreateIndex
CREATE INDEX "g4d_bos_documents_vendorId_docDate_idx" ON "g4d_bos_documents"("vendorId", "docDate");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_bos_documents_vendorId_docType_number_key" ON "g4d_bos_documents"("vendorId", "docType", "number");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_bos_documents_vendorId_idempotencyKey_key" ON "g4d_bos_documents"("vendorId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_bos_documents_vendorId_docType_sourceType_sourceId_key" ON "g4d_bos_documents"("vendorId", "docType", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "g4d_bos_document_lines_documentId_idx" ON "g4d_bos_document_lines"("documentId");

-- CreateIndex
CREATE INDEX "g4d_bos_document_lines_vendorId_itemId_idx" ON "g4d_bos_document_lines"("vendorId", "itemId");

-- CreateIndex
CREATE INDEX "g4d_bos_payments_vendorId_partyId_idx" ON "g4d_bos_payments"("vendorId", "partyId");

-- CreateIndex
CREATE INDEX "g4d_bos_payments_vendorId_paymentDate_idx" ON "g4d_bos_payments"("vendorId", "paymentDate");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_bos_payments_vendorId_kind_number_key" ON "g4d_bos_payments"("vendorId", "kind", "number");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_bos_payments_vendorId_idempotencyKey_key" ON "g4d_bos_payments"("vendorId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "g4d_bos_allocations_vendorId_documentId_idx" ON "g4d_bos_allocations"("vendorId", "documentId");

-- CreateIndex
CREATE INDEX "g4d_bos_allocations_paymentId_idx" ON "g4d_bos_allocations"("paymentId");

-- CreateIndex
CREATE INDEX "g4d_bos_expenses_vendorId_expenseDate_idx" ON "g4d_bos_expenses"("vendorId", "expenseDate");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_bos_expenses_vendorId_number_key" ON "g4d_bos_expenses"("vendorId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_bos_expenses_vendorId_idempotencyKey_key" ON "g4d_bos_expenses"("vendorId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_bos_accounts_vendorId_code_key" ON "g4d_bos_accounts"("vendorId", "code");

-- CreateIndex
CREATE INDEX "g4d_bos_journal_entries_vendorId_entryDate_idx" ON "g4d_bos_journal_entries"("vendorId", "entryDate");

-- CreateIndex
CREATE INDEX "g4d_bos_journal_entries_vendorId_sourceType_sourceId_idx" ON "g4d_bos_journal_entries"("vendorId", "sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_bos_journal_entries_vendorId_sourceType_sourceId_source_key" ON "g4d_bos_journal_entries"("vendorId", "sourceType", "sourceId", "sourceVersion");

-- CreateIndex
CREATE INDEX "g4d_bos_journal_lines_entryId_idx" ON "g4d_bos_journal_lines"("entryId");

-- CreateIndex
CREATE INDEX "g4d_bos_journal_lines_vendorId_accountCode_idx" ON "g4d_bos_journal_lines"("vendorId", "accountCode");

-- CreateIndex
CREATE INDEX "g4d_bos_journal_lines_vendorId_partyId_idx" ON "g4d_bos_journal_lines"("vendorId", "partyId");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_bos_stock_locations_vendorId_name_key" ON "g4d_bos_stock_locations"("vendorId", "name");

-- CreateIndex
CREATE INDEX "g4d_bos_recurring_vendorId_active_nextRunOn_idx" ON "g4d_bos_recurring"("vendorId", "active", "nextRunOn");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_plan_overrides_key_key" ON "g4d_plan_overrides"("key");

-- AddForeignKey
ALTER TABLE "g4d_bos_document_lines" ADD CONSTRAINT "g4d_bos_document_lines_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "g4d_bos_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_bos_allocations" ADD CONSTRAINT "g4d_bos_allocations_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "g4d_bos_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_bos_journal_lines" ADD CONSTRAINT "g4d_bos_journal_lines_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "g4d_bos_journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

