-- V3 batch 3 slice 5.1d: the vendor-requested account deletion queue and the do-not-contact / removal register. ADDITIVE ONLY: one new enum, two new g4d_ tables, indexes, one foreign key.
-- No existing table, column or row is changed. Staging only until the owner approves a production release.
-- Generated offline with prisma migrate diff against the previous schema; the RLS lines at the end follow prisma/sql/enable_rls_public.sql.

-- CreateEnum
CREATE TYPE "V3DeletionRequestStatus" AS ENUM ('PENDING', 'EXECUTED', 'CANCELLED');
-- CreateTable
CREATE TABLE "g4d_account_deletion_requests" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "status" "V3DeletionRequestStatus" NOT NULL DEFAULT 'PENDING',
    "pendingVendorId" TEXT,
    "requestedById" TEXT,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "executedAt" TIMESTAMP(3),
    "executedById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_account_deletion_requests_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "g4d_dnc_register" (
    "id" TEXT NOT NULL,
    "phoneHash" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'REMOVAL',
    "addedBy" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "g4d_dnc_register_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "g4d_account_deletion_requests_pendingVendorId_key" ON "g4d_account_deletion_requests"("pendingVendorId");
-- CreateIndex
CREATE INDEX "g4d_account_deletion_requests_status_createdAt_idx" ON "g4d_account_deletion_requests"("status", "createdAt");
-- CreateIndex
CREATE INDEX "g4d_account_deletion_requests_vendorId_idx" ON "g4d_account_deletion_requests"("vendorId");
-- CreateIndex
CREATE UNIQUE INDEX "g4d_dnc_register_phoneHash_key" ON "g4d_dnc_register"("phoneHash");
-- AddForeignKey
ALTER TABLE "g4d_account_deletion_requests" ADD CONSTRAINT "g4d_account_deletion_requests_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Same rule as every other public table (prisma/sql/enable_rls_public.sql): RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_account_deletion_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_dnc_register" ENABLE ROW LEVEL SECURITY;
