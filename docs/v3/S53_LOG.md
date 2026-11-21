# S53 log (slice 5.3: provisioning engine, claim links, invites; includes the remainder of 5.2)

Worktree `C:\Get4Domain\get4domain-s53`, branch `v3-s53`, from `origin/v3-s51` (6aca222, the pushed slice 5.1). Only `backend-api` and `docs/v3` changed. No frontend. No push.

## Environment note
`.env.staging` is not in this worktree and cannot be copied by the build session, so everything that needs the staging database is written but **NOT RUN**: applying the migration, `migrate-status`, `rls-off`, `drift`, the three staging integration suites. Offline checks (unit tests, build, lint, `verify:migrations`, the additive-migration guard, `verify:raw-sql`) were run for every task. The Prisma client had to be generated once in the new worktree (`npx prisma generate`); that is not a code change.

## S53.1 Design note (78786e9)
`docs/v3/V3_S3_PROVISIONING.md`: data dictionary, state machine, step contracts, token rules, API contract, settings, decision log. Section 11 (every difference from the spec) and section 12 (as built) were completed in S53.9.

## S53.2 Part A, schema and migration (0662f06)
Red: `provisioning-schema.spec.ts` and `tenant-model-registry.spec.ts` failed (21 tests). Green: 9 enums, 4 models (`g4d_provisioning_jobs`, `g4d_provisioning_steps`, `g4d_claim_tokens`, `g4d_invites`), back-relations on `Vendor`, migration `20261104100000_v3_provisioning` (generated offline with `prisma migrate diff`; additive only; RLS on all four tables; foreign keys only to `Vendor` and each other). One ACTIVE claim token per vendor is enforced by a nullable unique `activeKey`. Part A: `tenant-model-registry.spec.ts` fails if a V3 table with a `vendorId` is neither classified tenant data nor platform-only. Role-matrix entries and the route baseline are in S53.6/S53.7 (a route must exist first; see design note 11.1). `verify:migrations` 115 ok, additive guard 23 ok.

## S53.3 State machine and runner (21ffeea)
Pure `decide`, `backoffSeconds`, `onFailure`, `canRetry`, `canCancel`, `cancelPlan`, error classification; `JobRunnerService` with the atomic claim (`FOR UPDATE SKIP LOCKED` in one `UPDATE ... RETURNING`, lease in `lockedUntil`, fenced writes), retry with backoff and jitter, sanitised errors. 14 runner tests (red first: module not found) with an in-memory repository: success order, idempotent key, retry without repeating done steps, permanent and exhausted failures, crash then takeover after the lease, two runners on one job and on two jobs, lease loss, the raw token never stored. The 19 pure state-machine tests were written with the code and not run red first.

## S53.4 Vendor, plan and site steps (7572d9a)
`CREATE_VENDOR` (duplicate by normalised email or phone, race-safe subdomain, unusable password, vendor linked to the job in one transaction), `ASSIGN_FREE_PLAN` (`provisionFreeSubscription`, source STAFF), `CREATE_FREE_SITE_DRAFT` behind the `SiteProvisioner` port with the `CmsDraftSiteProvisioner` adapter (DRAFT, never published, TODO seam for 5.4). 23 tests, red first.

## S53.5 Claim link and invite (81041f7)
Token = 32 random bytes, SHA-256 stored, previous ACTIVE token revoked in the same transaction. `EmailAdapter`: sandbox (default) and live (exists, refuses with `LIVE_DISABLED` unless `V3_INVITE_LIVE_ENABLED` is exactly `true`). One invite row per token. 28 tests including a whole job through the real runner and steps that scans job, step, audit, claim and invite rows and captured logs for the raw token. Written with the code, not run red first.

## S53.6 Claims (b9b08f1)
`GET /v3/claim/:token/status` (public, 20 per minute per IP), uniform 404, race-safe `redeemClaim` (three concurrent redeems give one winner), staff `reissue` and `revoke`. Found by the HTTP test and fixed: the `default` throttler skips GET so the limit sits on `reads`; the error filter dropped `CLAIM_INVALID`. Route baseline: exactly one new public route.

## S53.7 Staff API (7905d90)
Nine routes, role matrix entries (OPERATIONS and SUPER_ADMIN; MARKETING refused), settings validator extension, cron tick (off by default), `ProvisioningModule`. The oracle failed first (14 tests). A wiring test compiles the real module. A runner that cannot settle now fails the job cleanly (found when a test stub returned no token).

## S53.8 Staging tests and checks (8017116)
Written, **NOT RUN** (no `.env.staging`), type-checked: `provisioning-flow.int.spec.ts`, `provisioning-concurrency.int.spec.ts`, `provisioning-tenant.int.spec.ts`. Run here: `provisioning-isolation.spec.ts` (legacy check extended to `src/provisioning`; no `VendorsService`, no welcome email; tenant scoping of the new tables; cleanup coverage, red first with 5 failures). `scripts/staging/test-tenant-cleanup.js` now removes jobs, invites, claim tokens, draft sites and audit rows of synthetic tenants.

## S53.9 Docs and trackers
`V3_S3_PROVISIONING.md` sections 11 and 12, `V3_API_DOCUMENTATION.md`, `V3_IMPLEMENTATION_PLAN.md` and `V3_REQUIREMENTS_MATRIX.md` status lines, this log.

## STAGING STEPS FOR THE OWNER (not run in the build session)
From `C:\Get4Domain\get4domain-s53\backend-api` on a machine where `.env.staging` is at the worktree root (copy it there yourself; it is git-ignored):
1. `npm run db:staging:migrate-deploy` (applies `20261104100000_v3_provisioning` to STAGING only; it also applies the slice 5.1 migration if that is not there yet), then `npm run db:staging:migrate-status` (nothing pending), `npm run db:staging:rls-off` (must report 0), `npm run db:staging:drift` (no drift).
2. `npm run build`.
3. If the plan data is not seeded on staging: `node scripts/seed-v3-plans.js` (dry run), then `node scripts/seed-v3-plans.js --apply`. The provisioning tests need the six plans.
4. `npm run test:int` (runs `provisioning-flow`, `provisioning-concurrency` and `provisioning-tenant` with the existing suites), then `npm run test:cleanup-staging -- --count` (must be 0).
5. Optional, to see the engine by hand on staging only: set the plan setting `provisioningRunnerEnabled` to true through `PUT /v3/admin/plan-settings/provisioningRunnerEnabled` (it needs `expectedUpdatedAt` once the row exists), create a job, and read it with `GET /v3/admin/provisioning/jobs/:id`. Leave `inviteAdapterMode` as `sandbox`. Do NOT set `V3_INVITE_LIVE_ENABLED` anywhere.
Nothing here touches production. The migration is NOT applied to production.

Things to look at when step 4 runs for the first time: the timestamp parameters of the claim query (`$queryRaw` with `Date` values against `timestamp(3)` columns; the concurrency suite is what proves it works on the staging session time zone), and that `vendorCMS` rows are removed by the cleanup.

## Rule 9 report
**Objective.** Slice 5.3: a reliable, repeatable engine that turns "staff create a business" into a vendor, a Free plan, a DRAFT Free site, a claim link and an invite, with every step visible and retryable. Includes the remainder of 5.2 (tenant registry test).
**Reuse.** The slice 5.1 plans module (`provisionFreeSubscription`, `AuditService`, plan settings, `redactSecrets`), `AdminGuard` and the role matrix with its oracle, the route baseline, `forTenant` and `VENDOR_SCOPED_MODELS`, the HTTP exception filter, `StarterService` (existing site seeding), `EmailService` (live adapter only), the staging guard and test harness, `advisoryXactLock` rules (not needed: the claim is one statement), `@nestjs/schedule`.
**Files modified (existing).** `prisma/schema.prisma`, `scripts/staging/test-tenant-cleanup.js`, `src/app.module.ts`, `src/auth/guards/admin-role-matrix.ts`, `src/common/filters/http-exception.filter.ts`, `src/common/throttling.ts`, `src/email/email.service.ts`, `src/plans/admin/admin-validation.ts`, `test/admin-role-matrix.spec.ts`, `test/baselines/route-classification.json` (+ docs). None overlaps the owner's 72 uncommitted files.
**Files added.** `backend-api/src/provisioning/**` (31 files), one migration, 14 test files and 3 support files, 3 docs.
**DB changes (staging only, additive).** 9 enum types, 4 tables (`g4d_provisioning_jobs`, `g4d_provisioning_steps`, `g4d_claim_tokens`, `g4d_invites`), RLS on each, foreign keys only to `Vendor` and each other. Not applied to any database in this session.
**Tests.** Unit 467 (20 suites) to 649 (31 suites), all green; 3 staging suites written, not run. **Results.** build ok, lint 0 errors, `verify:migrations` 115 ok, additive guard 23 ok, `verify:raw-sql` 698 ok (one new `$queryRaw`, bound values only).
**Outstanding.** The staging steps; the owner's answers (invite wording, claim expiry, retry limits, duplicate block or warn, claim by a different phone); slice 5.4 (theme-kit renderer replaces the draft-site adapter); slice 5.7 (phone OTP and password at claim); compensation of a half-built business (manual); the verified-domain fact for `customDomain`; `registeredByStaffId` for vendors created outside this path.

## Staging run 1 (owner) and the fix
**Result.** 295 of 296 passed. The one failure: `provisioning-flow.int.spec.ts`, "unknown, expired, used and revoked tokens all give the SAME 404 body", line 165: `POST /v3/admin/vendors/:id/claim-link/reissue` answered 400, expected 200.
**Root cause (a code bug, found by reading the code).** `ClaimsService.reissue` refused any owner email matching `/.invalid$/`. The rule was meant to catch the placeholder address the existing staff site creation writes (`site+<sub>@sites.get4domain.invalid`), but it also matched every synthetic test owner (`...@v3test.invalid`), and would refuse any address of that shape. Revoke, expiry and the 404 guarantees were not involved: reissue after a revoke or an expiry works.
**Red.** New unit test in `provisioning-claims.spec.ts`: reissue for `owner@v3test.invalid` and `someone@example.invalid` must succeed, the platform placeholder must still be refused with 400, and reissue after a revoke and after an expiry must succeed. It failed before the fix.
**Fix.** The refusal is now exactly the placeholder domain (`isPlaceholderOwnerEmail`, `@sites.get4domain.invalid`). The SAME-404 behaviour and every other rule are unchanged. The refusal state and its message are documented in the design note (difference 8).
**Leftover tenant.** The "1 synthetic tenant left" was NOT from this suite: it was `p51v-...` from the slice 5.1 plans tests (no provisioning job or tenant remained; `afterAll` of the flow suite already cleans in a `finally`). Cleared with the repo script, staging only: `node scripts/staging/test-tenant-cleanup.js` (no flag deletes; it matches only vendors with BOTH `@v3test.invalid` and a `V3TEST` name), which also removed 2 synthetic staff rows. `--count` afterwards: 0, and 0 again after the re-run below. Why the 5.1 suite left it is a separate question (its cleanup is not part of this slice).
**Re-run.** Unit 651 of 651 (31 suites), build ok, lint 0 errors, `verify:raw-sql` 698 ok, and the three provisioning integration files on staging: 3 of 3 suites, 15 of 15 tests pass.
