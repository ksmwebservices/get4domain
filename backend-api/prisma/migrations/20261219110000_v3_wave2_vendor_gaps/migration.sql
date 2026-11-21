-- Wave 2 Part B: vendor gap tables. Additive: two new tables, and the inbox state check is WIDENED (HANDLED joins NEW, READ, ARCHIVED, HELD; no existing value is removed or renamed).
-- NOT applied by this commit: the owner runs migrate-deploy on staging.

-- Inbox: a HANDLED state beside ARCHIVED (the vendor app wrote "handled" as ARCHIVED until now; ARCHIVED stays).
ALTER TABLE "g4d_inbox_messages" DROP CONSTRAINT "g4d_inbox_messages_state_chk";
ALTER TABLE "g4d_inbox_messages" ADD CONSTRAINT "g4d_inbox_messages_state_chk" CHECK ("state" IN ('NEW', 'READ', 'ARCHIVED', 'HELD', 'HANDLED'));

-- CreateTable
CREATE TABLE "g4d_migration_requests" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "openVendorId" TEXT,
    "siteUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "staffNote" TEXT,
    "createdByType" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_migration_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_promo_drafts" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdByType" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "g4d_promo_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "g4d_migration_requests_openVendorId_key" ON "g4d_migration_requests"("openVendorId");

-- CreateIndex
CREATE INDEX "g4d_migration_requests_vendorId_createdAt_idx" ON "g4d_migration_requests"("vendorId", "createdAt");

-- CreateIndex
CREATE INDEX "g4d_promo_drafts_vendorId_kind_status_createdAt_idx" ON "g4d_promo_drafts"("vendorId", "kind", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "g4d_migration_requests" ADD CONSTRAINT "g4d_migration_requests_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_promo_drafts" ADD CONSTRAINT "g4d_promo_drafts_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Checks (Prisma does not model them): closed sets, and an open request carries the vendor key while it is open only
ALTER TABLE "g4d_migration_requests" ADD CONSTRAINT "g4d_migration_requests_status_check" CHECK ("status" IN ('RECEIVED', 'IN_PROGRESS', 'DONE', 'DECLINED'));
ALTER TABLE "g4d_migration_requests" ADD CONSTRAINT "g4d_migration_requests_open_check" CHECK (("status" IN ('RECEIVED', 'IN_PROGRESS') AND "openVendorId" = "vendorId") OR ("status" IN ('DONE', 'DECLINED') AND "openVendorId" IS NULL));
ALTER TABLE "g4d_promo_drafts" ADD CONSTRAINT "g4d_promo_drafts_kind_check" CHECK ("kind" IN ('PROMOTION', 'SOCIAL'));
ALTER TABLE "g4d_promo_drafts" ADD CONSTRAINT "g4d_promo_drafts_status_check" CHECK ("status" IN ('DRAFT', 'ARCHIVED'));

-- Same rule as every other public table: RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_migration_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_promo_drafts" ENABLE ROW LEVEL SECURITY;
