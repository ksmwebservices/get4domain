-- SEO block (prompt 8d): monthly search volume and competition on a keyword target, filled only from a Keyword Planner CSV the owner exports (never scraped, never invented).
-- ADDITIVE ONLY: two nullable columns and one index on a platform-level, staff-only table. NOT applied by this commit: the owner runs migrate-deploy on staging.

-- AlterTable
ALTER TABLE "g4d_seo_keyword_targets" ADD COLUMN "volume" INTEGER,
ADD COLUMN "competition" TEXT;

-- Checks (Prisma does not model them): a volume is never negative; competition is the three words Keyword Planner uses
ALTER TABLE "g4d_seo_keyword_targets" ADD CONSTRAINT "g4d_seo_keyword_targets_volume_check" CHECK ("volume" IS NULL OR "volume" >= 0);
ALTER TABLE "g4d_seo_keyword_targets" ADD CONSTRAINT "g4d_seo_keyword_targets_competition_check" CHECK ("competition" IS NULL OR "competition" IN ('LOW', 'MEDIUM', 'HIGH'));

-- CreateIndex
CREATE INDEX "g4d_seo_keyword_targets_volume_idx" ON "g4d_seo_keyword_targets"("volume");
