-- V3 Step 0 (S12): idempotency key for wallet debits and refunds. Additive only: one nullable column and a unique index.
-- Existing rows keep NULL (a unique index allows any number of NULLs). Nothing is dropped, renamed or rewritten.
ALTER TABLE "g4d_wallet_transactions" ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "g4d_wallet_transactions_idempotencyKey_key" ON "g4d_wallet_transactions"("idempotencyKey");
