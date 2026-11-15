-- Wave 2 Part E: industry profile fields. Three new tables: the field sets (platform data, staff edit), the map from a profile value to the vendor site content (platform data), and the values a business gave (tenant data).
-- categorySlug and the map's scope columns are EMPTY (not NULL) for "every category of the pack" / "every pack", so the unique keys hold. Additive only. NOT applied by this commit: the owner runs migrate-deploy on staging.

-- CreateTable
CREATE TABLE "g4d_category_profile_fields" (
    "id" TEXT NOT NULL,
    "packKey" TEXT NOT NULL,
    "categorySlug" TEXT NOT NULL DEFAULT '',
    "fieldKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB NOT NULL DEFAULT '[]',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "siteSection" TEXT NOT NULL DEFAULT 'details',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedByStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_category_profile_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_profile_site_map" (
    "id" TEXT NOT NULL,
    "packKey" TEXT NOT NULL DEFAULT '',
    "categorySlug" TEXT NOT NULL DEFAULT '',
    "fieldKey" TEXT NOT NULL,
    "targetKind" TEXT NOT NULL,
    "targetKey" TEXT NOT NULL DEFAULT '',
    "itemMap" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedByStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_profile_site_map_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_vendor_profile_values" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "valueJson" JSONB NOT NULL,
    "updatedByType" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_vendor_profile_values_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "g4d_category_profile_fields_packKey_categorySlug_fieldKey_key" ON "g4d_category_profile_fields"("packKey", "categorySlug", "fieldKey");

-- CreateIndex
CREATE INDEX "g4d_category_profile_fields_packKey_categorySlug_sortOrder_idx" ON "g4d_category_profile_fields"("packKey", "categorySlug", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_profile_site_map_packKey_categorySlug_fieldKey_key" ON "g4d_profile_site_map"("packKey", "categorySlug", "fieldKey");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_vendor_profile_values_vendorId_fieldKey_key" ON "g4d_vendor_profile_values"("vendorId", "fieldKey");

-- AddForeignKey
ALTER TABLE "g4d_vendor_profile_values" ADD CONSTRAINT "g4d_vendor_profile_values_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Checks (Prisma does not model them): closed sets
ALTER TABLE "g4d_category_profile_fields" ADD CONSTRAINT "g4d_category_profile_fields_type_check" CHECK ("type" IN ('text', 'longtext', 'number', 'money', 'date', 'datetime', 'select', 'multiselect', 'bool', 'phone', 'email', 'url', 'image', 'status', 'textlist', 'servicelist', 'imagelist'));
ALTER TABLE "g4d_profile_site_map" ADD CONSTRAINT "g4d_profile_site_map_kind_check" CHECK ("targetKind" IN ('FIELD', 'LIST', 'NONE'));

-- Same rule as every other public table: RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_category_profile_fields" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_profile_site_map" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_vendor_profile_values" ENABLE ROW LEVEL SECURITY;
