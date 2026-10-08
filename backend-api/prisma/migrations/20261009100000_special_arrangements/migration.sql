-- Release 1A special arrangements (KSM, 2026-10-08). ADDITIVE ONLY: one new table, two nullable Invoice columns, no backfill, no data change.
-- Rollback: the table and columns can stay unused (nothing else depends on them); DROP TABLE "g4d_special_arrangements"; ALTER TABLE "Invoice" DROP COLUMN "gstForgonePaise", DROP COLUMN "gstNote";
-- Apply with `npx prisma migrate deploy` on the VM only (never from a developer machine against production). Afterwards re-run prisma/sql/enable_rls_public.sql (it enables RLS on any new public table).

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "gstForgonePaise" INTEGER,
ADD COLUMN     "gstNote" TEXT;

-- CreateTable
CREATE TABLE "g4d_special_arrangements" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "allowHalfYear" BOOLEAN NOT NULL DEFAULT false,
    "gstMode" "GstMode" NOT NULL DEFAULT 'EXCLUSIVE',
    "allowedChannels" "PayChannel"[] DEFAULT ARRAY[]::"PayChannel"[],
    "validUntil" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "endedAt" TIMESTAMP(3),
    "endedBy" TEXT,
    "endReason" TEXT,
    "history" JSONB NOT NULL DEFAULT '[]',
    "expiryWarnedAt" TIMESTAMP(3),
    "expiredNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_special_arrangements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "g4d_special_arrangements_vendorId_active_idx" ON "g4d_special_arrangements"("vendorId", "active");

-- CreateIndex
CREATE INDEX "g4d_special_arrangements_validUntil_idx" ON "g4d_special_arrangements"("validUntil");

-- AddForeignKey
ALTER TABLE "g4d_special_arrangements" ADD CONSTRAINT "g4d_special_arrangements_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
