-- Block 4b slice 11: the mail lanes and mailbox prices as data. Additive only: two new tables, no existing object is touched. Nothing here sends mail.
CREATE TABLE "g4d_v3_mail_lanes" (
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "allowsPromotion" BOOLEAN NOT NULL DEFAULT false,
    "sendingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_v3_mail_lanes_pkey" PRIMARY KEY ("key")
);
CREATE TABLE "g4d_v3_mailbox_prices" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "pricePaise" INTEGER,
    "includedCount" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "confirmedAt" TIMESTAMP(3),
    "confirmedBy" TEXT,
    "confirmNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_v3_mailbox_prices_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "g4d_v3_mailbox_prices_key_key" ON "g4d_v3_mailbox_prices"("key");
ALTER TABLE "g4d_v3_mail_lanes" ADD CONSTRAINT "g4d_v3_mail_lanes_key_chk" CHECK ("key" IN ('SYSTEM', 'VENDOR_OFFICIAL', 'PROMOTIONS'));
-- THE HARD RULE in the database: lane 1 and lane 2 never allow promotion, and in this block only lane 1 may have sending switched on (lanes 2 and 3 sending is a later release and a later migration).
ALTER TABLE "g4d_v3_mail_lanes" ADD CONSTRAINT "g4d_v3_mail_lanes_promotion_chk" CHECK ("allowsPromotion" = false OR "key" = 'PROMOTIONS');
ALTER TABLE "g4d_v3_mail_lanes" ADD CONSTRAINT "g4d_v3_mail_lanes_sending_chk" CHECK ("sendingEnabled" = false OR "key" = 'SYSTEM');
ALTER TABLE "g4d_v3_mailbox_prices" ADD CONSTRAINT "g4d_v3_mailbox_prices_kind_chk" CHECK ("kind" IN ('FORWARDING', 'INCLUDED', 'ADD_ON', 'EXTRA'));
ALTER TABLE "g4d_v3_mailbox_prices" ADD CONSTRAINT "g4d_v3_mailbox_prices_scope_chk" CHECK ("scope" IN ('ANY', 'PROFESSIONAL', 'ECOMMERCE', 'HANDYMAN'));
ALTER TABLE "g4d_v3_mailbox_prices" ADD CONSTRAINT "g4d_v3_mailbox_prices_status_chk" CHECK ("status" IN ('PENDING', 'ACTIVE'));
ALTER TABLE "g4d_v3_mailbox_prices" ADD CONSTRAINT "g4d_v3_mailbox_prices_amount_chk" CHECK (("pricePaise" IS NULL OR "pricePaise" >= 0) AND ("includedCount" IS NULL OR "includedCount" >= 1));
-- A price is ACTIVE only after someone confirmed it, with a note.
ALTER TABLE "g4d_v3_mailbox_prices" ADD CONSTRAINT "g4d_v3_mailbox_prices_confirmed_chk" CHECK ("status" = 'PENDING' OR ("confirmedAt" IS NOT NULL AND "confirmedBy" IS NOT NULL AND "confirmNote" IS NOT NULL));

-- Same rule as every other public table: RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_v3_mail_lanes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_v3_mailbox_prices" ENABLE ROW LEVEL SECURITY;
