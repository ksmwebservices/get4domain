-- Slice 5.24a (Batch 13): jobs and quotes (Handyman). Additive only: new tables, no existing object is touched.
CREATE TABLE "g4d_jobs" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "customerId" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "scheduledAt" TIMESTAMP(3),
    "assignedTo" TEXT,
    "requestId" TEXT,
    "quoteId" TEXT,
    "totalPaise" INTEGER,
    "payRequestId" TEXT,
    "paidAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_jobs_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "g4d_job_quotes" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "jobId" TEXT,
    "title" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "validUntil" TEXT,
    "linesJson" JSONB NOT NULL DEFAULT '[]',
    "taxablePaise" INTEGER NOT NULL DEFAULT 0,
    "taxPaise" INTEGER NOT NULL DEFAULT 0,
    "totalPaise" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_job_quotes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "g4d_jobs_vendorId_number_key" ON "g4d_jobs"("vendorId", "number");
CREATE INDEX "g4d_jobs_vendorId_status_createdAt_idx" ON "g4d_jobs"("vendorId", "status", "createdAt");
CREATE INDEX "g4d_jobs_vendorId_scheduledAt_idx" ON "g4d_jobs"("vendorId", "scheduledAt");
CREATE UNIQUE INDEX "g4d_job_quotes_vendorId_number_key" ON "g4d_job_quotes"("vendorId", "number");
CREATE INDEX "g4d_job_quotes_vendorId_status_createdAt_idx" ON "g4d_job_quotes"("vendorId", "status", "createdAt");
CREATE INDEX "g4d_job_quotes_vendorId_jobId_idx" ON "g4d_job_quotes"("vendorId", "jobId");

ALTER TABLE "g4d_jobs" ADD CONSTRAINT "g4d_jobs_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "g4d_job_quotes" ADD CONSTRAINT "g4d_job_quotes_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Same rule as every other public table: RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_job_quotes" ENABLE ROW LEVEL SECURITY;
