-- V3 Batch 4B slice 5.21: trust and safety. ADDITIVE ONLY: six enums, five g4d_ tables, indexes, one foreign key (proofs to Vendor), CHECK constraints, one guard trigger.
-- No existing table, column or row is changed. Staging only until the owner approves a production release.

-- CreateEnum
CREATE TYPE "V3ProofKind" AS ENUM ('GST', 'UDYAM', 'SHOP_LICENCE', 'PROFESSIONAL_REGISTRATION', 'OTHER');
CREATE TYPE "V3ProofStatus" AS ENUM ('SUBMITTED', 'CHECKED', 'MISMATCH');
CREATE TYPE "V3TrustBlockKind" AS ENUM ('PHONE', 'EMAIL', 'DOMAIN', 'UPI', 'NAME');
CREATE TYPE "V3ReportSubject" AS ENUM ('LISTING', 'SITE');
CREATE TYPE "V3BusinessReportStatus" AS ENUM ('NEW', 'LOOKING', 'CLOSED');
CREATE TYPE "V3TakedownStatus" AS ENUM ('ACTIVE', 'REVERSED');

-- CreateTable
CREATE TABLE "g4d_business_proofs" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "kind" "V3ProofKind" NOT NULL,
    "number" TEXT NOT NULL,
    "documentRef" TEXT,
    "status" "V3ProofStatus" NOT NULL DEFAULT 'SUBMITTED',
    "checkedBy" TEXT,
    "checkedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_business_proofs_pkey" PRIMARY KEY ("id")
);

-- CreateTable (the older g4d_blocklist, the do-not-contact register, is not touched)
CREATE TABLE "g4d_trust_blocklist" (
    "id" TEXT NOT NULL,
    "kind" "V3TrustBlockKind" NOT NULL,
    "valueHash" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdByStaffId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_trust_blocklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_business_reports" (
    "id" TEXT NOT NULL,
    "subjectType" "V3ReportSubject" NOT NULL,
    "subject" TEXT NOT NULL,
    "reporterContact" TEXT,
    "reason" TEXT NOT NULL,
    "status" "V3BusinessReportStatus" NOT NULL DEFAULT 'NEW',
    "ipHash" TEXT,
    "handledByStaffId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_business_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_prohibited_terms" (
    "id" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "editedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_prohibited_terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_takedowns" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT,
    "listingId" TEXT,
    "reason" TEXT NOT NULL,
    "documentRef" TEXT,
    "decidedBy" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "V3TakedownStatus" NOT NULL DEFAULT 'ACTIVE',
    "priorListingStatus" TEXT,
    "priorIndexable" BOOLEAN,
    "reversedBy" TEXT,
    "reversedAt" TIMESTAMP(3),
    "reverseReason" TEXT,

    CONSTRAINT "g4d_takedowns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "g4d_business_proofs_vendorId_kind_key" ON "g4d_business_proofs"("vendorId", "kind");

-- CreateIndex
CREATE INDEX "g4d_business_proofs_status_createdAt_idx" ON "g4d_business_proofs"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_trust_blocklist_kind_valueHash_key" ON "g4d_trust_blocklist"("kind", "valueHash");

-- CreateIndex
CREATE INDEX "g4d_business_reports_status_createdAt_idx" ON "g4d_business_reports"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_prohibited_terms_term_key" ON "g4d_prohibited_terms"("term");

-- CreateIndex
CREATE INDEX "g4d_takedowns_vendorId_status_idx" ON "g4d_takedowns"("vendorId", "status");

-- CreateIndex
CREATE INDEX "g4d_takedowns_listingId_status_idx" ON "g4d_takedowns"("listingId", "status");

-- CreateIndex
CREATE INDEX "g4d_takedowns_status_at_idx" ON "g4d_takedowns"("status", "at");

-- AddForeignKey
ALTER TABLE "g4d_business_proofs" ADD CONSTRAINT "g4d_business_proofs_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A proof is CHECKED or MISMATCH only when a staff member did the checking; a SUBMITTED one has not been checked.
ALTER TABLE "g4d_business_proofs" ADD CONSTRAINT "g4d_business_proofs_checked_chk" CHECK (("status" = 'SUBMITTED' AND "checkedBy" IS NULL) OR ("status" IN ('CHECKED', 'MISMATCH') AND "checkedBy" IS NOT NULL AND "checkedAt" IS NOT NULL));

-- A takedown names a vendor or a listing, always carries a written reason, and a reversed one says who reversed it, when and why.
ALTER TABLE "g4d_takedowns" ADD CONSTRAINT "g4d_takedowns_target_chk" CHECK ("vendorId" IS NOT NULL OR "listingId" IS NOT NULL);
ALTER TABLE "g4d_takedowns" ADD CONSTRAINT "g4d_takedowns_reason_chk" CHECK (length(btrim("reason")) > 0);
ALTER TABLE "g4d_takedowns" ADD CONSTRAINT "g4d_takedowns_reversal_chk" CHECK (("status" = 'ACTIVE' AND "reversedAt" IS NULL AND "reversedBy" IS NULL AND "reverseReason" IS NULL) OR ("status" = 'REVERSED' AND "reversedAt" IS NOT NULL AND "reversedBy" IS NOT NULL AND length(btrim(coalesce("reverseReason", ''))) > 0));

-- A takedown is a legal record: its reason, its decider, its time and its target can never change, and it can never be deleted. Only the status and the reversal columns move, once.
CREATE OR REPLACE FUNCTION g4d_takedown_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'g4d_takedowns rows cannot be deleted';
  END IF;
  IF NEW."reason" IS DISTINCT FROM OLD."reason" OR NEW."decidedBy" IS DISTINCT FROM OLD."decidedBy" OR NEW."at" IS DISTINCT FROM OLD."at"
     OR NEW."vendorId" IS DISTINCT FROM OLD."vendorId" OR NEW."listingId" IS DISTINCT FROM OLD."listingId" OR NEW."documentRef" IS DISTINCT FROM OLD."documentRef" THEN
    RAISE EXCEPTION 'g4d_takedowns reason, decider, time and target cannot be changed';
  END IF;
  IF OLD."status" = 'REVERSED' THEN
    RAISE EXCEPTION 'a reversed takedown cannot be changed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "g4d_takedown_guard_trg" BEFORE UPDATE OR DELETE ON "g4d_takedowns" FOR EACH ROW EXECUTE FUNCTION g4d_takedown_guard();

-- Same rule as every other public table (prisma/sql/enable_rls_public.sql): RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_business_proofs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_trust_blocklist" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_business_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_prohibited_terms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_takedowns" ENABLE ROW LEVEL SECURITY;
