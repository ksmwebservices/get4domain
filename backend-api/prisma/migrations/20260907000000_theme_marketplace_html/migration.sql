-- Theme Marketplace: uploaded static-HTML themes (Bolt/designer), multi-page capable.
-- Additive only — no existing column/table is altered; safe to apply on production.

ALTER TABLE "g4d_website_themes" ADD COLUMN "description" TEXT;
ALTER TABLE "g4d_website_themes" ADD COLUMN "pages" JSONB;
ALTER TABLE "g4d_website_themes" ADD COLUMN "css" TEXT;
