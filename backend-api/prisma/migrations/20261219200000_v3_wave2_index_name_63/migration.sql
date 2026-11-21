-- Wave 2 drift fix. 20261219100000 created an index whose name is 64 characters; Postgres cut it to 63
-- ("..._createdAt_id") but Prisma expects its own shortened name ("..._createdA_idx"). Rename it to that name.
-- Additive and guarded: does nothing if the old name is absent, or if the expected name is already taken.
DO $$
BEGIN
  IF to_regclass('public."g4d_pack_records_vendorId_packKey_tabKey_deletedAt_createdAt_id"') IS NOT NULL
     AND to_regclass('public."g4d_pack_records_vendorId_packKey_tabKey_deletedAt_createdA_idx"') IS NULL THEN
    ALTER INDEX "g4d_pack_records_vendorId_packKey_tabKey_deletedAt_createdAt_id" RENAME TO "g4d_pack_records_vendorId_packKey_tabKey_deletedAt_createdA_idx";
  END IF;
END $$;
