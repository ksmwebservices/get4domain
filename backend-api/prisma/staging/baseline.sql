-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'VENDOR');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'MARKETING', 'OPERATIONS');

-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'PENDING');

-- CreateEnum
CREATE TYPE "Product" AS ENUM ('DOMAIN_APP', 'DOMAIN_CAMPAIGN', 'BOTH');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('STARTUP', 'ENTERPRISE', 'STARTER', 'BUSINESS');

-- CreateEnum
CREATE TYPE "SubStatus" AS ENUM ('PENDING', 'ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED', 'DRAFT', 'SENT', 'PAYMENT_SUBMITTED', 'PARTIALLY_PAID', 'VOID', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

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

-- CreateEnum
CREATE TYPE "StockMovementReason" AS ENUM ('ONLINE_ORDER', 'SHOP_SALE', 'ADJUSTMENT', 'RETURN', 'CANCEL', 'OPENING', 'DAMAGE', 'RECOUNT', 'PURCHASE', 'TRANSFER');

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "phone" TEXT,
    "industry" TEXT DEFAULT 'general',
    "subdomain" TEXT,
    "widgetKey" TEXT,
    "waPhoneNumberId" TEXT,
    "customDomain" TEXT,
    "resellerClubCustomerId" TEXT,
    "resellerClubContactId" TEXT,
    "role" "Role" NOT NULL DEFAULT 'VENDOR',
    "status" "VendorStatus" NOT NULL DEFAULT 'ACTIVE',
    "configOverride" JSONB,
    "isSandbox" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "product" "Product" NOT NULL,
    "plan" "Plan" NOT NULL,
    "status" "SubStatus" NOT NULL DEFAULT 'PENDING',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "themeChangesUsed" INTEGER NOT NULL DEFAULT 0,
    "themeChangesLimit" INTEGER,
    "themeChangesResetAt" TIMESTAMP(3),

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "description" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "gstAmount" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "gstNumber" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "paidAt" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "kind" "InvoiceKind",
    "dealId" TEXT,
    "termId" TEXT,
    "payTokenHash" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "allowedChannels" "PayChannel"[] DEFAULT ARRAY[]::"PayChannel"[],
    "gstMode" "GstMode" NOT NULL DEFAULT 'EXCLUSIVE',
    "listAmountPaise" INTEGER,
    "discountPaise" INTEGER NOT NULL DEFAULT 0,
    "discountReason" TEXT,
    "adminDiscount" BOOLEAN NOT NULL DEFAULT false,
    "allowPromoStacking" BOOLEAN NOT NULL DEFAULT false,
    "promoCodeId" TEXT,
    "allowPromoEntry" BOOLEAN NOT NULL DEFAULT false,
    "lineItems" JSONB,
    "planKey" "BillingPlanKey",
    "billingCycle" "BillingCycle",
    "cycleMonths" INTEGER,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "paidPaise" INTEGER NOT NULL DEFAULT 0,
    "overpaymentPaise" INTEGER NOT NULL DEFAULT 0,
    "paidVia" "PayChannel",
    "sentAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "effectsAppliedAt" TIMESTAMP(3),
    "gstForgonePaise" INTEGER,
    "gstNote" TEXT,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "adminReply" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorCMS" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "businessName" TEXT,
    "tagline" TEXT,
    "about" TEXT,
    "logo" TEXT,
    "banner" TEXT,
    "favicon" TEXT,
    "themeId" TEXT,
    "seoTitle" TEXT,
    "seoDesc" TEXT,
    "seoKeywords" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "businessHours" TEXT,
    "whatsapp" TEXT,
    "facebook" TEXT,
    "instagram" TEXT,
    "linkedin" TEXT,
    "youtube" TEXT,
    "googleMaps" TEXT,
    "googleAnalyticsId" TEXT,
    "portfolio" JSONB,
    "draft" JSONB,
    "layout" JSONB,
    "ogImage" TEXT,
    "testimonials" JSONB,
    "pages" JSONB,
    "packKey" TEXT,
    "publishedAt" TIMESTAMP(3),
    "siteVersion" INTEGER NOT NULL DEFAULT 0,
    "extras" JSONB,
    "designKey" TEXT,
    "siteStatus" TEXT NOT NULL DEFAULT 'LIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorCMS_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_site_versions" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_site_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_media_assets" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "originalUrl" TEXT,
    "mime" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "originalBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_category_packs" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_category_packs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_theme_packages" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "manifest" JSONB NOT NULL,
    "pages" JSONB NOT NULL,
    "css" TEXT NOT NULL,
    "assetIndex" JSONB NOT NULL,
    "googleFonts" JSONB,
    "families" JSONB NOT NULL,
    "categories" JSONB NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MARKETPLACE',
    "replacesDesign" TEXT,
    "priceYearlyPaise" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "previewPath" TEXT,
    "lint" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_theme_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_theme_assets" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_theme_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_theme_entitlements" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "themeKey" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "paymentRef" TEXT,
    "invoiceRef" TEXT,
    "amountPaise" INTEGER NOT NULL DEFAULT 0,
    "gstPaise" INTEGER NOT NULL DEFAULT 0,
    "remindersSent" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_theme_entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorProduct" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" TEXT,
    "image" TEXT,
    "category" TEXT,
    "categoryId" TEXT,
    "customFields" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "industryType" TEXT,
    "priceAmount" DOUBLE PRECISION,
    "unit" TEXT,
    "sku" TEXT,
    "stockQty" INTEGER,
    "trackStock" BOOLEAN NOT NULL DEFAULT false,
    "reorderLevel" INTEGER,
    "hsn" TEXT,
    "gstRate" DOUBLE PRECISION,
    "purchasePriceAmount" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'active',
    "operationKey" TEXT,
    "sourceModel" TEXT,
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_categories" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameNormalized" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformCMS" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformCMS_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_leads" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "business" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "interest" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "source" TEXT,
    "preferredDate" TIMESTAMP(3),
    "preferredSlot" TEXT,
    "notes" TEXT,
    "assignedTo" TEXT,
    "followUpDate" TIMESTAMP(3),
    "demoCategory" TEXT,
    "demoVisitKeys" TEXT,
    "demoVisitCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_lead_call_logs" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "calledBy" TEXT,
    "duration" INTEGER,
    "outcome" TEXT,
    "notes" TEXT,
    "aiSummary" TEXT,
    "followUpAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_lead_call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_wallets" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "totalCredited" INTEGER NOT NULL DEFAULT 0,
    "totalDebited" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_wallet_transactions" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "razorpayId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_campaign_pages" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "subheadline" TEXT,
    "benefits" JSONB NOT NULL,
    "aboutText" TEXT,
    "heroImage" TEXT,
    "photos" JSONB,
    "style" TEXT NOT NULL DEFAULT 'LIGHT',
    "phone" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT,
    "mapsLink" TEXT,
    "testimonials" JSONB,
    "ctaText" TEXT NOT NULL DEFAULT 'Enquire Now',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "views" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_campaign_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_campaign_leads" (
    "id" TEXT NOT NULL,
    "campaignPageId" TEXT,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "message" TEXT,
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "customFields" JSONB,
    "notes" TEXT,
    "assignedTo" TEXT,
    "followUpDate" TIMESTAMP(3),
    "contactId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_campaign_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_call_logs" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "calledBy" TEXT NOT NULL,
    "duration" INTEGER,
    "outcome" TEXT,
    "notes" TEXT,
    "aiSummary" TEXT,
    "followUpAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_campaigns" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "channels" JSONB NOT NULL,
    "content" JSONB NOT NULL,
    "walletCost" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "analytics" JSONB,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_team_members" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "role" TEXT NOT NULL,
    "department" TEXT,
    "modules" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "inviteToken" TEXT,
    "password" TEXT,
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_notifications" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "recipientType" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "actionRequired" BOOLEAN NOT NULL DEFAULT false,
    "actionType" TEXT,
    "actionData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_push_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userType" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_platform_income" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "amount" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_platform_income_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_contacts" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "type" TEXT NOT NULL DEFAULT 'customer',
    "address" TEXT,
    "portalAccess" BOOLEAN NOT NULL DEFAULT false,
    "customFields" JSONB,
    "tags" JSONB,
    "notes" TEXT,
    "gstin" TEXT,
    "state" TEXT,
    "shippingAddress" TEXT,
    "openingBalancePaise" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_messages" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "contactId" TEXT,
    "channel" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'out',
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "providerMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_catalog_items" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "image" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "stock" INTEGER,
    "customFields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_catalog_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_records" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "contactId" TEXT,
    "catalogItemId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "customFields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_generic_invoices" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "recordId" TEXT,
    "contactId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "gstRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "dueDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "razorpayLinkId" TEXT,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_generic_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_vendor_addons" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "addonKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "enabledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "config" JSONB,

    CONSTRAINT "g4d_vendor_addons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_vendor_modules" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "enabledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_vendor_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_platform_settings" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "encrypted" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'NOT_CONFIGURED',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "g4d_platform_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_quotes" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT,
    "leadId" TEXT,
    "prospectName" TEXT NOT NULL,
    "prospectPhone" TEXT,
    "prospectEmail" TEXT,
    "quoteType" TEXT NOT NULL,
    "itemLabel" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "notes" TEXT,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "sentBy" TEXT,
    "items" JSONB,
    "shareToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_managed_service_catalog_items" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "defaultRate" INTEGER NOT NULL,
    "unit" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_managed_service_catalog_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_domain_campaign_records" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "adSpendPaise" INTEGER NOT NULL,
    "feePaise" INTEGER NOT NULL,
    "isCustomFee" BOOLEAN NOT NULL DEFAULT false,
    "invoiceId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_domain_campaign_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_admin_team_members" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "role" "AdminRole" NOT NULL DEFAULT 'OPERATIONS',
    "status" TEXT NOT NULL DEFAULT 'invited',
    "inviteToken" TEXT,
    "password" TEXT,
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_admin_team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_ai_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "industry" TEXT,
    "prompt" TEXT NOT NULL,
    "thumbnail" TEXT,
    "source" TEXT NOT NULL DEFAULT 'prompt',
    "canvaTemplateId" TEXT,
    "fields" JSONB,
    "editorJson" JSONB,
    "videoConfig" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_ai_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_website_themes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "industry" TEXT,
    "cssVars" JSONB NOT NULL,
    "pages" JSONB,
    "css" TEXT,
    "js" TEXT,
    "fonts" JSONB,
    "layout" JSONB,
    "price" INTEGER,
    "preview" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_website_themes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_vendor_payment_config" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'razorpay',
    "razorpayKeyId" TEXT,
    "razorpayKeySecret" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "checkoutMode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_vendor_payment_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_vendor_template_unlock" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL DEFAULT 0,
    "paymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_vendor_template_unlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_expenses" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "gstRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL,
    "paymentMethod" TEXT NOT NULL DEFAULT 'offline',
    "attachment" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_stationery" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reorderThreshold" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_stationery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_kb_entries" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "keywords" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_kb_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_wa_conversations" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "contactId" TEXT,
    "phone" TEXT NOT NULL,
    "phoneNumberId" TEXT,
    "state" TEXT NOT NULL DEFAULT 'active',
    "nameCaptured" BOOLEAN NOT NULL DEFAULT false,
    "leadId" TEXT,
    "windowStart" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_wa_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_vendor_tasks" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'new',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "assignee" TEXT,
    "segment" TEXT,
    "subtasks" JSONB,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_vendor_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_pos_tables" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "seats" INTEGER NOT NULL DEFAULT 2,
    "status" TEXT NOT NULL DEFAULT 'available',
    "orderTotal" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_pos_tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_kitchen_tickets" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "tableName" TEXT,
    "items" TEXT NOT NULL,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'preparing',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_kitchen_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_pos_sales" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'retail',
    "items" JSONB NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL,
    "paymentMethod" TEXT NOT NULL DEFAULT 'cash',
    "status" TEXT NOT NULL DEFAULT 'completed',
    "tableName" TEXT,
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "customerEmail" TEXT,
    "deliveryAddress" TEXT,
    "orderNote" TEXT,
    "orderSource" TEXT,
    "idempotencyKey" TEXT,
    "paidAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_pos_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_appointments" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "contactId" TEXT,
    "customerName" TEXT NOT NULL,
    "phone" TEXT,
    "service" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 30,
    "status" TEXT NOT NULL DEFAULT 'booked',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_payment_records" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "party" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'cleared',
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_payment_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_gst_filings" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "formType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "dueDate" TIMESTAMP(3),
    "filedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_gst_filings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_domain_registrations" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "domainName" TEXT NOT NULL,
    "tld" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'registered',
    "registrar" TEXT NOT NULL DEFAULT 'resellerclub',
    "registrarOrderId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "pricePaise" INTEGER NOT NULL DEFAULT 0,
    "years" INTEGER NOT NULL DEFAULT 1,
    "mappingType" TEXT,
    "mappingVerifiedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_domain_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_vehicles" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'sedan',
    "regNumber" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 4,
    "status" TEXT NOT NULL DEFAULT 'available',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_drivers" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "licenseNo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'available',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_trips" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "contactId" TEXT,
    "title" TEXT NOT NULL,
    "destination" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "pax" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'planning',
    "packageCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sellPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "itinerary" JSONB,
    "vehicleId" TEXT,
    "driverId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_visa_applications" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "tripId" TEXT,
    "travelerName" TEXT NOT NULL,
    "passportNo" TEXT,
    "country" TEXT NOT NULL,
    "visaType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'applied',
    "appliedDate" TIMESTAMP(3),
    "decisionDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_visa_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_vendor_comms_settings" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "waEnabled" BOOLEAN NOT NULL DEFAULT true,
    "waDisplayNumber" TEXT,
    "waTemplateId" TEXT,
    "waGreeting" TEXT,
    "waStatus" TEXT NOT NULL DEFAULT 'unverified',
    "waVerifiedAt" TIMESTAMP(3),
    "smsBusinessName" TEXT,
    "emailFromName" TEXT,
    "emailReplyTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "g4d_vendor_comms_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_contracts" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "monthlyRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gstRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "billingDayOfMonth" INTEGER NOT NULL DEFAULT 1,
    "scheduleNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastBilledPeriod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_contract_assignments" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "driverId" TEXT,
    "routeLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_contract_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_stylists" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "specialty" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_stylists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_salon_chairs" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'available',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_salon_chairs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_salon_appointments" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "contactId" TEXT,
    "clientName" TEXT NOT NULL,
    "clientPhone" TEXT,
    "serviceName" TEXT NOT NULL,
    "stylistId" TEXT,
    "chairId" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 45,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_salon_appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_gym_classes" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trainer" TEXT,
    "dayOfWeek" TEXT NOT NULL DEFAULT 'Mon',
    "startTime" TEXT NOT NULL DEFAULT '06:00',
    "durationMin" INTEGER NOT NULL DEFAULT 60,
    "capacity" INTEGER NOT NULL DEFAULT 20,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_gym_classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_memberships" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "contactId" TEXT,
    "memberName" TEXT NOT NULL,
    "memberPhone" TEXT,
    "planName" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_rooms" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "roomType" TEXT NOT NULL DEFAULT 'Standard',
    "capacity" INTEGER NOT NULL DEFAULT 2,
    "pricePerNight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'available',
    "housekeeping" TEXT NOT NULL DEFAULT 'clean',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_room_bookings" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "contactId" TEXT,
    "guestName" TEXT NOT NULL,
    "guestPhone" TEXT,
    "roomId" TEXT,
    "checkIn" TIMESTAMP(3) NOT NULL,
    "checkOut" TIMESTAMP(3) NOT NULL,
    "guests" INTEGER NOT NULL DEFAULT 1,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'booked',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_room_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_listings" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "propertyType" TEXT NOT NULL DEFAULT 'Apartment',
    "location" TEXT,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "areaSqft" DOUBLE PRECISION,
    "bhk" TEXT,
    "status" TEXT NOT NULL DEFAULT 'available',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_deals" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "contactId" TEXT,
    "clientName" TEXT NOT NULL,
    "clientPhone" TEXT,
    "listingId" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'new',
    "value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "agent" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_property_visits" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "contactId" TEXT,
    "clientName" TEXT NOT NULL,
    "clientPhone" TEXT,
    "listingId" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "agent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_property_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_batches" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "courseName" TEXT,
    "faculty" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'Classroom',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "schedule" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 30,
    "fee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'upcoming',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_enrollments" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "contactId" TEXT,
    "studentName" TEXT NOT NULL,
    "studentPhone" TEXT,
    "guardianContact" TEXT,
    "batchId" TEXT,
    "enrollDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "feeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "feePaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'enrolled',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_engagements" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "contactId" TEXT,
    "engagementType" TEXT NOT NULL DEFAULT 'Consulting',
    "billingType" TEXT NOT NULL DEFAULT 'Fixed',
    "status" TEXT NOT NULL DEFAULT 'proposal',
    "feeValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hourlyRate" DOUBLE PRECISION,
    "assignedTo" TEXT,
    "startDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "description" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_engagements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_engagement_docs" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "receivedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_engagement_docs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_construction_projects" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "contactId" TEXT,
    "siteAddress" TEXT,
    "phase" TEXT NOT NULL DEFAULT 'Foundation',
    "status" TEXT NOT NULL DEFAULT 'planning',
    "budget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "spent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "targetDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_construction_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_project_milestones" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_project_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_project_materials" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "projectId" TEXT,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "supplier" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ordered',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_project_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_event_bookings" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "contactId" TEXT,
    "eventType" TEXT NOT NULL DEFAULT 'Wedding',
    "eventDate" TIMESTAMP(3),
    "venue" TEXT,
    "guestCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'enquiry',
    "packageValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "advancePaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_event_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_event_vendors" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "service" TEXT NOT NULL DEFAULT 'Catering',
    "contactPhone" TEXT,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_event_vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_finance_cases" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "contactId" TEXT,
    "caseType" TEXT NOT NULL DEFAULT 'ITR',
    "status" TEXT NOT NULL DEFAULT 'open',
    "feeValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "filingDeadline" TIMESTAMP(3),
    "assignedTo" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_finance_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_finance_case_docs" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "receivedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_finance_case_docs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_service_jobs" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "vehicleNumber" TEXT NOT NULL,
    "vehicleModel" TEXT,
    "customerName" TEXT NOT NULL,
    "contactId" TEXT,
    "jobType" TEXT NOT NULL DEFAULT 'General Service',
    "status" TEXT NOT NULL DEFAULT 'received',
    "odometer" INTEGER,
    "complaint" TEXT,
    "estimateAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "receivedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "promisedDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_service_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_job_lines" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'labor',
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_job_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_part_stock" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "partNumber" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reorderLevel" INTEGER NOT NULL DEFAULT 5,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_part_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_shipments" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "trackingNo" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "contactId" TEXT,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'Road',
    "weight" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'booked',
    "freightAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pickupDate" TIMESTAMP(3),
    "eta" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "assignedVehicle" TEXT,
    "assignedDriver" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_test_orders" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "contactId" TEXT,
    "referringDoctor" TEXT,
    "status" TEXT NOT NULL DEFAULT 'booked',
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sampleId" TEXT,
    "testDate" TIMESTAMP(3),
    "collectedAt" TIMESTAMP(3),
    "reportReadyAt" TIMESTAMP(3),
    "reportUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_test_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_test_order_items" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "testName" TEXT NOT NULL,
    "sampleType" TEXT NOT NULL DEFAULT 'Blood',
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_test_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_photo_shoots" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "contactId" TEXT,
    "eventType" TEXT NOT NULL DEFAULT 'Wedding',
    "eventDate" TIMESTAMP(3),
    "venue" TEXT,
    "coverageHours" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'enquiry',
    "packageValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "advancePaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deliveryDueDate" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "galleryUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_photo_shoots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_shoot_deliverables" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "shootId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_shoot_deliverables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_produce_orders" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "buyerName" TEXT NOT NULL,
    "contactId" TEXT,
    "produceName" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'kg',
    "grade" TEXT NOT NULL DEFAULT 'A',
    "ratePerUnit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "harvestDate" TIMESTAMP(3),
    "dispatchDate" TIMESTAMP(3),
    "deliveryDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_produce_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_produce_stock" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "produceName" TEXT NOT NULL,
    "grade" TEXT NOT NULL DEFAULT 'A',
    "unit" TEXT NOT NULL DEFAULT 'kg',
    "quantityAvailable" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ratePerUnit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "harvestDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'available',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_produce_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_coaching_batches" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT,
    "faculty" TEXT,
    "timing" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'Classroom',
    "startDate" TIMESTAMP(3),
    "capacity" INTEGER NOT NULL DEFAULT 30,
    "fee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'upcoming',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_coaching_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_coaching_enrollments" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "contactId" TEXT,
    "studentPhone" TEXT,
    "guardianContact" TEXT,
    "batchId" TEXT,
    "enrollDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "feeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "feePaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'enrolled',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_coaching_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_coaching_sessions" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "startTime" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_coaching_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_tech_projects" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "contactId" TEXT,
    "projectType" TEXT NOT NULL DEFAULT 'Web',
    "techStack" TEXT,
    "billingType" TEXT NOT NULL DEFAULT 'Fixed',
    "status" TEXT NOT NULL DEFAULT 'proposal',
    "contractValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deadline" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_tech_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_project_tasks" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "sprint" TEXT,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "assignee" TEXT,
    "estimateHours" DOUBLE PRECISION,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_project_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_doctors" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "specialty" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "consultationFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "availability" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_doctors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_clinic_appointments" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "contactId" TEXT,
    "patientPhone" TEXT,
    "doctorId" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 30,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "reason" TEXT,
    "fee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "diagnosis" TEXT,
    "prescriptionNotes" TEXT,
    "followUpDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_clinic_appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_restaurant_orders" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "tableId" TEXT,
    "tableName" TEXT,
    "orderType" TEXT NOT NULL DEFAULT 'Dine-in',
    "customerName" TEXT,
    "contactId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentMethod" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_restaurant_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_restaurant_order_items" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "catalogItemId" TEXT,
    "name" TEXT NOT NULL,
    "station" TEXT NOT NULL DEFAULT 'kitchen',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_restaurant_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_retail_products" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "category" TEXT,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stockQty" INTEGER NOT NULL DEFAULT 0,
    "reorderLevel" INTEGER NOT NULL DEFAULT 5,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_retail_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_operation_types" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "cta" TEXT NOT NULL,
    "groupKey" TEXT NOT NULL,
    "actionIntent" TEXT,
    "description" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_operation_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_industry_experiences" (
    "id" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "groupKey" TEXT NOT NULL,
    "businessModel" TEXT NOT NULL,
    "primaryOperation" TEXT NOT NULL,
    "secondaryOperations" JSONB NOT NULL,
    "primaryCta" TEXT NOT NULL,
    "vendorModules" JSONB NOT NULL,
    "vendorMobileNav" JSONB NOT NULL,
    "clientModules" JSONB NOT NULL,
    "crmPipeline" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_industry_experiences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_otp_daily_verifications" (
    "phone" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_otp_daily_verifications_pkey" PRIMARY KEY ("phone")
);

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
    "scheduledNextNetPaise" INTEGER,
    "scheduledNextDiscountReason" TEXT,
    "aiCreditPaise" INTEGER,
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
    "aiCreditPaise" INTEGER,
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
    "listPaise" INTEGER,
    "approvedNetPaise" INTEGER,
    "discountReason" TEXT,
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

-- CreateTable
CREATE TABLE "g4d_stock_movements" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" "StockMovementReason" NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "note" TEXT,
    "balanceAfter" INTEGER NOT NULL,
    "createdBy" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "variantKey" TEXT,
    "locationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_stock_movements_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "g4d_bos_settings" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "gstRegistered" BOOLEAN NOT NULL DEFAULT false,
    "gstin" TEXT,
    "legalName" TEXT,
    "state" TEXT,
    "defaultGstRate" DOUBLE PRECISION NOT NULL DEFAULT 18,
    "priceMode" TEXT NOT NULL DEFAULT 'EXCLUSIVE',
    "roundOff" BOOLEAN NOT NULL DEFAULT true,
    "prefixes" JSONB,
    "negativeStock" TEXT NOT NULL DEFAULT 'WARN',
    "orderInvoiceOn" TEXT NOT NULL DEFAULT 'PAID',
    "purchaseUpdatesCost" BOOLEAN NOT NULL DEFAULT true,
    "bankDetails" TEXT,
    "upiId" TEXT,
    "terms" TEXT,
    "notes" TEXT,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_bos_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_bos_doc_series" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "fy" TEXT NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "g4d_bos_doc_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_bos_documents" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "number" TEXT,
    "fy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "partyId" TEXT,
    "partyName" TEXT,
    "partyGstin" TEXT,
    "partyState" TEXT,
    "billingAddress" TEXT,
    "docDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "taxKind" TEXT NOT NULL DEFAULT 'NONE',
    "priceMode" TEXT NOT NULL DEFAULT 'EXCLUSIVE',
    "placeOfSupply" TEXT,
    "intraState" BOOLEAN NOT NULL DEFAULT true,
    "subtotalPaise" INTEGER NOT NULL DEFAULT 0,
    "discountPaise" INTEGER NOT NULL DEFAULT 0,
    "shippingPaise" INTEGER NOT NULL DEFAULT 0,
    "taxablePaise" INTEGER NOT NULL DEFAULT 0,
    "cgstPaise" INTEGER NOT NULL DEFAULT 0,
    "sgstPaise" INTEGER NOT NULL DEFAULT 0,
    "igstPaise" INTEGER NOT NULL DEFAULT 0,
    "roundOffPaise" INTEGER NOT NULL DEFAULT 0,
    "totalPaise" INTEGER NOT NULL DEFAULT 0,
    "paidPaise" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "sourceType" TEXT,
    "sourceId" TEXT,
    "refDocId" TEXT,
    "supplierRef" TEXT,
    "notes" TEXT,
    "terms" TEXT,
    "publicToken" TEXT,
    "idempotencyKey" TEXT,
    "issuedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_bos_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_bos_document_lines" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "itemId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "variantKey" TEXT,
    "hsn" TEXT,
    "unit" TEXT,
    "qty" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "ratePaise" INTEGER NOT NULL DEFAULT 0,
    "discountPaise" INTEGER NOT NULL DEFAULT 0,
    "taxablePaise" INTEGER NOT NULL DEFAULT 0,
    "gstRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cgstPaise" INTEGER NOT NULL DEFAULT 0,
    "sgstPaise" INTEGER NOT NULL DEFAULT 0,
    "igstPaise" INTEGER NOT NULL DEFAULT 0,
    "totalPaise" INTEGER NOT NULL DEFAULT 0,
    "unitCostPaise" INTEGER,
    "stockQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "refLineId" TEXT,
    "restock" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "g4d_bos_document_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_bos_payments" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "number" TEXT,
    "fy" TEXT,
    "partyId" TEXT,
    "partyName" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'CASH',
    "amountPaise" INTEGER NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "sourceId" TEXT,
    "idempotencyKey" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_bos_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_bos_allocations" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "paymentId" TEXT,
    "creditNoteId" TEXT,
    "amountPaise" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_bos_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_bos_expenses" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "number" TEXT,
    "fy" TEXT,
    "expenseDate" TIMESTAMP(3) NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "supplierId" TEXT,
    "taxablePaise" INTEGER NOT NULL,
    "gstRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cgstPaise" INTEGER NOT NULL DEFAULT 0,
    "sgstPaise" INTEGER NOT NULL DEFAULT 0,
    "igstPaise" INTEGER NOT NULL DEFAULT 0,
    "totalPaise" INTEGER NOT NULL,
    "paymentMode" TEXT NOT NULL DEFAULT 'CASH',
    "attachment" TEXT,
    "recurring" TEXT NOT NULL DEFAULT 'NONE',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "idempotencyKey" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_bos_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_bos_accounts" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "system" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "g4d_bos_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_bos_journal_entries" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceVersion" INTEGER NOT NULL DEFAULT 1,
    "memo" TEXT,
    "reversalOfId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_bos_journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_bos_journal_lines" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "partyId" TEXT,
    "debitPaise" INTEGER NOT NULL DEFAULT 0,
    "creditPaise" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "g4d_bos_journal_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_bos_stock_locations" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "g4d_bos_stock_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_bos_recurring" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "nextRunOn" TIMESTAMP(3) NOT NULL,
    "endsOn" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastRunOn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_bos_recurring_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_plan_overrides" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_plan_overrides_pkey" PRIMARY KEY ("id")
);

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
    "createdIpHash" TEXT,
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
    "callbackAt" TIMESTAMP(3),
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

-- CreateTable
CREATE TABLE "g4d_leadspace_daily_stats" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "ctaClicks" INTEGER NOT NULL DEFAULT 0,
    "formStarts" INTEGER NOT NULL DEFAULT 0,
    "outboundClicks" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "g4d_leadspace_daily_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_email_key" ON "Vendor"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_subdomain_key" ON "Vendor"("subdomain");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_widgetKey_key" ON "Vendor"("widgetKey");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_waPhoneNumberId_key" ON "Vendor"("waPhoneNumberId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_payTokenHash_key" ON "Invoice"("payTokenHash");

-- CreateIndex
CREATE INDEX "Invoice_vendorId_status_idx" ON "Invoice"("vendorId", "status");

-- CreateIndex
CREATE INDEX "Invoice_kind_status_idx" ON "Invoice"("kind", "status");

-- CreateIndex
CREATE UNIQUE INDEX "VendorCMS_vendorId_key" ON "VendorCMS"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_site_versions_vendorId_createdAt_idx" ON "g4d_site_versions"("vendorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_site_versions_vendorId_version_key" ON "g4d_site_versions"("vendorId", "version");

-- CreateIndex
CREATE INDEX "g4d_media_assets_vendorId_createdAt_idx" ON "g4d_media_assets"("vendorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_category_packs_key_key" ON "g4d_category_packs"("key");

-- CreateIndex
CREATE INDEX "g4d_theme_packages_status_idx" ON "g4d_theme_packages"("status");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_theme_packages_key_version_key" ON "g4d_theme_packages"("key", "version");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_theme_assets_packageId_path_key" ON "g4d_theme_assets"("packageId", "path");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_theme_entitlements_paymentRef_key" ON "g4d_theme_entitlements"("paymentRef");

-- CreateIndex
CREATE INDEX "g4d_theme_entitlements_vendorId_themeKey_idx" ON "g4d_theme_entitlements"("vendorId", "themeKey");

-- CreateIndex
CREATE INDEX "g4d_theme_entitlements_status_endsAt_idx" ON "g4d_theme_entitlements"("status", "endsAt");

-- CreateIndex
CREATE INDEX "VendorProduct_categoryId_idx" ON "VendorProduct"("categoryId");

-- CreateIndex
CREATE INDEX "VendorProduct_vendorId_status_idx" ON "VendorProduct"("vendorId", "status");

-- CreateIndex
CREATE INDEX "VendorProduct_vendorId_industryType_idx" ON "VendorProduct"("vendorId", "industryType");

-- CreateIndex
CREATE INDEX "VendorProduct_vendorId_sku_idx" ON "VendorProduct"("vendorId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "VendorProduct_sourceModel_sourceId_key" ON "VendorProduct"("sourceModel", "sourceId");

-- CreateIndex
CREATE INDEX "g4d_categories_vendorId_idx" ON "g4d_categories"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_categories_vendorId_nameNormalized_key" ON "g4d_categories"("vendorId", "nameNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformCMS_key_key" ON "PlatformCMS"("key");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_wallets_vendorId_key" ON "g4d_wallets"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_wallet_transactions_razorpayId_key" ON "g4d_wallet_transactions"("razorpayId");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_campaign_pages_slug_key" ON "g4d_campaign_pages"("slug");

-- CreateIndex
CREATE INDEX "g4d_contacts_vendorId_idx" ON "g4d_contacts"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_messages_vendorId_idx" ON "g4d_messages"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_messages_contactId_idx" ON "g4d_messages"("contactId");

-- CreateIndex
CREATE INDEX "g4d_catalog_items_vendorId_idx" ON "g4d_catalog_items"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_records_vendorId_idx" ON "g4d_records"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_records_status_idx" ON "g4d_records"("status");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_generic_invoices_recordId_key" ON "g4d_generic_invoices"("recordId");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_generic_invoices_invoiceNumber_key" ON "g4d_generic_invoices"("invoiceNumber");

-- CreateIndex
CREATE INDEX "g4d_generic_invoices_vendorId_idx" ON "g4d_generic_invoices"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_vendor_addons_vendorId_addonKey_key" ON "g4d_vendor_addons"("vendorId", "addonKey");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_vendor_modules_vendorId_moduleKey_key" ON "g4d_vendor_modules"("vendorId", "moduleKey");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_platform_settings_category_key_key" ON "g4d_platform_settings"("category", "key");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_quotes_shareToken_key" ON "g4d_quotes"("shareToken");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_domain_campaign_records_vendorId_month_key" ON "g4d_domain_campaign_records"("vendorId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_admin_team_members_email_key" ON "g4d_admin_team_members"("email");

-- CreateIndex
CREATE INDEX "g4d_ai_templates_contentType_idx" ON "g4d_ai_templates"("contentType");

-- CreateIndex
CREATE INDEX "g4d_ai_templates_industry_idx" ON "g4d_ai_templates"("industry");

-- CreateIndex
CREATE INDEX "g4d_ai_templates_source_idx" ON "g4d_ai_templates"("source");

-- CreateIndex
CREATE INDEX "g4d_website_themes_industry_idx" ON "g4d_website_themes"("industry");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_vendor_payment_config_vendorId_key" ON "g4d_vendor_payment_config"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_vendor_template_unlock_vendorId_idx" ON "g4d_vendor_template_unlock"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_vendor_template_unlock_vendorId_themeId_key" ON "g4d_vendor_template_unlock"("vendorId", "themeId");

-- CreateIndex
CREATE INDEX "g4d_expenses_vendorId_idx" ON "g4d_expenses"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_stationery_vendorId_idx" ON "g4d_stationery"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_kb_entries_vendorId_idx" ON "g4d_kb_entries"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_wa_conversations_vendorId_idx" ON "g4d_wa_conversations"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_wa_conversations_vendorId_phone_key" ON "g4d_wa_conversations"("vendorId", "phone");

-- CreateIndex
CREATE INDEX "g4d_vendor_tasks_vendorId_idx" ON "g4d_vendor_tasks"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_vendor_tasks_vendorId_stage_idx" ON "g4d_vendor_tasks"("vendorId", "stage");

-- CreateIndex
CREATE INDEX "g4d_pos_tables_vendorId_idx" ON "g4d_pos_tables"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_kitchen_tickets_vendorId_idx" ON "g4d_kitchen_tickets"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_kitchen_tickets_vendorId_status_idx" ON "g4d_kitchen_tickets"("vendorId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_pos_sales_razorpayPaymentId_key" ON "g4d_pos_sales"("razorpayPaymentId");

-- CreateIndex
CREATE INDEX "g4d_pos_sales_vendorId_idx" ON "g4d_pos_sales"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_pos_sales_vendorId_createdAt_idx" ON "g4d_pos_sales"("vendorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_pos_sales_vendorId_idempotencyKey_key" ON "g4d_pos_sales"("vendorId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "g4d_appointments_vendorId_idx" ON "g4d_appointments"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_appointments_vendorId_startAt_idx" ON "g4d_appointments"("vendorId", "startAt");

-- CreateIndex
CREATE INDEX "g4d_payment_records_vendorId_idx" ON "g4d_payment_records"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_payment_records_vendorId_date_idx" ON "g4d_payment_records"("vendorId", "date");

-- CreateIndex
CREATE INDEX "g4d_gst_filings_vendorId_idx" ON "g4d_gst_filings"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_gst_filings_vendorId_period_formType_key" ON "g4d_gst_filings"("vendorId", "period", "formType");

-- CreateIndex
CREATE INDEX "g4d_domain_registrations_vendorId_idx" ON "g4d_domain_registrations"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_domain_registrations_vendorId_status_idx" ON "g4d_domain_registrations"("vendorId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_domain_registrations_vendorId_domainName_key" ON "g4d_domain_registrations"("vendorId", "domainName");

-- CreateIndex
CREATE INDEX "g4d_vehicles_vendorId_idx" ON "g4d_vehicles"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_drivers_vendorId_idx" ON "g4d_drivers"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_trips_vendorId_idx" ON "g4d_trips"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_trips_vendorId_status_idx" ON "g4d_trips"("vendorId", "status");

-- CreateIndex
CREATE INDEX "g4d_visa_applications_vendorId_idx" ON "g4d_visa_applications"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_visa_applications_vendorId_status_idx" ON "g4d_visa_applications"("vendorId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_vendor_comms_settings_vendorId_key" ON "g4d_vendor_comms_settings"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_contracts_vendorId_idx" ON "g4d_contracts"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_contracts_vendorId_status_idx" ON "g4d_contracts"("vendorId", "status");

-- CreateIndex
CREATE INDEX "g4d_contract_assignments_contractId_idx" ON "g4d_contract_assignments"("contractId");

-- CreateIndex
CREATE INDEX "g4d_stylists_vendorId_idx" ON "g4d_stylists"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_salon_chairs_vendorId_idx" ON "g4d_salon_chairs"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_salon_appointments_vendorId_idx" ON "g4d_salon_appointments"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_salon_appointments_vendorId_startAt_idx" ON "g4d_salon_appointments"("vendorId", "startAt");

-- CreateIndex
CREATE INDEX "g4d_gym_classes_vendorId_idx" ON "g4d_gym_classes"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_memberships_vendorId_idx" ON "g4d_memberships"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_memberships_vendorId_status_idx" ON "g4d_memberships"("vendorId", "status");

-- CreateIndex
CREATE INDEX "g4d_rooms_vendorId_idx" ON "g4d_rooms"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_room_bookings_vendorId_idx" ON "g4d_room_bookings"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_room_bookings_vendorId_checkIn_idx" ON "g4d_room_bookings"("vendorId", "checkIn");

-- CreateIndex
CREATE INDEX "g4d_listings_vendorId_idx" ON "g4d_listings"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_deals_vendorId_idx" ON "g4d_deals"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_deals_vendorId_stage_idx" ON "g4d_deals"("vendorId", "stage");

-- CreateIndex
CREATE INDEX "g4d_property_visits_vendorId_idx" ON "g4d_property_visits"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_property_visits_vendorId_scheduledAt_idx" ON "g4d_property_visits"("vendorId", "scheduledAt");

-- CreateIndex
CREATE INDEX "g4d_batches_vendorId_idx" ON "g4d_batches"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_enrollments_vendorId_idx" ON "g4d_enrollments"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_enrollments_vendorId_status_idx" ON "g4d_enrollments"("vendorId", "status");

-- CreateIndex
CREATE INDEX "g4d_engagements_vendorId_idx" ON "g4d_engagements"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_engagements_vendorId_status_idx" ON "g4d_engagements"("vendorId", "status");

-- CreateIndex
CREATE INDEX "g4d_engagement_docs_vendorId_idx" ON "g4d_engagement_docs"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_engagement_docs_engagementId_idx" ON "g4d_engagement_docs"("engagementId");

-- CreateIndex
CREATE INDEX "g4d_construction_projects_vendorId_idx" ON "g4d_construction_projects"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_construction_projects_vendorId_status_idx" ON "g4d_construction_projects"("vendorId", "status");

-- CreateIndex
CREATE INDEX "g4d_project_milestones_vendorId_idx" ON "g4d_project_milestones"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_project_milestones_projectId_idx" ON "g4d_project_milestones"("projectId");

-- CreateIndex
CREATE INDEX "g4d_project_materials_vendorId_idx" ON "g4d_project_materials"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_event_bookings_vendorId_idx" ON "g4d_event_bookings"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_event_bookings_vendorId_status_idx" ON "g4d_event_bookings"("vendorId", "status");

-- CreateIndex
CREATE INDEX "g4d_event_vendors_vendorId_idx" ON "g4d_event_vendors"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_event_vendors_bookingId_idx" ON "g4d_event_vendors"("bookingId");

-- CreateIndex
CREATE INDEX "g4d_finance_cases_vendorId_idx" ON "g4d_finance_cases"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_finance_cases_vendorId_status_idx" ON "g4d_finance_cases"("vendorId", "status");

-- CreateIndex
CREATE INDEX "g4d_finance_case_docs_vendorId_idx" ON "g4d_finance_case_docs"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_finance_case_docs_caseId_idx" ON "g4d_finance_case_docs"("caseId");

-- CreateIndex
CREATE INDEX "g4d_service_jobs_vendorId_idx" ON "g4d_service_jobs"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_service_jobs_vendorId_status_idx" ON "g4d_service_jobs"("vendorId", "status");

-- CreateIndex
CREATE INDEX "g4d_job_lines_vendorId_idx" ON "g4d_job_lines"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_job_lines_jobId_idx" ON "g4d_job_lines"("jobId");

-- CreateIndex
CREATE INDEX "g4d_part_stock_vendorId_idx" ON "g4d_part_stock"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_shipments_vendorId_idx" ON "g4d_shipments"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_shipments_vendorId_status_idx" ON "g4d_shipments"("vendorId", "status");

-- CreateIndex
CREATE INDEX "g4d_test_orders_vendorId_idx" ON "g4d_test_orders"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_test_orders_vendorId_status_idx" ON "g4d_test_orders"("vendorId", "status");

-- CreateIndex
CREATE INDEX "g4d_test_order_items_vendorId_idx" ON "g4d_test_order_items"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_test_order_items_orderId_idx" ON "g4d_test_order_items"("orderId");

-- CreateIndex
CREATE INDEX "g4d_photo_shoots_vendorId_idx" ON "g4d_photo_shoots"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_photo_shoots_vendorId_status_idx" ON "g4d_photo_shoots"("vendorId", "status");

-- CreateIndex
CREATE INDEX "g4d_shoot_deliverables_vendorId_idx" ON "g4d_shoot_deliverables"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_shoot_deliverables_shootId_idx" ON "g4d_shoot_deliverables"("shootId");

-- CreateIndex
CREATE INDEX "g4d_produce_orders_vendorId_idx" ON "g4d_produce_orders"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_produce_orders_vendorId_status_idx" ON "g4d_produce_orders"("vendorId", "status");

-- CreateIndex
CREATE INDEX "g4d_produce_stock_vendorId_idx" ON "g4d_produce_stock"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_coaching_batches_vendorId_idx" ON "g4d_coaching_batches"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_coaching_enrollments_vendorId_idx" ON "g4d_coaching_enrollments"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_coaching_enrollments_vendorId_status_idx" ON "g4d_coaching_enrollments"("vendorId", "status");

-- CreateIndex
CREATE INDEX "g4d_coaching_sessions_vendorId_idx" ON "g4d_coaching_sessions"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_coaching_sessions_batchId_idx" ON "g4d_coaching_sessions"("batchId");

-- CreateIndex
CREATE INDEX "g4d_tech_projects_vendorId_idx" ON "g4d_tech_projects"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_tech_projects_vendorId_status_idx" ON "g4d_tech_projects"("vendorId", "status");

-- CreateIndex
CREATE INDEX "g4d_project_tasks_vendorId_idx" ON "g4d_project_tasks"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_project_tasks_vendorId_status_idx" ON "g4d_project_tasks"("vendorId", "status");

-- CreateIndex
CREATE INDEX "g4d_doctors_vendorId_idx" ON "g4d_doctors"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_clinic_appointments_vendorId_idx" ON "g4d_clinic_appointments"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_clinic_appointments_vendorId_startAt_idx" ON "g4d_clinic_appointments"("vendorId", "startAt");

-- CreateIndex
CREATE INDEX "g4d_clinic_appointments_vendorId_status_idx" ON "g4d_clinic_appointments"("vendorId", "status");

-- CreateIndex
CREATE INDEX "g4d_restaurant_orders_vendorId_idx" ON "g4d_restaurant_orders"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_restaurant_orders_vendorId_status_idx" ON "g4d_restaurant_orders"("vendorId", "status");

-- CreateIndex
CREATE INDEX "g4d_restaurant_order_items_vendorId_idx" ON "g4d_restaurant_order_items"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_restaurant_order_items_orderId_idx" ON "g4d_restaurant_order_items"("orderId");

-- CreateIndex
CREATE INDEX "g4d_retail_products_vendorId_idx" ON "g4d_retail_products"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_operation_types_key_key" ON "g4d_operation_types"("key");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_industry_experiences_industry_key" ON "g4d_industry_experiences"("industry");

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
CREATE UNIQUE INDEX "g4d_stock_movements_idempotencyKey_key" ON "g4d_stock_movements"("idempotencyKey");

-- CreateIndex
CREATE INDEX "g4d_stock_movements_vendorId_productId_createdAt_idx" ON "g4d_stock_movements"("vendorId", "productId", "createdAt");

-- CreateIndex
CREATE INDEX "g4d_stock_movements_refType_refId_idx" ON "g4d_stock_movements"("refType", "refId");

-- CreateIndex
CREATE INDEX "g4d_special_arrangements_vendorId_active_idx" ON "g4d_special_arrangements"("vendorId", "active");

-- CreateIndex
CREATE INDEX "g4d_special_arrangements_validUntil_idx" ON "g4d_special_arrangements"("validUntil");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_bos_settings_vendorId_key" ON "g4d_bos_settings"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_bos_doc_series_vendorId_docType_fy_key" ON "g4d_bos_doc_series"("vendorId", "docType", "fy");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_bos_documents_publicToken_key" ON "g4d_bos_documents"("publicToken");

-- CreateIndex
CREATE INDEX "g4d_bos_documents_vendorId_docType_status_idx" ON "g4d_bos_documents"("vendorId", "docType", "status");

-- CreateIndex
CREATE INDEX "g4d_bos_documents_vendorId_partyId_idx" ON "g4d_bos_documents"("vendorId", "partyId");

-- CreateIndex
CREATE INDEX "g4d_bos_documents_vendorId_docDate_idx" ON "g4d_bos_documents"("vendorId", "docDate");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_bos_documents_vendorId_docType_number_key" ON "g4d_bos_documents"("vendorId", "docType", "number");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_bos_documents_vendorId_idempotencyKey_key" ON "g4d_bos_documents"("vendorId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_bos_documents_vendorId_docType_sourceType_sourceId_key" ON "g4d_bos_documents"("vendorId", "docType", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "g4d_bos_document_lines_documentId_idx" ON "g4d_bos_document_lines"("documentId");

-- CreateIndex
CREATE INDEX "g4d_bos_document_lines_vendorId_itemId_idx" ON "g4d_bos_document_lines"("vendorId", "itemId");

-- CreateIndex
CREATE INDEX "g4d_bos_payments_vendorId_partyId_idx" ON "g4d_bos_payments"("vendorId", "partyId");

-- CreateIndex
CREATE INDEX "g4d_bos_payments_vendorId_paymentDate_idx" ON "g4d_bos_payments"("vendorId", "paymentDate");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_bos_payments_vendorId_kind_number_key" ON "g4d_bos_payments"("vendorId", "kind", "number");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_bos_payments_vendorId_idempotencyKey_key" ON "g4d_bos_payments"("vendorId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "g4d_bos_allocations_vendorId_documentId_idx" ON "g4d_bos_allocations"("vendorId", "documentId");

-- CreateIndex
CREATE INDEX "g4d_bos_allocations_paymentId_idx" ON "g4d_bos_allocations"("paymentId");

-- CreateIndex
CREATE INDEX "g4d_bos_expenses_vendorId_expenseDate_idx" ON "g4d_bos_expenses"("vendorId", "expenseDate");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_bos_expenses_vendorId_number_key" ON "g4d_bos_expenses"("vendorId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_bos_expenses_vendorId_idempotencyKey_key" ON "g4d_bos_expenses"("vendorId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_bos_accounts_vendorId_code_key" ON "g4d_bos_accounts"("vendorId", "code");

-- CreateIndex
CREATE INDEX "g4d_bos_journal_entries_vendorId_entryDate_idx" ON "g4d_bos_journal_entries"("vendorId", "entryDate");

-- CreateIndex
CREATE INDEX "g4d_bos_journal_entries_vendorId_sourceType_sourceId_idx" ON "g4d_bos_journal_entries"("vendorId", "sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_bos_journal_entries_vendorId_sourceType_sourceId_source_key" ON "g4d_bos_journal_entries"("vendorId", "sourceType", "sourceId", "sourceVersion");

-- CreateIndex
CREATE INDEX "g4d_bos_journal_lines_entryId_idx" ON "g4d_bos_journal_lines"("entryId");

-- CreateIndex
CREATE INDEX "g4d_bos_journal_lines_vendorId_accountCode_idx" ON "g4d_bos_journal_lines"("vendorId", "accountCode");

-- CreateIndex
CREATE INDEX "g4d_bos_journal_lines_vendorId_partyId_idx" ON "g4d_bos_journal_lines"("vendorId", "partyId");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_bos_stock_locations_vendorId_name_key" ON "g4d_bos_stock_locations"("vendorId", "name");

-- CreateIndex
CREATE INDEX "g4d_bos_recurring_vendorId_active_nextRunOn_idx" ON "g4d_bos_recurring"("vendorId", "active", "nextRunOn");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_plan_overrides_key_key" ON "g4d_plan_overrides"("key");

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
CREATE INDEX "g4d_lead_events_vendorId_callbackAt_idx" ON "g4d_lead_events"("vendorId", "callbackAt");

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

-- CreateIndex
CREATE INDEX "g4d_leadspace_daily_stats_vendorId_day_idx" ON "g4d_leadspace_daily_stats"("vendorId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_leadspace_daily_stats_profileId_day_key" ON "g4d_leadspace_daily_stats"("profileId", "day");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "g4d_billing_deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorCMS" ADD CONSTRAINT "VendorCMS_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_theme_assets" ADD CONSTRAINT "g4d_theme_assets_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "g4d_theme_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorProduct" ADD CONSTRAINT "VendorProduct_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorProduct" ADD CONSTRAINT "VendorProduct_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "g4d_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorProduct" ADD CONSTRAINT "VendorProduct_operationKey_fkey" FOREIGN KEY ("operationKey") REFERENCES "g4d_operation_types"("key") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_categories" ADD CONSTRAINT "g4d_categories_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_lead_call_logs" ADD CONSTRAINT "g4d_lead_call_logs_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "g4d_leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_wallets" ADD CONSTRAINT "g4d_wallets_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_wallet_transactions" ADD CONSTRAINT "g4d_wallet_transactions_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_wallet_transactions" ADD CONSTRAINT "g4d_wallet_transactions_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "g4d_wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_campaign_pages" ADD CONSTRAINT "g4d_campaign_pages_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_campaign_leads" ADD CONSTRAINT "g4d_campaign_leads_campaignPageId_fkey" FOREIGN KEY ("campaignPageId") REFERENCES "g4d_campaign_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_campaign_leads" ADD CONSTRAINT "g4d_campaign_leads_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_campaign_leads" ADD CONSTRAINT "g4d_campaign_leads_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "g4d_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_call_logs" ADD CONSTRAINT "g4d_call_logs_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "g4d_campaign_leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_team_members" ADD CONSTRAINT "g4d_team_members_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_contacts" ADD CONSTRAINT "g4d_contacts_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_messages" ADD CONSTRAINT "g4d_messages_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_messages" ADD CONSTRAINT "g4d_messages_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "g4d_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_catalog_items" ADD CONSTRAINT "g4d_catalog_items_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_records" ADD CONSTRAINT "g4d_records_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_records" ADD CONSTRAINT "g4d_records_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "g4d_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_records" ADD CONSTRAINT "g4d_records_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "g4d_catalog_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_generic_invoices" ADD CONSTRAINT "g4d_generic_invoices_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_generic_invoices" ADD CONSTRAINT "g4d_generic_invoices_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "g4d_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_generic_invoices" ADD CONSTRAINT "g4d_generic_invoices_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "g4d_contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_vendor_addons" ADD CONSTRAINT "g4d_vendor_addons_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_vendor_modules" ADD CONSTRAINT "g4d_vendor_modules_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_domain_campaign_records" ADD CONSTRAINT "g4d_domain_campaign_records_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_expenses" ADD CONSTRAINT "g4d_expenses_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_stationery" ADD CONSTRAINT "g4d_stationery_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_kb_entries" ADD CONSTRAINT "g4d_kb_entries_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_wa_conversations" ADD CONSTRAINT "g4d_wa_conversations_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_wa_conversations" ADD CONSTRAINT "g4d_wa_conversations_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "g4d_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_vendor_tasks" ADD CONSTRAINT "g4d_vendor_tasks_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_pos_tables" ADD CONSTRAINT "g4d_pos_tables_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_kitchen_tickets" ADD CONSTRAINT "g4d_kitchen_tickets_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_pos_sales" ADD CONSTRAINT "g4d_pos_sales_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_appointments" ADD CONSTRAINT "g4d_appointments_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_payment_records" ADD CONSTRAINT "g4d_payment_records_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_gst_filings" ADD CONSTRAINT "g4d_gst_filings_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_domain_registrations" ADD CONSTRAINT "g4d_domain_registrations_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_vehicles" ADD CONSTRAINT "g4d_vehicles_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_drivers" ADD CONSTRAINT "g4d_drivers_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_trips" ADD CONSTRAINT "g4d_trips_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_trips" ADD CONSTRAINT "g4d_trips_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "g4d_vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_trips" ADD CONSTRAINT "g4d_trips_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "g4d_drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_visa_applications" ADD CONSTRAINT "g4d_visa_applications_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_visa_applications" ADD CONSTRAINT "g4d_visa_applications_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "g4d_trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_vendor_comms_settings" ADD CONSTRAINT "g4d_vendor_comms_settings_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_contracts" ADD CONSTRAINT "g4d_contracts_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_contracts" ADD CONSTRAINT "g4d_contracts_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "g4d_contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_contract_assignments" ADD CONSTRAINT "g4d_contract_assignments_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "g4d_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_contract_assignments" ADD CONSTRAINT "g4d_contract_assignments_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "g4d_vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_contract_assignments" ADD CONSTRAINT "g4d_contract_assignments_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "g4d_drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_stylists" ADD CONSTRAINT "g4d_stylists_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_salon_chairs" ADD CONSTRAINT "g4d_salon_chairs_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_salon_appointments" ADD CONSTRAINT "g4d_salon_appointments_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_salon_appointments" ADD CONSTRAINT "g4d_salon_appointments_stylistId_fkey" FOREIGN KEY ("stylistId") REFERENCES "g4d_stylists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_salon_appointments" ADD CONSTRAINT "g4d_salon_appointments_chairId_fkey" FOREIGN KEY ("chairId") REFERENCES "g4d_salon_chairs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_gym_classes" ADD CONSTRAINT "g4d_gym_classes_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_memberships" ADD CONSTRAINT "g4d_memberships_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_rooms" ADD CONSTRAINT "g4d_rooms_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_room_bookings" ADD CONSTRAINT "g4d_room_bookings_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_room_bookings" ADD CONSTRAINT "g4d_room_bookings_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "g4d_rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_listings" ADD CONSTRAINT "g4d_listings_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_deals" ADD CONSTRAINT "g4d_deals_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_deals" ADD CONSTRAINT "g4d_deals_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "g4d_listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_property_visits" ADD CONSTRAINT "g4d_property_visits_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_property_visits" ADD CONSTRAINT "g4d_property_visits_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "g4d_listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_batches" ADD CONSTRAINT "g4d_batches_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_enrollments" ADD CONSTRAINT "g4d_enrollments_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_enrollments" ADD CONSTRAINT "g4d_enrollments_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "g4d_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_engagements" ADD CONSTRAINT "g4d_engagements_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_engagement_docs" ADD CONSTRAINT "g4d_engagement_docs_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_engagement_docs" ADD CONSTRAINT "g4d_engagement_docs_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "g4d_engagements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_construction_projects" ADD CONSTRAINT "g4d_construction_projects_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_project_milestones" ADD CONSTRAINT "g4d_project_milestones_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_project_milestones" ADD CONSTRAINT "g4d_project_milestones_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "g4d_construction_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_project_materials" ADD CONSTRAINT "g4d_project_materials_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_event_bookings" ADD CONSTRAINT "g4d_event_bookings_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_event_vendors" ADD CONSTRAINT "g4d_event_vendors_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_event_vendors" ADD CONSTRAINT "g4d_event_vendors_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "g4d_event_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_finance_cases" ADD CONSTRAINT "g4d_finance_cases_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_finance_case_docs" ADD CONSTRAINT "g4d_finance_case_docs_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_finance_case_docs" ADD CONSTRAINT "g4d_finance_case_docs_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "g4d_finance_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_service_jobs" ADD CONSTRAINT "g4d_service_jobs_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_job_lines" ADD CONSTRAINT "g4d_job_lines_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_job_lines" ADD CONSTRAINT "g4d_job_lines_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "g4d_service_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_part_stock" ADD CONSTRAINT "g4d_part_stock_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_shipments" ADD CONSTRAINT "g4d_shipments_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_test_orders" ADD CONSTRAINT "g4d_test_orders_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_test_order_items" ADD CONSTRAINT "g4d_test_order_items_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_test_order_items" ADD CONSTRAINT "g4d_test_order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "g4d_test_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_photo_shoots" ADD CONSTRAINT "g4d_photo_shoots_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_shoot_deliverables" ADD CONSTRAINT "g4d_shoot_deliverables_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_shoot_deliverables" ADD CONSTRAINT "g4d_shoot_deliverables_shootId_fkey" FOREIGN KEY ("shootId") REFERENCES "g4d_photo_shoots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_produce_orders" ADD CONSTRAINT "g4d_produce_orders_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_produce_stock" ADD CONSTRAINT "g4d_produce_stock_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_coaching_batches" ADD CONSTRAINT "g4d_coaching_batches_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_coaching_enrollments" ADD CONSTRAINT "g4d_coaching_enrollments_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_coaching_enrollments" ADD CONSTRAINT "g4d_coaching_enrollments_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "g4d_coaching_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_coaching_sessions" ADD CONSTRAINT "g4d_coaching_sessions_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_coaching_sessions" ADD CONSTRAINT "g4d_coaching_sessions_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "g4d_coaching_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_tech_projects" ADD CONSTRAINT "g4d_tech_projects_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_project_tasks" ADD CONSTRAINT "g4d_project_tasks_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_project_tasks" ADD CONSTRAINT "g4d_project_tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "g4d_tech_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_doctors" ADD CONSTRAINT "g4d_doctors_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_clinic_appointments" ADD CONSTRAINT "g4d_clinic_appointments_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_clinic_appointments" ADD CONSTRAINT "g4d_clinic_appointments_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "g4d_doctors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_restaurant_orders" ADD CONSTRAINT "g4d_restaurant_orders_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_restaurant_order_items" ADD CONSTRAINT "g4d_restaurant_order_items_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_restaurant_order_items" ADD CONSTRAINT "g4d_restaurant_order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "g4d_restaurant_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_retail_products" ADD CONSTRAINT "g4d_retail_products_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_billing_terms" ADD CONSTRAINT "g4d_billing_terms_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_billing_deals" ADD CONSTRAINT "g4d_billing_deals_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_promo_redemptions" ADD CONSTRAINT "g4d_promo_redemptions_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "g4d_promo_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_plan_change_requests" ADD CONSTRAINT "g4d_plan_change_requests_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_stock_movements" ADD CONSTRAINT "g4d_stock_movements_productId_fkey" FOREIGN KEY ("productId") REFERENCES "VendorProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_special_arrangements" ADD CONSTRAINT "g4d_special_arrangements_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_bos_document_lines" ADD CONSTRAINT "g4d_bos_document_lines_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "g4d_bos_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_bos_allocations" ADD CONSTRAINT "g4d_bos_allocations_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "g4d_bos_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_bos_journal_lines" ADD CONSTRAINT "g4d_bos_journal_lines_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "g4d_bos_journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

