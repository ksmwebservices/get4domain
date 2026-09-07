-- Theme Marketplace: uploaded theme JS + preserved font stylesheet hrefs. Additive only.
ALTER TABLE "g4d_website_themes" ADD COLUMN "js" TEXT;
ALTER TABLE "g4d_website_themes" ADD COLUMN "fonts" JSONB;
