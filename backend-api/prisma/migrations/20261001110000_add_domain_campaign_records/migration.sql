-- DomainCampaign monthly ad-spend/fee records (dispatch 01-Oct-2026)
CREATE TABLE "g4d_domain_campaign_records" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "adSpendPaise" INTEGER NOT NULL,
    "feePaise" INTEGER NOT NULL,
    "invoiceId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_domain_campaign_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "g4d_domain_campaign_records_vendorId_month_key" ON "g4d_domain_campaign_records"("vendorId", "month");

ALTER TABLE "g4d_domain_campaign_records" ADD CONSTRAINT "g4d_domain_campaign_records_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
