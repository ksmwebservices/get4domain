-- SEO block slice 1: a locality level in the place tree, a pincode on directory businesses, and the keyword set per category. ADDITIVE ONLY: one enum value, one nullable column, one new table.
-- The pincode backfill fills only the new NULL column from the pin already stored in addressJson (six digits, first digit 1-9); no existing column or row is changed otherwise.
-- NOT applied by this commit: the owner runs migrate-deploy on staging.

-- AlterEnum
ALTER TYPE "V3DirectoryLocationKind" ADD VALUE IF NOT EXISTS 'LOCALITY';

-- AlterTable
ALTER TABLE "g4d_directory_businesses" ADD COLUMN "pincode" TEXT;
CREATE INDEX "g4d_directory_businesses_pincode_idx" ON "g4d_directory_businesses"("pincode");
UPDATE "g4d_directory_businesses" SET "pincode" = "addressJson"->>'pin' WHERE "pincode" IS NULL AND "addressJson"->>'pin' ~ '^[1-9][0-9]{5}$';

-- CreateTable: platform-level, staff only
CREATE TABLE "g4d_seo_category_keywords" (
    "id" TEXT NOT NULL,
    "categorySlug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "singular" TEXT NOT NULL,
    "plural" TEXT NOT NULL,
    "synonyms" JSONB NOT NULL DEFAULT '[]',
    "specialisations" JSONB NOT NULL DEFAULT '[]',
    "source" TEXT NOT NULL DEFAULT 'DERIVED',
    "updatedByStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_seo_category_keywords_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "g4d_seo_category_keywords_categorySlug_key" ON "g4d_seo_category_keywords"("categorySlug");

-- Same rule as every other public table (prisma/sql/enable_rls_public.sql): RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_seo_category_keywords" ENABLE ROW LEVEL SECURITY;
