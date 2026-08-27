-- Phase 2 (Gym): dedicated GymClass (class/slot schedule) + Membership (status
-- tracking) models. Additive; no data touched.

-- CreateTable
CREATE TABLE "g4d_gym_classes" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trainer" TEXT,
    "dayOfWeek" TEXT NOT NULL DEFAULT 'Mon',
    "startTime" TEXT NOT NULL DEFAULT '06:00',
    "durationMin" INTEGER NOT NULL DEFAULT 60,
    "capacity" INTEGER NOT NULL DEFAULT 20,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_gym_classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_memberships" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "contactId" TEXT,
    "memberName" TEXT NOT NULL,
    "memberPhone" TEXT,
    "planName" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "g4d_gym_classes_vendorId_idx" ON "g4d_gym_classes"("vendorId");
CREATE INDEX "g4d_memberships_vendorId_idx" ON "g4d_memberships"("vendorId");
CREATE INDEX "g4d_memberships_vendorId_status_idx" ON "g4d_memberships"("vendorId", "status");

-- AddForeignKey
ALTER TABLE "g4d_gym_classes" ADD CONSTRAINT "g4d_gym_classes_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "g4d_memberships" ADD CONSTRAINT "g4d_memberships_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
