-- V3 slice 5.4: site settings, versioned site publications (rendered HTML snapshots), their pages, and site events. ADDITIVE ONLY: new enums, new g4d_ tables, new indexes and foreign keys.
-- No existing table, column or row is changed. Staging only until the owner approves a production release.
-- Generated offline with prisma migrate diff against the slice 5.3 schema; the RLS lines at the end follow prisma/sql/enable_rls_public.sql.

-- CreateEnum
CREATE TYPE "V3MotionIntensity" AS ENUM ('OFF', 'LOW', 'MEDIUM', 'RICH');

-- CreateEnum
CREATE TYPE "V3PublicationStatus" AS ENUM ('DRAFT_PREVIEW', 'PUBLISHED', 'SUPERSEDED', 'ROLLED_BACK');

-- CreateTable
CREATE TABLE "g4d_site_settings" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "themeId" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "variant" TEXT,
    "motionIntensity" "V3MotionIntensity" NOT NULL DEFAULT 'LOW',
    "forceNoindex" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_site_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_site_publications" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "V3PublicationStatus" NOT NULL DEFAULT 'DRAFT_PREVIEW',
    "themeId" TEXT NOT NULL,
    "themeHash" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "settingsHash" TEXT NOT NULL DEFAULT '',
    "indexable" BOOLEAN NOT NULL DEFAULT false,
    "indexHeader" TEXT NOT NULL DEFAULT 'noindex, nofollow',
    "missingFieldsJson" JSONB NOT NULL DEFAULT '[]',
    "warningsJson" JSONB NOT NULL DEFAULT '[]',
    "languages" TEXT NOT NULL DEFAULT 'en',
    "totalBytes" INTEGER NOT NULL DEFAULT 0,
    "rolledBackFromVersion" INTEGER,
    "createdByType" "V3ActorType" NOT NULL DEFAULT 'SYSTEM',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "currentVendorId" TEXT,

    CONSTRAINT "g4d_site_publications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_site_publication_pages" (
    "id" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "seoJson" JSONB NOT NULL DEFAULT '{}',
    "bytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_site_publication_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_site_events" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "publicationId" TEXT,
    "type" TEXT NOT NULL,
    "actorType" "V3ActorType" NOT NULL DEFAULT 'SYSTEM',
    "actorId" TEXT,
    "detailJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_site_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "g4d_site_settings_vendorId_key" ON "g4d_site_settings"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_site_publications_currentVendorId_key" ON "g4d_site_publications"("currentVendorId");

-- CreateIndex
CREATE INDEX "g4d_site_publications_vendorId_status_idx" ON "g4d_site_publications"("vendorId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_site_publications_vendorId_version_key" ON "g4d_site_publications"("vendorId", "version");

-- CreateIndex
CREATE INDEX "g4d_site_publication_pages_vendorId_idx" ON "g4d_site_publication_pages"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_site_publication_pages_publicationId_path_lang_key" ON "g4d_site_publication_pages"("publicationId", "path", "lang");

-- CreateIndex
CREATE INDEX "g4d_site_events_vendorId_createdAt_idx" ON "g4d_site_events"("vendorId", "createdAt");

-- AddForeignKey
ALTER TABLE "g4d_site_settings" ADD CONSTRAINT "g4d_site_settings_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_site_publications" ADD CONSTRAINT "g4d_site_publications_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_site_publication_pages" ADD CONSTRAINT "g4d_site_publication_pages_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "g4d_site_publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_site_publication_pages" ADD CONSTRAINT "g4d_site_publication_pages_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_site_events" ADD CONSTRAINT "g4d_site_events_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_site_events" ADD CONSTRAINT "g4d_site_events_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "g4d_site_publications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Same rule as every other public table (prisma/sql/enable_rls_public.sql): RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_site_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_site_publications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_site_publication_pages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_site_events" ENABLE ROW LEVEL SECURITY;
