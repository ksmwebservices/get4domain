-- Phase 2 (Real Estate): dedicated Listing / Deal (pipeline) / PropertyVisit
-- models. Additive; no data touched.

-- CreateTable
CREATE TABLE "g4d_listings" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "propertyType" TEXT NOT NULL DEFAULT 'Apartment',
    "location" TEXT,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "areaSqft" DOUBLE PRECISION,
    "bhk" TEXT,
    "status" TEXT NOT NULL DEFAULT 'available',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_deals" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "contactId" TEXT,
    "clientName" TEXT NOT NULL,
    "clientPhone" TEXT,
    "listingId" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'new',
    "value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "agent" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_property_visits" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "contactId" TEXT,
    "clientName" TEXT NOT NULL,
    "clientPhone" TEXT,
    "listingId" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "agent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_property_visits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "g4d_listings_vendorId_idx" ON "g4d_listings"("vendorId");
CREATE INDEX "g4d_deals_vendorId_idx" ON "g4d_deals"("vendorId");
CREATE INDEX "g4d_deals_vendorId_stage_idx" ON "g4d_deals"("vendorId", "stage");
CREATE INDEX "g4d_property_visits_vendorId_idx" ON "g4d_property_visits"("vendorId");
CREATE INDEX "g4d_property_visits_vendorId_scheduledAt_idx" ON "g4d_property_visits"("vendorId", "scheduledAt");

-- AddForeignKey
ALTER TABLE "g4d_listings" ADD CONSTRAINT "g4d_listings_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "g4d_deals" ADD CONSTRAINT "g4d_deals_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "g4d_deals" ADD CONSTRAINT "g4d_deals_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "g4d_listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "g4d_property_visits" ADD CONSTRAINT "g4d_property_visits_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "g4d_property_visits" ADD CONSTRAINT "g4d_property_visits_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "g4d_listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
