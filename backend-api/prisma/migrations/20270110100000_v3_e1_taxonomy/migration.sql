-- E1 taxonomy: 45 families (top level), categories (second level, each stored once), the family-category links (many to many), the symmetric related-families table, the planned pack key on each family, a source tag on every row,
-- and a map from the 196 existing registration categories (g4d_pack_categories) into the new structure.
-- ADDITIVE ONLY: new tables, new indexes, new constraints. Nothing existing is dropped, renamed, altered or rewritten; g4d_pack_categories and every vendor that uses it are untouched (the one foreign key points FROM the new map table TO the existing table).
-- The tables start empty; scripts/seed-v3-taxonomy.js loads them (dry run first).

-- CreateTable
CREATE TABLE "g4d_taxonomy_families" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "plannedPackKey" TEXT NOT NULL,
    "sourceTag" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_taxonomy_families_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_taxonomy_categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceTag" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_taxonomy_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_taxonomy_family_categories" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_taxonomy_family_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_taxonomy_related_families" (
    "id" TEXT NOT NULL,
    "familyAId" TEXT NOT NULL,
    "familyBId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "needsOwnerReview" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_taxonomy_related_families_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "g4d_taxonomy_legacy_map" (
    "id" TEXT NOT NULL,
    "legacyCategoryKey" TEXT NOT NULL,
    "taxonomyCategoryId" TEXT NOT NULL,
    "matchKind" TEXT NOT NULL,
    "sourceTag" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "g4d_taxonomy_legacy_map_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "g4d_taxonomy_families_slug_key" ON "g4d_taxonomy_families"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_taxonomy_families_sortOrder_key" ON "g4d_taxonomy_families"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_taxonomy_families_plannedPackKey_key" ON "g4d_taxonomy_families"("plannedPackKey");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_taxonomy_categories_slug_key" ON "g4d_taxonomy_categories"("slug");

-- CreateIndex
CREATE INDEX "g4d_taxonomy_family_categories_categoryId_idx" ON "g4d_taxonomy_family_categories"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_taxonomy_family_categories_familyId_categoryId_key" ON "g4d_taxonomy_family_categories"("familyId", "categoryId");

-- CreateIndex
CREATE INDEX "g4d_taxonomy_related_families_familyBId_idx" ON "g4d_taxonomy_related_families"("familyBId");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_taxonomy_related_families_familyAId_familyBId_key" ON "g4d_taxonomy_related_families"("familyAId", "familyBId");

-- CreateIndex
CREATE UNIQUE INDEX "g4d_taxonomy_legacy_map_legacyCategoryKey_key" ON "g4d_taxonomy_legacy_map"("legacyCategoryKey");

-- CreateIndex
CREATE INDEX "g4d_taxonomy_legacy_map_taxonomyCategoryId_idx" ON "g4d_taxonomy_legacy_map"("taxonomyCategoryId");

-- AddForeignKey
ALTER TABLE "g4d_taxonomy_family_categories" ADD CONSTRAINT "g4d_taxonomy_family_categories_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "g4d_taxonomy_families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_taxonomy_family_categories" ADD CONSTRAINT "g4d_taxonomy_family_categories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "g4d_taxonomy_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_taxonomy_related_families" ADD CONSTRAINT "g4d_taxonomy_related_families_familyAId_fkey" FOREIGN KEY ("familyAId") REFERENCES "g4d_taxonomy_families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_taxonomy_related_families" ADD CONSTRAINT "g4d_taxonomy_related_families_familyBId_fkey" FOREIGN KEY ("familyBId") REFERENCES "g4d_taxonomy_families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_taxonomy_legacy_map" ADD CONSTRAINT "g4d_taxonomy_legacy_map_taxonomyCategoryId_fkey" FOREIGN KEY ("taxonomyCategoryId") REFERENCES "g4d_taxonomy_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "g4d_taxonomy_legacy_map" ADD CONSTRAINT "g4d_taxonomy_legacy_map_legacyCategoryKey_fkey" FOREIGN KEY ("legacyCategoryKey") REFERENCES "g4d_pack_categories"("categoryKey") ON DELETE RESTRICT ON UPDATE CASCADE;


-- A related pair is stored once, with the smaller family id first: (A,B) and (B,A) cannot both exist and a family cannot relate to itself.
ALTER TABLE "g4d_taxonomy_related_families" ADD CONSTRAINT "g4d_taxonomy_related_families_ordered_check" CHECK ("familyAId" < "familyBId");

-- Same rule as every other public table: RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_taxonomy_families" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_taxonomy_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_taxonomy_family_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_taxonomy_related_families" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "g4d_taxonomy_legacy_map" ENABLE ROW LEVEL SECURITY;
