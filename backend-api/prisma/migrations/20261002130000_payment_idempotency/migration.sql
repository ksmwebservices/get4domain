-- Security patch: payment replay protection (2026-10-02).
-- Public web checkout records the Razorpay order/payment on the sale; a unique payment id makes
-- confirm idempotent. Wallet top-up payment ids become unique as defence in depth (the
-- application also guards under a per-payment advisory lock). Additive; NULLs are distinct in
-- Postgres so existing rows (no payment id) are unaffected. Pre-checked: 0 duplicate
-- g4d_wallet_transactions.razorpayId values and 0 web sales exist, so these cannot fail on current data.
ALTER TABLE "g4d_pos_sales" ADD COLUMN "razorpayOrderId" TEXT;
ALTER TABLE "g4d_pos_sales" ADD COLUMN "razorpayPaymentId" TEXT;
CREATE UNIQUE INDEX "g4d_pos_sales_razorpayPaymentId_key" ON "g4d_pos_sales"("razorpayPaymentId");
CREATE UNIQUE INDEX "g4d_wallet_transactions_razorpayId_key" ON "g4d_wallet_transactions"("razorpayId");
