-- WhatsApp lead-qualifying bot (dispatch 24 Aug 2026). Additive only.

-- B: route an inbound webhook to the correct tenant via Fast2SMS phone_number_id.
ALTER TABLE "Vendor" ADD COLUMN "waPhoneNumberId" TEXT;
CREATE UNIQUE INDEX "Vendor_waPhoneNumberId_key" ON "Vendor"("waPhoneNumberId");

-- A: extend existing vendor profile with business hours (bot grounding + site).
ALTER TABLE "VendorCMS" ADD COLUMN "businessHours" TEXT;

-- C: link a CRM lead to the Contact whose Message history is its transcript.
ALTER TABLE "g4d_campaign_leads" ADD COLUMN "contactId" TEXT;

-- A: vendor-managed knowledge base (Q&A) — the bot's primary source of truth.
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
CREATE INDEX "g4d_kb_entries_vendorId_idx" ON "g4d_kb_entries"("vendorId");

-- B/D: per-customer bot conversation state + billing window.
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
CREATE UNIQUE INDEX "g4d_wa_conversations_vendorId_phone_key" ON "g4d_wa_conversations"("vendorId", "phone");
CREATE INDEX "g4d_wa_conversations_vendorId_idx" ON "g4d_wa_conversations"("vendorId");

-- Foreign keys (match Prisma conventions: RESTRICT for required, SET NULL for optional).
ALTER TABLE "g4d_campaign_leads" ADD CONSTRAINT "g4d_campaign_leads_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "g4d_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "g4d_kb_entries" ADD CONSTRAINT "g4d_kb_entries_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "g4d_wa_conversations" ADD CONSTRAINT "g4d_wa_conversations_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "g4d_wa_conversations" ADD CONSTRAINT "g4d_wa_conversations_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "g4d_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
