-- CreateEnum
CREATE TYPE "V3ServiceRequestStatus" AS ENUM ('REQUESTED', 'ACCEPTED', 'IN_PRODUCTION', 'READY_FOR_REVIEW', 'REVISION_REQUESTED', 'APPROVED', 'REJECTED_BY_TEAM', 'CANCELLED');

-- CreateEnum
CREATE TYPE "V3ServiceFunding" AS ENUM ('INCLUDED_ALLOWANCE', 'PACK', 'WALLET');

-- CreateEnum
CREATE TYPE "V3ServiceRequestCreator" AS ENUM ('VENDOR', 'STAFF_ON_BEHALF');

-- CreateEnum
CREATE TYPE "V3DeliverableKind" AS ENUM ('TEXT', 'FILE_REF', 'LINK');

-- CreateTable
CREATE TABLE "g4d_service_requests" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "status" "V3ServiceRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "briefJson" JSONB NOT NULL,
    "attachmentRefs" JSONB NOT NULL DEFAULT '[]',
    "priceSnapshotPaise" INTEGER,
    "taxSnapshotJson" JSONB NOT NULL DEFAULT '{}',
    "fundingKind" "V3ServiceFunding" NOT NULL,
    "holdLedgerId" TEXT,
    "chargeLedgerId" TEXT,
    "packPurchaseId" TEXT,
    "assignedStaffId" TEXT,
    "slaDueAt" TIMESTAMP(3),
    "slaBreachedAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "revisionsUsed" INTEGER NOT NULL DEFAULT 0,
    "grantEndsAt" TIMESTAMP(3),
    "grantOverrideId" TEXT,
    "createdByType" "V3ServiceRequestCreator" NOT NULL DEFAULT 'VENDOR',
    "createdById" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "rejectReason" TEXT,
    "approvedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_service_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_service_request_events" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "note" TEXT,
    "metaJson" JSONB NOT NULL DEFAULT '{}',
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_service_request_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_service_deliverables" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "kind" "V3DeliverableKind" NOT NULL,
    "text" TEXT,
    "fileRef" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_service_deliverables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_service_invoices" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "ledgerEntryId" TEXT NOT NULL,
    "snapshotJson" JSONB NOT NULL,
    "taxBreakdownJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_service_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "g4d_service_requests_holdLedgerId_key" ON "g4d_service_requests"("holdLedgerId");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_service_requests_chargeLedgerId_key" ON "g4d_service_requests"("chargeLedgerId");

-- CreateIndex
CREATE INDEX "g4d_service_requests_vendorId_status_createdAt_idx" ON "g4d_service_requests"("vendorId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "g4d_service_requests_status_slaDueAt_idx" ON "g4d_service_requests"("status", "slaDueAt");

-- CreateIndex
CREATE INDEX "g4d_service_requests_serviceId_status_idx" ON "g4d_service_requests"("serviceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_service_requests_vendorId_idempotencyKey_key" ON "g4d_service_requests"("vendorId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "g4d_service_request_events_requestId_at_idx" ON "g4d_service_request_events"("requestId", "at");

-- CreateIndex
CREATE INDEX "g4d_service_request_events_vendorId_at_idx" ON "g4d_service_request_events"("vendorId", "at");

-- CreateIndex
CREATE INDEX "g4d_service_deliverables_requestId_createdAt_idx" ON "g4d_service_deliverables"("requestId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_service_invoices_requestId_key" ON "g4d_service_invoices"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_service_invoices_invoiceNumber_key" ON "g4d_service_invoices"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_service_invoices_ledgerEntryId_key" ON "g4d_service_invoices"("ledgerEntryId");

-- CreateIndex
CREATE INDEX "g4d_service_invoices_vendorId_issuedAt_idx" ON "g4d_service_invoices"("vendorId", "issuedAt");

-- AddForeignKey
ALTER TABLE "g4d_service_requests" ADD CONSTRAINT "g4d_service_requests_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_service_requests" ADD CONSTRAINT "g4d_service_requests_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "g4d_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_service_request_events" ADD CONSTRAINT "g4d_service_request_events_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "g4d_service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_service_deliverables" ADD CONSTRAINT "g4d_service_deliverables_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "g4d_service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_service_invoices" ADD CONSTRAINT "g4d_service_invoices_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "g4d_service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A charge and a hold are never negative; a request cannot use a negative number of revisions.
ALTER TABLE "g4d_service_requests" ADD CONSTRAINT "g4d_service_requests_amounts_chk" CHECK (("priceSnapshotPaise" IS NULL OR "priceSnapshotPaise" > 0) AND "revisionsUsed" >= 0);

-- A WALLET request always carries the amount and the hold that reserved it; an allowance or pack request carries neither.
ALTER TABLE "g4d_service_requests" ADD CONSTRAINT "g4d_service_requests_funding_chk" CHECK (("fundingKind" = 'WALLET' AND "priceSnapshotPaise" IS NOT NULL AND "holdLedgerId" IS NOT NULL) OR ("fundingKind" <> 'WALLET' AND "holdLedgerId" IS NULL));

-- The history of a request is evidence: it can never be changed, and it can never be deleted by hand. The only delete allowed is the cascade of a request that is already gone (a hard-deleted test tenant).
CREATE OR REPLACE FUNCTION g4d_service_request_events_immutable() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'g4d_service_request_events rows cannot be changed';
  END IF;
  IF EXISTS (SELECT 1 FROM "g4d_service_requests" WHERE "id" = OLD."requestId") THEN
    RAISE EXCEPTION 'g4d_service_request_events rows cannot be deleted';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "g4d_service_request_events_immutable_trg" BEFORE UPDATE OR DELETE ON "g4d_service_request_events" FOR EACH ROW EXECUTE FUNCTION g4d_service_request_events_immutable();

-- A tax invoice is a legal document: once written it can never be changed or deleted (same rule, same cascade exception).
CREATE OR REPLACE FUNCTION g4d_service_invoices_immutable() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'g4d_service_invoices rows cannot be changed';
  END IF;
  IF EXISTS (SELECT 1 FROM "g4d_service_requests" WHERE "id" = OLD."requestId") THEN
    RAISE EXCEPTION 'g4d_service_invoices rows cannot be deleted';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "g4d_service_invoices_immutable_trg" BEFORE UPDATE OR DELETE ON "g4d_service_invoices" FOR EACH ROW EXECUTE FUNCTION g4d_service_invoices_immutable();

-- Same rule as every other public table (prisma/sql/enable_rls_public.sql): RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_service_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_service_request_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_service_deliverables" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_service_invoices" ENABLE ROW LEVEL SECURITY;
