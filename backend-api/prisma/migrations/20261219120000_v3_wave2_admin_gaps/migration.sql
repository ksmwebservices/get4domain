-- Wave 2 Part C: admin gap tables. Additive: four nullable columns on the plan order (what staff recorded when they marked it paid offline) and one new staff-only table (vendor notes).
-- NOT applied by this commit: the owner runs migrate-deploy on staging.

-- AlterTable
ALTER TABLE "g4d_plan_orders" ADD COLUMN "settledReference" TEXT,
ADD COLUMN "settledOn" DATE,
ADD COLUMN "settledAmountPaise" INTEGER,
ADD COLUMN "settledByName" TEXT;

-- CreateTable
CREATE TABLE "g4d_vendor_notes" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "byStaffId" TEXT,
    "byName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_vendor_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "g4d_vendor_notes_vendorId_createdAt_idx" ON "g4d_vendor_notes"("vendorId", "createdAt");

-- No foreign key on the notes, like the activity log: the immutability trigger below lets a note go only once its vendor is gone.

-- Checks (Prisma does not model them): a recorded amount is never negative, a note is never empty
ALTER TABLE "g4d_plan_orders" ADD CONSTRAINT "g4d_plan_orders_settled_amount_check" CHECK ("settledAmountPaise" IS NULL OR "settledAmountPaise" >= 0);
ALTER TABLE "g4d_vendor_notes" ADD CONSTRAINT "g4d_vendor_notes_body_check" CHECK (length(btrim("body")) > 0);

-- Append only, like the activity log: a staff note can never be changed, and never deleted by hand. The only delete allowed is for a vendor that is already gone (a hard-deleted test tenant).
CREATE OR REPLACE FUNCTION g4d_vendor_notes_immutable() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'g4d_vendor_notes rows cannot be changed';
  END IF;
  IF EXISTS (SELECT 1 FROM "Vendor" WHERE "id" = OLD."vendorId") THEN
    RAISE EXCEPTION 'g4d_vendor_notes rows cannot be deleted';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "g4d_vendor_notes_immutable_trg" BEFORE UPDATE OR DELETE ON "g4d_vendor_notes" FOR EACH ROW EXECUTE FUNCTION g4d_vendor_notes_immutable();

-- Same rule as every other public table: RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_vendor_notes" ENABLE ROW LEVEL SECURITY;
