-- Slice B2 (Website manager, amendment 08): the location of the live site, for staff. Additive only: one new table.
-- CreateTable
CREATE TABLE "g4d_site_locations" (
    "vendorId" TEXT NOT NULL,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "mapLinkInput" TEXT,
    "directionsUrl" TEXT,
    "version" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_site_locations_pkey" PRIMARY KEY ("vendorId")
);
-- AddForeignKey
ALTER TABLE "g4d_site_locations" ADD CONSTRAINT "g4d_site_locations_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Same rule as every other public table (prisma/sql/enable_rls_public.sql): RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_site_locations" ENABLE ROW LEVEL SECURITY;
