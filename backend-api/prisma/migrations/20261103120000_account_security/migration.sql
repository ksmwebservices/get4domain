-- V3 Step 0 (S13): password reset, password change and rotating refresh tokens. ADDITIVE ONLY.
-- Three nullable columns (existing rows keep NULL = "never changed", so every current session stays valid) and two new tables.
-- Nothing is dropped, renamed or rewritten. Only SHA-256 hashes of tokens are stored, never the tokens.
ALTER TABLE "Vendor" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);
ALTER TABLE "g4d_admin_team_members" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);
ALTER TABLE "g4d_team_members" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);

CREATE TABLE "g4d_password_resets" (
    "id" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "requestedIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_password_resets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "g4d_refresh_tokens" (
    "id" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "replacedById" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "g4d_password_resets_tokenHash_key" ON "g4d_password_resets"("tokenHash");
CREATE INDEX "g4d_password_resets_accountType_accountId_createdAt_idx" ON "g4d_password_resets"("accountType", "accountId", "createdAt");
CREATE UNIQUE INDEX "g4d_refresh_tokens_tokenHash_key" ON "g4d_refresh_tokens"("tokenHash");
CREATE INDEX "g4d_refresh_tokens_accountType_accountId_idx" ON "g4d_refresh_tokens"("accountType", "accountId");
CREATE INDEX "g4d_refresh_tokens_familyId_idx" ON "g4d_refresh_tokens"("familyId");

-- Same rule as every other public table (prisma/sql/enable_rls_public.sql): RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_password_resets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_refresh_tokens" ENABLE ROW LEVEL SECURITY;
