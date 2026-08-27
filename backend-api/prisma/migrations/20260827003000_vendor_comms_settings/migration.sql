-- Per-vendor communication settings (Comms self-service, 27-Aug-2026).
-- WhatsApp is fully vendor-owned (their own number/template/greeting); SMS and
-- Email are shared platform infrastructure so only branding is stored here.
-- Additive: every column is nullable or defaulted, no backfill required — a
-- vendor with no row simply falls back to the platform defaults.

-- CreateTable
CREATE TABLE "g4d_vendor_comms_settings" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "waEnabled" BOOLEAN NOT NULL DEFAULT true,
    "waDisplayNumber" TEXT,
    "waTemplateId" TEXT,
    "waGreeting" TEXT,
    "waStatus" TEXT NOT NULL DEFAULT 'unverified',
    "waVerifiedAt" TIMESTAMP(3),
    "smsBusinessName" TEXT,
    "emailFromName" TEXT,
    "emailReplyTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "g4d_vendor_comms_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "g4d_vendor_comms_settings_vendorId_key" ON "g4d_vendor_comms_settings"("vendorId");

-- AddForeignKey
ALTER TABLE "g4d_vendor_comms_settings" ADD CONSTRAINT "g4d_vendor_comms_settings_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
