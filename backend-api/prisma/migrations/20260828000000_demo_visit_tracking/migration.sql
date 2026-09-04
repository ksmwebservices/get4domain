-- Demo-visit tracking (additive) on the existing OTP-gate lead.
-- Dispatch 28-Aug-2026: scope a phone to its first main category, cap at 3 distinct
-- demo visits, then convert to a warm sales lead. All columns nullable/defaulted —
-- no backfill, no data change to existing rows.
ALTER TABLE "g4d_leads" ADD COLUMN "demoCategory" TEXT;
ALTER TABLE "g4d_leads" ADD COLUMN "demoVisitKeys" TEXT;
ALTER TABLE "g4d_leads" ADD COLUMN "demoVisitCount" INTEGER NOT NULL DEFAULT 0;
