-- Wave 2 Part H2: which add-on packs a pack may buy, as data. One new table, nothing else is touched. NOT applied by this commit: the owner runs migrate-deploy on staging.
-- The rows below are the owner's rules as a first state (SHOP and ONLINE_ORDERING_DELIVERY for the packs that sell goods, never PHARMACY; PHARMACY_COUNTER only for PHARMACY; HOME_SAMPLE_COLLECTION for LAB).
-- A row is only inserted when both its add-on pack and its pack already exist (the pack loader creates the same rows later on a database that has none yet), so this migration cannot fail on a foreign key.

CREATE TABLE "g4d_addon_eligibility" (
    "id" TEXT NOT NULL,
    "addonKey" TEXT NOT NULL,
    "packKey" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedByStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_addon_eligibility_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "g4d_addon_eligibility_addonKey_packKey_key" ON "g4d_addon_eligibility"("addonKey", "packKey");
CREATE INDEX "g4d_addon_eligibility_packKey_idx" ON "g4d_addon_eligibility"("packKey");

ALTER TABLE "g4d_addon_eligibility" ADD CONSTRAINT "g4d_addon_eligibility_addonKey_fkey" FOREIGN KEY ("addonKey") REFERENCES "g4d_pack_addons"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "g4d_addon_eligibility" ADD CONSTRAINT "g4d_addon_eligibility_packKey_fkey" FOREIGN KEY ("packKey") REFERENCES "g4d_packs"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- like every platform table: row level security ON and no policy, so only the server role reads or writes it
ALTER TABLE "g4d_addon_eligibility" ENABLE ROW LEVEL SECURITY;

-- the fixed rules also hold in the database, so no tool can write a row that breaks them
ALTER TABLE "g4d_addon_eligibility" ADD CONSTRAINT "g4d_addon_eligibility_owner_rules_check" CHECK (
  NOT ("addonKey" IN ('SHOP', 'ONLINE_ORDERING_DELIVERY') AND "packKey" = 'PHARMACY')
  AND ("addonKey" <> 'PHARMACY_COUNTER' OR "packKey" = 'PHARMACY')
);

INSERT INTO "g4d_addon_eligibility" ("id", "addonKey", "packKey", "active", "updatedAt")
SELECT 'elig_' || v."addonKey" || '_' || v."packKey", v."addonKey", v."packKey", true, CURRENT_TIMESTAMP
FROM (VALUES
  ('SHOP', 'RETAIL'), ('SHOP', 'FOOD_SERVICE'), ('SHOP', 'MEMBERSHIP_WELLNESS'), ('SHOP', 'VEHICLE_SERVICE'), ('SHOP', 'B2B_DEALER'),
  ('ONLINE_ORDERING_DELIVERY', 'RETAIL'), ('ONLINE_ORDERING_DELIVERY', 'FOOD_SERVICE'), ('ONLINE_ORDERING_DELIVERY', 'MEMBERSHIP_WELLNESS'), ('ONLINE_ORDERING_DELIVERY', 'VEHICLE_SERVICE'), ('ONLINE_ORDERING_DELIVERY', 'B2B_DEALER'),
  ('PHARMACY_COUNTER', 'PHARMACY'),
  ('HOME_SAMPLE_COLLECTION', 'LAB')
) AS v("addonKey", "packKey")
WHERE EXISTS (SELECT 1 FROM "g4d_pack_addons" a WHERE a."key" = v."addonKey")
  AND EXISTS (SELECT 1 FROM "g4d_packs" p WHERE p."key" = v."packKey")
ON CONFLICT ("addonKey", "packKey") DO NOTHING;
