-- LeadSpace page funnel top and creation guard (Dispatch B phase 2, 2026-10-10). ADDITIVE ONLY: one new table and one new nullable column on a table created in 20261010100000_leadspace.
-- Rollback (only if nothing has been written to them): DROP TABLE "g4d_leadspace_daily_stats"; ALTER TABLE "g4d_leadspace_profiles" DROP COLUMN "createdIpHash". Re-run prisma/sql/enable_rls_public.sql after applying.

-- AlterTable
ALTER TABLE "g4d_leadspace_profiles" ADD COLUMN     "createdIpHash" TEXT;

-- CreateTable
CREATE TABLE "g4d_leadspace_daily_stats" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "ctaClicks" INTEGER NOT NULL DEFAULT 0,
    "formStarts" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "g4d_leadspace_daily_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "g4d_leadspace_daily_stats_vendorId_day_idx" ON "g4d_leadspace_daily_stats"("vendorId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_leadspace_daily_stats_profileId_day_key" ON "g4d_leadspace_daily_stats"("profileId", "day");

