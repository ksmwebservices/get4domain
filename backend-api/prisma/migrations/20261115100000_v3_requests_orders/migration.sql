-- V3 batch 3 slice 5.14: requests, events, consents, tracking, vendor payment methods, orders, order items, vendor payment events, vendor invoices, gap-free counters, stock, offers, message outbox, suppressions, reports and the blocklist.
-- ADDITIVE ONLY: new enums, new g4d_ tables, indexes and foreign keys; no existing table, column or row changes. Secrets are stored sealed (cipher, iv, tag columns); nothing here holds card, UPI PIN or bank data.
-- Staging only until the owner approves a production release.

-- CreateEnum
CREATE TYPE "V3RequestKind" AS ENUM ('ENQUIRY', 'APPOINTMENT', 'QUOTE', 'PRODUCT_ENQUIRY', 'ORDER_REQUEST', 'ORDER');
-- CreateEnum
CREATE TYPE "V3RequestStatus" AS ENUM ('RECEIVED', 'DELIVERED', 'SEEN', 'RESPONDED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED', 'EXPIRED', 'SPAM');
-- CreateEnum
CREATE TYPE "V3RequestSource" AS ENUM ('DIRECTORY', 'SITE', 'WHATSAPP', 'MANUAL');
-- CreateEnum
CREATE TYPE "V3RequestActor" AS ENUM ('CUSTOMER', 'VENDOR', 'STAFF', 'SYSTEM');
-- CreateEnum
CREATE TYPE "V3PaymentMethodKind" AS ENUM ('OWN_GATEWAY', 'UPI', 'PAY_ON_DELIVERY', 'PAY_AT_VISIT', 'BANK_TRANSFER');
-- CreateEnum
CREATE TYPE "V3PaymentMethodStatus" AS ENUM ('UNVERIFIED', 'ACTIVE', 'DISABLED');
-- CreateEnum
CREATE TYPE "V3OrderStatus" AS ENUM ('PLACED', 'AWAITING_PAYMENT', 'PAID', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED', 'REFUNDED_RECORDED');
-- CreateEnum
CREATE TYPE "V3OrderPaymentMode" AS ENUM ('ONLINE', 'COD', 'AT_VISIT', 'MANUAL');
-- CreateEnum
CREATE TYPE "V3VendorInvoiceStatus" AS ENUM ('ISSUED', 'VOID');
-- CreateEnum
CREATE TYPE "V3OfferKind" AS ENUM ('BANNER', 'COUPON');
-- CreateEnum
CREATE TYPE "V3OfferStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ENDED');
-- CreateEnum
CREATE TYPE "V3MessageChannel" AS ENUM ('WHATSAPP', 'SMS', 'EMAIL');
-- CreateEnum
CREATE TYPE "V3MessageStatus" AS ENUM ('QUEUED', 'SENT_SANDBOX', 'FAILED', 'DELIVERED');
-- CreateEnum
CREATE TYPE "V3ReportStatus" AS ENUM ('OPEN', 'REVIEWED', 'ACTIONED', 'REJECTED');
-- CreateEnum
CREATE TYPE "V3BlockKind" AS ENUM ('PHONE_HASH', 'IP_HASH', 'EMAIL_HASH');
-- CreateEnum
CREATE TYPE "V3CounterKind" AS ENUM ('ORDER', 'INVOICE');
-- CreateTable
CREATE TABLE "g4d_requests" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "siteHost" TEXT NOT NULL,
    "kind" "V3RequestKind" NOT NULL,
    "status" "V3RequestStatus" NOT NULL DEFAULT 'RECEIVED',
    "customerName" TEXT NOT NULL,
    "customerPhoneE164" TEXT NOT NULL,
    "customerEmail" TEXT,
    "payloadJson" JSONB NOT NULL DEFAULT '{}',
    "sourceKind" "V3RequestSource" NOT NULL DEFAULT 'SITE',
    "directoryRefHash" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "spamScore" INTEGER NOT NULL DEFAULT 0,
    "firstSeenAt" TIMESTAMP(3),
    "firstResponseAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "convertedCustomerId" TEXT,
    "convertedBookingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_requests_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "g4d_request_events" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorType" "V3RequestActor" NOT NULL,
    "channel" TEXT,
    "deliveryResult" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metaJson" JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT "g4d_request_events_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "g4d_request_consents" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "textVersion" INTEGER NOT NULL,
    "textHash" TEXT NOT NULL,
    "ipHash" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contactByBusiness" BOOLEAN NOT NULL,
    "contactByPlatform" BOOLEAN NOT NULL,
    "marketing" BOOLEAN NOT NULL,
    CONSTRAINT "g4d_request_consents_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "g4d_request_tracking" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_request_tracking_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "g4d_vendor_payment_methods" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "kind" "V3PaymentMethodKind" NOT NULL,
    "label" TEXT NOT NULL,
    "configCipher" TEXT,
    "configIv" TEXT,
    "configTag" TEXT,
    "last4" TEXT,
    "webhookSecretCipher" TEXT,
    "webhookSecretIv" TEXT,
    "webhookSecretTag" TEXT,
    "status" "V3PaymentMethodStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_vendor_payment_methods_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "g4d_orders" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "orderNo" INTEGER NOT NULL,
    "status" "V3OrderStatus" NOT NULL DEFAULT 'PLACED',
    "paymentMode" "V3OrderPaymentMode" NOT NULL,
    "methodId" TEXT,
    "amountPaise" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "reviewFlag" BOOLEAN NOT NULL DEFAULT false,
    "shippingJson" JSONB NOT NULL DEFAULT '{}',
    "trackingJson" JSONB NOT NULL DEFAULT '{}',
    "refundedPaise" INTEGER NOT NULL DEFAULT 0,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_orders_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "g4d_order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productRef" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitPaise" INTEGER NOT NULL,
    "taxJson" JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT "g4d_order_items_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "g4d_vendor_payment_events" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "methodId" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "signatureValid" BOOLEAN NOT NULL,
    "payloadJson" JSONB NOT NULL DEFAULT '{}',
    "result" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "g4d_vendor_payment_events_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "g4d_vendor_invoices" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "orderId" TEXT,
    "requestId" TEXT,
    "seq" INTEGER NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshotJson" JSONB NOT NULL DEFAULT '{}',
    "status" "V3VendorInvoiceStatus" NOT NULL DEFAULT 'ISSUED',
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    CONSTRAINT "g4d_vendor_invoices_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "g4d_vendor_counters" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "kind" "V3CounterKind" NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "g4d_vendor_counters_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "g4d_stock_levels" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "productRef" TEXT NOT NULL,
    "onHand" INTEGER NOT NULL,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_stock_levels_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "g4d_stock_reservations" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productRef" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "committedAt" TIMESTAMP(3),
    CONSTRAINT "g4d_stock_reservations_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "g4d_offers" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "kind" "V3OfferKind" NOT NULL,
    "title" TEXT NOT NULL,
    "code" TEXT,
    "percentOff" INTEGER,
    "flatPaise" INTEGER,
    "minOrderPaise" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "usageLimit" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "status" "V3OfferStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_offers_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "g4d_message_outbox" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT,
    "channel" "V3MessageChannel" NOT NULL,
    "templateKey" TEXT NOT NULL,
    "toHash" TEXT NOT NULL,
    "toMasked" TEXT NOT NULL,
    "payloadRedactedJson" JSONB NOT NULL DEFAULT '{}',
    "senderRoute" TEXT NOT NULL,
    "status" "V3MessageStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "relatedRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_message_outbox_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "g4d_message_suppressions" (
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "channel" "V3MessageChannel" NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "g4d_message_suppressions_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "g4d_reports" (
    "id" TEXT NOT NULL,
    "reportedHost" TEXT NOT NULL,
    "reasonKind" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "reporterContactMasked" TEXT,
    "status" "V3ReportStatus" NOT NULL DEFAULT 'OPEN',
    "handledBy" TEXT,
    "handledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "g4d_reports_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "g4d_blocklist" (
    "id" TEXT NOT NULL,
    "kind" "V3BlockKind" NOT NULL,
    "hash" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "addedBy" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "g4d_blocklist_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "g4d_requests_vendorId_status_createdAt_idx" ON "g4d_requests"("vendorId", "status", "createdAt");
-- CreateIndex
CREATE INDEX "g4d_requests_vendorId_createdAt_idx" ON "g4d_requests"("vendorId", "createdAt");
-- CreateIndex
CREATE INDEX "g4d_requests_customerPhoneE164_idx" ON "g4d_requests"("customerPhoneE164");
-- CreateIndex
CREATE UNIQUE INDEX "g4d_requests_vendorId_idempotencyKey_key" ON "g4d_requests"("vendorId", "idempotencyKey");
-- CreateIndex
CREATE INDEX "g4d_request_events_requestId_at_idx" ON "g4d_request_events"("requestId", "at");
-- CreateIndex
CREATE UNIQUE INDEX "g4d_request_consents_requestId_key" ON "g4d_request_consents"("requestId");
-- CreateIndex
CREATE UNIQUE INDEX "g4d_request_tracking_requestId_key" ON "g4d_request_tracking"("requestId");
-- CreateIndex
CREATE UNIQUE INDEX "g4d_request_tracking_tokenHash_key" ON "g4d_request_tracking"("tokenHash");
-- CreateIndex
CREATE INDEX "g4d_vendor_payment_methods_vendorId_status_idx" ON "g4d_vendor_payment_methods"("vendorId", "status");
-- CreateIndex
CREATE UNIQUE INDEX "g4d_orders_requestId_key" ON "g4d_orders"("requestId");
-- CreateIndex
CREATE INDEX "g4d_orders_vendorId_status_createdAt_idx" ON "g4d_orders"("vendorId", "status", "createdAt");
-- CreateIndex
CREATE UNIQUE INDEX "g4d_orders_vendorId_orderNo_key" ON "g4d_orders"("vendorId", "orderNo");
-- CreateIndex
CREATE INDEX "g4d_order_items_orderId_idx" ON "g4d_order_items"("orderId");
-- CreateIndex
CREATE INDEX "g4d_vendor_payment_events_vendorId_at_idx" ON "g4d_vendor_payment_events"("vendorId", "at");
-- CreateIndex
CREATE UNIQUE INDEX "g4d_vendor_payment_events_vendorId_providerEventId_key" ON "g4d_vendor_payment_events"("vendorId", "providerEventId");
-- CreateIndex
CREATE INDEX "g4d_vendor_invoices_vendorId_orderId_idx" ON "g4d_vendor_invoices"("vendorId", "orderId");
-- CreateIndex
CREATE UNIQUE INDEX "g4d_vendor_invoices_vendorId_seq_key" ON "g4d_vendor_invoices"("vendorId", "seq");
-- CreateIndex
CREATE UNIQUE INDEX "g4d_vendor_invoices_vendorId_invoiceNumber_key" ON "g4d_vendor_invoices"("vendorId", "invoiceNumber");
-- CreateIndex
CREATE UNIQUE INDEX "g4d_vendor_counters_vendorId_kind_key" ON "g4d_vendor_counters"("vendorId", "kind");
-- CreateIndex
CREATE UNIQUE INDEX "g4d_stock_levels_vendorId_productRef_key" ON "g4d_stock_levels"("vendorId", "productRef");
-- CreateIndex
CREATE INDEX "g4d_stock_reservations_orderId_idx" ON "g4d_stock_reservations"("orderId");
-- CreateIndex
CREATE INDEX "g4d_stock_reservations_expiresAt_idx" ON "g4d_stock_reservations"("expiresAt");
-- CreateIndex
CREATE INDEX "g4d_offers_vendorId_status_idx" ON "g4d_offers"("vendorId", "status");
-- CreateIndex
CREATE UNIQUE INDEX "g4d_offers_vendorId_code_key" ON "g4d_offers"("vendorId", "code");
-- CreateIndex
CREATE INDEX "g4d_message_outbox_vendorId_createdAt_idx" ON "g4d_message_outbox"("vendorId", "createdAt");
-- CreateIndex
CREATE INDEX "g4d_message_outbox_relatedRequestId_idx" ON "g4d_message_outbox"("relatedRequestId");
-- CreateIndex
CREATE UNIQUE INDEX "g4d_message_suppressions_hash_channel_key" ON "g4d_message_suppressions"("hash", "channel");
-- CreateIndex
CREATE INDEX "g4d_reports_status_createdAt_idx" ON "g4d_reports"("status", "createdAt");
-- CreateIndex
CREATE UNIQUE INDEX "g4d_blocklist_kind_hash_key" ON "g4d_blocklist"("kind", "hash");
-- AddForeignKey
ALTER TABLE "g4d_requests" ADD CONSTRAINT "g4d_requests_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "g4d_request_events" ADD CONSTRAINT "g4d_request_events_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "g4d_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "g4d_request_consents" ADD CONSTRAINT "g4d_request_consents_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "g4d_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "g4d_request_tracking" ADD CONSTRAINT "g4d_request_tracking_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "g4d_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "g4d_vendor_payment_methods" ADD CONSTRAINT "g4d_vendor_payment_methods_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "g4d_orders" ADD CONSTRAINT "g4d_orders_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "g4d_orders" ADD CONSTRAINT "g4d_orders_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "g4d_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "g4d_order_items" ADD CONSTRAINT "g4d_order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "g4d_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "g4d_vendor_invoices" ADD CONSTRAINT "g4d_vendor_invoices_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "g4d_vendor_counters" ADD CONSTRAINT "g4d_vendor_counters_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "g4d_stock_levels" ADD CONSTRAINT "g4d_stock_levels_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "g4d_offers" ADD CONSTRAINT "g4d_offers_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Same rule as every other public table (prisma/sql/enable_rls_public.sql): RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_request_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_request_consents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_request_tracking" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_vendor_payment_methods" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_order_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_vendor_payment_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_vendor_invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_vendor_counters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_stock_levels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_stock_reservations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_offers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_message_outbox" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_message_suppressions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_blocklist" ENABLE ROW LEVEL SECURITY;
