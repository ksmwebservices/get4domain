-- Wave 3 Part A: two staff labels, the partner login role, and the referral partner table. Additive only. NOT applied by this commit: the owner runs migrate-deploy on staging.
-- FIELD_EXECUTIVE and TELECALLER hold exactly the SALES (MARKETING) rights: the application folds them into SALES when it builds the principal. REFERRAL_PARTNER may use /v3/partner/* only.
-- The new enum values are not used inside this migration (a value added in a transaction cannot be used until it commits).

ALTER TYPE "AdminRole" ADD VALUE IF NOT EXISTS 'FIELD_EXECUTIVE';
ALTER TYPE "AdminRole" ADD VALUE IF NOT EXISTS 'TELECALLER';
ALTER TYPE "AdminRole" ADD VALUE IF NOT EXISTS 'REFERRAL_PARTNER';

CREATE TABLE "g4d_referral_partners" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "staffUserId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_referral_partners_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "g4d_referral_partners_email_key" ON "g4d_referral_partners"("email");
CREATE UNIQUE INDEX "g4d_referral_partners_staffUserId_key" ON "g4d_referral_partners"("staffUserId");
CREATE INDEX "g4d_referral_partners_status_idx" ON "g4d_referral_partners"("status");

-- like every platform table: row level security ON and no policy, so only the server role reads or writes it
ALTER TABLE "g4d_referral_partners" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "g4d_referral_partners" ADD CONSTRAINT "g4d_referral_partners_type_check" CHECK ("type" IN ('FREELANCER', 'SALES_TEAM', 'ADMIN_TEAM'));
ALTER TABLE "g4d_referral_partners" ADD CONSTRAINT "g4d_referral_partners_status_check" CHECK ("status" IN ('ACTIVE', 'DISABLED'));
ALTER TABLE "g4d_referral_partners" ADD CONSTRAINT "g4d_referral_partners_name_check" CHECK (length(btrim("name")) > 0);
