-- Slice 5.17a (owner amendment 06, UPI only). Additive only: new nullable or defaulted columns on an existing table, plus one partial unique index.
-- Row-level security stays as it was on g4d_vendor_payment_methods (column additions do not change policies).
-- AlterTable
ALTER TABLE "g4d_vendor_payment_methods" ADD COLUMN "upiId" TEXT;
ALTER TABLE "g4d_vendor_payment_methods" ADD COLUMN "payeeName" TEXT;
ALTER TABLE "g4d_vendor_payment_methods" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "g4d_vendor_payment_methods" ADD COLUMN "showToCustomers" BOOLEAN NOT NULL DEFAULT false;
-- CreateIndex: at most one default method per vendor
CREATE UNIQUE INDEX "g4d_vendor_payment_methods_one_default_idx" ON "g4d_vendor_payment_methods"("vendorId") WHERE "isDefault" = true;
