-- SEO block slice 3: the daily click-out aggregate. ADDITIVE ONLY: one new table. It holds counts only: no IP, no user agent, no business id, no visitor data.
-- Platform-level and staff only. NOT applied by this commit: the owner runs migrate-deploy on staging.

-- CreateTable
CREATE TABLE "g4d_seo_click_daily" (
    "id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "pageType" TEXT NOT NULL,
    "categoryKey" TEXT NOT NULL DEFAULT '',
    "locationKey" TEXT NOT NULL DEFAULT '',
    "keywordKey" TEXT NOT NULL DEFAULT '',
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_seo_click_daily_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "g4d_seo_click_daily_key" ON "g4d_seo_click_daily"("day", "pageType", "categoryKey", "locationKey", "keywordKey");
CREATE INDEX "g4d_seo_click_daily_day_idx" ON "g4d_seo_click_daily"("day");
CREATE INDEX "g4d_seo_click_daily_keywordKey_idx" ON "g4d_seo_click_daily"("keywordKey");

-- Same rule as every other public table (prisma/sql/enable_rls_public.sql): RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_seo_click_daily" ENABLE ROW LEVEL SECURITY;
