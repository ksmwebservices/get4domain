-- Phase 3 — Construction: project + milestone tracking, materials

CREATE TABLE "g4d_construction_projects" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "contactId" TEXT,
    "siteAddress" TEXT,
    "phase" TEXT NOT NULL DEFAULT 'Foundation',
    "status" TEXT NOT NULL DEFAULT 'planning',
    "budget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "spent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "targetDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_construction_projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "g4d_project_milestones" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_project_milestones_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "g4d_project_materials" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "projectId" TEXT,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "supplier" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ordered',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_project_materials_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "g4d_construction_projects_vendorId_idx" ON "g4d_construction_projects"("vendorId");
CREATE INDEX "g4d_construction_projects_vendorId_status_idx" ON "g4d_construction_projects"("vendorId", "status");
CREATE INDEX "g4d_project_milestones_vendorId_idx" ON "g4d_project_milestones"("vendorId");
CREATE INDEX "g4d_project_milestones_projectId_idx" ON "g4d_project_milestones"("projectId");
CREATE INDEX "g4d_project_materials_vendorId_idx" ON "g4d_project_materials"("vendorId");

ALTER TABLE "g4d_construction_projects" ADD CONSTRAINT "g4d_construction_projects_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "g4d_project_milestones" ADD CONSTRAINT "g4d_project_milestones_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "g4d_project_milestones" ADD CONSTRAINT "g4d_project_milestones_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "g4d_construction_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "g4d_project_materials" ADD CONSTRAINT "g4d_project_materials_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
