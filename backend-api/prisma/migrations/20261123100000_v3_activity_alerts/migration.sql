-- CreateEnum
CREATE TYPE "V3ActivityActorType" AS ENUM ('VENDOR_USER', 'STAFF', 'SYSTEM');

-- CreateEnum
CREATE TYPE "V3AlertLevel" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "V3AlertStatus" AS ENUM ('NEW', 'LOOKING', 'RESOLVED', 'NOT_AN_ISSUE');

-- CreateTable
CREATE TABLE "g4d_activity_log" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT,
    "actorType" "V3ActivityActorType" NOT NULL,
    "actorId" TEXT,
    "actionKey" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "summaryJson" JSONB NOT NULL DEFAULT '{}',
    "ipHash" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_alert_rules" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "level" "V3AlertLevel" NOT NULL,
    "thresholdJson" JSONB,
    "notifyRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedByStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_alert_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_alerts" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "ruleKey" TEXT NOT NULL,
    "level" "V3AlertLevel" NOT NULL,
    "status" "V3AlertStatus" NOT NULL DEFAULT 'NEW',
    "ownerStaffId" TEXT,
    "activityIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "g4d_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_v3_notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "role" TEXT,
    "kind" TEXT NOT NULL,
    "refId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_v3_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "g4d_activity_log_vendorId_at_idx" ON "g4d_activity_log"("vendorId", "at");

-- CreateIndex
CREATE INDEX "g4d_activity_log_actionKey_at_idx" ON "g4d_activity_log"("actionKey", "at");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_alert_rules_key_key" ON "g4d_alert_rules"("key");

-- CreateIndex
CREATE INDEX "g4d_alerts_status_level_createdAt_idx" ON "g4d_alerts"("status", "level", "createdAt");

-- CreateIndex
CREATE INDEX "g4d_alerts_vendorId_createdAt_idx" ON "g4d_alerts"("vendorId", "createdAt");

-- CreateIndex
CREATE INDEX "g4d_alerts_ownerStaffId_status_idx" ON "g4d_alerts"("ownerStaffId", "status");

-- CreateIndex
CREATE INDEX "g4d_v3_notifications_userId_readAt_idx" ON "g4d_v3_notifications"("userId", "readAt");

-- CreateIndex
CREATE INDEX "g4d_v3_notifications_role_readAt_idx" ON "g4d_v3_notifications"("role", "readAt");


-- A notification is for one person or for a role, never for nobody.
ALTER TABLE "g4d_v3_notifications" ADD CONSTRAINT "g4d_v3_notifications_target_chk" CHECK ("userId" IS NOT NULL OR "role" IS NOT NULL);

-- A closed alert (RESOLVED or NOT_AN_ISSUE) says when it was closed; an open alert (NEW or LOOKING) never has a closing time.
ALTER TABLE "g4d_alerts" ADD CONSTRAINT "g4d_alerts_resolved_chk" CHECK (("status" IN ('RESOLVED', 'NOT_AN_ISSUE') AND "resolvedAt" IS NOT NULL) OR ("status" IN ('NEW', 'LOOKING') AND "resolvedAt" IS NULL));

-- The activity log is append-only: it can never be changed, and it can never be deleted by hand. The only delete allowed is for a vendor that is already gone (a hard-deleted test tenant).
CREATE OR REPLACE FUNCTION g4d_activity_log_immutable() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'g4d_activity_log rows cannot be changed';
  END IF;
  IF OLD."vendorId" IS NOT NULL AND EXISTS (SELECT 1 FROM "Vendor" WHERE "id" = OLD."vendorId") THEN
    RAISE EXCEPTION 'g4d_activity_log rows cannot be deleted';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "g4d_activity_log_immutable_trg" BEFORE UPDATE OR DELETE ON "g4d_activity_log" FOR EACH ROW EXECUTE FUNCTION g4d_activity_log_immutable();

-- Same rule as every other public table (prisma/sql/enable_rls_public.sql): RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_activity_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_alert_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_alerts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_v3_notifications" ENABLE ROW LEVEL SECURITY;
