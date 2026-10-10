-- LeadSpace follow-ups: a vendor reminder to call a customer again, and a counter for the taps on a product's own buy link.
-- Additive only: one nullable column, one column with a default, one index. No existing row is touched.
ALTER TABLE "g4d_lead_events" ADD COLUMN "callbackAt" TIMESTAMP(3);

ALTER TABLE "g4d_leadspace_daily_stats" ADD COLUMN "outboundClicks" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "g4d_lead_events_vendorId_callbackAt_idx" ON "g4d_lead_events"("vendorId", "callbackAt");
