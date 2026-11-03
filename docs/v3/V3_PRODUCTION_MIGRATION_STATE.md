# V3 Production Migration State (Step 0, item 1)

> Read-only check of the production database, 2026-11-02. **SELECT only.** Structure came from `pg_catalog`; migration history came from a CSV exported by the owner from the production SQL editor (names and timestamps only). **No vendor, customer or business data was read.** No connection details appear in this document.

## How it was checked
- Role `audit_readonly`: `default_transaction_read_only = on`; privileges on `public._prisma_migrations`: SELECT only (no INSERT/UPDATE/DELETE); no CREATE in schema `public`.
- Six fixed SELECT statements (identity, privileges, `_prisma_migrations`, `pg_class` tables + RLS flag, `pg_attribute` + `format_type` columns, `pg_extension`) plus four catalog-only diagnostics.
- **`_prisma_migrations` rows were not visible to that role:** RLS is enabled on the table, the role has no `BYPASSRLS`, and `public` has 0 policies, so the query returned 0 rows. The migration comparison therefore uses the owner's SQL-editor export (`prod-migrations.csv.csv`, git-ignored, not committed). That export has no `started_at`, checksum or logs, so checksum drift cannot be detected.

## Server
PostgreSQL 17.6. Extensions: `pg_stat_statements`, `pgcrypto`, `plpgsql`, `supabase_vault`, `uuid-ossp`.

## Migrations vs the 53 local folders
| Category | Count | Detail |
|---|---|---|
| Applied cleanly | 54 names | all 53 local folders + `20260719093736_add_leads` |
| Rolled back only | 0 | |
| Failed (`finished_at` NULL, not rolled back) | 0 | |
| In production, no local folder | 1 | `20260719093736_add_leads` |
| Local folder, not applied | 0 | |

57 rows for 54 names. Retries: `20260722000000_web_push_subscriptions` (rolled back twice, then finished) and `20261007120000_commercial_engine` (rolled back once, then finished; the documented P3018 recovery).
Three finished rows have `applied_steps_count = 0` (`web_push_subscriptions`, `add_vendor_cms_portfolio`, `add_managed_services`), which usually means they were marked applied with `migrate resolve --applied` and their SQL reached the database some other way. Consequence: a fresh database cannot be built from the migration files alone, which is why staging is built from a baseline.
**The 53 local folders are the full set**; earlier V3 docs said 54 because the count included `migration_lock.toml`. The V2 docs that list migrations as "pending" are stale: production is at head.

## Structure
- 151 tables in `public` = 150 schema models + `_prisma_migrations`. Every model has a table; no unknown tables.
- **RLS off: 0 tables.** Policies in `public`: 0.
- Column names match the schema. A name-only comparison flagged 7 "extra" columns (`allowedChannels` on four tables, `appliesToPlans`/`appliesToCycles`/`appliesToKinds` on promo codes); they are enum-array columns that the comparison skipped, and they exist in the commercial-engine and special-arrangements migrations. Types and nullability were not compared (raw `format_type` output was captured locally, not committed).

## Staging (built from this state)
Staging is a separate Supabase project. It was built with a baseline generated from `schema.prisma` (`backend-api/prisma/staging/baseline.sql`: 150 tables, 21 enums, 248 indexes, 128 foreign keys, no data statements), then the 53 folders were marked applied and `enable_rls_public.sql` was run. Result: `migrate status` = up to date; RLS off = 0. Staging has no `add_leads` row (no local folder).

## Corrections to earlier V3 docs
- Migration folders: 53 (not 54). Fixed in the matrix and plans.
- Enums: 21 (not 20) in `schema.prisma`. Corrected in the matrix and the migration plan.
