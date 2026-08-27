-- Phase 3 — Technology & IT: project + sprint/task tracking

CREATE TABLE "g4d_tech_projects" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "contactId" TEXT,
    "projectType" TEXT NOT NULL DEFAULT 'Web',
    "techStack" TEXT,
    "billingType" TEXT NOT NULL DEFAULT 'Fixed',
    "status" TEXT NOT NULL DEFAULT 'proposal',
    "contractValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deadline" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_tech_projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "g4d_project_tasks" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "sprint" TEXT,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "assignee" TEXT,
    "estimateHours" DOUBLE PRECISION,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "g4d_project_tasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "g4d_tech_projects_vendorId_idx" ON "g4d_tech_projects"("vendorId");
CREATE INDEX "g4d_tech_projects_vendorId_status_idx" ON "g4d_tech_projects"("vendorId", "status");
CREATE INDEX "g4d_project_tasks_vendorId_idx" ON "g4d_project_tasks"("vendorId");
CREATE INDEX "g4d_project_tasks_vendorId_status_idx" ON "g4d_project_tasks"("vendorId", "status");

ALTER TABLE "g4d_tech_projects" ADD CONSTRAINT "g4d_tech_projects_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "g4d_project_tasks" ADD CONSTRAINT "g4d_project_tasks_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "g4d_project_tasks" ADD CONSTRAINT "g4d_project_tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "g4d_tech_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
