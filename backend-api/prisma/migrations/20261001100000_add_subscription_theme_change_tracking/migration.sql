-- Theme-change entitlement tracking for DomainApp Workspace/BOS tiers
-- (dispatch 01-Oct-2026). Additive and nullable/defaulted — safe on existing rows.
ALTER TABLE "Subscription" ADD COLUMN "themeChangesUsed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Subscription" ADD COLUMN "themeChangesLimit" INTEGER;
ALTER TABLE "Subscription" ADD COLUMN "themeChangesResetAt" TIMESTAMP(3);
