-- Wave 2 public site gap G2: a short-lived, one-time login handoff from the public site to the vendor app. One new table, nothing else is touched. NOT applied by this commit: the owner runs migrate-deploy on staging.
-- Only the SHA-256 of the code is stored. A code works once, for a moment, for a vendor owner only. Rows are kept as history (a use sets usedAt); nothing is deleted.

CREATE TABLE "g4d_login_handoffs" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "issuedIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_login_handoffs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "g4d_login_handoffs_tokenHash_key" ON "g4d_login_handoffs"("tokenHash");
CREATE INDEX "g4d_login_handoffs_accountType_accountId_createdAt_idx" ON "g4d_login_handoffs"("accountType", "accountId", "createdAt");

-- like every account table: row level security ON and no policy, so only the server role reads or writes it
ALTER TABLE "g4d_login_handoffs" ENABLE ROW LEVEL SECURITY;

-- a handoff is for a vendor owner only, and a code never lives longer than ten minutes whatever the setting says
ALTER TABLE "g4d_login_handoffs" ADD CONSTRAINT "g4d_login_handoffs_owner_only_check" CHECK ("accountType" = 'VENDOR');
ALTER TABLE "g4d_login_handoffs" ADD CONSTRAINT "g4d_login_handoffs_life_check" CHECK ("expiresAt" <= "createdAt" + INTERVAL '10 minutes');
