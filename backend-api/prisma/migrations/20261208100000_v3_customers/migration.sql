-- Slice 5.23a (Batch 13): one customer list per business with source attribution. Additive only: new tables, no existing object is touched.
-- CreateTable
CREATE TABLE "g4d_customers" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "phoneKey" TEXT,
    "email" TEXT,
    "emailKey" TEXT,
    "firstSource" TEXT NOT NULL,
    "consent" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "consentAt" TIMESTAMP(3),
    "notes" TEXT,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_customers_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "g4d_customer_sources" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "refType" TEXT NOT NULL DEFAULT '',
    "refId" TEXT NOT NULL DEFAULT '',
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "g4d_customer_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (a missing phone or e-mail is NULL, and NULLs never collide, so only a real second copy of the same person is refused)
CREATE UNIQUE INDEX "g4d_customers_vendorId_phoneKey_key" ON "g4d_customers"("vendorId", "phoneKey");
CREATE UNIQUE INDEX "g4d_customers_vendorId_emailKey_key" ON "g4d_customers"("vendorId", "emailKey");
CREATE INDEX "g4d_customers_vendorId_createdAt_idx" ON "g4d_customers"("vendorId", "createdAt");
CREATE UNIQUE INDEX "g4d_customer_sources_customerId_source_refType_refId_key" ON "g4d_customer_sources"("customerId", "source", "refType", "refId");
CREATE INDEX "g4d_customer_sources_vendorId_source_idx" ON "g4d_customer_sources"("vendorId", "source");

-- AddForeignKey
ALTER TABLE "g4d_customers" ADD CONSTRAINT "g4d_customers_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "g4d_customer_sources" ADD CONSTRAINT "g4d_customer_sources_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "g4d_customer_sources" ADD CONSTRAINT "g4d_customer_sources_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "g4d_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Same rule as every other public table (prisma/sql/enable_rls_public.sql): RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_customers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_customer_sources" ENABLE ROW LEVEL SECURITY;
