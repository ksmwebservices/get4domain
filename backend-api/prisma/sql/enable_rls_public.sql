-- =====================================================================
-- Enable Row Level Security on every base table in the `public` schema
-- to close Supabase's public API surface (PostgREST / Realtime).
--
-- WHY THIS IS SAFE FOR THE APP (verified against prod, 2026-08-19):
--   * Every public table is OWNED BY `postgres`.
--   * The app connects AS `postgres` (DATABASE_URL), and `postgres` has
--     `rolbypassrls = true` — it bypasses RLS on every table, always.
--   * We use ENABLE (never FORCE), so even owner-bypass would apply too.
--   * `anon` and `authenticated` (Supabase's public API roles) have
--     `rolbypassrls = false`; with RLS enabled and NO policy attached they
--     get zero rows (default-deny) — the public API is closed.
--   * The codebase uses no @supabase/supabase-js / anon client at all, so
--     nothing legitimately reads these via the public API.
--
-- => No policies are attached, and NO table needs one for the app to work.
--    This does NOT change the app's Prisma connection or its queries.
--
-- Idempotent + count-proof: it enables RLS on ANY public base table that
-- currently has it disabled, so it covers all of them regardless of the
-- exact number (34 seen from the app DB; Supabase Advisor reported 37 —
-- run the reconciliation query in the runbook to identify any delta; this
-- script fixes whatever is actually there).
--
-- APPLY on prod via the Supabase SQL Editor or psql (as postgres). Re-run
-- after any future `prisma db push` that adds tables (Prisma leaves new
-- tables RLS-disabled).
-- =====================================================================

DO $$
DECLARE
  r record;
  n int := 0;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND rowsecurity = false
    ORDER BY tablename
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
    RAISE NOTICE 'RLS enabled on public.%', r.tablename;
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'Done: RLS enabled on % table(s).', n;
END $$;

-- Verify afterwards (expect zero rows returned):
--   SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity=false;
