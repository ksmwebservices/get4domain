-- Commercial Engine follow-up A: KSM-approved net price on plan-change requests (additive; every column nullable).
-- Deploy order: apply this AFTER 20261007120000_commercial_engine (prisma migrate deploy applies in order).
-- Rollback: the columns can stay unused; no data depends on them.
-- AlterTable
ALTER TABLE "g4d_billing_terms" ADD COLUMN     "scheduledNextDiscountReason" TEXT,
ADD COLUMN     "scheduledNextNetPaise" INTEGER;
-- AlterTable
ALTER TABLE "g4d_plan_change_requests" ADD COLUMN     "approvedNetPaise" INTEGER,
ADD COLUMN     "discountReason" TEXT,
ADD COLUMN     "listPaise" INTEGER;
