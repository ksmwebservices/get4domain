-- Phase 3 — Logistics & Transport: shipment tracking

CREATE TABLE "g4d_shipments" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "trackingNo" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "contactId" TEXT,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'Road',
    "weight" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'booked',
    "freightAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pickupDate" TIMESTAMP(3),
    "eta" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "assignedVehicle" TEXT,
    "assignedDriver" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_shipments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "g4d_shipments_vendorId_idx" ON "g4d_shipments"("vendorId");
CREATE INDEX "g4d_shipments_vendorId_status_idx" ON "g4d_shipments"("vendorId", "status");

ALTER TABLE "g4d_shipments" ADD CONSTRAINT "g4d_shipments_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
