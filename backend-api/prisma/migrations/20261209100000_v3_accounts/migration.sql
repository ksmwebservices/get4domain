-- Slice 5.23b (Batch 13): accounts. Additive only: new tables, no existing object is touched.
CREATE TABLE "g4d_sale_records" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "soldAt" TIMESTAMP(3) NOT NULL,
    "customerName" TEXT,
    "taxablePaise" INTEGER NOT NULL,
    "taxPaise" INTEGER NOT NULL,
    "cgstPaise" INTEGER NOT NULL,
    "sgstPaise" INTEGER NOT NULL,
    "igstPaise" INTEGER NOT NULL,
    "totalPaise" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "g4d_sale_records_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "g4d_acct_expenses" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "spentOn" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "gstPaise" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_acct_expenses_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "g4d_items" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hsnSac" TEXT,
    "unit" TEXT,
    "pricePaise" INTEGER,
    "taxRatePercent" DECIMAL(6,3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "g4d_sale_records_vendorId_sourceType_sourceId_key" ON "g4d_sale_records"("vendorId", "sourceType", "sourceId");
CREATE INDEX "g4d_sale_records_vendorId_soldAt_idx" ON "g4d_sale_records"("vendorId", "soldAt");
CREATE INDEX "g4d_acct_expenses_vendorId_spentOn_idx" ON "g4d_acct_expenses"("vendorId", "spentOn");
CREATE INDEX "g4d_items_vendorId_createdAt_idx" ON "g4d_items"("vendorId", "createdAt");

ALTER TABLE "g4d_sale_records" ADD CONSTRAINT "g4d_sale_records_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "g4d_acct_expenses" ADD CONSTRAINT "g4d_acct_expenses_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "g4d_items" ADD CONSTRAINT "g4d_items_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Same rule as every other public table: RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_sale_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_acct_expenses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_items" ENABLE ROW LEVEL SECURITY;
