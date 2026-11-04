-- V3 slice 5.7: public directory, claim by phone OTP, removal links, account setup grants. ADDITIVE ONLY: new enums, new g4d_ tables, new indexes and foreign keys, and one new value on the
-- V3StepKey enum (the optional CREATE_DIRECTORY_PROFILE provisioning step). No existing table, column or row is changed. Staging only until the owner approves a production release.
-- Generated offline with prisma migrate diff against the slice 5.6 schema, then two hand edits: the search vector is a database-generated column, and the trigram search below.
-- SEARCH: full text (to_tsvector 'simple' + GIN) always works. Trigram similarity needs the pg_trgm extension; it is created inside a guarded block, so a role without permission does NOT fail
-- the migration: the application checks pg_extension at run time and uses full text only when pg_trgm is missing.
-- DRIFT NOTE: the trigram index below is not declared in schema.prisma (Prisma cannot express it without a preview feature), so "db:staging:drift" may list it as an extra index. That is expected.

-- CreateEnum
CREATE TYPE "V3DirectoryLocationKind" AS ENUM ('STATE', 'DISTRICT', 'CITY');

-- CreateEnum
CREATE TYPE "V3DirectoryBusinessStatus" AS ENUM ('DRAFT', 'UNCLAIMED', 'CLAIMED', 'SUSPENDED', 'REMOVED');

-- CreateEnum
CREATE TYPE "V3DirectoryPlacementKind" AS ENUM ('SPONSORED');

-- CreateEnum
CREATE TYPE "V3OtpChannel" AS ENUM ('SMS');

-- CreateEnum
CREATE TYPE "V3OtpStatus" AS ENUM ('PENDING', 'VERIFIED', 'EXPIRED', 'LOCKED', 'REVOKED');

-- CreateEnum
CREATE TYPE "V3DirectoryRemovalStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'EXECUTED');

-- CreateEnum
CREATE TYPE "V3GrantStatus" AS ENUM ('ACTIVE', 'USED', 'EXPIRED', 'REVOKED');

-- AlterEnum
ALTER TYPE "V3StepKey" ADD VALUE 'CREATE_DIRECTORY_PROFILE';

-- CreateTable
CREATE TABLE "g4d_directory_locations" (
    "id" TEXT NOT NULL,
    "parentId" TEXT,
    "parentKey" TEXT NOT NULL,
    "kind" "V3DirectoryLocationKind" NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "proposed" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_directory_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_directory_categories" (
    "id" TEXT NOT NULL,
    "parentId" TEXT,
    "parentKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "themeCategoryId" TEXT,
    "family" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "proposed" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_directory_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_directory_businesses" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "locationId" TEXT,
    "addressJson" JSONB NOT NULL DEFAULT '{}',
    "phoneE164" TEXT,
    "emailMasked" TEXT,
    "hoursJson" JSONB NOT NULL DEFAULT '{}',
    "geoJson" JSONB,
    "descriptionText" TEXT NOT NULL DEFAULT '',
    "status" "V3DirectoryBusinessStatus" NOT NULL DEFAULT 'DRAFT',
    "indexable" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'STAFF',
    "claimedAt" TIMESTAMP(3),
    "removedAt" TIMESTAMP(3),
    "searchVector" tsvector GENERATED ALWAYS AS (to_tsvector('simple', coalesce("name", '') || ' ' || coalesce("descriptionText", ''))) STORED,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_directory_businesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_directory_business_services" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_directory_business_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_directory_business_media" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'IMAGE',
    "altText" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_directory_business_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_directory_placements" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "kind" "V3DirectoryPlacementKind" NOT NULL DEFAULT 'SPONSORED',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "label" TEXT NOT NULL,
    "createdByStaffId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_directory_placements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_otp_challenges" (
    "id" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "channel" "V3OtpChannel" NOT NULL DEFAULT 'SMS',
    "phoneHash" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "salt" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "requestIpHash" TEXT,
    "status" "V3OtpStatus" NOT NULL DEFAULT 'PENDING',
    "sandboxBody" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_directory_removal_requests" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "V3DirectoryRemovalStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT,
    "requesterContactMasked" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "handledByStaffId" TEXT,
    "handledAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_directory_removal_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_directory_claim_overrides" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "phoneE164" TEXT NOT NULL,
    "phoneHash" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "approvedByStaffId" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_directory_claim_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_account_setup_grants" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "V3GrantStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_account_setup_grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "g4d_directory_locations_parentId_idx" ON "g4d_directory_locations"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_directory_locations_parentKey_slug_key" ON "g4d_directory_locations"("parentKey", "slug");

-- CreateIndex
CREATE INDEX "g4d_directory_categories_parentId_idx" ON "g4d_directory_categories"("parentId");

-- CreateIndex
CREATE INDEX "g4d_directory_categories_themeCategoryId_idx" ON "g4d_directory_categories"("themeCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_directory_categories_parentKey_slug_key" ON "g4d_directory_categories"("parentKey", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_directory_businesses_vendorId_key" ON "g4d_directory_businesses"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_directory_businesses_slug_key" ON "g4d_directory_businesses"("slug");

-- CreateIndex
CREATE INDEX "g4d_directory_businesses_status_indexable_idx" ON "g4d_directory_businesses"("status", "indexable");

-- CreateIndex
CREATE INDEX "g4d_directory_businesses_categoryId_idx" ON "g4d_directory_businesses"("categoryId");

-- CreateIndex
CREATE INDEX "g4d_directory_businesses_locationId_idx" ON "g4d_directory_businesses"("locationId");

-- CreateIndex
CREATE INDEX "g4d_directory_businesses_searchVector_idx" ON "g4d_directory_businesses" USING GIN ("searchVector");

-- CreateIndex
CREATE INDEX "g4d_directory_business_services_businessId_idx" ON "g4d_directory_business_services"("businessId");

-- CreateIndex
CREATE INDEX "g4d_directory_business_media_businessId_idx" ON "g4d_directory_business_media"("businessId");

-- CreateIndex
CREATE INDEX "g4d_directory_placements_businessId_idx" ON "g4d_directory_placements"("businessId");

-- CreateIndex
CREATE INDEX "g4d_directory_placements_startsAt_endsAt_idx" ON "g4d_directory_placements"("startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "g4d_otp_challenges_phoneHash_createdAt_idx" ON "g4d_otp_challenges"("phoneHash", "createdAt");

-- CreateIndex
CREATE INDEX "g4d_otp_challenges_subjectType_subjectId_createdAt_idx" ON "g4d_otp_challenges"("subjectType", "subjectId", "createdAt");

-- CreateIndex
CREATE INDEX "g4d_otp_challenges_requestIpHash_createdAt_idx" ON "g4d_otp_challenges"("requestIpHash", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_directory_removal_requests_tokenHash_key" ON "g4d_directory_removal_requests"("tokenHash");

-- CreateIndex
CREATE INDEX "g4d_directory_removal_requests_businessId_status_idx" ON "g4d_directory_removal_requests"("businessId", "status");

-- CreateIndex
CREATE INDEX "g4d_directory_claim_overrides_businessId_idx" ON "g4d_directory_claim_overrides"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_account_setup_grants_tokenHash_key" ON "g4d_account_setup_grants"("tokenHash");

-- CreateIndex
CREATE INDEX "g4d_account_setup_grants_vendorId_idx" ON "g4d_account_setup_grants"("vendorId");

-- AddForeignKey
ALTER TABLE "g4d_directory_locations" ADD CONSTRAINT "g4d_directory_locations_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "g4d_directory_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_directory_categories" ADD CONSTRAINT "g4d_directory_categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "g4d_directory_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_directory_businesses" ADD CONSTRAINT "g4d_directory_businesses_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_directory_businesses" ADD CONSTRAINT "g4d_directory_businesses_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "g4d_directory_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_directory_businesses" ADD CONSTRAINT "g4d_directory_businesses_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "g4d_directory_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_directory_business_services" ADD CONSTRAINT "g4d_directory_business_services_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "g4d_directory_businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_directory_business_media" ADD CONSTRAINT "g4d_directory_business_media_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "g4d_directory_businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_directory_placements" ADD CONSTRAINT "g4d_directory_placements_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "g4d_directory_businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_directory_removal_requests" ADD CONSTRAINT "g4d_directory_removal_requests_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "g4d_directory_businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_directory_claim_overrides" ADD CONSTRAINT "g4d_directory_claim_overrides_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "g4d_directory_businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_account_setup_grants" ADD CONSTRAINT "g4d_account_setup_grants_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_trgm could not be created (%), directory search will use full text only', SQLERRM;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    CREATE INDEX IF NOT EXISTS "g4d_directory_businesses_name_trgm_idx" ON "g4d_directory_businesses" USING GIN ("name" gin_trgm_ops);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'trigram index not created (%)', SQLERRM;
END $$;

-- Same rule as every other public table (prisma/sql/enable_rls_public.sql): RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_directory_locations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_directory_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_directory_businesses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_directory_business_services" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_directory_business_media" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_directory_placements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_otp_challenges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_directory_removal_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_directory_claim_overrides" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_account_setup_grants" ENABLE ROW LEVEL SECURITY;
