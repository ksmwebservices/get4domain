-- Wave 4 W4: commission adjustment. A commission line that is reversed AFTER it was paid out becomes a separate negative ADJUSTMENT line, netted on the partner's next month close.
-- Additive: two new columns with defaults (every existing row becomes kind COMMISSION), the one-line-per-vendor rule becomes one line per vendor AND kind, and the amount check allows a negative amount for an ADJUSTMENT only.
-- No table is created, so no new row level security is needed (the ledger already has it on).

ALTER TABLE "g4d_commission_ledger" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'COMMISSION';
ALTER TABLE "g4d_commission_ledger" ADD COLUMN "adjustsLineId" TEXT;

DROP INDEX "g4d_commission_ledger_vendorId_key";
CREATE UNIQUE INDEX "g4d_commission_ledger_vendorId_kind_key" ON "g4d_commission_ledger"("vendorId", "kind");

ALTER TABLE "g4d_commission_ledger" DROP CONSTRAINT "g4d_commission_ledger_amount_check";
ALTER TABLE "g4d_commission_ledger" ADD CONSTRAINT "g4d_commission_ledger_kind_check" CHECK ("kind" IN ('COMMISSION', 'ADJUSTMENT'));
ALTER TABLE "g4d_commission_ledger" ADD CONSTRAINT "g4d_commission_ledger_amount_check" CHECK (
  ("kind" = 'COMMISSION' AND ("amountMinor" IS NULL OR "amountMinor" >= 0))
  OR ("kind" = 'ADJUSTMENT' AND "amountMinor" IS NOT NULL AND "amountMinor" < 0 AND "adjustsLineId" IS NOT NULL)
);
