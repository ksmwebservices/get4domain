-- Slice B3 (Website manager, amendment 08): the Google review link of the live site, for staff. Additive only: one new table.
-- CreateTable
CREATE TABLE "g4d_review_links" (
    "vendorId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_review_links_pkey" PRIMARY KEY ("vendorId")
);
-- AddForeignKey
ALTER TABLE "g4d_review_links" ADD CONSTRAINT "g4d_review_links_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Same rule as every other public table (prisma/sql/enable_rls_public.sql): RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_review_links" ENABLE ROW LEVEL SECURITY;
