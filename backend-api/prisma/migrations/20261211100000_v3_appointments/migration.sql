-- Slice 5.24b (Batch 13): appointments (Professional). Additive only: new tables, no existing object is touched.
CREATE TABLE "g4d_appt_services" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "pricePaise" INTEGER,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_appt_services_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "g4d_appt_providers" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hoursJson" JSONB NOT NULL DEFAULT '[]',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_appt_providers_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "g4d_appt_bookings" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "customerId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "notes" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "requestId" TEXT,
    "cancelReason" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_appt_bookings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "g4d_appt_services_vendorId_createdAt_idx" ON "g4d_appt_services"("vendorId", "createdAt");
CREATE INDEX "g4d_appt_providers_vendorId_createdAt_idx" ON "g4d_appt_providers"("vendorId", "createdAt");
CREATE INDEX "g4d_appt_bookings_vendorId_startsAt_idx" ON "g4d_appt_bookings"("vendorId", "startsAt");
CREATE INDEX "g4d_appt_bookings_vendorId_providerId_startsAt_idx" ON "g4d_appt_bookings"("vendorId", "providerId", "startsAt");
CREATE INDEX "g4d_appt_bookings_vendorId_status_createdAt_idx" ON "g4d_appt_bookings"("vendorId", "status", "createdAt");

ALTER TABLE "g4d_appt_services" ADD CONSTRAINT "g4d_appt_services_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "g4d_appt_providers" ADD CONSTRAINT "g4d_appt_providers_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "g4d_appt_bookings" ADD CONSTRAINT "g4d_appt_bookings_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Same rule as every other public table: RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_appt_services" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_appt_providers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_appt_bookings" ENABLE ROW LEVEL SECURITY;
