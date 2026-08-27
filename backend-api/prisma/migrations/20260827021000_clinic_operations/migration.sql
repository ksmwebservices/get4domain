-- Final 3 — Clinic: appointment scheduling + doctor assignment + visit tracking

CREATE TABLE "g4d_doctors" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "specialty" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "consultationFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "availability" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_doctors_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "g4d_clinic_appointments" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "contactId" TEXT,
    "patientPhone" TEXT,
    "doctorId" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 30,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "reason" TEXT,
    "fee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "diagnosis" TEXT,
    "prescriptionNotes" TEXT,
    "followUpDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_clinic_appointments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "g4d_doctors_vendorId_idx" ON "g4d_doctors"("vendorId");
CREATE INDEX "g4d_clinic_appointments_vendorId_idx" ON "g4d_clinic_appointments"("vendorId");
CREATE INDEX "g4d_clinic_appointments_vendorId_startAt_idx" ON "g4d_clinic_appointments"("vendorId", "startAt");
CREATE INDEX "g4d_clinic_appointments_vendorId_status_idx" ON "g4d_clinic_appointments"("vendorId", "status");

ALTER TABLE "g4d_doctors" ADD CONSTRAINT "g4d_doctors_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "g4d_clinic_appointments" ADD CONSTRAINT "g4d_clinic_appointments_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "g4d_clinic_appointments" ADD CONSTRAINT "g4d_clinic_appointments_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "g4d_doctors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
