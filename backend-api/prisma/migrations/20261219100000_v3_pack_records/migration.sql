-- Wave 2 Part A: pack records. Two new tables, no existing object is touched (the Vendor model only gains a back-relation, no column).
-- g4d_pack_tab_fields is platform data (staff edit it, no vendor id). g4d_pack_records is tenant data (every query names the vendor). Soft delete only.
-- NOT applied by this commit: the owner runs migrate-deploy on staging.

-- CreateTable
CREATE TABLE "g4d_pack_tab_fields" (
    "id" TEXT NOT NULL,
    "ownerKey" TEXT NOT NULL,
    "tabKey" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB NOT NULL DEFAULT '[]',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "listColumn" BOOLEAN NOT NULL DEFAULT false,
    "searchable" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedByStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_pack_tab_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_pack_records" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "packKey" TEXT NOT NULL,
    "tabKey" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "searchText" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdByType" TEXT NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "g4d_pack_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "g4d_pack_tab_fields_ownerKey_tabKey_fieldKey_key" ON "g4d_pack_tab_fields"("ownerKey", "tabKey", "fieldKey");

-- CreateIndex
CREATE INDEX "g4d_pack_tab_fields_ownerKey_tabKey_sortOrder_idx" ON "g4d_pack_tab_fields"("ownerKey", "tabKey", "sortOrder");

-- CreateIndex
CREATE INDEX "g4d_pack_records_vendorId_packKey_tabKey_deletedAt_createdAt_idx" ON "g4d_pack_records"("vendorId", "packKey", "tabKey", "deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "g4d_pack_records_vendorId_packKey_tabKey_status_idx" ON "g4d_pack_records"("vendorId", "packKey", "tabKey", "status");

-- AddForeignKey
ALTER TABLE "g4d_pack_records" ADD CONSTRAINT "g4d_pack_records_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Checks (Prisma does not model them): the field type and the record status are closed sets
ALTER TABLE "g4d_pack_tab_fields" ADD CONSTRAINT "g4d_pack_tab_fields_type_check" CHECK ("type" IN ('text', 'longtext', 'number', 'money', 'date', 'datetime', 'select', 'multiselect', 'bool', 'phone', 'email', 'url', 'image', 'status'));
ALTER TABLE "g4d_pack_records" ADD CONSTRAINT "g4d_pack_records_status_check" CHECK ("status" IN ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED'));

-- Same rule as every other public table: RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_pack_tab_fields" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_pack_records" ENABLE ROW LEVEL SECURITY;
