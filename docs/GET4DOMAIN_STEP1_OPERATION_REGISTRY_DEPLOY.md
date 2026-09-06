# STEP 1 — Operation + Industry Experience Registry — Deploy Runbook

**Date:** 06 Sep 2026 · **Status:** Migration WRITTEN, NOT applied (KSM applies on the VM)
**PRD:** §8, §10, §31-33 · **Branch:** `get4domain-site`

## What this ships (code only — no DB touched by Claude)
1. **Frontend config** (consumed by Phase B/C):
   - `get4domain_mvp/src/config/operations.ts` — 17 first-class operations.
   - `get4domain_mvp/src/config/industry-experience.ts` — all 20 industries → business model, primary/secondary operations, vendor modules, vendor mobile-nav, client modules, CRM pipeline.
2. **Backend schema** — two additive reference tables in `backend-api/prisma/schema.prisma`:
   - `OperationType` → `g4d_operation_types`
   - `IndustryExperience` → `g4d_industry_experiences`
3. **Migration** — `backend-api/prisma/migrations/20260906000000_operation_industry_registry/migration.sql` (two `CREATE TABLE`, additive, no existing table altered).
4. **Idempotent seed** — `backend-api/prisma/seed-registry.ts` (upsert; safe to re-run), wired into `prisma/seed.ts` and runnable standalone.

## KSM — apply on the VM (in `backend-api/`, this order)

```bash
# 1. Pull latest
git pull origin get4domain-site

# 2. Apply the migration (creates the two new tables; additive, safe)
npx prisma migrate deploy

# 3. Regenerate the client inside the running image if needed
npx prisma generate

# 4. Seed / refresh the registry rows (idempotent — upsert, no duplicates)
npm run seed:registry
```

> If you deploy via Docker: rebuild the backend image so `20260906000000_...` is present,
> then run steps 2-4 inside the backend container.

## Post-apply verification
```sql
SELECT count(*) FROM g4d_operation_types;        -- expect 17
SELECT count(*) FROM g4d_industry_experiences;   -- expect 20
SELECT industry, "primaryOperation", "primaryCta" FROM g4d_industry_experiences ORDER BY industry;
```

## Notes / guarantees
- **Additive & non-destructive.** No `ALTER`/`DROP` on any existing table; no vendor/payment/customer data touched.
- **RLS:** these are platform reference tables (not per-vendor). If your RLS policy blocks reads by the anon role and the public site needs them, add a read policy — but Phase B/C read them **server-side** with the service role, so no RLS change is required for this step.
- **Idempotent seed** means re-running after future edits updates rows in place (`active: true`), never duplicates.
- Frontend `src/config/*.ts` and backend `seed-registry.ts` are intentional mirrors — keep both in sync when the catalog changes.
