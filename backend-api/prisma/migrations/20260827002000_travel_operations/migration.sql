-- Phase 1 (Travel Operations): dedicated Vehicle / Driver / Trip / VisaApplication
-- models, vendorId-scoped. Additive; no existing data touched. Bookings stay on
-- the shared g4d_records table (untouched).

-- CreateTable
CREATE TABLE "g4d_vehicles" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'sedan',
    "regNumber" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 4,
    "status" TEXT NOT NULL DEFAULT 'available',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_drivers" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "licenseNo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'available',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_trips" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "contactId" TEXT,
    "title" TEXT NOT NULL,
    "destination" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "pax" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'planning',
    "packageCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sellPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "itinerary" JSONB,
    "vehicleId" TEXT,
    "driverId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_visa_applications" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "tripId" TEXT,
    "travelerName" TEXT NOT NULL,
    "passportNo" TEXT,
    "country" TEXT NOT NULL,
    "visaType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'applied',
    "appliedDate" TIMESTAMP(3),
    "decisionDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_visa_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "g4d_vehicles_vendorId_idx" ON "g4d_vehicles"("vendorId");
CREATE INDEX "g4d_drivers_vendorId_idx" ON "g4d_drivers"("vendorId");
CREATE INDEX "g4d_trips_vendorId_idx" ON "g4d_trips"("vendorId");
CREATE INDEX "g4d_trips_vendorId_status_idx" ON "g4d_trips"("vendorId", "status");
CREATE INDEX "g4d_visa_applications_vendorId_idx" ON "g4d_visa_applications"("vendorId");
CREATE INDEX "g4d_visa_applications_vendorId_status_idx" ON "g4d_visa_applications"("vendorId", "status");

-- AddForeignKey
ALTER TABLE "g4d_vehicles" ADD CONSTRAINT "g4d_vehicles_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "g4d_drivers" ADD CONSTRAINT "g4d_drivers_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "g4d_trips" ADD CONSTRAINT "g4d_trips_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "g4d_trips" ADD CONSTRAINT "g4d_trips_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "g4d_vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "g4d_trips" ADD CONSTRAINT "g4d_trips_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "g4d_drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "g4d_visa_applications" ADD CONSTRAINT "g4d_visa_applications_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "g4d_visa_applications" ADD CONSTRAINT "g4d_visa_applications_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "g4d_trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;
