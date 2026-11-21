-- Wave 3 Part I: referral links, the attribution of a vendor to a partner, the commission slabs, the commission ledger and the payouts. Five new platform tables, nothing else is touched.
-- NOT applied by this commit: the owner runs migrate-deploy on staging. The slab table starts EMPTY: no value is seeded, and with no slab rows nothing accrues.
-- Every table has row level security ON with no policy (staff and server only), like every platform table. Partner access is through the server's partner routes, which filter by the signed-in partner.

CREATE TABLE "g4d_referral_links" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "disabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_referral_links_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "g4d_referral_attributions" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "linkId" TEXT,
    "source" TEXT NOT NULL,
    "setById" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_referral_attributions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "g4d_commission_slabs" (
    "id" TEXT NOT NULL,
    "minVendors" INTEGER NOT NULL,
    "maxVendors" INTEGER,
    "amountPerVendorMinor" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_commission_slabs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "g4d_commission_payouts" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "totalMinor" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PAID',
    "reference" TEXT NOT NULL,
    "paidById" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_commission_payouts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "g4d_commission_ledger" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "qualifiedAt" TIMESTAMP(3) NOT NULL,
    "amountMinor" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ACCRUED',
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "flagReason" TEXT,
    "approvedAt" TIMESTAMP(3),
    "payoutId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_commission_ledger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "g4d_referral_links_code_key" ON "g4d_referral_links"("code");
CREATE INDEX "g4d_referral_links_partnerId_active_idx" ON "g4d_referral_links"("partnerId", "active");
CREATE UNIQUE INDEX "g4d_referral_attributions_vendorId_key" ON "g4d_referral_attributions"("vendorId");
CREATE INDEX "g4d_referral_attributions_partnerId_idx" ON "g4d_referral_attributions"("partnerId");
CREATE INDEX "g4d_commission_slabs_effectiveFrom_idx" ON "g4d_commission_slabs"("effectiveFrom");
CREATE UNIQUE INDEX "g4d_commission_payouts_partnerId_month_key" ON "g4d_commission_payouts"("partnerId", "month");
CREATE UNIQUE INDEX "g4d_commission_ledger_vendorId_key" ON "g4d_commission_ledger"("vendorId");
CREATE INDEX "g4d_commission_ledger_partnerId_month_status_idx" ON "g4d_commission_ledger"("partnerId", "month", "status");
CREATE INDEX "g4d_commission_ledger_month_status_idx" ON "g4d_commission_ledger"("month", "status");

ALTER TABLE "g4d_referral_links" ADD CONSTRAINT "g4d_referral_links_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "g4d_referral_partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "g4d_referral_attributions" ADD CONSTRAINT "g4d_referral_attributions_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "g4d_referral_partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "g4d_commission_payouts" ADD CONSTRAINT "g4d_commission_payouts_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "g4d_referral_partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "g4d_commission_ledger" ADD CONSTRAINT "g4d_commission_ledger_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "g4d_referral_partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "g4d_commission_ledger" ADD CONSTRAINT "g4d_commission_ledger_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "g4d_commission_payouts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- like every platform table: row level security ON and no policy, so only the server role reads or writes it
ALTER TABLE "g4d_referral_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_referral_attributions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_commission_slabs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_commission_payouts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_commission_ledger" ENABLE ROW LEVEL SECURITY;

-- the rules also hold in the database, so no tool can write a row that breaks them
ALTER TABLE "g4d_referral_links" ADD CONSTRAINT "g4d_referral_links_code_check" CHECK ("code" ~ '^[A-Z2-9]{6,12}$');
ALTER TABLE "g4d_referral_attributions" ADD CONSTRAINT "g4d_referral_attributions_source_check" CHECK ("source" IN ('REGISTER', 'ON_BEHALF', 'ADMIN_CHANGE'));
ALTER TABLE "g4d_commission_slabs" ADD CONSTRAINT "g4d_commission_slabs_range_check" CHECK ("minVendors" >= 1 AND ("maxVendors" IS NULL OR "maxVendors" >= "minVendors") AND "amountPerVendorMinor" > 0);
ALTER TABLE "g4d_commission_ledger" ADD CONSTRAINT "g4d_commission_ledger_status_check" CHECK ("status" IN ('ACCRUED', 'APPROVED', 'PAID', 'REVERSED'));
ALTER TABLE "g4d_commission_ledger" ADD CONSTRAINT "g4d_commission_ledger_month_check" CHECK ("month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
ALTER TABLE "g4d_commission_ledger" ADD CONSTRAINT "g4d_commission_ledger_amount_check" CHECK ("amountMinor" IS NULL OR "amountMinor" >= 0);
ALTER TABLE "g4d_commission_payouts" ADD CONSTRAINT "g4d_commission_payouts_total_check" CHECK ("totalMinor" > 0 AND length(btrim("reference")) > 0 AND "month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
