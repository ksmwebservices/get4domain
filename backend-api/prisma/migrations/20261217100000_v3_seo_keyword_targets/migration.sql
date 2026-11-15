-- SEO block slice 5: keyword targets and the daily UTM aggregate. ADDITIVE ONLY: two new tables. Neither holds visitor data (no IP, no user agent, no referrer, no business id).
-- Platform-level and staff only. NOT applied by this commit: the owner runs migrate-deploy on staging.

-- CreateTable
CREATE TABLE "g4d_seo_keyword_targets" (
    "id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "pageType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "priority" INTEGER NOT NULL DEFAULT 2,
    "titleOverride" TEXT,
    "descriptionOverride" TEXT,
    "h1Override" TEXT,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'STAFF',
    "createdByStaffId" TEXT,
    "updatedByStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_seo_keyword_targets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "g4d_seo_keyword_targets_status_check" CHECK ("status" IN ('PLANNED', 'ACTIVE', 'PAUSED')),
    CONSTRAINT "g4d_seo_keyword_targets_priority_check" CHECK ("priority" BETWEEN 1 AND 3)
);
CREATE UNIQUE INDEX "g4d_seo_keyword_targets_key" ON "g4d_seo_keyword_targets"("keyword", "path");
CREATE INDEX "g4d_seo_keyword_targets_path_status_idx" ON "g4d_seo_keyword_targets"("path", "status");
CREATE INDEX "g4d_seo_keyword_targets_status_idx" ON "g4d_seo_keyword_targets"("status");

CREATE TABLE "g4d_seo_utm_daily" (
    "id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "pageType" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT '',
    "medium" TEXT NOT NULL DEFAULT '',
    "campaign" TEXT NOT NULL DEFAULT '',
    "keywordKey" TEXT NOT NULL DEFAULT '',
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_seo_utm_daily_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "g4d_seo_utm_daily_key" ON "g4d_seo_utm_daily"("day", "pageType", "source", "medium", "campaign", "keywordKey");
CREATE INDEX "g4d_seo_utm_daily_day_idx" ON "g4d_seo_utm_daily"("day");
CREATE INDEX "g4d_seo_utm_daily_keywordKey_idx" ON "g4d_seo_utm_daily"("keywordKey");

-- Same rule as every other public table (prisma/sql/enable_rls_public.sql): RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_seo_keyword_targets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_seo_utm_daily" ENABLE ROW LEVEL SECURITY;
