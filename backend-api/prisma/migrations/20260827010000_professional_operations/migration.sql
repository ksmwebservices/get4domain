-- Phase 2 — Professional Services: engagement/case tracking + document checklist

-- CreateTable
CREATE TABLE "g4d_engagements" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "contactId" TEXT,
    "engagementType" TEXT NOT NULL DEFAULT 'Consulting',
    "billingType" TEXT NOT NULL DEFAULT 'Fixed',
    "status" TEXT NOT NULL DEFAULT 'proposal',
    "feeValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hourlyRate" DOUBLE PRECISION,
    "assignedTo" TEXT,
    "startDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "description" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_engagements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_engagement_docs" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "receivedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_engagement_docs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "g4d_engagements_vendorId_idx" ON "g4d_engagements"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_engagements_vendorId_status_idx" ON "g4d_engagements"("vendorId", "status");

-- CreateIndex
CREATE INDEX "g4d_engagement_docs_vendorId_idx" ON "g4d_engagement_docs"("vendorId");

-- CreateIndex
CREATE INDEX "g4d_engagement_docs_engagementId_idx" ON "g4d_engagement_docs"("engagementId");

-- AddForeignKey
ALTER TABLE "g4d_engagements" ADD CONSTRAINT "g4d_engagements_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_engagement_docs" ADD CONSTRAINT "g4d_engagement_docs_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_engagement_docs" ADD CONSTRAINT "g4d_engagement_docs_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "g4d_engagements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
