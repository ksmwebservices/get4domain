-- Wave 2 Part D: uploaded files. One new table (pictures and pdf documents). vendorId is NULL for a staff draft upload made before the listing or its vendor account exists.
-- Additive only. NOT applied by this commit: the owner runs migrate-deploy on staging.

-- CreateTable
CREATE TABLE "g4d_media" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT,
    "scopeKey" TEXT NOT NULL,
    "ownerKind" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "altText" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "uploadedByType" TEXT NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "g4d_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "g4d_media_key_key" ON "g4d_media"("key");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_media_scopeKey_sha256_key" ON "g4d_media"("scopeKey", "sha256");

-- CreateIndex
CREATE INDEX "g4d_media_vendorId_status_createdAt_idx" ON "g4d_media"("vendorId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "g4d_media_scopeKey_status_createdAt_idx" ON "g4d_media"("scopeKey", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "g4d_media" ADD CONSTRAINT "g4d_media_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Checks (Prisma does not model them): closed sets, sizes, and a picture always has its size
ALTER TABLE "g4d_media" ADD CONSTRAINT "g4d_media_kind_check" CHECK ("kind" IN ('IMAGE', 'DOCUMENT'));
ALTER TABLE "g4d_media" ADD CONSTRAINT "g4d_media_owner_kind_check" CHECK ("ownerKind" IN ('VENDOR_SITE', 'LISTING_DRAFT'));
ALTER TABLE "g4d_media" ADD CONSTRAINT "g4d_media_status_check" CHECK ("status" IN ('ACTIVE', 'REMOVED'));
ALTER TABLE "g4d_media" ADD CONSTRAINT "g4d_media_content_type_check" CHECK ("contentType" IN ('image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'application/pdf'));
ALTER TABLE "g4d_media" ADD CONSTRAINT "g4d_media_bytes_check" CHECK ("bytes" > 0);
ALTER TABLE "g4d_media" ADD CONSTRAINT "g4d_media_image_size_check" CHECK ("kind" <> 'IMAGE' OR "contentType" = 'image/svg+xml' OR ("width" IS NOT NULL AND "height" IS NOT NULL AND "width" > 0 AND "height" > 0));
ALTER TABLE "g4d_media" ADD CONSTRAINT "g4d_media_scope_check" CHECK (("ownerKind" = 'VENDOR_SITE' AND "vendorId" IS NOT NULL) OR ("ownerKind" = 'LISTING_DRAFT' AND "vendorId" IS NULL));

-- Same rule as every other public table: RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_media" ENABLE ROW LEVEL SECURITY;
