-- V3 batch 3 slice 5.6b: the canonical host a site was last built for. ADDITIVE ONLY: one nullable column on an existing V3 table; no existing row or column changes.
-- Why a column and not a table: g4d_site_settings already has exactly one row per vendor and the canonical host is one value per vendor. Staging only until the owner approves a production release.

-- AlterTable
ALTER TABLE "g4d_site_settings" ADD COLUMN     "canonicalHost" TEXT;
