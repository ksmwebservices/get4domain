-- CreateEnum
CREATE TYPE "V3WalletLotStatus" AS ENUM ('OPEN', 'SPENT', 'EXPIRED');

-- CreateEnum
CREATE TYPE "V3WalletLotSource" AS ENUM ('TOPUP', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "g4d_wallet_lots" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "topupId" TEXT,
    "source" "V3WalletLotSource" NOT NULL DEFAULT 'TOPUP',
    "amountPaise" INTEGER NOT NULL,
    "remainingPaise" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "V3WalletLotStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_wallet_lots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "g4d_wallet_lots_topupId_key" ON "g4d_wallet_lots"("topupId");

-- CreateIndex
CREATE INDEX "g4d_wallet_lots_walletId_status_expiresAt_idx" ON "g4d_wallet_lots"("walletId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "g4d_wallet_lots_status_expiresAt_idx" ON "g4d_wallet_lots"("status", "expiresAt");

-- AddForeignKey
ALTER TABLE "g4d_wallet_lots" ADD CONSTRAINT "g4d_wallet_lots_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "g4d_v3_wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A lot never holds more than it was opened with, and never less than nothing.
ALTER TABLE "g4d_wallet_lots" ADD CONSTRAINT "g4d_wallet_lots_amounts_chk" CHECK ("remainingPaise" >= 0 AND "remainingPaise" <= "amountPaise" AND "amountPaise" > 0);

-- Same rule as every other public table: RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_wallet_lots" ENABLE ROW LEVEL SECURITY;
