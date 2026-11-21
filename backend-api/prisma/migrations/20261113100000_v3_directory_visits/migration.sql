-- V3 batch 3 slice 5.7b: daily Visit-site counters and the short-lived attribution reference. ADDITIVE ONLY: new g4d_ tables, indexes and foreign keys; no existing table, column or row changes.
-- The counters hold no visitor data. The reference is stored as a hash only. Staging only until the owner approves a production release.

-- CreateTable
CREATE TABLE "g4d_directory_visit_daily" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "searchCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_directory_visit_daily_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "g4d_directory_visit_refs" (
    "id" TEXT NOT NULL,
    "refHash" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "g4d_directory_visit_refs_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "g4d_directory_visit_daily_day_idx" ON "g4d_directory_visit_daily"("day");
-- CreateIndex
CREATE UNIQUE INDEX "g4d_directory_visit_daily_businessId_day_key" ON "g4d_directory_visit_daily"("businessId", "day");
-- CreateIndex
CREATE UNIQUE INDEX "g4d_directory_visit_refs_refHash_key" ON "g4d_directory_visit_refs"("refHash");
-- CreateIndex
CREATE INDEX "g4d_directory_visit_refs_expiresAt_idx" ON "g4d_directory_visit_refs"("expiresAt");
-- AddForeignKey
ALTER TABLE "g4d_directory_visit_daily" ADD CONSTRAINT "g4d_directory_visit_daily_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "g4d_directory_businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "g4d_directory_visit_refs" ADD CONSTRAINT "g4d_directory_visit_refs_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "g4d_directory_businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Same rule as every other public table (prisma/sql/enable_rls_public.sql): RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_directory_visit_daily" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_directory_visit_refs" ENABLE ROW LEVEL SECURITY;
