-- Phase 3 — Coaching Centre: batch/session scheduling + student tracking

CREATE TABLE "g4d_coaching_batches" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT,
    "faculty" TEXT,
    "timing" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'Classroom',
    "startDate" TIMESTAMP(3),
    "capacity" INTEGER NOT NULL DEFAULT 30,
    "fee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'upcoming',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_coaching_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "g4d_coaching_enrollments" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "contactId" TEXT,
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
    CONSTRAINT "g4d_coaching_enrollments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "g4d_coaching_sessions" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "startTime" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_coaching_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "g4d_coaching_batches_vendorId_idx" ON "g4d_coaching_batches"("vendorId");
CREATE INDEX "g4d_coaching_enrollments_vendorId_idx" ON "g4d_coaching_enrollments"("vendorId");
CREATE INDEX "g4d_coaching_enrollments_vendorId_status_idx" ON "g4d_coaching_enrollments"("vendorId", "status");
CREATE INDEX "g4d_coaching_sessions_vendorId_idx" ON "g4d_coaching_sessions"("vendorId");
CREATE INDEX "g4d_coaching_sessions_batchId_idx" ON "g4d_coaching_sessions"("batchId");

ALTER TABLE "g4d_coaching_batches" ADD CONSTRAINT "g4d_coaching_batches_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "g4d_coaching_enrollments" ADD CONSTRAINT "g4d_coaching_enrollments_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "g4d_coaching_enrollments" ADD CONSTRAINT "g4d_coaching_enrollments_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "g4d_coaching_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "g4d_coaching_sessions" ADD CONSTRAINT "g4d_coaching_sessions_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "g4d_coaching_sessions" ADD CONSTRAINT "g4d_coaching_sessions_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "g4d_coaching_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
