# Batch 4B run log (slices 5.20, 5.21, 5.22)

Worktree `C:\Get4Domain\get4domain-b4b`, branch `v3-b4b`, from `origin/v3-b4` (`83610cf`). Dispatch: `docs/v3/stages/V3_DISPATCH/STAGE_08_ACTIVITY_TRUST_BATCH_4B.md` (it is not in `docs/v3/stages/` directly; it was found one folder down). No push. No `.env.staging` in this worktree, so every staging step is written and marked NOT RUN. Dependencies installed with `npm ci` in `backend-api`, then `prisma generate`.

## Gate check

`git fetch` ran. `origin/v3-b4` exists and equals the local `v3-b4` (`83610cf`). Its history carries the Batch 4 FINISH commit (`59ec3ce`) and the follow-up commits. The owner's note of 6 November 2026 says it passed staging (theme-switch suite 7 of 7, full run 37 of 38 suites with one database connection drop that passed on rerun, cleanup count 0) and is pushed. The gate is satisfied. The owner's known limit on theme switches across processes is recorded at the end of `docs/v3/B4_LOG.md`.

## Slice 5.20: activity log and alerts

**Built.** Module `src/v3-activity` (global): pure core (`activity-core.ts`: ten alert rules, masking; `action-table.ts`: route to action key), `ActivityService.record()` (masks, hashes the address with the existing OtpPepper, stores, lets the enabled rules look, writes alerts and in-app notices, never throws into the caller), `AlertsService` (list, detail, change by compare-and-set, rules, attention board), a bus listener on `*`, an interceptor, store and Prisma store, controllers, rule loader (`scripts/seed-v3-alert-rules.js`, dry run default, `--apply`, staging guard, creates the ten rules disabled with no numbers). Migration `20261123100000_v3_activity_alerts`: four tables, three enums, append-only trigger on the log, two CHECK constraints, RLS on, no foreign key.

**Differences from the dispatch (decisions).**
1. The notifications table is `g4d_v3_notifications`, not `g4d_notifications`: that name is the LEGACY `Notification` table (stop-line 5, never rename or reuse).
2. Wiring: instead of editing each module's services, a global interceptor writes one row for EVERY successful mutating route under `/v3/me` and `/v3/admin` (31 controllers, 150+ routes), by construction, and the bus listener records the semantic events the wallet, services, service requests, theme switches and plans already emit. Bodies are never stored, only field names. The "controller must call record()" test is therefore a coverage test (`activity-interceptor.spec.ts`, `activity-actions.spec.ts`): every mutating route in the reviewed route baseline resolves to an action key, the only exemption is the theme preview (stores nothing), and no controller may opt out. A route added later is logged with no change.
3. `PUT /v3/admin/alert-rules` is one route with the key in the body (literal reading); `GET /v3/admin/alerts/:id` was added for the detail. Rules: GET and PUT SUPER_ADMIN only. Alerts, vendor activity and attention: OPERATIONS and SUPER_ADMIN (MARKETING refused, they carry money and personal data). `GET /v3/me/activity` is owner only.
4. A closed alert (RESOLVED or NOT_AN_ISSUE) has a closing time; an open one does not (DB check). Alert status moves: open ones go anywhere; a closed one can only be looked at again. A change needs the status the caller saw (409 ALERT_STALE otherwise).
5. A rule that needs numbers (CAMPAIGN_SPIKE, PAYMENT_FAILURES, LARGE_IMPORT) refuses to switch on until staff set them (ALERT_RULE_NEEDS_THRESHOLD). Level and key of a rule cannot be changed.
6. BUSINESS_IDENTITY_CHANGED fires when the directory profile body NAMES the business name or GST field (the body's values are not compared), so it can over-report. Four rules have no real event yet and are tested with synthetic events: CAMPAIGN_SPIKE, PAYMENT_FAILURES, PROHIBITED_TEXT, LARGE_IMPORT.
7. Staging cleanup script extended (alerts, notices, activity rows; activity rows go after the vendor because of the trigger).

**Honest note on order.** Red first was followed for the core (module missing), the schema spec was written after the migration, the service, API and interceptor specs after their code (they passed first time). The table spec (`activity-actions`) was red first.

**Protocol results.** Unit suite 128 suites / 2662 tests before the role-matrix oracle fix: 127 suites passed, the one failure was `admin-role-matrix.spec.ts` (its own route list needed the 7 new admin routes); fixed, that file now 266 of 266. Before this slice: 121 suites / 2541. Lint (no --fix) on all changed files: 0 errors. `nest build` and renderer build ok. `verify:migrations` 153/153, `verify-migrations-additive` 42/42, `verify:raw-sql` 944/944. Route baseline 1037 to 1045 (8 added: 7 admin, 1 owner-only authenticated; reviewed). Legacy static check (`b4-isolation`) now covers `v3-activity`. Tenant registry: `V3ActivityLog`, `V3Alert` classified.

**NOT RUN:** `activity.int.spec.ts` (staging, no `.env.staging`), the migration SQL, `seed-v3-alert-rules.js` (dry run needs staging), `verify:db-lock`.
