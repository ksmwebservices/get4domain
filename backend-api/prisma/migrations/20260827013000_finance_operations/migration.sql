-- Phase 3 — Finance & Consulting: case tracking + per-type document checklist

CREATE TABLE "g4d_finance_cases" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "contactId" TEXT,
    "caseType" TEXT NOT NULL DEFAULT 'ITR',
    "status" TEXT NOT NULL DEFAULT 'open',
    "feeValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "filingDeadline" TIMESTAMP(3),
    "assignedTo" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_finance_cases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "g4d_finance_case_docs" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "receivedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_finance_case_docs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "g4d_finance_cases_vendorId_idx" ON "g4d_finance_cases"("vendorId");
CREATE INDEX "g4d_finance_cases_vendorId_status_idx" ON "g4d_finance_cases"("vendorId", "status");
CREATE INDEX "g4d_finance_case_docs_vendorId_idx" ON "g4d_finance_case_docs"("vendorId");
CREATE INDEX "g4d_finance_case_docs_caseId_idx" ON "g4d_finance_case_docs"("caseId");

ALTER TABLE "g4d_finance_cases" ADD CONSTRAINT "g4d_finance_cases_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "g4d_finance_case_docs" ADD CONSTRAINT "g4d_finance_case_docs_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "g4d_finance_case_docs" ADD CONSTRAINT "g4d_finance_case_docs_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "g4d_finance_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
