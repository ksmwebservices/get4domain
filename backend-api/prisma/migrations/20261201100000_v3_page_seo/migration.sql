-- Slice B1 (Website manager, amendment 08): per-page SEO of the live site, for staff reports. Additive only: one new table.
-- CreateTable
CREATE TABLE "g4d_page_seo" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "pageKey" TEXT NOT NULL,
    "seoTitle" TEXT NOT NULL,
    "seoDescription" TEXT NOT NULL,
    "shareImageRef" TEXT,
    "customTitle" BOOLEAN NOT NULL DEFAULT false,
    "customDescription" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_page_seo_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "g4d_page_seo_vendorId_pageKey_key" ON "g4d_page_seo"("vendorId", "pageKey");
CREATE INDEX "g4d_page_seo_vendorId_version_idx" ON "g4d_page_seo"("vendorId", "version");
-- AddForeignKey
ALTER TABLE "g4d_page_seo" ADD CONSTRAINT "g4d_page_seo_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Same rule as every other public table (prisma/sql/enable_rls_public.sql): RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_page_seo" ENABLE ROW LEVEL SECURITY;
