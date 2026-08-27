-- Phase 3 — Photography: shoot scheduling + delivery tracking

CREATE TABLE "g4d_photo_shoots" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "contactId" TEXT,
    "eventType" TEXT NOT NULL DEFAULT 'Wedding',
    "eventDate" TIMESTAMP(3),
    "venue" TEXT,
    "coverageHours" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'enquiry',
    "packageValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "advancePaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deliveryDueDate" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "galleryUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_photo_shoots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "g4d_shoot_deliverables" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "shootId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_shoot_deliverables_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "g4d_photo_shoots_vendorId_idx" ON "g4d_photo_shoots"("vendorId");
CREATE INDEX "g4d_photo_shoots_vendorId_status_idx" ON "g4d_photo_shoots"("vendorId", "status");
CREATE INDEX "g4d_shoot_deliverables_vendorId_idx" ON "g4d_shoot_deliverables"("vendorId");
CREATE INDEX "g4d_shoot_deliverables_shootId_idx" ON "g4d_shoot_deliverables"("shootId");

ALTER TABLE "g4d_photo_shoots" ADD CONSTRAINT "g4d_photo_shoots_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "g4d_shoot_deliverables" ADD CONSTRAINT "g4d_shoot_deliverables_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "g4d_shoot_deliverables" ADD CONSTRAINT "g4d_shoot_deliverables_shootId_fkey" FOREIGN KEY ("shootId") REFERENCES "g4d_photo_shoots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
