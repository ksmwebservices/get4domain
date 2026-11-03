-- V3 slice 5.1: plans, tracks and entitlements. ADDITIVE ONLY: new enum types, new tables, new indexes and foreign keys among them (and to "Vendor"),
-- and two nullable provenance columns on "Vendor". Nothing is dropped, renamed, rewritten or tightened. No foreign key to any legacy billing, BOS or commercial table.
-- Generated offline with prisma migrate diff against the previous schema; STAGING ONLY until the owner approves production.

-- CreateEnum
CREATE TYPE "V3PlanTrack" AS ENUM ('HANDYMAN', 'PROFESSIONAL', 'ECOMMERCE');

-- CreateEnum
CREATE TYPE "V3PlanLevel" AS ENUM ('FREE', 'PRO');

-- CreateEnum
CREATE TYPE "V3PlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "V3PriceStatus" AS ENUM ('PROPOSED', 'APPROVED');

-- CreateEnum
CREATE TYPE "V3FeatureKind" AS ENUM ('BOOLEAN', 'LIMIT', 'ENUM');

-- CreateEnum
CREATE TYPE "V3FeatureState" AS ENUM ('ACTIVE', 'LIMITED', 'LOCKED_PREVIEW', 'HIDDEN');

-- CreateEnum
CREATE TYPE "V3DiscountType" AS ENUM ('TERM', 'PROMO', 'MIGRATION');

-- CreateEnum
CREATE TYPE "V3SubscriptionStatus" AS ENUM ('ACTIVE', 'GRACE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "V3SubscriptionSource" AS ENUM ('REGISTRATION', 'SELF', 'STAFF', 'MIGRATION', 'PROMO');

-- CreateEnum
CREATE TYPE "V3ActorType" AS ENUM ('SYSTEM', 'STAFF', 'VENDOR');

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN "registeredByStaffId" TEXT;
ALTER TABLE "Vendor" ADD COLUMN "source" TEXT;

-- CreateTable
CREATE TABLE "g4d_plans" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "track" "V3PlanTrack" NOT NULL,
    "level" "V3PlanLevel" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "V3PlanStatus" NOT NULL DEFAULT 'DRAFT',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_plan_prices" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "termMonths" INTEGER NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "taxInclusive" BOOLEAN NOT NULL DEFAULT false,
    "status" "V3PriceStatus" NOT NULL DEFAULT 'PROPOSED',
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_plan_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_features" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "kind" "V3FeatureKind" NOT NULL DEFAULT 'BOOLEAN',
    "unit" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_plan_features" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "state" "V3FeatureState" NOT NULL DEFAULT 'HIDDEN',
    "limitValue" INTEGER,
    "enumValue" TEXT,
    "upsellText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_plan_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_tax_rates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ratePercent" DECIMAL(6,3) NOT NULL,
    "appliesTo" TEXT NOT NULL DEFAULT 'ALL',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_tax_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_discount_rules" (
    "id" TEXT NOT NULL,
    "type" "V3DiscountType" NOT NULL,
    "name" TEXT NOT NULL,
    "percentOff" DECIMAL(6,3),
    "amountOffPaise" INTEGER,
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),
    "stackable" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "status" "V3PriceStatus" NOT NULL DEFAULT 'PROPOSED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_discount_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_plan_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "valueJson" JSONB NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_plan_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_plan_subscriptions" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "V3SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "termMonths" INTEGER,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "graceEndsAt" TIMESTAMP(3),
    "source" "V3SubscriptionSource" NOT NULL,
    "priceSnapshotJson" JSONB NOT NULL DEFAULT '{}',
    "createdByType" "V3ActorType" NOT NULL DEFAULT 'SYSTEM',
    "createdById" TEXT,
    "currentVendorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_plan_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_subscription_events" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "vendorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fromPlanId" TEXT,
    "toPlanId" TEXT,
    "reason" TEXT,
    "actorType" "V3ActorType" NOT NULL DEFAULT 'SYSTEM',
    "actorId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_subscription_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_entitlement_overrides" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "state" "V3FeatureState" NOT NULL,
    "limitValue" INTEGER,
    "enumValue" TEXT,
    "reason" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdByStaffId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_entitlement_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_audit_logs" (
    "id" TEXT NOT NULL,
    "actorType" "V3ActorType" NOT NULL DEFAULT 'STAFF',
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "ip" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_vendor_flags" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedByStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_vendor_flags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "g4d_plans_key_key" ON "g4d_plans"("key");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_plans_track_level_key" ON "g4d_plans"("track", "level");

-- CreateIndex
CREATE INDEX "g4d_plan_prices_planId_idx" ON "g4d_plan_prices"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_plan_prices_planId_termMonths_effectiveFrom_key" ON "g4d_plan_prices"("planId", "termMonths", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_features_key_key" ON "g4d_features"("key");

-- CreateIndex
CREATE INDEX "g4d_plan_features_featureKey_idx" ON "g4d_plan_features"("featureKey");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_plan_features_planId_featureKey_key" ON "g4d_plan_features"("planId", "featureKey");

-- CreateIndex
CREATE INDEX "g4d_discount_rules_type_active_idx" ON "g4d_discount_rules"("type", "active");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_plan_settings_key_key" ON "g4d_plan_settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_plan_subscriptions_currentVendorId_key" ON "g4d_plan_subscriptions"("currentVendorId");

-- CreateIndex
CREATE INDEX "g4d_plan_subscriptions_vendorId_status_idx" ON "g4d_plan_subscriptions"("vendorId", "status");

-- CreateIndex
CREATE INDEX "g4d_plan_subscriptions_planId_idx" ON "g4d_plan_subscriptions"("planId");

-- CreateIndex
CREATE INDEX "g4d_subscription_events_vendorId_at_idx" ON "g4d_subscription_events"("vendorId", "at");

-- CreateIndex
CREATE INDEX "g4d_subscription_events_subscriptionId_idx" ON "g4d_subscription_events"("subscriptionId");

-- CreateIndex
CREATE INDEX "g4d_entitlement_overrides_vendorId_featureKey_idx" ON "g4d_entitlement_overrides"("vendorId", "featureKey");

-- CreateIndex
CREATE INDEX "g4d_entitlement_overrides_expiresAt_idx" ON "g4d_entitlement_overrides"("expiresAt");

-- CreateIndex
CREATE INDEX "g4d_audit_logs_entityType_entityId_at_idx" ON "g4d_audit_logs"("entityType", "entityId", "at");

-- CreateIndex
CREATE INDEX "g4d_audit_logs_at_idx" ON "g4d_audit_logs"("at");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_vendor_flags_vendorId_key_key" ON "g4d_vendor_flags"("vendorId", "key");

-- AddForeignKey
ALTER TABLE "g4d_plan_prices" ADD CONSTRAINT "g4d_plan_prices_planId_fkey" FOREIGN KEY ("planId") REFERENCES "g4d_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_plan_features" ADD CONSTRAINT "g4d_plan_features_planId_fkey" FOREIGN KEY ("planId") REFERENCES "g4d_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_plan_features" ADD CONSTRAINT "g4d_plan_features_featureKey_fkey" FOREIGN KEY ("featureKey") REFERENCES "g4d_features"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_plan_subscriptions" ADD CONSTRAINT "g4d_plan_subscriptions_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_plan_subscriptions" ADD CONSTRAINT "g4d_plan_subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "g4d_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_subscription_events" ADD CONSTRAINT "g4d_subscription_events_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_entitlement_overrides" ADD CONSTRAINT "g4d_entitlement_overrides_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_entitlement_overrides" ADD CONSTRAINT "g4d_entitlement_overrides_featureKey_fkey" FOREIGN KEY ("featureKey") REFERENCES "g4d_features"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_vendor_flags" ADD CONSTRAINT "g4d_vendor_flags_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Same rule as every other public table (prisma/sql/enable_rls_public.sql): RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_plan_prices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_features" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_plan_features" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_tax_rates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_discount_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_plan_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_plan_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_subscription_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_entitlement_overrides" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_vendor_flags" ENABLE ROW LEVEL SECURITY;
