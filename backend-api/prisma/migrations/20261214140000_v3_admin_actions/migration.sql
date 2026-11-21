-- Block 4b slice 9: staff actions (business name history, scheduled plan changes, listing merges) and per-host visit counts. Additive only: four new tables, no existing object is touched.
CREATE TABLE "g4d_v3_business_name_history" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "oldName" TEXT NOT NULL,
    "newName" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "g4d_v3_business_name_history_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "g4d_v3_scheduled_plan_changes" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "planKey" TEXT NOT NULL,
    "termMonths" INTEGER,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "requestedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "appliedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_v3_scheduled_plan_changes_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "g4d_v3_listing_merges" (
    "id" TEXT NOT NULL,
    "keepVendorId" TEXT NOT NULL,
    "mergedVendorId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "actorId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'APPLIED',
    "movedJson" JSONB NOT NULL DEFAULT '{}',
    "conflictsJson" JSONB NOT NULL DEFAULT '[]',
    "reversibleUntil" TIMESTAMP(3) NOT NULL,
    "reversedAt" TIMESTAMP(3),
    "reversedBy" TEXT,
    "reverseReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "g4d_v3_listing_merges_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "g4d_v3_host_visits_daily" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_v3_host_visits_daily_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "g4d_v3_business_name_history_vendorId_createdAt_idx" ON "g4d_v3_business_name_history"("vendorId", "createdAt");
CREATE INDEX "g4d_v3_scheduled_plan_changes_vendorId_createdAt_idx" ON "g4d_v3_scheduled_plan_changes"("vendorId", "createdAt");
CREATE INDEX "g4d_v3_scheduled_plan_changes_status_effectiveAt_idx" ON "g4d_v3_scheduled_plan_changes"("status", "effectiveAt");
CREATE INDEX "g4d_v3_listing_merges_keepVendorId_createdAt_idx" ON "g4d_v3_listing_merges"("keepVendorId", "createdAt");
CREATE INDEX "g4d_v3_listing_merges_mergedVendorId_createdAt_idx" ON "g4d_v3_listing_merges"("mergedVendorId", "createdAt");
CREATE UNIQUE INDEX "g4d_v3_host_visits_daily_host_day_key" ON "g4d_v3_host_visits_daily"("host", "day");
CREATE INDEX "g4d_v3_host_visits_daily_vendorId_day_idx" ON "g4d_v3_host_visits_daily"("vendorId", "day");
ALTER TABLE "g4d_v3_business_name_history" ADD CONSTRAINT "g4d_v3_business_name_history_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "g4d_v3_scheduled_plan_changes" ADD CONSTRAINT "g4d_v3_scheduled_plan_changes_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "g4d_v3_host_visits_daily" ADD CONSTRAINT "g4d_v3_host_visits_daily_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "g4d_v3_scheduled_plan_changes" ADD CONSTRAINT "g4d_v3_scheduled_plan_changes_status_chk" CHECK ("status" IN ('PENDING', 'APPLYING', 'APPLIED', 'CANCELLED', 'FAILED'));
ALTER TABLE "g4d_v3_listing_merges" ADD CONSTRAINT "g4d_v3_listing_merges_status_chk" CHECK ("status" IN ('APPLIED', 'REVERSED'));
ALTER TABLE "g4d_v3_listing_merges" ADD CONSTRAINT "g4d_v3_listing_merges_different_chk" CHECK ("keepVendorId" <> "mergedVendorId");
ALTER TABLE "g4d_v3_host_visits_daily" ADD CONSTRAINT "g4d_v3_host_visits_daily_count_chk" CHECK ("count" >= 0);

-- Same rule as every other public table: RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_v3_business_name_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_v3_scheduled_plan_changes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_v3_listing_merges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_v3_host_visits_daily" ENABLE ROW LEVEL SECURITY;
