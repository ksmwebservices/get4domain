-- Commercial Engine v1 (dispatch 07-Oct-2026) — ADDITIVE ONLY.
--
-- Adds: PayeeSettings, BillingTerm, BillingDeal (named so because `Deal` is the real-estate model),
-- ManualPaymentSubmission, PromoCode, PromoRedemption, PlanChangeRequest, CommercialAuditLog,
-- and extends "Invoice" with nullable/defaulted commercial columns + six new InvoiceStatus values.
-- Nothing is dropped, renamed, retyped or rewritten; every existing row and query is unaffected
-- (legacy invoices have kind = NULL and keep their exact behaviour).
--
-- Output below is the exact DDL from `prisma migrate diff` (HEAD schema -> new schema).
-- NOTE: `ALTER TYPE ... ADD VALUE` is transaction-safe on PostgreSQL >= 12 (Supabase runs 15); the new
-- values are not referenced anywhere in this migration.
--
-- Deploy order: apply this migration BEFORE deploying the backend built against the new Prisma client
-- (the generated client selects the new Invoice columns on every Invoice query).
--
-- Rollback (only while nothing writes the new columns/tables): DROP the eight g4d_* tables, then
--   ALTER TABLE "Invoice" DROP COLUMN ... (the new columns), DROP TYPE ... (the new enums).
-- The six new InvoiceStatus values cannot be removed without recreating the type — harmless to leave.

-- CreateEnum
CREATE TYPE "BillingPlanKey" AS ENUM ('WORKSPACE', 'BOS');
-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'HALF_YEARLY', 'ANNUAL', 'CUSTOM_MONTHS');
-- CreateEnum
CREATE TYPE "GstMode" AS ENUM ('EXCLUSIVE', 'INCLUSIVE', 'NONE');
-- CreateEnum
CREATE TYPE "BillingTermStatus" AS ENUM ('DEMO', 'ACTIVE', 'ACTIVE_PAYMENT_DUE', 'LAPSED', 'CANCELLED');
-- CreateEnum
CREATE TYPE "TermSource" AS ENUM ('STANDARD', 'ADMIN_DEAL');
-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'EXPIRED');
-- CreateEnum
CREATE TYPE "InvoiceKind" AS ENUM ('ACTIVATION', 'RENEWAL', 'PLAN_CHANGE', 'ADDON', 'MANAGED_SERVICE');
-- CreateEnum
CREATE TYPE "PayChannel" AS ENUM ('RAZORPAY', 'UPI_QR', 'OFFLINE');
-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('SUBMITTED', 'CONFIRMED', 'REJECTED');
-- CreateEnum
CREATE TYPE "PromoType" AS ENUM ('PERCENT', 'FLAT');
-- CreateEnum
CREATE TYPE "PlanChangeEffective" AS ENUM ('AT_RENEWAL', 'NOW');
-- CreateEnum
CREATE TYPE "PlanChangeStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'APPLIED');
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.
ALTER TYPE "InvoiceStatus" ADD VALUE 'DRAFT';
ALTER TYPE "InvoiceStatus" ADD VALUE 'SENT';
ALTER TYPE "InvoiceStatus" ADD VALUE 'PAYMENT_SUBMITTED';
ALTER TYPE "InvoiceStatus" ADD VALUE 'PARTIALLY_PAID';
ALTER TYPE "InvoiceStatus" ADD VALUE 'VOID';
ALTER TYPE "InvoiceStatus" ADD VALUE 'EXPIRED';
-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "adminDiscount" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "allowPromoEntry" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "allowPromoStacking" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "allowedChannels" "PayChannel"[] DEFAULT ARRAY[]::"PayChannel"[],
ADD COLUMN     "billingCycle" "BillingCycle",
ADD COLUMN     "cycleMonths" INTEGER,
ADD COLUMN     "dealId" TEXT,
ADD COLUMN     "discountPaise" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "discountReason" TEXT,
ADD COLUMN     "effectsAppliedAt" TIMESTAMP(3),
ADD COLUMN     "gstMode" "GstMode" NOT NULL DEFAULT 'EXCLUSIVE',
ADD COLUMN     "kind" "InvoiceKind",
ADD COLUMN     "lineItems" JSONB,
ADD COLUMN     "listAmountPaise" INTEGER,
ADD COLUMN     "overpaymentPaise" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "paidPaise" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "paidVia" "PayChannel",
ADD COLUMN     "payTokenHash" TEXT,
ADD COLUMN     "periodEnd" TIMESTAMP(3),
ADD COLUMN     "periodStart" TIMESTAMP(3),
ADD COLUMN     "planKey" "BillingPlanKey",
ADD COLUMN     "promoCodeId" TEXT,
ADD COLUMN     "sentAt" TIMESTAMP(3),
ADD COLUMN     "termId" TEXT,
ADD COLUMN     "tokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "voidReason" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMP(3);
-- CreateTable
CREATE TABLE "g4d_payee_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT 'default',
    "upiId" TEXT,
    "payeeName" TEXT,
    "qrImageUrl" TEXT,
    "bankName" TEXT,
    "bankAccountName" TEXT,
    "bankAccountNumber" TEXT,
    "bankIfsc" TEXT,
    "bankBranch" TEXT,
    "instructions" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_payee_settings_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "g4d_billing_terms" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "planKey" "BillingPlanKey" NOT NULL,
    "billingCycle" "BillingCycle" NOT NULL,
    "cycleMonths" INTEGER NOT NULL,
    "listAmountPaise" INTEGER NOT NULL,
    "discountPaise" INTEGER NOT NULL DEFAULT 0,
    "netAmountPaise" INTEGER NOT NULL,
    "gstMode" "GstMode" NOT NULL DEFAULT 'EXCLUSIVE',
    "gstNote" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "graceDays" INTEGER NOT NULL DEFAULT 7,
    "status" "BillingTermStatus" NOT NULL DEFAULT 'DEMO',
    "source" "TermSource" NOT NULL DEFAULT 'STANDARD',
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "allowedChannels" "PayChannel"[] DEFAULT ARRAY[]::"PayChannel"[],
    "scheduledNextPlan" "BillingPlanKey",
    "scheduledNextCycle" "BillingCycle",
    "scheduledNextCycleMonths" INTEGER,
    "subscriptionId" TEXT,
    "activationInvoiceId" TEXT,
    "renewalInvoiceId" TEXT,
    "paymentDueAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "lapsedAt" TIMESTAMP(3),
    "reminders" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_billing_terms_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "g4d_billing_deals" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT,
    "prospectName" TEXT,
    "prospectPhone" TEXT,
    "prospectEmail" TEXT,
    "prospectBusiness" TEXT,
    "demoSubdomain" TEXT,
    "status" "DealStatus" NOT NULL DEFAULT 'DRAFT',
    "planKey" "BillingPlanKey",
    "billingCycle" "BillingCycle",
    "cycleMonths" INTEGER,
    "lineItems" JSONB NOT NULL,
    "listAmountPaise" INTEGER NOT NULL DEFAULT 0,
    "discountPaise" INTEGER NOT NULL DEFAULT 0,
    "discountReason" TEXT,
    "promoCodeId" TEXT,
    "gstMode" "GstMode" NOT NULL DEFAULT 'EXCLUSIVE',
    "graceDays" INTEGER NOT NULL DEFAULT 7,
    "allowedChannels" "PayChannel"[] DEFAULT ARRAY[]::"PayChannel"[],
    "linkExpiryDays" INTEGER NOT NULL DEFAULT 14,
    "allowPromoEntry" BOOLEAN NOT NULL DEFAULT false,
    "activateNow" BOOLEAN NOT NULL DEFAULT false,
    "paymentDueDays" INTEGER,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_billing_deals_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "g4d_manual_payment_submissions" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "utr" TEXT NOT NULL,
    "claimedAmountPaise" INTEGER NOT NULL,
    "confirmedAmountPaise" INTEGER,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "screenshotUrl" TEXT,
    "screenshotMime" TEXT,
    "payerNote" TEXT,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reason" TEXT,
    "submittedByIpHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_manual_payment_submissions_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "g4d_promo_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "type" "PromoType" NOT NULL,
    "value" INTEGER NOT NULL,
    "appliesToPlans" "BillingPlanKey"[] DEFAULT ARRAY[]::"BillingPlanKey"[],
    "appliesToCycles" "BillingCycle"[] DEFAULT ARRAY[]::"BillingCycle"[],
    "appliesToKinds" "InvoiceKind"[] DEFAULT ARRAY[]::"InvoiceKind"[],
    "minCycleMonths" INTEGER,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "maxRedemptions" INTEGER,
    "perVendorLimit" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_promo_codes_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "g4d_promo_redemptions" (
    "id" TEXT NOT NULL,
    "promoCodeId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "discountPaise" INTEGER NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "g4d_promo_redemptions_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "g4d_plan_change_requests" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "fromTermId" TEXT,
    "toPlanKey" "BillingPlanKey" NOT NULL,
    "toCycle" "BillingCycle" NOT NULL,
    "toCycleMonths" INTEGER NOT NULL,
    "effective" "PlanChangeEffective" NOT NULL DEFAULT 'AT_RENEWAL',
    "status" "PlanChangeStatus" NOT NULL DEFAULT 'REQUESTED',
    "prorationCreditPaise" INTEGER NOT NULL DEFAULT 0,
    "vendorNote" TEXT,
    "adminNote" TEXT,
    "newInvoiceId" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_plan_change_requests_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "g4d_commercial_audit_log" (
    "id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "g4d_commercial_audit_log_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "g4d_payee_settings_key_key" ON "g4d_payee_settings"("key");
-- CreateIndex
CREATE INDEX "g4d_billing_terms_vendorId_isCurrent_idx" ON "g4d_billing_terms"("vendorId", "isCurrent");
-- CreateIndex
CREATE INDEX "g4d_billing_terms_status_periodEnd_idx" ON "g4d_billing_terms"("status", "periodEnd");
-- CreateIndex
CREATE INDEX "g4d_billing_deals_vendorId_idx" ON "g4d_billing_deals"("vendorId");
-- CreateIndex
CREATE INDEX "g4d_billing_deals_status_idx" ON "g4d_billing_deals"("status");
-- CreateIndex
CREATE UNIQUE INDEX "g4d_manual_payment_submissions_utr_key" ON "g4d_manual_payment_submissions"("utr");
-- CreateIndex
CREATE INDEX "g4d_manual_payment_submissions_invoiceId_idx" ON "g4d_manual_payment_submissions"("invoiceId");
-- CreateIndex
CREATE INDEX "g4d_manual_payment_submissions_status_idx" ON "g4d_manual_payment_submissions"("status");
-- CreateIndex
CREATE UNIQUE INDEX "g4d_promo_codes_code_key" ON "g4d_promo_codes"("code");
-- CreateIndex
CREATE UNIQUE INDEX "g4d_promo_redemptions_invoiceId_key" ON "g4d_promo_redemptions"("invoiceId");
-- CreateIndex
CREATE INDEX "g4d_promo_redemptions_promoCodeId_idx" ON "g4d_promo_redemptions"("promoCodeId");
-- CreateIndex
CREATE INDEX "g4d_promo_redemptions_vendorId_idx" ON "g4d_promo_redemptions"("vendorId");
-- CreateIndex
CREATE INDEX "g4d_plan_change_requests_vendorId_idx" ON "g4d_plan_change_requests"("vendorId");
-- CreateIndex
CREATE INDEX "g4d_plan_change_requests_status_idx" ON "g4d_plan_change_requests"("status");
-- CreateIndex
CREATE INDEX "g4d_commercial_audit_log_entityType_entityId_idx" ON "g4d_commercial_audit_log"("entityType", "entityId");
-- CreateIndex
CREATE INDEX "g4d_commercial_audit_log_createdAt_idx" ON "g4d_commercial_audit_log"("createdAt");
-- CreateIndex
CREATE UNIQUE INDEX "Invoice_payTokenHash_key" ON "Invoice"("payTokenHash");
-- CreateIndex
CREATE INDEX "Invoice_vendorId_status_idx" ON "Invoice"("vendorId", "status");
-- CreateIndex
CREATE INDEX "Invoice_kind_status_idx" ON "Invoice"("kind", "status");
-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "g4d_billing_deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "g4d_billing_terms" ADD CONSTRAINT "g4d_billing_terms_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "g4d_billing_deals" ADD CONSTRAINT "g4d_billing_deals_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "g4d_promo_redemptions" ADD CONSTRAINT "g4d_promo_redemptions_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "g4d_promo_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "g4d_plan_change_requests" ADD CONSTRAINT "g4d_plan_change_requests_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
