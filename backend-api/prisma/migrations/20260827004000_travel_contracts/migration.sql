-- Travel recurring contracts: g4d_contracts + g4d_contract_assignments (multiple
-- vehicle/driver per contract). Additive; no existing data touched. Monthly
-- billing generates GenericInvoices via the existing invoice path.

-- CreateTable
CREATE TABLE "g4d_contracts" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "monthlyRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gstRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "billingDayOfMonth" INTEGER NOT NULL DEFAULT 1,
    "scheduleNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastBilledPeriod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_contract_assignments" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "driverId" TEXT,
    "routeLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_contract_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "g4d_contracts_vendorId_idx" ON "g4d_contracts"("vendorId");
CREATE INDEX "g4d_contracts_vendorId_status_idx" ON "g4d_contracts"("vendorId", "status");
CREATE INDEX "g4d_contract_assignments_contractId_idx" ON "g4d_contract_assignments"("contractId");

-- AddForeignKey
ALTER TABLE "g4d_contracts" ADD CONSTRAINT "g4d_contracts_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "g4d_contracts" ADD CONSTRAINT "g4d_contracts_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "g4d_contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "g4d_contract_assignments" ADD CONSTRAINT "g4d_contract_assignments_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "g4d_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "g4d_contract_assignments" ADD CONSTRAINT "g4d_contract_assignments_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "g4d_vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "g4d_contract_assignments" ADD CONSTRAINT "g4d_contract_assignments_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "g4d_drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
