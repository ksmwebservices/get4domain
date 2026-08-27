-- Phase 3 — Automobile Service: service-job + parts/labor, parts inventory

CREATE TABLE "g4d_service_jobs" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "vehicleNumber" TEXT NOT NULL,
    "vehicleModel" TEXT,
    "customerName" TEXT NOT NULL,
    "contactId" TEXT,
    "jobType" TEXT NOT NULL DEFAULT 'General Service',
    "status" TEXT NOT NULL DEFAULT 'received',
    "odometer" INTEGER,
    "complaint" TEXT,
    "estimateAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "receivedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "promisedDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_service_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "g4d_job_lines" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'labor',
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_job_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "g4d_part_stock" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "partNumber" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reorderLevel" INTEGER NOT NULL DEFAULT 5,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_part_stock_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "g4d_service_jobs_vendorId_idx" ON "g4d_service_jobs"("vendorId");
CREATE INDEX "g4d_service_jobs_vendorId_status_idx" ON "g4d_service_jobs"("vendorId", "status");
CREATE INDEX "g4d_job_lines_vendorId_idx" ON "g4d_job_lines"("vendorId");
CREATE INDEX "g4d_job_lines_jobId_idx" ON "g4d_job_lines"("jobId");
CREATE INDEX "g4d_part_stock_vendorId_idx" ON "g4d_part_stock"("vendorId");

ALTER TABLE "g4d_service_jobs" ADD CONSTRAINT "g4d_service_jobs_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "g4d_job_lines" ADD CONSTRAINT "g4d_job_lines_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "g4d_job_lines" ADD CONSTRAINT "g4d_job_lines_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "g4d_service_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "g4d_part_stock" ADD CONSTRAINT "g4d_part_stock_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
