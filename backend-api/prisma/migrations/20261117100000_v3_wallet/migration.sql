-- CreateEnum
CREATE TYPE "V3WalletStatus" AS ENUM ('INACTIVE', 'ACTIVE', 'FROZEN');

-- CreateEnum
CREATE TYPE "V3WalletLedgerKind" AS ENUM ('TOPUP', 'HOLD', 'RELEASE', 'CHARGE', 'REVERSAL', 'EXPIRY', 'ADJUSTMENT', 'PACK_PURCHASE', 'PLAN_RENEWAL');

-- CreateEnum
CREATE TYPE "V3WalletTopupStatus" AS ENUM ('CREATED', 'PENDING', 'PAID', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "g4d_v3_wallets" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "status" "V3WalletStatus" NOT NULL DEFAULT 'INACTIVE',
    "balancePaise" INTEGER NOT NULL DEFAULT 0,
    "heldPaise" INTEGER NOT NULL DEFAULT 0,
    "entryCount" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "activatedAt" TIMESTAMP(3),
    "activatedByEventId" TEXT,
    "frozenReason" TEXT,
    "billingStateCode" TEXT,
    "billingGstin" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_v3_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_wallet_ledger" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "entryNo" INTEGER NOT NULL,
    "kind" "V3WalletLedgerKind" NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "balanceDeltaPaise" INTEGER NOT NULL,
    "heldDeltaPaise" INTEGER NOT NULL,
    "balanceAfterPaise" INTEGER NOT NULL,
    "heldAfterPaise" INTEGER NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "holdId" TEXT,
    "reversesId" TEXT,
    "reason" TEXT,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "lotUsesJson" JSONB NOT NULL DEFAULT '[]',
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_wallet_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_wallet_topups" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "V3WalletTopupStatus" NOT NULL DEFAULT 'CREATED',
    "providerOrderId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "paymentId" TEXT,
    "paidAmountPaise" INTEGER,
    "paidAt" TIMESTAMP(3),
    "ledgerId" TEXT,
    "receiptId" TEXT,
    "createdByType" TEXT NOT NULL DEFAULT 'VENDOR',
    "createdById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_wallet_topups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_wallet_receipts" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "topupId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "documentType" TEXT NOT NULL DEFAULT 'RECEIPT',
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "snapshotJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_wallet_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "g4d_v3_wallets_vendorId_key" ON "g4d_v3_wallets"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_wallet_ledger_vendorId_at_idx" ON "g4d_wallet_ledger"("vendorId", "at");

-- CreateIndex
CREATE INDEX "g4d_wallet_ledger_refType_refId_idx" ON "g4d_wallet_ledger"("refType", "refId");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_wallet_ledger_walletId_idempotencyKey_key" ON "g4d_wallet_ledger"("walletId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_wallet_ledger_walletId_entryNo_key" ON "g4d_wallet_ledger"("walletId", "entryNo");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_wallet_ledger_holdId_key" ON "g4d_wallet_ledger"("holdId");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_wallet_ledger_reversesId_key" ON "g4d_wallet_ledger"("reversesId");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_wallet_topups_providerOrderId_key" ON "g4d_wallet_topups"("providerOrderId");

-- CreateIndex
CREATE INDEX "g4d_wallet_topups_vendorId_createdAt_idx" ON "g4d_wallet_topups"("vendorId", "createdAt");

-- CreateIndex
CREATE INDEX "g4d_wallet_topups_status_expiresAt_idx" ON "g4d_wallet_topups"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_wallet_topups_vendorId_idempotencyKey_key" ON "g4d_wallet_topups"("vendorId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_wallet_receipts_topupId_key" ON "g4d_wallet_receipts"("topupId");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_wallet_receipts_receiptNumber_key" ON "g4d_wallet_receipts"("receiptNumber");

-- CreateIndex
CREATE INDEX "g4d_wallet_receipts_vendorId_issuedAt_idx" ON "g4d_wallet_receipts"("vendorId", "issuedAt");

-- AddForeignKey
ALTER TABLE "g4d_v3_wallets" ADD CONSTRAINT "g4d_v3_wallets_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_wallet_ledger" ADD CONSTRAINT "g4d_wallet_ledger_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "g4d_v3_wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_wallet_topups" ADD CONSTRAINT "g4d_wallet_topups_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_wallet_receipts" ADD CONSTRAINT "g4d_wallet_receipts_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_wallet_receipts" ADD CONSTRAINT "g4d_wallet_receipts_topupId_fkey" FOREIGN KEY ("topupId") REFERENCES "g4d_wallet_topups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The database itself refuses a negative balance, a negative held amount and held money above the balance, whatever the application does.
ALTER TABLE "g4d_v3_wallets" ADD CONSTRAINT "g4d_v3_wallets_amounts_chk" CHECK ("balancePaise" >= 0 AND "heldPaise" >= 0 AND "heldPaise" <= "balancePaise");

ALTER TABLE "g4d_wallet_ledger" ADD CONSTRAINT "g4d_wallet_ledger_after_chk" CHECK ("balanceAfterPaise" >= 0 AND "heldAfterPaise" >= 0 AND "heldAfterPaise" <= "balanceAfterPaise");

ALTER TABLE "g4d_wallet_topups" ADD CONSTRAINT "g4d_wallet_topups_amount_chk" CHECK ("amountPaise" > 0);

-- The ledger is append-only: it can never be changed, and it can never be deleted by hand. The only delete allowed is the cascade of a wallet that is already gone (a hard-deleted test tenant).
CREATE OR REPLACE FUNCTION g4d_wallet_ledger_immutable() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'g4d_wallet_ledger rows cannot be changed';
  END IF;
  IF EXISTS (SELECT 1 FROM "g4d_v3_wallets" WHERE "id" = OLD."walletId") THEN
    RAISE EXCEPTION 'g4d_wallet_ledger rows cannot be deleted';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "g4d_wallet_ledger_immutable_trg" BEFORE UPDATE OR DELETE ON "g4d_wallet_ledger" FOR EACH ROW EXECUTE FUNCTION g4d_wallet_ledger_immutable();

-- Same rule as every other public table (prisma/sql/enable_rls_public.sql): RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_v3_wallets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_wallet_ledger" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_wallet_topups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_wallet_receipts" ENABLE ROW LEVEL SECURITY;
