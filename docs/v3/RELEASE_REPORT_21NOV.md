# Release report, 21 Nov 2026 (push pending work, tests, migrations, live state, merge order)

Written on branch `v3-lane-e1`. Nothing was merged, nothing was deployed, the live server and V2 were not touched, no `.env` file, key or password was read or committed, and the smoke folder was not committed. The staging database was only read (earlier lanes).

## 1. What was not on GitHub

I fetched `origin` for `get4domain-w2` (22 worktrees) and `get4domain-ui`, and counted commits that no `origin/*` branch contains.

**Commits:** none. Every committed change in both repos is already on GitHub.

**Three local branches are ahead of their same-name remote branch**, but their commits are already on other remote branches, so nothing would be lost. They were **not pushed** and not tested, because they are not checked out anywhere and pushing them would only move a branch label (and start a Vercel preview, see `docs/v3`/memory note):

| Branch | Ahead of `origin/<same name>` |
|---|---|
| `v3-w3` | 12 |
| `v3-pub-fe18` | 2 |
| `v3-upgrade` | 1 |

`v3-audit` has no remote branch of its own (its commits are on others). `get4domain-site` is 1 behind its remote.

**Uncommitted work in the worktrees** (the real unpushed material):

| Worktree (branch) | What is there | Done |
|---|---|---|
| `get4domain-w2` (`v3-lane-e1`) | 5 reports (`WEBSITE_ENGINE_AUDIT`, `THEME_SPEC_RECONCILIATION`, `SPEC_A_18NOV_w2`, `DRIVING_PACK_READINESS`, `LIVE_TRIAL_PLAN`), this file, `docs/v3/inputs/`, and a pending **deletion** of `docs/v3/THEME_PACKAGE_SPEC.md` | the reports and this file committed; `inputs/` and the deletion left alone (owner files; a deleted spec is not mine to commit) |
| `get4domain-pub` (`v3-pub-a1`) | 4 docs (`SPEC_B_20NOV_pub`, `T01_CLEAN_LINT_REPORT`, `THEME_VOCABULARY_FOR_DESIGNERS`, `URBANFIX_CONVERSION_REPORT`), `docs/industry-audit/` (another lane, still in progress), 23 MB of screenshots, a pending deletion of `THEME_PACKAGE_SPEC.md` | the 4 docs committed; the rest left |
| `get4domain-ui` (`v3-ui-s17`) | 4 prompt and decision documents, `docs/u1-screenshots/`, `packages/api/.vitest/` (a cache) | the 4 documents committed; screenshots and cache left |
| `C:\Get4Domain` (platform repo, on `main`) | `theme-inbox/` (Road Sign, Route Board, UrbanFix v2 sources and zips) plus 61 older changes of the platform repo | `theme-inbox` committed on a **new branch** `theme-inbox-21nov` from `origin/main` through a temporary worktree (sources, final zips, manifests, no previews, no work files); `main` was not touched |
| `get4domain-site` (`v3-step0`) | 301 changes: the 72 owner-modified files and 229 untracked | not touched (owner files) |
| `get4domain-themes` (`v3-themes`) | 12 deletions under `theme-uploads/clinic-demo`, 5 untracked folders and a zip | not touched |
| `get4domain-b2`, `-s54` | the same 2 modified files (`goals.ts`, `registry.generated.ts`) | not touched (looks like line-ending noise) |
| `get4domain-b5`, `-b9`, `-b11`, `-b13` | test run logs | not committed |

## 2. Tests and lint (one heavy run at a time)

| Repo and branch | Check | Result |
|---|---|---|
| `themes` kit (`v3-lane-e1`) | `node --test "test/*.test.mjs"` | **292 of 292 pass** |
| `backend-api` (`v3-lane-e1`) | `npm run lint:ci` | **11 errors, 44 warnings.** All 11 errors are `require()` imports in five test specs (`b2-propose-prices`, `b4-withdraw-future-prices`, `b6-live-scripts`, `r1-registrar-check`, `s1-rebuild-script`); `src` has no errors |
| `backend-api` (`v3-lane-e1`) | `npm run test:ci` (unit and web projects) | **8 suites fail, 325 pass; 24 tests fail, 6,199 pass; 3 snapshots fail** (below) |
| `get4domain-pub` (`v3-pub-a1`) | `npm run test:v3-public` | **636 of 636 pass** |
| `get4domain-pub` | lint | **not available**: `next lint` has no ESLint configuration and asks to create one; nothing was changed |
| `get4domain-ui` (`v3-ui-s17`) | `npm run typecheck` | passes |
| `get4domain-ui` | `npm test` (4 workspaces and the deploy test) | **all pass**: 426, 52, 591 and 282 tests, plus 11 deploy tests |

Failing suites on `v3-lane-e1` (existing at the branch tip, not caused by this report; each needs its own fix lane):

| Suite | What fails |
|---|---|
| `tenant-model-registry` | the model `V3DuplicateReview` carries a `vendorId` but is not classified as tenant data or platform-only |
| `plans-errors` | the list of stable plan error codes has 3 codes the test does not expect |
| `free-pro-matrix` | the pinned digest of the plan rows changed (the B3 plan allowances) |
| `staging-harness-compile` | Nest cannot resolve `DuplicateCheckService` inside `SiteDocModule` (the D1 duplicate check is not wired there) |
| `site-api` | Nest cannot resolve `RegistrationHook` for `MeSiteController` in the test module (13 tests) |
| `provisioning-claims` | `GET /v3/claim/:token/status` answers 404 instead of 200 |
| `listing-only-site` | three golden snapshots of the Free listing home page differ (plumber, dentist, jewellery) |
| `b2-admin-vendor-site` | the trial-site banner tests break on a missing mock for the site provisioner |

The integration tests (`npm run test:int`) were **not run**: they use the staging database and were outside this lane.

## 3. Migrations

All migrations are in `backend-api/prisma/migrations`. The three repos hold migrations only in `get4domain-w2` (the pub copy is the older 53; the UI repo has none).

**Baseline.** The live database had the 53 folders up to `20261016100000_theme_packages` applied and no failed or rolled-back rows when it was checked on 2 Nov 2026 (`docs/v3/V3_PRODUCTION_MIGRATION_STATE.md`). That file is the only record; I did not look at the live database.

**New folders after that baseline, by branch** (the chain is one line of branches, each containing the one before it):

| Branch | New folders (cumulative) | Last one |
|---|---:|---|
| `v3-step0` | 2 | `20261103120000_account_security` |
| `v3-s51`, `-s53`, `-s54` | 3, 4, 5 | `20261105100000_v3_site_publish` |
| `v3-b2` | 9 | `20261109100000_v3_ai_studio` |
| `v3-b3` | 16 | `20261116100000_v3_terms` |
| `v3-b4`, `-b4b` | 22, 24 | `20261124100000_v3_trust_safety` |
| `v3-b5`, `-b9`, `-b11` | 27, 35, 37 | `20261207100000_v3_registrar` |
| `v3-blk4b` | 49 | `20261214160000_v3_policy_kinds` |
| `v3-w3`, `v3-w4` | 74 | `20261230110000_v3_wave4_tds_payouts` |
| **`v3-lane-e1` (tip)** | **80** | `20270110100000_v3_e1_taxonomy` |

So the tip adds **80 migrations** that the live database does not have (as far as the 2 Nov record shows). Staging has them, up to the E1 taxonomy: I checked the table names and the migration list on staging earlier today.

**Additive or not.** I read the SQL of all 80 for `DROP`, `ALTER ... TYPE`, `SET NOT NULL`, `RENAME`, `DELETE`, `TRUNCATE` and `UPDATE`. **73 are additive only** (new tables, columns, indexes, enum values, with RLS). **7 are not purely additive** and need a look before the live run, none destroys data:

| Migration | Statement | Effect |
|---|---|---|
| `20261214130000_v3_offline_payments` | `ALTER COLUMN "methodId" DROP NOT NULL` | loosens a column |
| `20261219110000_v3_wave2_vendor_gaps` | drops and recreates the inbox state check | widens an allowed set |
| `20261219150000_v3_wave2_site_mapping` | drops and recreates two check constraints | widens allowed values |
| `20261219200000_v3_wave2_index_name_63` | `ALTER INDEX ... RENAME` | renames one index to the name Prisma expects |
| `20261230100000_v3_wave4_commission_adjustment` | `DROP INDEX` of a unique index and a check constraint | replaced by wider ones; take the plan before running |
| `20261216100000_v3_seo_geo_keywords`, `20261230110000_v3_wave4_tds_payouts`, `20270105100000_v3_d1_duplicate_check` | one `UPDATE` each | backfill of a new column from existing data |

**Applied to the live database:** the 53 baseline folders yes (2 Nov record); the 80 newer ones **no record of any apply**. Nothing was applied in this lane. The live runbook runs them with `scripts/live/migrate-live.js` (`status`, then `deploy`, which asks for the word `LIVE`).

Migration folders are the same set along the whole chain, so the answer is the same for every branch: the branch that contains a migration is the first one in the table above.

## 4. Live server state (from the repo only)

- **Image tag:** **not recorded in the repo.** `deploy/v3live/env/compose.env.example` has `IMAGE_TAG=` empty; the real `compose.env` lives on the server (`/opt/v3live/env/compose.env`). The tag format is `<yyyymmdd>-<short commit>` (`deploy/v3live/RUNBOOK.md:224`, `docs/v3/DEPLOY_V3LIVE_PLAN.md:40`). No file in the repo names a tag that was actually deployed. Whether the V3 stack is running at all was not checked.
- **Containers** (`deploy/v3live/docker-compose.apps.yml`): `g4d-v3-api`, `g4d-v3-site` (port 3006), `g4d-v3-vendor`, `g4d-v3-admin`, `g4d-v3-partner`; images `get4domain-v3-api`, `-site`, `-vendor`, `-admin`, `-partner` with `:${IMAGE_TAG}`.
- **Deploy command** (`RUNBOOK.md:396-405`): build the images with the new `IMAGE_TAG`, run the migrations if there are any (`migrate-live.js`), set `IMAGE_TAG` in `compose.env`, then
  `docker compose -f /opt/v3live/src/backend/deploy/v3live/docker-compose.apps.yml --env-file /opt/v3live/env/compose.env up -d --no-build`.
  Rollback is the previous tag (`RUNBOOK.md:411,635`).
- The runbook's first deploy keeps `V3_PUBLIC_ENABLED=false`, `EMAIL_LIVE_SEND=false` and `PLAN_PAYMENTS_LIVE_ENABLED=false`; the wildcard `*.get4domain.com` stays on V2 until the owner switches it (`deploy/v3live/nginx/WILDCARD_SWITCH_LATER.md`).

## 5. Merge order into `main`, and what is unsafe

**First, a fact that changes the question.** `origin/main` is the platform standards repository (`CLAUDE.md`, `backend/`, `frontend/`, `CLIENT_PROJECTS/`) and has **no common history with the V3 branches** (`git merge-base` finds nothing; the V3 tip is 809 commits ahead). The V3 chain is based on `origin/get4domain-site` (merge base `233d78c`; `v3-upgrade` is 2 ahead and 1 behind it). A merge into `main` would join unrelated histories and add `backend-api/`, `get4domain_mvp/` and `themes/` next to the old layout. **I recommend merging V3 into `get4domain-site`, not `main`, unless the owner has decided otherwise.** Order below is for that target.

| # | Merge | Reason |
|---|---|---|
| 1 | nothing to merge: `fix-marketing-seo` is already in `origin/get4domain-site` (both at `d3b2f67`); `v3-upgrade` must first take that 1 commit (it is 1 behind) | V3 builds on top of it |
| 2 | `v3-upgrade` (and `v3-step0`'s 2 documentation commits, the production runbook, which are not in the chain) | the base of every other branch; keeps the migration baseline of 53 |
| 3 | `v3-s51`, `v3-s53`, `v3-s54` | plans, provisioning, site publish: everything later calls them |
| 4 | `v3-b2`, `v3-b3`, `v3-b4`, `v3-b4b`, `v3-b5`, `v3-b9`, `v3-b11`, `v3-blk4b` | each contains the one before; migration timestamps rise in this order, so they must go in this order |
| 5 | `v3-w3`, `v3-w4` | commissions and payouts, include the Wave 3 and 4 migrations |
| 6 | the lane branches `v3-lane-b3`, `-b4`, `-b5`, `-b6`, `-k1`, `-r1`, `-s1`, `-s3`, then `v3-lane-e1` | all contained in `v3-lane-e1`; merging the tip lands them together, but only after the 8 failing suites are fixed |
| 7 | `get4domain-pub` branches (`v3-pub` to `v3-pub-fe19`, `v3-pub-a1`) | the public site calls the backend's `/v3/public` routes, so it follows the backend; its branches are a separate line (not contained in `v3-lane-e1`) |
| 8 | `get4domain-ui` (`v3-ui-s1` to `v3-ui-s17`) into its own `main` | separate repository, all tests green; it can go before or after the backend, since the apps use mocks until the API is live |
| 9 | `theme-inbox-21nov` | theme sources and zips only, no code; any time |

**Unsafe to merge now:**

| Branch | Why |
|---|---|
| `v3-lane-e1` (and everything that follows it) | 8 failing unit suites (section 2), 80 migrations not on live, 7 of them with a constraint, index or backfill statement; dependency-injection failures in `site-api` and `staging-harness-compile` mean the site and trial-site routes may not start in the full app |
| `main` as a target | unrelated history, would add 809 commits and a second project layout |
| `v3-step0` worktree | 72 owner-edited files and 229 untracked files; must not be reset, stashed or checked out |
| `v3-themes` | its worktree deletes `theme-uploads/clinic-demo`; old base; not part of the chain |
| `v3-pub-a1` and `v3-pub-fe19` | no ESLint set up, a spec file deleted but not committed, and the `/vendor-site` relay needs the backend's V3 public flags, which are off on the live plan |
| Any merge that runs the 80 migrations on live | not before the 7 non-additive ones are reviewed and a backup restore is rehearsed (`RUNBOOK.md` practise-it step) |
