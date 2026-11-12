-- Slice 5.6d (domain sales through the registrar). Additive only: new tables, no existing object is touched.
-- CreateTable
CREATE TABLE "g4d_domain_margins" (
    "id" TEXT NOT NULL,
    "tld" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "effectiveFrom" TIMESTAMP(3),
    "note" TEXT,
    "createdBy" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_domain_margins_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "g4d_registrar_customers" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "rcCustomerId" TEXT NOT NULL,
    "rcContactId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "g4d_registrar_customers_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "g4d_registrants" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phoneCc" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'IN',
    "zipcode" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "phoneVerifiedAt" TIMESTAMP(3),
    "docKind" TEXT,
    "docLast4" TEXT,
    "docCipher" BYTEA,
    "docIv" BYTEA,
    "docTag" BYTEA,
    "docMime" TEXT,
    "docBytes" INTEGER,
    "docUploadedAt" TIMESTAMP(3),
    "docPurgedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'INCOMPLETE',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "consentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_registrants_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "g4d_identity_otps" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "toHash" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "g4d_identity_otps_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "g4d_identity_access" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "staffId" TEXT,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "g4d_identity_access_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "g4d_registered_domains" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "tld" TEXT NOT NULL,
    "rcOrderId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "privacy" BOOLEAN NOT NULL DEFAULT false,
    "nameServers" JSONB NOT NULL DEFAULT '[]',
    "dnsStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "alertsSent" JSONB NOT NULL DEFAULT '[]',
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRenewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_registered_domains_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "g4d_domain_orders" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "tld" TEXT NOT NULL,
    "years" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "registeredDomainId" TEXT,
    "amountPaise" INTEGER NOT NULL,
    "costPaise" INTEGER NOT NULL,
    "marginPaise" INTEGER NOT NULL,
    "privacyPaise" INTEGER NOT NULL DEFAULT 0,
    "taxSnapshotJson" JSONB NOT NULL DEFAULT '{}',
    "holdLedgerId" TEXT,
    "chargeLedgerId" TEXT,
    "releaseLedgerId" TEXT,
    "rcOrderId" TEXT,
    "privacy" BOOLEAN NOT NULL DEFAULT false,
    "fundedBy" TEXT NOT NULL DEFAULT 'WALLET',
    "requestedByType" TEXT NOT NULL DEFAULT 'VENDOR',
    "requestedById" TEXT,
    "reason" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "openKey" TEXT,
    "failureCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_domain_orders_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "g4d_domain_invoices" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "snapshotJson" JSONB NOT NULL,
    "totalPaise" INTEGER NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "g4d_domain_invoices_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "g4d_registrar_runs" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'RECONCILE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "checked" INTEGER NOT NULL DEFAULT 0,
    "settled" INTEGER NOT NULL DEFAULT 0,
    "mismatches" JSONB NOT NULL DEFAULT '[]',
    "balancePaise" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "note" TEXT,
    CONSTRAINT "g4d_registrar_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "g4d_domain_margins_tld_effectiveFrom_key" ON "g4d_domain_margins"("tld", "effectiveFrom");
CREATE INDEX "g4d_domain_margins_tld_status_idx" ON "g4d_domain_margins"("tld", "status");
CREATE UNIQUE INDEX "g4d_registrar_customers_vendorId_key" ON "g4d_registrar_customers"("vendorId");
CREATE UNIQUE INDEX "g4d_registrants_vendorId_key" ON "g4d_registrants"("vendorId");
CREATE INDEX "g4d_registrants_status_updatedAt_idx" ON "g4d_registrants"("status", "updatedAt");
CREATE INDEX "g4d_identity_otps_vendorId_channel_createdAt_idx" ON "g4d_identity_otps"("vendorId", "channel", "createdAt");
CREATE INDEX "g4d_identity_access_vendorId_at_idx" ON "g4d_identity_access"("vendorId", "at");
CREATE UNIQUE INDEX "g4d_registered_domains_domain_key" ON "g4d_registered_domains"("domain");
CREATE INDEX "g4d_registered_domains_vendorId_idx" ON "g4d_registered_domains"("vendorId");
CREATE INDEX "g4d_registered_domains_status_expiresAt_idx" ON "g4d_registered_domains"("status", "expiresAt");
CREATE UNIQUE INDEX "g4d_domain_orders_vendorId_idempotencyKey_key" ON "g4d_domain_orders"("vendorId", "idempotencyKey");
CREATE INDEX "g4d_domain_orders_vendorId_createdAt_idx" ON "g4d_domain_orders"("vendorId", "createdAt");
CREATE INDEX "g4d_domain_orders_status_updatedAt_idx" ON "g4d_domain_orders"("status", "updatedAt");
CREATE UNIQUE INDEX "g4d_domain_invoices_orderId_key" ON "g4d_domain_invoices"("orderId");
CREATE UNIQUE INDEX "g4d_domain_invoices_vendorId_number_key" ON "g4d_domain_invoices"("vendorId", "number");
CREATE INDEX "g4d_registrar_runs_startedAt_idx" ON "g4d_registrar_runs"("startedAt");

-- One live purchase per domain name: openKey holds the name while a REGISTER order is live and is cleared when it fails, so a second purchase of the same name is refused by the database, not only by the service.
CREATE UNIQUE INDEX "g4d_domain_orders_openKey_key" ON "g4d_domain_orders"("openKey");

-- AddForeignKey
ALTER TABLE "g4d_registrar_customers" ADD CONSTRAINT "g4d_registrar_customers_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "g4d_registrants" ADD CONSTRAINT "g4d_registrants_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "g4d_identity_otps" ADD CONSTRAINT "g4d_identity_otps_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "g4d_identity_access" ADD CONSTRAINT "g4d_identity_access_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "g4d_registered_domains" ADD CONSTRAINT "g4d_registered_domains_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "g4d_domain_orders" ADD CONSTRAINT "g4d_domain_orders_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "g4d_domain_invoices" ADD CONSTRAINT "g4d_domain_invoices_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "g4d_domain_invoices" ADD CONSTRAINT "g4d_domain_invoices_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "g4d_domain_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Same rule as every other public table (prisma/sql/enable_rls_public.sql): RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_domain_margins" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_registrar_customers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_registrants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_identity_otps" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_identity_access" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_registered_domains" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_domain_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_domain_invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_registrar_runs" ENABLE ROW LEVEL SECURITY;
