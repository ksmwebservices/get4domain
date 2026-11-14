-- Amendment 13 V9 (Part B, B5 and B8): two staff roles are added to the existing enum. Additive: no value is renamed, removed or re-used.
-- The document's SALES role is the existing MARKETING value (see docs/v3/V3_DIRECTORY_CLAIM.md). The new values are not used in this migration.
ALTER TYPE "AdminRole" ADD VALUE IF NOT EXISTS 'SUPPORT';
ALTER TYPE "AdminRole" ADD VALUE IF NOT EXISTS 'ADMIN';
