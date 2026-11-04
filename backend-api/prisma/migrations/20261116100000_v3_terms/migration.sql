-- CreateEnum
CREATE TYPE "V3TermsKind" AS ENUM ('VENDOR_TERMS', 'ACCEPTABLE_USE', 'DATA_PROCESSING', 'REFUND_POLICY_TEMPLATE', 'GRIEVANCE', 'PRIVACY', 'COOKIE', 'CUSTOMER_TERMS');

-- CreateEnum
CREATE TYPE "V3TermsStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');

-- CreateTable
CREATE TABLE "g4d_terms_documents" (
    "id" TEXT NOT NULL,
    "kind" "V3TermsKind" NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "status" "V3TermsStatus" NOT NULL DEFAULT 'DRAFT',
    "bodyMarkdown" TEXT NOT NULL,
    "changeNote" TEXT,
    "publishedAt" TIMESTAMP(3),
    "publishedBy" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_terms_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_terms_acceptances" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT,
    "customerRequestId" TEXT,
    "userId" TEXT,
    "documentId" TEXT NOT NULL,
    "kind" "V3TermsKind" NOT NULL,
    "version" INTEGER NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipHash" TEXT,
    "userAgentHash" TEXT,

    CONSTRAINT "g4d_terms_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "g4d_terms_documents_kind_status_idx" ON "g4d_terms_documents"("kind", "status");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_terms_documents_kind_version_key" ON "g4d_terms_documents"("kind", "version");

-- CreateIndex
CREATE INDEX "g4d_terms_acceptances_vendorId_kind_idx" ON "g4d_terms_acceptances"("vendorId", "kind");

-- CreateIndex
CREATE INDEX "g4d_terms_acceptances_documentId_idx" ON "g4d_terms_acceptances"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_terms_acceptances_vendorId_documentId_key" ON "g4d_terms_acceptances"("vendorId", "documentId");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_terms_acceptances_customerRequestId_documentId_key" ON "g4d_terms_acceptances"("customerRequestId", "documentId");

-- AddForeignKey
ALTER TABLE "g4d_terms_acceptances" ADD CONSTRAINT "g4d_terms_acceptances_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_terms_acceptances" ADD CONSTRAINT "g4d_terms_acceptances_customerRequestId_fkey" FOREIGN KEY ("customerRequestId") REFERENCES "g4d_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_terms_acceptances" ADD CONSTRAINT "g4d_terms_acceptances_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "g4d_terms_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Exactly one of the two subjects is set.
ALTER TABLE "g4d_terms_acceptances" ADD CONSTRAINT "g4d_terms_acceptances_one_subject_chk" CHECK (("vendorId" IS NOT NULL) <> ("customerRequestId" IS NOT NULL));

-- An acceptance is evidence: it can never be changed, and it can never be deleted by hand. The only delete allowed is the cascade of a tenant row that is already gone (a hard-deleted test tenant).
CREATE OR REPLACE FUNCTION g4d_terms_acceptances_immutable() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'g4d_terms_acceptances rows cannot be changed';
  END IF;
  IF (OLD."vendorId" IS NOT NULL AND EXISTS (SELECT 1 FROM "Vendor" WHERE "id" = OLD."vendorId"))
     OR (OLD."customerRequestId" IS NOT NULL AND EXISTS (SELECT 1 FROM "g4d_requests" WHERE "id" = OLD."customerRequestId")) THEN
    RAISE EXCEPTION 'g4d_terms_acceptances rows cannot be deleted';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "g4d_terms_acceptances_immutable_trg" BEFORE UPDATE OR DELETE ON "g4d_terms_acceptances" FOR EACH ROW EXECUTE FUNCTION g4d_terms_acceptances_immutable();

-- Same rule as every other public table (prisma/sql/enable_rls_public.sql): RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_terms_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_terms_acceptances" ENABLE ROW LEVEL SECURITY;
