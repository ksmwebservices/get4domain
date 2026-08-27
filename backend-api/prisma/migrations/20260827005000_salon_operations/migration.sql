-- Phase 2 (Salon): dedicated Stylist / SalonChair / SalonAppointment models for
-- real service-chair scheduling + stylist assignment. Additive; no data touched.

-- CreateTable
CREATE TABLE "g4d_stylists" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "specialty" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_stylists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_salon_chairs" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'available',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_salon_chairs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_salon_appointments" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "contactId" TEXT,
    "clientName" TEXT NOT NULL,
    "clientPhone" TEXT,
    "serviceName" TEXT NOT NULL,
    "stylistId" TEXT,
    "chairId" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 45,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_salon_appointments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "g4d_stylists_vendorId_idx" ON "g4d_stylists"("vendorId");
CREATE INDEX "g4d_salon_chairs_vendorId_idx" ON "g4d_salon_chairs"("vendorId");
CREATE INDEX "g4d_salon_appointments_vendorId_idx" ON "g4d_salon_appointments"("vendorId");
CREATE INDEX "g4d_salon_appointments_vendorId_startAt_idx" ON "g4d_salon_appointments"("vendorId", "startAt");

-- AddForeignKey
ALTER TABLE "g4d_stylists" ADD CONSTRAINT "g4d_stylists_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "g4d_salon_chairs" ADD CONSTRAINT "g4d_salon_chairs_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "g4d_salon_appointments" ADD CONSTRAINT "g4d_salon_appointments_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "g4d_salon_appointments" ADD CONSTRAINT "g4d_salon_appointments_stylistId_fkey" FOREIGN KEY ("stylistId") REFERENCES "g4d_stylists"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "g4d_salon_appointments" ADD CONSTRAINT "g4d_salon_appointments_chairId_fkey" FOREIGN KEY ("chairId") REFERENCES "g4d_salon_chairs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
