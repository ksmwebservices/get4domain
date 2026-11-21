# Batch 4B run log (slices 5.20, 5.21; 5.22 deferred)

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

## Slice 5.22: vendor 360, search, saved views, bulk actions: DEFERRED TO RELEASE 2

OWNER CUT (7 November 2026): slice 5.22 is skipped in this run and moved to Release 2. Nothing of it is built: no `/v3/admin/vendors/:id/360`, no `/v3/admin/search`, no `g4d_saved_views`, no bulk actions framework. The 5.20 routes `GET /v3/admin/vendors/:vendorId/activity` and `GET /v3/admin/attention` stay as built and are the only staff views of a vendor this batch ships.

## Carry-over C1: a suspension never hides a listing (commit 03e1790)

The directory kept a SUSPENDED listing out of the search, the detail page and the Visit link. That conflicted with owner rule 6. Now a suspended listing is listed as the Free listing-only site it has become (shown as claimed or unclaimed, stored status unchanged); only a removed business is hidden. It stays out of the sitemap (not indexable). Moderation SUSPEND still sets `indexable = false`. Tests updated in `directory-service`, `directory-api`, `directory-visits` (they asserted the old hiding) and the in-memory repo.

C2 (the set-password endpoint that must call the claim guard) and C3 (erasure beyond the retention list) were not part of this run's ask: **C2 is NOT built** (still needed before Stage 19); C3 is written as an OPEN QUESTION for counsel, not built.

## Slice 5.21: trust and safety

**Built.** Module `src/v3-trust` (global): pure core (`trust-core.ts`: value normalisation, whole-phrase scan, payee-name comparison, notice page, status moves), `TrustStore` and the Prisma store, services (proofs, trust block list, reports, prohibited terms, takedown, scan, fake payee check), three ports (`ProhibitedScanPort`, `TakedownPort`, `PayeeNameCheckPort`), controllers (public report, owner, staff). Migration `20261124100000_v3_trust_safety`: six enums, five tables, one foreign key (proofs to vendor), CHECK constraints, a takedown guard trigger, RLS on. Wired: `PublishService` (scan after a publish), `PublicRequestsService` (takedown gate and scan after an accepted request), `SitePublicService` + `PublicSiteController` (451 notice), `AlertsService.attention` (queues and the BUSINESS_PROOF_MISSING Medium item), `PrismaActivityStore.attention` (read-only counts).

**Differences from the dispatch (decisions).** Full list in `docs/v3/V3_ACTIVITY_AND_TRUST.md` (D1 to D8). The important ones:
1. `g4d_blocklist` and `/v3/admin/blocklist` already exist (the do-not-contact register, other kinds). The trust block list is `g4d_trust_blocklist` at `/v3/admin/trust-blocklist`; the old table is untouched.
2. An eleventh alert rule `PAYEE_NAME_MISMATCH` (HIGH, seeded disabled). The five 5.20 tests that counted ten rules now count eleven; nothing else in them changed. **The owner must re-run `seed-v3-alert-rules.js --apply` on staging** (it creates only the missing rule).
3. A takedown reversal restores the listing as it was (OPEN QUESTION: keep the reversal or make a takedown permanent).
4. The takedown guard trigger lets a delete through only when the vendor and the listing are gone (so staging test tenants clean up to 0).
5. Authority for takedown comes from the central role matrix (`rolesFor`), not from a role literal in the service (the `staff-vendor-access` guard test forbids inline role checks; it caught my first version).

**Honest note on order.** Red first was NOT followed for this slice: the core, store, services and controllers were written, then the tests (they passed at first run except two test-side slips fixed at once). The one test that went red because of a rule rather than a slip was `staff-vendor-access` (inline role check) and `tenant-model-registry` (two new vendor-carrying tables), both fixed in code or classification, none weakened.

**Slip worth recording.** One `npx jest test/directory` command (no project selected) also ran the **integration** project. Each integration file starts with the staging guard, which refuses anything but the allow-listed staging database, and the run passed 229 tests and failed 3 in 2 suites (one is `directory-concurrency.int.spec.ts`, a claim-attempts assertion at line 66; the other I did not identify because only the tail of the output was kept). I did not investigate them (they exercise directory code I had touched for C1, so they are not proven unrelated), did not run them again, and did not run the cleanup. The owner should run the integration suite and `test:cleanup-staging --count` (must be 0) with the other staging steps.

**Protocol results.** Unit suite: 128 suites / 2662 tests at the end of 5.20; now 133 suites / 2762 tests, all green. Lint (no --fix) on all changed files: 0 errors (3 old warnings in the exception filter). `nest build` ok; `tsc` clean outside the unrelated `remotion` folder. `verify:migrations` 155/155, `verify-migrations-additive` 43/43, `verify:raw-sql` 945/945. Route baseline 1045 to 1063 (18 added: 1 public, 3 owner-only, 14 admin; reviewed). Role-matrix oracle 249 to 263. Legacy static check (`b4-isolation`) now covers `v3-trust`. Tenant registry: `V3BusinessProof`, `V3Takedown` classified.

**NOT RUN:** `trust.int.spec.ts` (staging), the migration SQL, `seed-v3-alert-rules.js` (the new rule), `verify:db-lock`, the cleanup count.

## FINISH (7 November 2026)

**Branch and worktree.** `v3-b4b` in `C:\Get4Domain\get4domain-b4b`, from `origin/v3-b4` (`83610cf`). Linear history, 6 commits, nothing pushed.

| Commit | What |
|---|---|
| `b1b0dec` | B4B.0 rules document and this log |
| `485de8f` | slice 5.20: activity log and alerts |
| `5ed71b7` | slice 5.22 deferred to Release 2 (owner cut), written in this log |
| `03e1790` | carry-over C1: a suspension never hides a listing |
| `03aa512` | slice 5.21 step 1: data, migration, pure core |
| `565b1fb` | slice 5.21 step 2: services, routes, wiring, tests |

**Unit totals.** Before Batch 4B (`v3-b4`): 121 suites / 2541 tests. After 5.20: 128 / 2662. Now: 133 suites / 2762 tests, all green (`npm run test:ci`).

**Migration folders in order.**
1. `20261123100000_v3_activity_alerts`: 3 enums, 4 tables, 2 CHECKs, an append-only trigger on the log, RLS on, no foreign key.
2. `20261124100000_v3_trust_safety`: 6 enums, 5 tables, 1 foreign key (proofs to vendor), 4 CHECKs, a takedown guard trigger, RLS on.

**Seeds.** `scripts/seed-v3-alert-rules.js` (dry run by default, `--apply`, staging guard): creates the 11 rule rows disabled with no numbers; creates only the missing ones, so the owner's run of the first ten is not disturbed. Dry run output NOT RUN (needs staging). The prohibited-term table has **no seed on purpose**.

**Routes.** 5.20: 8 (1 owner, 7 staff). 5.21: 18 (1 public, 3 owner, 14 staff; 6 are SUPER_ADMIN only: the four prohibited-term routes and takedown create and reverse). Baseline 1037 to 1063; oracle 242 to 263. MARKETING is refused on every new staff route.

**Not built.** Slice 5.22 (owner cut, Release 2). Carry-over C2, the set-password endpoint that calls the claim guard, is **still not built** and is needed before Stage 19. C3 is an open question for counsel.

**NOT RUN and why (no staging access in this session).** `activity.int.spec.ts`, `trust.int.spec.ts`, the two migrations, the rule loader, `verify:db-lock`, the cleanup count. Also see the slip recorded under slice 5.21 (an accidental integration run).

**OPEN QUESTIONS.** The seven in `docs/v3/V3_ACTIVITY_AND_TRUST.md`: takedown reversal (keep or drop), the notice wording, a suspended vendor reading a takedown reason, the prohibited phrases, which alert rules to switch on and with which numbers, retiring the older `POST /v3/public/reports`, erasure beyond the retention list.

**Merge risks.** `PublishService`, `PublicRequestsService` and `SitePublicService` each gained trailing optional constructor parameters (anything that builds them by position keeps working). `PublicSiteController.byHost` has a new 451 branch. The directory read, visit and repository files changed for C1 and the directory tests changed with them; the 72 owner-modified files in the shared folder were not touched or compared in this run.

**Secret scan** over `origin/v3-b4..HEAD` (added lines): no key, token, connection string or private key. The only matches are synthetic strings in the 5.20 interceptor test (`sk_live_x` and an account number used to prove they are not stored). **Workflow check:** no file under `.github` changed.

**Owner commands for staging, in this order** (`npm.cmd`, from `C:\Get4Domain\get4domain-b4b\backend-api` unless stated):
1. Copy `.env.staging` into the worktree root `C:\Get4Domain\get4domain-b4b\` (not in git).
2. `npm.cmd ci` then `npx.cmd prisma generate`.
3. `npm.cmd run db:staging:migrate-status` (expect `20261124100000_v3_trust_safety` pending; the activity folder is already applied), then `npm.cmd run db:staging:migrate-deploy`, then `migrate-status` again (none pending).
4. `npm.cmd run db:staging:rls-off` (expect no table without RLS), then `npm.cmd run db:staging:drift` (expect the 2 documented allowed items only; the triggers and CHECKs are not part of the schema diff).
5. `npm.cmd run build`.
6. `node scripts/seed-v3-alert-rules.js` (dry run: expect exactly `PAYEE_NAME_MISMATCH` to create), then `node scripts/seed-v3-alert-rules.js --apply`.
7. `npm.cmd run test:int` (all suites; `activity.int` and `trust.int` are new). Two suites failed in the accidental run described above; look at those first.
8. `npm.cmd run test:cleanup-staging -- --count` (must print 0).

**Single push command** (only after the owner has read this and agrees; a push makes a Vercel Preview): `git push -u origin v3-b4b` from `C:\Get4Domain\get4domain-b4b`. Not run.
