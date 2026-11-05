-- A refill adds GST on top of the credit (owner decision, 5 November 2026). Additive only: two columns on the top-up row and a check.
-- payablePaise = what the vendor pays (credit plus GST); null on a refill made before this change (it was then exactly the credit).
-- taxSnapshotJson = the tax worked out when the refill was made; the tax invoice is issued from it, never from rates read later.
ALTER TABLE "g4d_wallet_topups" ADD COLUMN "payablePaise" INTEGER;
ALTER TABLE "g4d_wallet_topups" ADD COLUMN "taxSnapshotJson" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "g4d_wallet_topups" ADD CONSTRAINT "g4d_wallet_topups_payable_chk" CHECK ("payablePaise" IS NULL OR "payablePaise" >= "amountPaise");
