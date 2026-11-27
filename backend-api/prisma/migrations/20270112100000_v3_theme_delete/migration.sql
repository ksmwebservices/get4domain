-- Theme delete: an admin may delete a theme that was never published and never given to a business. Every version row is KEPT and stamped (soft delete); its package file is emptied. Additive: two nullable columns and one check.
ALTER TABLE "g4d_theme_market_packages" ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "deletedById" TEXT;

-- The database repeats the rule it can see on the row: a deleted version was never published and never belonged to a business
ALTER TABLE "g4d_theme_market_packages" ADD CONSTRAINT "g4d_theme_market_packages_deleted_check" CHECK ("deletedAt" IS NULL OR ("publishedAt" IS NULL AND "status" <> 'PUBLISHED' AND "privateVendorId" IS NULL AND "sourceVendorId" IS NULL));
