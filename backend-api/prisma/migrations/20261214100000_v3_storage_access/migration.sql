-- Block 4b slice 1: access log of the private object bucket. Additive only: one new table, no existing object is touched.
CREATE TABLE "g4d_storage_access" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT,
    "bucket" TEXT NOT NULL DEFAULT 'PRIVATE',
    "objectKey" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "purpose" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "g4d_storage_access_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "g4d_storage_access_vendorId_createdAt_idx" ON "g4d_storage_access"("vendorId", "createdAt");
ALTER TABLE "g4d_storage_access" ADD CONSTRAINT "g4d_storage_access_action_chk" CHECK ("action" IN ('PUT', 'GET', 'SIGN', 'DELETE', 'DENIED'));

-- Append-only: a row can never be changed, and can be deleted only when its vendor is already gone (a hard-deleted test tenant).
CREATE OR REPLACE FUNCTION g4d_storage_access_immutable() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'g4d_storage_access rows cannot be changed';
  END IF;
  IF OLD."vendorId" IS NOT NULL AND EXISTS (SELECT 1 FROM "Vendor" WHERE "id" = OLD."vendorId") THEN
    RAISE EXCEPTION 'g4d_storage_access rows cannot be deleted';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "g4d_storage_access_immutable_trg" BEFORE UPDATE OR DELETE ON "g4d_storage_access" FOR EACH ROW EXECUTE FUNCTION g4d_storage_access_immutable();

-- Same rule as every other public table: RLS on, no policy; the backend role bypasses it.
ALTER TABLE "g4d_storage_access" ENABLE ROW LEVEL SECURITY;
