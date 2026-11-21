-- Amendment 13 Part B (B13): the paused plan state. Additive only: one new table, no existing object is touched.
-- CreateTable
CREATE TABLE "g4d_plan_pauses" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "openVendorId" TEXT,
    "reason" TEXT NOT NULL,
    "pausedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resumedAt" TIMESTAMP(3),
    "pausedByType" TEXT NOT NULL DEFAULT 'STAFF',
    "pausedById" TEXT,
    "resumedByType" TEXT,
    "resumedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_plan_pauses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "g4d_plan_pauses_openVendorId_key" ON "g4d_plan_pauses"("openVendorId");

-- CreateIndex
CREATE INDEX "g4d_plan_pauses_vendorId_pausedAt_idx" ON "g4d_plan_pauses"("vendorId", "pausedAt");

-- AddForeignKey
ALTER TABLE "g4d_plan_pauses" ADD CONSTRAINT "g4d_plan_pauses_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Same rule as every other public table: RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_plan_pauses" ENABLE ROW LEVEL SECURITY;
