-- DomainCampaign fee model corrected to PRD §88 brackets; Enterprise/multi-brand
-- clients carry an admin-entered custom fee (stored in feePaise) flagged here.
-- Additive and defaulted — safe on existing rows.
ALTER TABLE "g4d_domain_campaign_records" ADD COLUMN "isCustomFee" BOOLEAN NOT NULL DEFAULT false;
