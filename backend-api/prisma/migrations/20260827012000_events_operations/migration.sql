-- Phase 3 — Events & Wedding: booking + vendor coordination

CREATE TABLE "g4d_event_bookings" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "contactId" TEXT,
    "eventType" TEXT NOT NULL DEFAULT 'Wedding',
    "eventDate" TIMESTAMP(3),
    "venue" TEXT,
    "guestCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'enquiry',
    "packageValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "advancePaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_event_bookings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "g4d_event_vendors" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "service" TEXT NOT NULL DEFAULT 'Catering',
    "contactPhone" TEXT,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_event_vendors_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "g4d_event_bookings_vendorId_idx" ON "g4d_event_bookings"("vendorId");
CREATE INDEX "g4d_event_bookings_vendorId_status_idx" ON "g4d_event_bookings"("vendorId", "status");
CREATE INDEX "g4d_event_vendors_vendorId_idx" ON "g4d_event_vendors"("vendorId");
CREATE INDEX "g4d_event_vendors_bookingId_idx" ON "g4d_event_vendors"("bookingId");

ALTER TABLE "g4d_event_bookings" ADD CONSTRAINT "g4d_event_bookings_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "g4d_event_vendors" ADD CONSTRAINT "g4d_event_vendors_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "g4d_event_vendors" ADD CONSTRAINT "g4d_event_vendors_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "g4d_event_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
