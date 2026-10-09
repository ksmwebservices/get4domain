-- LeadSpace (Dispatch B, 2026-10-10). ADDITIVE ONLY: 21 new tables, no existing table changed.
-- Rollback (only if nothing has been written to them): DROP the g4d_leadspace_*, g4d_lead_*, g4d_consent_records, g4d_invalid_lead_credits,
-- g4d_whatsapp_*, g4d_social_*, g4d_promotion_plans, g4d_post_jobs and g4d_ad_spend_entries tables. Re-run prisma/sql/enable_rls_public.sql after applying.

-- CreateTable
CREATE TABLE "g4d_leadspace_profiles" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "city" TEXT NOT NULL,
    "serviceArea" TEXT,
    "goal" TEXT NOT NULL DEFAULT 'ENQUIRY',
    "mode" TEXT NOT NULL DEFAULT 'TEMPLATE',
    "templateId" TEXT NOT NULL DEFAULT 'generic',
    "businessName" TEXT NOT NULL,
    "tagline" TEXT,
    "about" TEXT,
    "phone" TEXT,
    "alertWhatsapp" TEXT,
    "email" TEXT,
    "address" TEXT,
    "mapsLink" TEXT,
    "heroImage" TEXT,
    "services" JSONB NOT NULL DEFAULT '[]',
    "offer" JSONB,
    "gallery" JSONB,
    "faqs" JSONB,
    "trust" JSONB,
    "hours" TEXT,
    "existingPageUrl" TEXT,
    "verificationStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "noindex" BOOLEAN NOT NULL DEFAULT true,
    "regulated" JSONB,
    "reraNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "suspendedReason" TEXT,
    "lowBalanceMode" TEXT NOT NULL DEFAULT 'HOLD',
    "promotionEnabled" BOOLEAN NOT NULL DEFAULT false,
    "views" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_leadspace_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_lead_events" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "profileId" TEXT,
    "type" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "phoneHash" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "source" TEXT,
    "utm" JSONB,
    "consentId" TEXT,
    "otpVerifiedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "priceQuotedPaise" INTEGER,
    "priceChargedPaise" INTEGER NOT NULL DEFAULT 0,
    "ledgerId" TEXT,
    "vendorNote" TEXT,
    "orderDecision" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_lead_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_lead_price_rules" (
    "id" TEXT NOT NULL,
    "category" TEXT,
    "city" TEXT,
    "eventType" TEXT NOT NULL,
    "pricePaise" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdBy" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_lead_price_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_lead_purses" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'LEADS',
    "balancePaise" INTEGER NOT NULL DEFAULT 0,
    "totalCredited" INTEGER NOT NULL DEFAULT 0,
    "totalDebited" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_lead_purses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_lead_purse_entries" (
    "id" TEXT NOT NULL,
    "purseId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "note" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "razorpayId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_lead_purse_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_consent_records" (
    "id" TEXT NOT NULL,
    "phoneHash" TEXT NOT NULL,
    "textVersion" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "vendorId" TEXT,
    "slug" TEXT,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_invalid_lead_credits" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "decidedBy" TEXT NOT NULL,
    "decidedById" TEXT,
    "amountPaise" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_invalid_lead_credits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_lead_disputes" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "decidedBy" TEXT,
    "decisionNote" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_lead_disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_lead_otps" (
    "id" TEXT NOT NULL,
    "phoneHash" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "vendorId" TEXT,
    "consentId" TEXT,
    "deviceHash" TEXT,
    "ipHash" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_lead_otps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_lead_blocked_phones" (
    "id" TEXT NOT NULL,
    "phoneHash" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_lead_blocked_phones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_lead_refill_packs" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "payPaise" INTEGER NOT NULL,
    "creditPaise" INTEGER NOT NULL,
    "gstMode" TEXT NOT NULL DEFAULT 'INCLUSIVE',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_lead_refill_packs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_lead_refund_requests" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "paymentFeePaise" INTEGER NOT NULL DEFAULT 0,
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_lead_refund_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_leadspace_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_leadspace_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "g4d_whatsapp_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "body" TEXT NOT NULL,
    "approvalStatus" TEXT NOT NULL DEFAULT 'SANDBOX',
    "providerTemplateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_whatsapp_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_whatsapp_message_logs" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "toMasked" TEXT NOT NULL,
    "phoneHash" TEXT NOT NULL,
    "vendorId" TEXT,
    "status" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_whatsapp_message_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_social_accounts" (
    "id" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL,
    "vendorId" TEXT,
    "channel" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "externalId" TEXT,
    "theme" TEXT,
    "city" TEXT,
    "category" TEXT,
    "tokenEnc" TEXT,
    "scopes" JSONB,
    "status" TEXT NOT NULL DEFAULT 'SANDBOX',
    "dailyCap" INTEGER NOT NULL DEFAULT 3,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_social_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_social_posts" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'TEXT',
    "content" TEXT NOT NULL,
    "imageUrl" TEXT,
    "linkUrl" TEXT,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "providerPostId" TEXT,
    "postUrl" TEXT,
    "error" TEXT,
    "results" JSONB,
    "idempotencyKey" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_social_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_promotion_plans" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "channels" JSONB NOT NULL DEFAULT '[]',
    "schedule" JSONB NOT NULL DEFAULT '{}',
    "theme" TEXT,
    "offer" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "manualUntil" TIMESTAMP(3),
    "autoApprove" BOOLEAN NOT NULL DEFAULT false,
    "killSwitch" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_promotion_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_post_jobs" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "accountId" TEXT,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "theme" TEXT,
    "content" JSONB NOT NULL,
    "assetUrl" TEXT,
    "linkUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AWAITING_APPROVAL',
    "approvalLog" JSONB NOT NULL DEFAULT '[]',
    "results" JSONB,
    "socialPostId" TEXT,
    "manualTask" BOOLEAN NOT NULL DEFAULT false,
    "manualDoneAt" TIMESTAMP(3),
    "manualTarget" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_post_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_ad_spend_entries" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "channel" TEXT NOT NULL,
    "category" TEXT,
    "city" TEXT,
    "amountPaise" INTEGER NOT NULL,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_ad_spend_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_leadspace_abuse_reports" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "ipHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_leadspace_abuse_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "g4d_leadspace_profiles_vendorId_key" ON "g4d_leadspace_profiles"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_leadspace_profiles_slug_key" ON "g4d_leadspace_profiles"("slug");

-- CreateIndex
CREATE INDEX "g4d_leadspace_profiles_category_city_idx" ON "g4d_leadspace_profiles"("category", "city");

-- CreateIndex
CREATE INDEX "g4d_leadspace_profiles_status_idx" ON "g4d_leadspace_profiles"("status");

-- CreateIndex
CREATE INDEX "g4d_lead_events_vendorId_createdAt_idx" ON "g4d_lead_events"("vendorId", "createdAt");

-- CreateIndex
CREATE INDEX "g4d_lead_events_vendorId_status_createdAt_idx" ON "g4d_lead_events"("vendorId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "g4d_lead_events_vendorId_phoneHash_type_createdAt_idx" ON "g4d_lead_events"("vendorId", "phoneHash", "type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_lead_events_vendorId_idempotencyKey_key" ON "g4d_lead_events"("vendorId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "g4d_lead_price_rules_eventType_effectiveFrom_idx" ON "g4d_lead_price_rules"("eventType", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_lead_purses_vendorId_kind_key" ON "g4d_lead_purses"("vendorId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_lead_purse_entries_idempotencyKey_key" ON "g4d_lead_purse_entries"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_lead_purse_entries_razorpayId_key" ON "g4d_lead_purse_entries"("razorpayId");

-- CreateIndex
CREATE INDEX "g4d_lead_purse_entries_vendorId_createdAt_idx" ON "g4d_lead_purse_entries"("vendorId", "createdAt");

-- CreateIndex
CREATE INDEX "g4d_consent_records_phoneHash_createdAt_idx" ON "g4d_consent_records"("phoneHash", "createdAt");

-- CreateIndex
CREATE INDEX "g4d_invalid_lead_credits_vendorId_createdAt_idx" ON "g4d_invalid_lead_credits"("vendorId", "createdAt");

-- CreateIndex
CREATE INDEX "g4d_invalid_lead_credits_leadId_idx" ON "g4d_invalid_lead_credits"("leadId");

-- CreateIndex
CREATE INDEX "g4d_lead_disputes_status_createdAt_idx" ON "g4d_lead_disputes"("status", "createdAt");

-- CreateIndex
CREATE INDEX "g4d_lead_disputes_vendorId_idx" ON "g4d_lead_disputes"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_lead_otps_phoneHash_createdAt_idx" ON "g4d_lead_otps"("phoneHash", "createdAt");

-- CreateIndex
CREATE INDEX "g4d_lead_otps_deviceHash_createdAt_idx" ON "g4d_lead_otps"("deviceHash", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_lead_blocked_phones_phoneHash_key" ON "g4d_lead_blocked_phones"("phoneHash");

-- CreateIndex
CREATE INDEX "g4d_lead_refund_requests_status_idx" ON "g4d_lead_refund_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_whatsapp_templates_name_key" ON "g4d_whatsapp_templates"("name");

-- CreateIndex
CREATE INDEX "g4d_whatsapp_message_logs_vendorId_createdAt_idx" ON "g4d_whatsapp_message_logs"("vendorId", "createdAt");

-- CreateIndex
CREATE INDEX "g4d_whatsapp_message_logs_phoneHash_createdAt_idx" ON "g4d_whatsapp_message_logs"("phoneHash", "createdAt");

-- CreateIndex
CREATE INDEX "g4d_social_accounts_ownerType_channel_idx" ON "g4d_social_accounts"("ownerType", "channel");

-- CreateIndex
CREATE INDEX "g4d_social_accounts_vendorId_idx" ON "g4d_social_accounts"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_social_posts_idempotencyKey_key" ON "g4d_social_posts"("idempotencyKey");

-- CreateIndex
CREATE INDEX "g4d_social_posts_status_scheduledFor_idx" ON "g4d_social_posts"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "g4d_social_posts_accountId_scheduledFor_idx" ON "g4d_social_posts"("accountId", "scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_promotion_plans_vendorId_key" ON "g4d_promotion_plans"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_post_jobs_status_scheduledFor_idx" ON "g4d_post_jobs"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "g4d_post_jobs_vendorId_idx" ON "g4d_post_jobs"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_ad_spend_entries_date_idx" ON "g4d_ad_spend_entries"("date");

-- CreateIndex
CREATE INDEX "g4d_leadspace_abuse_reports_slug_idx" ON "g4d_leadspace_abuse_reports"("slug");

-- CreateIndex
CREATE INDEX "g4d_leadspace_abuse_reports_status_idx" ON "g4d_leadspace_abuse_reports"("status");

