-- TM1 M2: the theme marketplace's package table. Additive: one new table, nothing existing is changed (the Vendor model only gains a relation field, no column).
-- The legacy V2 theme store keeps its own table (g4d_theme_packages); this one is separate on purpose.

-- CreateTable
CREATE TABLE "g4d_theme_market_packages" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tier" TEXT NOT NULL DEFAULT 'Standard',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "visibility" TEXT NOT NULL DEFAULT 'PUBLIC',
    "privateVendorId" TEXT,
    "sourceVendorId" TEXT,
    "starter" BOOLEAN NOT NULL DEFAULT false,
    "licence" TEXT NOT NULL,
    "tracks" TEXT[],
    "packs" TEXT[],
    "addons" TEXT[],
    "capabilities" TEXT[],
    "tags" TEXT[],
    "catalogueCategories" TEXT[],
    "kitCategories" TEXT[],
    "manifestJson" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "fileCount" INTEGER NOT NULL,
    "bytes" BYTEA NOT NULL,
    "consentObtained" BOOLEAN,
    "consentNote" TEXT,
    "consentAt" TIMESTAMP(3),
    "consentById" TEXT,
    "reviewNote" TEXT,
    "createdByType" TEXT NOT NULL DEFAULT 'STAFF',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "publishedById" TEXT,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "g4d_theme_market_packages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "g4d_theme_market_packages_status_visibility_idx" ON "g4d_theme_market_packages"("status", "visibility");

-- CreateIndex
CREATE INDEX "g4d_theme_market_packages_privateVendorId_idx" ON "g4d_theme_market_packages"("privateVendorId");

-- CreateIndex
CREATE INDEX "g4d_theme_market_packages_packs_idx" ON "g4d_theme_market_packages" USING GIN ("packs");

-- CreateIndex
CREATE INDEX "g4d_theme_market_packages_tags_idx" ON "g4d_theme_market_packages" USING GIN ("tags");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_theme_market_packages_key_version_key" ON "g4d_theme_market_packages"("key", "version");

-- AddForeignKey
ALTER TABLE "g4d_theme_market_packages" ADD CONSTRAINT "g4d_theme_market_packages_privateVendorId_fkey" FOREIGN KEY ("privateVendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Checks (Prisma does not model them): closed sets, the private/public rule, the consent rule, sane sizes
ALTER TABLE "g4d_theme_market_packages" ADD CONSTRAINT "g4d_theme_market_packages_status_check" CHECK ("status" IN ('DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED'));
ALTER TABLE "g4d_theme_market_packages" ADD CONSTRAINT "g4d_theme_market_packages_visibility_check" CHECK ("visibility" IN ('PUBLIC', 'PRIVATE'));
ALTER TABLE "g4d_theme_market_packages" ADD CONSTRAINT "g4d_theme_market_packages_tier_check" CHECK ("tier" IN ('Standard', 'Premium'));
-- a PRIVATE theme names its one business; a PUBLIC theme names none (its source stays in sourceVendorId)
ALTER TABLE "g4d_theme_market_packages" ADD CONSTRAINT "g4d_theme_market_packages_private_check" CHECK (("visibility" = 'PRIVATE' AND "privateVendorId" IS NOT NULL) OR ("visibility" = 'PUBLIC' AND "privateVendorId" IS NULL));
-- a theme made for a customer can be PUBLISHED to the marketplace only when the admin recorded the customer's consent
ALTER TABLE "g4d_theme_market_packages" ADD CONSTRAINT "g4d_theme_market_packages_consent_check" CHECK ("status" <> 'PUBLISHED' OR "visibility" = 'PRIVATE' OR "sourceVendorId" IS NULL OR "consentObtained" IS TRUE);
ALTER TABLE "g4d_theme_market_packages" ADD CONSTRAINT "g4d_theme_market_packages_size_check" CHECK ("version" >= 1 AND "sizeBytes" > 0 AND "sizeBytes" <= 5242880 AND "fileCount" >= 1 AND "fileCount" <= 400);
ALTER TABLE "g4d_theme_market_packages" ADD CONSTRAINT "g4d_theme_market_packages_packs_check" CHECK (cardinality("packs") >= 1);
ALTER TABLE "g4d_theme_market_packages" ADD CONSTRAINT "g4d_theme_market_packages_key_check" CHECK ("key" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length("key") BETWEEN 3 AND 40);
-- the published stamp travels with the status
ALTER TABLE "g4d_theme_market_packages" ADD CONSTRAINT "g4d_theme_market_packages_published_check" CHECK ("status" NOT IN ('PUBLISHED') OR "publishedAt" IS NOT NULL);

-- Same rule as every other public table: RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_theme_market_packages" ENABLE ROW LEVEL SECURITY;
