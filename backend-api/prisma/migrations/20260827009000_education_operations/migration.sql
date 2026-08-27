-- Phase 2 (Education): dedicated Batch (scheduling) + StudentEnrollment
-- (enrollment + fee tracking) models. Additive; no data touched.

-- CreateTable
CREATE TABLE "g4d_batches" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "courseName" TEXT,
    "faculty" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'Classroom',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "schedule" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 30,
    "fee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'upcoming',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_enrollments" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "contactId" TEXT,
    "studentName" TEXT NOT NULL,
    "studentPhone" TEXT,
    "guardianContact" TEXT,
    "batchId" TEXT,
    "enrollDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "feeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "feePaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'enrolled',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "g4d_batches_vendorId_idx" ON "g4d_batches"("vendorId");
CREATE INDEX "g4d_enrollments_vendorId_idx" ON "g4d_enrollments"("vendorId");
CREATE INDEX "g4d_enrollments_vendorId_status_idx" ON "g4d_enrollments"("vendorId", "status");

-- AddForeignKey
ALTER TABLE "g4d_batches" ADD CONSTRAINT "g4d_batches_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "g4d_enrollments" ADD CONSTRAINT "g4d_enrollments_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "g4d_enrollments" ADD CONSTRAINT "g4d_enrollments_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "g4d_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
