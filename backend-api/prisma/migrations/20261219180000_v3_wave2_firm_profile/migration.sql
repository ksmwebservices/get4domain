-- Wave 2 Part H3: the platform's own company details as data, in ONE row. One new table, nothing else is touched. NOT applied by this commit: the owner runs migrate-deploy on staging.
-- The first row carries the two facts the owner gave (the legal name and the registered address). GSTIN, PAN, email and phone start empty: nothing is invented.

CREATE TABLE "g4d_firm_profile" (
    "id" TEXT NOT NULL,
    "legalName" TEXT NOT NULL DEFAULT 'KSM QUANTUM TECHNOLOGIES',
    "registeredAddress" TEXT NOT NULL DEFAULT 'Tidel Park, D Block, Tharamani, Chennai 600113',
    "gstin" TEXT,
    "pan" TEXT,
    "registeredEmail" TEXT,
    "registeredPhone" TEXT,
    "updatedByStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "g4d_firm_profile_pkey" PRIMARY KEY ("id")
);

-- like every platform table: row level security ON and no policy, so only the server role reads or writes it
ALTER TABLE "g4d_firm_profile" ENABLE ROW LEVEL SECURITY;

-- one row only, and the tax numbers keep their layout even if something writes around the service
ALTER TABLE "g4d_firm_profile" ADD CONSTRAINT "g4d_firm_profile_single_row_check" CHECK ("id" = 'platform');
ALTER TABLE "g4d_firm_profile" ADD CONSTRAINT "g4d_firm_profile_gstin_check" CHECK ("gstin" IS NULL OR "gstin" ~ '^(0[1-9]|[12][0-9]|3[0-8]|97|99)[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$');
ALTER TABLE "g4d_firm_profile" ADD CONSTRAINT "g4d_firm_profile_pan_check" CHECK ("pan" IS NULL OR "pan" ~ '^[A-Z]{5}[0-9]{4}[A-Z]$');
ALTER TABLE "g4d_firm_profile" ADD CONSTRAINT "g4d_firm_profile_name_check" CHECK (length(btrim("legalName")) > 0 AND length(btrim("registeredAddress")) > 0);

INSERT INTO "g4d_firm_profile" ("id", "updatedAt") VALUES ('platform', CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
