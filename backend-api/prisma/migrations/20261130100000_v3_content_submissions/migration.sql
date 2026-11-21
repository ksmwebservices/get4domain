-- Slice 5.5c (Website manager, amendment 06): Free edits go to review. Additive only: one new enum and one new table.
-- CreateEnum
CREATE TYPE "V3SubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');
-- CreateTable
CREATE TABLE "g4d_content_submissions" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'SITE_CONTENT',
    "payloadJson" JSONB NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "changedJson" JSONB NOT NULL DEFAULT '{}',
    "status" "V3SubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "submittedById" TEXT,
    "reviewerId" TEXT,
    "reason" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "openVendorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_content_submissions_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "g4d_content_submissions_openVendorId_key" ON "g4d_content_submissions"("openVendorId");
CREATE INDEX "g4d_content_submissions_vendorId_createdAt_idx" ON "g4d_content_submissions"("vendorId", "createdAt");
CREATE INDEX "g4d_content_submissions_status_submittedAt_idx" ON "g4d_content_submissions"("status", "submittedAt");
-- AddForeignKey
ALTER TABLE "g4d_content_submissions" ADD CONSTRAINT "g4d_content_submissions_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Same rule as every other public table (prisma/sql/enable_rls_public.sql): RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_content_submissions" ENABLE ROW LEVEL SECURITY;
