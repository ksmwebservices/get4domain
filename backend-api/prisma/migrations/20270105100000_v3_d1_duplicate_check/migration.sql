-- D1 duplicate check. Additive: one nullable column with an index, two new tables, one guarded trigram index. Nothing existing is changed or dropped.

-- Vendor.phoneKey: the last 10 digits of the phone, so a phone is found by an index instead of a LIKE scan. Nullable: a row whose phone is empty or shorter than 10 digits has none.
ALTER TABLE "Vendor" ADD COLUMN "phoneKey" TEXT;
CREATE INDEX "Vendor_phoneKey_idx" ON "Vendor"("phoneKey");

-- Backfill, safe on a live database: it only touches rows that have no key yet (so it can be run again and never overwrites a key the application wrote), changes no other column,
-- takes row locks only (reads are never blocked) and the table is small. The same rule as the application: digits only, at least 10 of them, the last 10.
UPDATE "Vendor"
SET "phoneKey" = RIGHT(regexp_replace("phone", '\D', '', 'g'), 10)
WHERE "phoneKey" IS NULL AND "phone" IS NOT NULL AND length(regexp_replace("phone", '\D', '', 'g')) >= 10;

-- CreateTable
CREATE TABLE "g4d_duplicate_overrides" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "staffRole" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "matchedVendorId" TEXT,
    "matchedBusinessId" TEXT,
    "matchedSignals" TEXT[],
    "newVendorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_duplicate_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_duplicate_reviews" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "matchedVendorId" TEXT,
    "matchedBusinessId" TEXT,
    "matchedSignals" TEXT[],
    "score" DOUBLE PRECISION,
    "decidedByStaffId" TEXT,
    "decisionReason" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_duplicate_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "g4d_duplicate_overrides_newVendorId_idx" ON "g4d_duplicate_overrides"("newVendorId");
CREATE INDEX "g4d_duplicate_overrides_matchedVendorId_idx" ON "g4d_duplicate_overrides"("matchedVendorId");
CREATE UNIQUE INDEX "g4d_duplicate_reviews_vendorId_key" ON "g4d_duplicate_reviews"("vendorId");
CREATE INDEX "g4d_duplicate_reviews_status_createdAt_idx" ON "g4d_duplicate_reviews"("status", "createdAt");

-- A review is PENDING, CLEARED or REJECTED, and a decision carries who and when
ALTER TABLE "g4d_duplicate_reviews" ADD CONSTRAINT "g4d_duplicate_reviews_status_check" CHECK ("status" IN ('PENDING', 'CLEARED', 'REJECTED'));

-- Name similarity for the medium signal. Guarded like the directory's own trigram index: a role that may not create the extension does not fail the migration, and the application
-- then compares names itself (same trigram rule) on the rows it narrowed by location and category.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_trgm could not be created (%), duplicate names will be compared in the application', SQLERRM;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    CREATE INDEX IF NOT EXISTS "Vendor_businessName_trgm_idx" ON "Vendor" USING GIN ("businessName" gin_trgm_ops);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'trigram index on Vendor.businessName not created (%)', SQLERRM;
END $$;

-- Same rule as every other public table (prisma/sql/enable_rls_public.sql): RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_duplicate_overrides" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_duplicate_reviews" ENABLE ROW LEVEL SECURITY;
