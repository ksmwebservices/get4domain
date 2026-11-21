-- Slice 5.5a (Website manager): the vendor's draft of the managed content document and the snapshot each publication was built from. Additive only: two new tables.
-- CreateTable
CREATE TABLE "g4d_site_drafts" (
    "vendorId" TEXT NOT NULL,
    "docJson" JSONB NOT NULL DEFAULT '{}',
    "rev" INTEGER NOT NULL DEFAULT 0,
    "baseVersion" INTEGER,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_site_drafts_pkey" PRIMARY KEY ("vendorId")
);
-- CreateTable
CREATE TABLE "g4d_site_snapshots" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "docJson" JSONB NOT NULL DEFAULT '{}',
    "docHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "g4d_site_snapshots_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "g4d_site_snapshots_publicationId_key" ON "g4d_site_snapshots"("publicationId");
CREATE UNIQUE INDEX "g4d_site_snapshots_vendorId_version_key" ON "g4d_site_snapshots"("vendorId", "version");
CREATE INDEX "g4d_site_snapshots_vendorId_createdAt_idx" ON "g4d_site_snapshots"("vendorId", "createdAt");
-- AddForeignKey
ALTER TABLE "g4d_site_drafts" ADD CONSTRAINT "g4d_site_drafts_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "g4d_site_snapshots" ADD CONSTRAINT "g4d_site_snapshots_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Same rule as every other public table (prisma/sql/enable_rls_public.sql): RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_site_drafts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_site_snapshots" ENABLE ROW LEVEL SECURITY;
