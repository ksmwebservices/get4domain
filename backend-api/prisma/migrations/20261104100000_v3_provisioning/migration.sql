-- V3 slice 5.3: provisioning jobs and steps, claim tokens, invites. ADDITIVE ONLY: new enums, new g4d_ tables, new indexes and foreign keys.
-- No existing table, column or row is changed. Staging only until the owner approves a production release.
-- Generated offline with prisma migrate diff against the slice 5.1 schema; the RLS lines at the end follow prisma/sql/enable_rls_public.sql.

-- CreateEnum
CREATE TYPE "V3JobKind" AS ENUM ('BUSINESS_FREE_SITE');

-- CreateEnum
CREATE TYPE "V3JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'WAITING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "V3StepKey" AS ENUM ('CREATE_VENDOR', 'ASSIGN_FREE_PLAN', 'CREATE_FREE_SITE_DRAFT', 'CREATE_CLAIM_LINK', 'SEND_INVITE');

-- CreateEnum
CREATE TYPE "V3StepStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "V3ClaimPurpose" AS ENUM ('CLAIM');

-- CreateEnum
CREATE TYPE "V3ClaimStatus" AS ENUM ('ACTIVE', 'USED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "V3InviteChannel" AS ENUM ('EMAIL');

-- CreateEnum
CREATE TYPE "V3InviteMode" AS ENUM ('SANDBOX', 'LIVE');

-- CreateEnum
CREATE TYPE "V3InviteStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'BOUNCED');

-- CreateTable
CREATE TABLE "g4d_provisioning_jobs" (
    "id" TEXT NOT NULL,
    "kind" "V3JobKind" NOT NULL DEFAULT 'BUSINESS_FREE_SITE',
    "status" "V3JobStatus" NOT NULL DEFAULT 'QUEUED',
    "idempotencyKey" TEXT NOT NULL,
    "vendorId" TEXT,
    "input" JSONB NOT NULL,
    "currentStep" "V3StepKey",
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedBy" TEXT,
    "lockedUntil" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "createdByType" "V3ActorType" NOT NULL DEFAULT 'STAFF',
    "createdById" TEXT,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_provisioning_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_provisioning_steps" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "stepKey" "V3StepKey" NOT NULL,
    "status" "V3StepStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "outputRef" JSONB,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_provisioning_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_claim_tokens" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "purpose" "V3ClaimPurpose" NOT NULL DEFAULT 'CLAIM',
    "status" "V3ClaimStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdByType" "V3ActorType" NOT NULL DEFAULT 'SYSTEM',
    "createdById" TEXT,
    "activeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_claim_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_invites" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "channel" "V3InviteChannel" NOT NULL DEFAULT 'EMAIL',
    "toAddress" TEXT NOT NULL,
    "claimTokenId" TEXT NOT NULL,
    "adapterMode" "V3InviteMode" NOT NULL DEFAULT 'SANDBOX',
    "status" "V3InviteStatus" NOT NULL DEFAULT 'QUEUED',
    "providerMessageId" TEXT,
    "subject" TEXT NOT NULL,
    "bodyPreview" TEXT NOT NULL,
    "sandboxBody" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "g4d_provisioning_jobs_idempotencyKey_key" ON "g4d_provisioning_jobs"("idempotencyKey");

-- CreateIndex
CREATE INDEX "g4d_provisioning_jobs_status_nextRunAt_idx" ON "g4d_provisioning_jobs"("status", "nextRunAt");

-- CreateIndex
CREATE INDEX "g4d_provisioning_jobs_vendorId_idx" ON "g4d_provisioning_jobs"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_provisioning_steps_jobId_stepKey_key" ON "g4d_provisioning_steps"("jobId", "stepKey");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_claim_tokens_tokenHash_key" ON "g4d_claim_tokens"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_claim_tokens_activeKey_key" ON "g4d_claim_tokens"("activeKey");

-- CreateIndex
CREATE INDEX "g4d_claim_tokens_vendorId_status_idx" ON "g4d_claim_tokens"("vendorId", "status");

-- CreateIndex
CREATE INDEX "g4d_invites_vendorId_createdAt_idx" ON "g4d_invites"("vendorId", "createdAt");

-- CreateIndex
CREATE INDEX "g4d_invites_claimTokenId_idx" ON "g4d_invites"("claimTokenId");

-- AddForeignKey
ALTER TABLE "g4d_provisioning_jobs" ADD CONSTRAINT "g4d_provisioning_jobs_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_provisioning_steps" ADD CONSTRAINT "g4d_provisioning_steps_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "g4d_provisioning_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_claim_tokens" ADD CONSTRAINT "g4d_claim_tokens_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_invites" ADD CONSTRAINT "g4d_invites_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_invites" ADD CONSTRAINT "g4d_invites_claimTokenId_fkey" FOREIGN KEY ("claimTokenId") REFERENCES "g4d_claim_tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Same rule as every other public table (prisma/sql/enable_rls_public.sql): RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_provisioning_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_provisioning_steps" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_claim_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_invites" ENABLE ROW LEVEL SECURITY;
