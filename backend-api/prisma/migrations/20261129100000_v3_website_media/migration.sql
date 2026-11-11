-- Slice 5.5b (Website manager): the media library and the Banner Library. Additive only: two new tables.
-- CreateTable
CREATE TABLE "g4d_site_pictures" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "altText" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "uploadedByType" "V3ActorType" NOT NULL DEFAULT 'SYSTEM',
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "g4d_site_pictures_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "g4d_banner_images" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "altText" TEXT NOT NULL,
    "hasPeople" BOOLEAN NOT NULL DEFAULT false,
    "sourceUrl" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "licenceName" TEXT NOT NULL,
    "obtainedOn" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_banner_images_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "g4d_site_pictures_vendorId_sha256_key" ON "g4d_site_pictures"("vendorId", "sha256");
CREATE INDEX "g4d_site_pictures_vendorId_createdAt_idx" ON "g4d_site_pictures"("vendorId", "createdAt");
CREATE UNIQUE INDEX "g4d_banner_images_categoryId_sha256_key" ON "g4d_banner_images"("categoryId", "sha256");
CREATE INDEX "g4d_banner_images_categoryId_active_idx" ON "g4d_banner_images"("categoryId", "active");
-- AddForeignKey
ALTER TABLE "g4d_site_pictures" ADD CONSTRAINT "g4d_site_pictures_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Same rule as every other public table (prisma/sql/enable_rls_public.sql): RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_site_pictures" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_banner_images" ENABLE ROW LEVEL SECURITY;
