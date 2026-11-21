-- Wave 4 W8: TDS on commission payouts and the partner PAN. Additive: new columns only, no table is created (so no new row level security is needed; both tables already have it on).
-- A payout now records gross, the TDS held back and the net. Every payout recorded before this had no TDS: gross = its total, TDS = 0, net = its total.

ALTER TABLE "g4d_referral_partners" ADD COLUMN "pan" TEXT;

ALTER TABLE "g4d_commission_payouts" ADD COLUMN "grossMinor" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "g4d_commission_payouts" ADD COLUMN "tdsMinor" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "g4d_commission_payouts" ADD COLUMN "netMinor" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "g4d_commission_payouts" ADD COLUMN "tdsPercentBp" INTEGER;
ALTER TABLE "g4d_commission_payouts" ADD COLUMN "tdsEdited" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "g4d_commission_payouts" ADD COLUMN "tdsReason" TEXT;

UPDATE "g4d_commission_payouts" SET "grossMinor" = "totalMinor", "tdsMinor" = 0, "netMinor" = "totalMinor";

-- the rules also hold in the database: net = gross - tds, tds is not negative and leaves something to pay, gross is the total, a PAN has the shape of a PAN
ALTER TABLE "g4d_commission_payouts" ADD CONSTRAINT "g4d_commission_payouts_tds_check" CHECK ("grossMinor" = "totalMinor" AND "tdsMinor" >= 0 AND "tdsMinor" < "grossMinor" AND "netMinor" = "grossMinor" - "tdsMinor" AND ("tdsPercentBp" IS NULL OR ("tdsPercentBp" >= 0 AND "tdsPercentBp" <= 10000)));
ALTER TABLE "g4d_referral_partners" ADD CONSTRAINT "g4d_referral_partners_pan_check" CHECK ("pan" IS NULL OR "pan" ~ '^[A-Z]{5}[0-9]{4}[A-Z]$');
