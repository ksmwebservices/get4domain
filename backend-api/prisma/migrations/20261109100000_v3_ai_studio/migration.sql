-- V3 slice 5.11: AI Studio providers (secrets stored encrypted), usage and credits, versioned prompts, manual credit grants. ADDITIVE ONLY: new enums, new g4d_ tables, new indexes and foreign keys.
-- No existing table, column or row is changed. Staging only until the owner approves a production release.
-- Generated offline with prisma migrate diff against the slice 5.1b schema; the RLS lines at the end follow prisma/sql/enable_rls_public.sql.

-- CreateEnum
CREATE TYPE "V3AiProviderKind" AS ENUM ('TEXT_LLM');

-- CreateEnum
CREATE TYPE "V3AiProviderStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "V3AiUsageStatus" AS ENUM ('RESERVED', 'DONE', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "V3AiPromptStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');

-- CreateTable
CREATE TABLE "g4d_ai_providers" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "kind" "V3AiProviderKind" NOT NULL DEFAULT 'TEXT_LLM',
    "displayName" TEXT NOT NULL,
    "status" "V3AiProviderStatus" NOT NULL DEFAULT 'DISABLED',
    "secretCipher" TEXT,
    "secretIv" TEXT,
    "secretTag" TEXT,
    "secretLast4" TEXT,
    "model" TEXT NOT NULL,
    "settingsJson" JSONB NOT NULL DEFAULT '{}',
    "createdByStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_ai_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_ai_usage" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "providerKey" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT NOT NULL,
    "status" "V3AiUsageStatus" NOT NULL DEFAULT 'RESERVED',
    "period" TEXT NOT NULL,
    "resultText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_ai_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_ai_prompts" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "template" TEXT NOT NULL,
    "status" "V3AiPromptStatus" NOT NULL DEFAULT 'DRAFT',
    "activeKey" TEXT,
    "createdByStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_ai_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_ai_credit_grants" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "grantedByStaffId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_ai_credit_grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "g4d_ai_providers_key_key" ON "g4d_ai_providers"("key");

-- CreateIndex
CREATE INDEX "g4d_ai_usage_vendorId_period_status_idx" ON "g4d_ai_usage"("vendorId", "period", "status");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_ai_usage_vendorId_idempotencyKey_key" ON "g4d_ai_usage"("vendorId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_ai_prompts_activeKey_key" ON "g4d_ai_prompts"("activeKey");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_ai_prompts_key_version_key" ON "g4d_ai_prompts"("key", "version");

-- CreateIndex
CREATE INDEX "g4d_ai_credit_grants_vendorId_period_idx" ON "g4d_ai_credit_grants"("vendorId", "period");

-- AddForeignKey
ALTER TABLE "g4d_ai_usage" ADD CONSTRAINT "g4d_ai_usage_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_ai_credit_grants" ADD CONSTRAINT "g4d_ai_credit_grants_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Same rule as every other public table (prisma/sql/enable_rls_public.sql): RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_ai_providers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_ai_usage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_ai_prompts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_ai_credit_grants" ENABLE ROW LEVEL SECURITY;
