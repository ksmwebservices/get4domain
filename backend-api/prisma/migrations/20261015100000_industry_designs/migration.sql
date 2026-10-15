-- Industry designs (15 Oct 2026): starter content, the chosen design and the site status live on the vendor's one site row.
-- Additive only: two nullable columns and one column with a default on "VendorCMS". No existing row is touched or rewritten; every existing site stays LIVE.

-- AlterTable
ALTER TABLE "VendorCMS" ADD COLUMN     "extras" JSONB,
ADD COLUMN     "designKey" TEXT,
ADD COLUMN     "siteStatus" TEXT NOT NULL DEFAULT 'LIVE';
