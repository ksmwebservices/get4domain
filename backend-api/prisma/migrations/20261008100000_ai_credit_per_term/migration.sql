-- AI Studio credit prorated by billing term (KSM decision 2026-10-08). ADDITIVE ONLY: two nullable columns, no backfill.
-- Existing deals/terms keep NULL; the application computes the credit from plan + months when the column is NULL.
-- Rollback: the columns can stay unused (nothing depends on them being dropped).
-- AlterTable
ALTER TABLE "g4d_billing_terms" ADD COLUMN     "aiCreditPaise" INTEGER;

-- AlterTable
ALTER TABLE "g4d_billing_deals" ADD COLUMN     "aiCreditPaise" INTEGER;
