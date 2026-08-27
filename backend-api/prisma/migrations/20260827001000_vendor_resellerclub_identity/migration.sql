-- Per-vendor ResellerClub identity: customer + contact ids created lazily from
-- the vendor's own details on first domain registration. Additive, nullable.

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN "resellerClubCustomerId" TEXT;
ALTER TABLE "Vendor" ADD COLUMN "resellerClubContactId" TEXT;
