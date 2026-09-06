-- OPERATION + INDUSTRY EXPERIENCE REGISTRY (PRD §8, §10, §31-33).
-- Two additive platform reference tables. No existing table is touched; safe to apply
-- on production. Seeded idempotently afterwards by `npx prisma db seed` (prisma/seed.ts).

-- CreateTable
CREATE TABLE "g4d_operation_types" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "cta" TEXT NOT NULL,
    "groupKey" TEXT NOT NULL,
    "actionIntent" TEXT,
    "description" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_operation_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_industry_experiences" (
    "id" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "groupKey" TEXT NOT NULL,
    "businessModel" TEXT NOT NULL,
    "primaryOperation" TEXT NOT NULL,
    "secondaryOperations" JSONB NOT NULL,
    "primaryCta" TEXT NOT NULL,
    "vendorModules" JSONB NOT NULL,
    "vendorMobileNav" JSONB NOT NULL,
    "clientModules" JSONB NOT NULL,
    "crmPipeline" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_industry_experiences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "g4d_operation_types_key_key" ON "g4d_operation_types"("key");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_industry_experiences_industry_key" ON "g4d_industry_experiences"("industry");
