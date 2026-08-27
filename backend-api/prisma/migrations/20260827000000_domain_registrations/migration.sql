-- Phase 2 (domain registration): dedicated per-vendor domain registrations +
-- connected (externally-owned) domains. Additive; no existing data touched.

-- CreateTable
CREATE TABLE "g4d_domain_registrations" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "domainName" TEXT NOT NULL,
    "tld" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'registered',
    "registrar" TEXT NOT NULL DEFAULT 'resellerclub',
    "registrarOrderId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "pricePaise" INTEGER NOT NULL DEFAULT 0,
    "years" INTEGER NOT NULL DEFAULT 1,
    "mappingType" TEXT,
    "mappingVerifiedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_domain_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "g4d_domain_registrations_vendorId_domainName_key" ON "g4d_domain_registrations"("vendorId", "domainName");

-- CreateIndex
CREATE INDEX "g4d_domain_registrations_vendorId_idx" ON "g4d_domain_registrations"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_domain_registrations_vendorId_status_idx" ON "g4d_domain_registrations"("vendorId", "status");

-- AddForeignKey
ALTER TABLE "g4d_domain_registrations" ADD CONSTRAINT "g4d_domain_registrations_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
