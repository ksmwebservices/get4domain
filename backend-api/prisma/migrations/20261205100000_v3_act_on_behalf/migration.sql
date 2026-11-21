-- Slice 5.13b (Website manager): staff acting on behalf of a vendor. Additive only: one new table. The onboarding queue reuses existing tables and adds none.
-- CreateTable
CREATE TABLE "g4d_act_on_behalf_sessions" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "endedBy" TEXT,
    "vendorNotifiedAt" TIMESTAMP(3),
    "activeStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "g4d_act_on_behalf_sessions_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "g4d_act_on_behalf_sessions_activeStaffId_key" ON "g4d_act_on_behalf_sessions"("activeStaffId");
CREATE INDEX "g4d_act_on_behalf_sessions_vendorId_startedAt_idx" ON "g4d_act_on_behalf_sessions"("vendorId", "startedAt");
CREATE INDEX "g4d_act_on_behalf_sessions_staffId_endedAt_idx" ON "g4d_act_on_behalf_sessions"("staffId", "endedAt");
-- AddForeignKey
ALTER TABLE "g4d_act_on_behalf_sessions" ADD CONSTRAINT "g4d_act_on_behalf_sessions_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Same rule as every other public table (prisma/sql/enable_rls_public.sql): RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_act_on_behalf_sessions" ENABLE ROW LEVEL SECURITY;
