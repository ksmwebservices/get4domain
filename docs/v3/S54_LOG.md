# S54 log (slice 5.4: theme renderer, SEO layer and publish)

Worktree `C:\Get4Domain\get4domain-s54`, branch `v3-s54`, from `origin/v3-s53` (`041b4b9`, the pushed slice 5.3), with the theme kit (`origin/v3-themes`) merged in. Changes: `backend-api/`, `themes/.gitattributes`, `docs/v3/`. No frontend. No push.

## Environment note
`.env.staging` is not in this worktree and cannot be copied by the build session, so everything that needs the staging database is written but **NOT RUN**: applying the migration, the staging gates (`migrate-status`, `rls-off`, `drift`), and the three staging integration suites. Offline checks (kit tests, backend unit tests, build, lint, `verify:migrations`, the additive-migration guard, `verify:raw-sql`) were run for every task. The Prisma client had to be generated once (`npx prisma generate`), which is not a code change.

## S54.0 Merge the kit (af352e1, 7b9a0fc)
`git merge --no-ff origin/v3-themes`: 253 files, all under `themes/` plus five new `docs/v3` theme documents; **no conflicts, no code touched**. Kit tests after the merge: 6 of 255 failed. Cause: the kit compares committed files byte for byte with what its generators write (LF), and this Windows machine has `core.autocrlf=true`, so the fresh worktree held CRLF files. Normalising the working copy to LF gave 255 of 255; `themes/.gitattributes` (`* text=auto eol=lf`) makes that permanent for any checkout. No kit file or test was changed. Backend unit tests after the merge: 651 of 651.

## S54.1 Design note (5d2a1c2)
`docs/v3/V3_S4_RENDERER_PUBLISH.md`: how the renderer is consumed, data dictionary, SEO rules, indexing rule, publish state machine, API contract, decisions. Sections 11 (every difference from the spec) and 12 (as built) were completed in S54.10.

## S54.2 Schema and migration (e127b43)
Red: `site-schema.spec.ts` and the updated tenant registry failed (12 tests). Green: 2 enums, 4 models (`g4d_site_settings`, `g4d_site_publications`, `g4d_site_publication_pages`, `g4d_site_events`), migration `20261105100000_v3_site_publish` (offline `prisma migrate diff`, additive only, RLS on all four, foreign keys only to `Vendor` and each other, all cascade on vendor delete). One PUBLISHED per vendor by the nullable unique `currentVendorId`. A shell escaping slip in my first version of the spec (a lost backslash) made three tests fail for the wrong reason; fixed in the test text, not in the schema.

## S54.3 ThemeRenderService (ece8301)
`scripts/build-renderer.js` transforms the kit's ESM into CommonJS at build time into `dist/renderer` (git-ignored); `renderer-loader.ts` loads it (a cache folder in dev and tests, an error in production when missing); `ThemeRenderService` lints every vendor theme at start with the kit's own lint (about 3 seconds), refuses an invalid one, derives the default theme per category from the manifests, returns the renderer output unchanged. `site-single-copy.spec.ts` fails if a second renderer, theme package or library copy appears in `backend-api`. First attempt at the build script left `.mjs` input as ES modules (the compiler never converts `.mjs`); fixed by handing the source over under a `.ts` name. `Dockerfile.with-themes` documents the repo-root build context (unused, not run).

## S54.4 Content port, mapping, theme resolution (7b7a8c0)
Pure mapping from the vendor's draft document to the renderer input (nothing invented; starter prices and quotes hidden; hours left empty), plan limits applied and reported, a stable page plan, `resolveTheme` with entitlements. Found while testing: the five Standard themes list disjoint categories, so the rule is by TRACK. A contract test renders every theme x every category of its tracks.

## S54.5 SEO layer and indexing rule (f632502)
Pure functions with a text-safety filter (no price, no Workspace/BOS/LeadSpace/old tagline), titles up to 60, descriptions composed from the vendor's own sentences, self canonical, hreflang only for more than one language, JSON-LD with `sameAs` only from vendor URLs and no offers, sitemap and robots.txt, a document assembler that escapes everything, `evaluateIndexing`. Reading real output found two defects (a duplicated description, an empty About heading), fixed red first. 46 of the SEO tests were written with the code and not run red first.

## S54.6 Build, publish, rollback (8c162d9)
`SiteBuildService`, `PublishService`, `SiteSettingsService`, `SitePublicService`, `PrismaSiteRepository` (advisory lock per vendor, audit and event in the same transaction). 32 tests with the real renderer over an in-memory twin repository, including overlapping publishes. Not run red first.

## S54.7 APIs (2ea6e59)
15 routes (6 vendor, 8 staff, 1 public), role matrix entries, error codes through the filter, `SitePublishModule`. The oracle failed first. Route baseline: exactly the 15 new routes. `site-api.spec.ts` runs the real guards over HTTP; `site-wiring.spec.ts` compiles the real module.

## S54.8 Provisioning seam (c08e402)
`siteDraftBuilderMode` (default `legacy`), `ModeSiteProvisioner`, `RendererDraftBuilder`. The slice 5.3 provisioning suites all still pass. The provisioning wiring test now expects the mode switch (intended).

## S54.9 Staging tests and static checks (5f73ca8)
Written, **NOT RUN** (no `.env.staging`), type-checked: `site-flow.int.spec.ts`, `site-tenant.int.spec.ts`, `site-concurrency.int.spec.ts`. Run here: `site-isolation.spec.ts` (legacy check extended to `src/site-publish`; the legacy site document is read only by the content source and never written; the SEO and mapping code is pure; tenant scope; cleanup coverage).

## S54.10 Docs and trackers
`V3_S4_RENDERER_PUBLISH.md` sections 11 and 12, `V3_API_DOCUMENTATION.md`, `V3_IMPLEMENTATION_PLAN.md` and `V3_REQUIREMENTS_MATRIX.md` status lines, this log. One slip while editing: a helper pasted a function's source over the slice 5.3 status line of the plan; caught from the diff before any commit and the file was restored from the previous commit with a plain write, then edited correctly.

## STAGING STEPS FOR THE OWNER (not run in the build session)
From `C:\Get4Domain\get4domain-s54\backend-api` on a machine where `.env.staging` is at the worktree root (copy it there yourself; it is git-ignored):
1. `npm run db:staging:migrate-deploy` (applies `20261105100000_v3_site_publish` to STAGING only, and any earlier migration not yet there), then `npm run db:staging:migrate-status` (nothing pending), `npm run db:staging:rls-off` (must report 0), `npm run db:staging:drift` (no drift).
2. `npm run build` (this now also builds the renderer into `dist/renderer`; it needs the whole repository, not `backend-api` alone).
3. If the plan data is not on staging: `node scripts/seed-v3-plans.js` (dry run), then `node scripts/seed-v3-plans.js --apply`.
4. `npm run test:int` (runs `site-flow`, `site-tenant`, `site-concurrency` with the existing suites; `site-flow` turns the plan setting `siteDraftBuilderMode` to `renderer` for its run and puts it back), then `npm run test:cleanup-staging -- --count` (must be 0).
5. Also from `C:\Get4Domain\get4domain-s54\themes`: `npm test` (255 of 255).
6. Only after step 4 passes, and only if you want the renderer on staging: `PUT /v3/admin/plan-settings/siteDraftBuilderMode` with `"renderer"` (staff token; it needs `expectedUpdatedAt` once the row exists). Leave production on `legacy`.
Nothing here touches production. The migration is NOT applied to production. Nothing is published to a real host.

Things to watch when step 4 runs for the first time: `ThemeRenderService` lints five themes at app start (about 3 seconds); the publish and rollback transactions use `timeout: 60000` for the page copy; and `vendorCMS`, `vendorProduct` and `v3AuditLog` rows of the test vendors are removed by the cleanup script.

## Rule 9 report
**Objective.** Slice 5.4: turn a vendor's draft content into a complete, SEO-ready static HTML site with the theme kit's renderer, store it as a versioned snapshot, and let staff and the vendor publish or roll back; the backend uses the kit's renderer (single source). No exposure on any real host.
**Reuse.** The theme kit (renderer, lint, library, category map), the slice 5.1 entitlement engine and `toRenderEntitlements`, `AuditService`, `AdminGuard` and the role matrix with its oracle, the tenant guard and `forTenant`, `VendorOwnerGuard` and `ModuleGuard`, `advisoryXactLock`, the HTTP exception filter, the throttler, `overlayDraft`, `StarterService`-based draft from slice 5.3, the staging guard and cleanup script.
**Files modified (existing).** `prisma/schema.prisma`, `package.json`, `src/app.module.ts`, `src/auth/guards/admin-role-matrix.ts`, `src/common/filters/http-exception.filter.ts`, `src/common/throttling.ts`, `src/provisioning/provisioning.errors.ts`, `.module.ts`, `.providers.ts`, `settings/provisioning-settings.ts` (+ tests, baseline, docs). Check against the owner's uncommitted files in the shared folder is in the FINISH report.
**Files added.** `backend-api/src/site-publish/**`, `src/provisioning/site/{draft-site-builder,mode-site-provisioner,renderer-draft-builder}.ts`, `scripts/build-renderer.js`, `Dockerfile.with-themes`, one migration, 14 test files (11 unit, 3 staging) and 4 new support files, `themes/.gitattributes`, 3 docs.
**DB changes (staging only, additive).** 2 enum types, 4 tables (`g4d_site_settings`, `g4d_site_publications`, `g4d_site_publication_pages`, `g4d_site_events`), RLS on each, foreign keys only to `Vendor` and each other. Not applied to any database in this session.
**Tests.** Backend unit 651 (after the merge, 31 suites) to 839 (42 suites), all green; theme kit 255 of 255; 3 staging suites written, not run. **Results.** build ok (including the renderer build), lint 0 errors, `verify:migrations` 117 ok, additive guard 24 ok, `verify:raw-sql` 729 ok, type-check of the staging suites clean.
**Outstanding.** The staging steps; the owner's answers (default theme per category, indexing wording, the Get4Domain badge on Free sites, where social profile URLs come from, the preview URL pattern); slice 5.5 (structured content such as hours), 5.6 (hosts and domains, which is what finally exposes a site), the dashboard screens; more themes so Pro vendors on Handyman and Ecommerce have a choice; rebuilding a site automatically when the owner claims it (slice 5.7 should call build and publish).

## S54-TIMING: provisioning-flow timeout on staging (310 of 311 pass; one test over 30 s)
**Report.** `provisioning-flow.int.spec.ts` "unknown, expired, used and revoked tokens all give the SAME 404 body" timed out at 30000 ms; slice 5.4 ran every provisioning test about 1.4 times slower than slice 5.3 on the same staging database. Worked from code only (no staging access).

**Static diff review (`origin/v3-s53` to HEAD, everything the job path touches).** Changed files on the path: `provisioning.providers.ts` (new bindings), `provisioning.module.ts` (imports `SitePublishModule`), `provisioning-settings.ts` (one new key), `mode-site-provisioner.ts` and `renderer-draft-builder.ts` (new). Unchanged and so not a cause: job runner, the other four steps, the entitlement and subscription services, tenant client, guards, interceptors, the global providers, and the error filter apart from reading two more code lists (no I/O). Findings:
| # | What | Per | Extra DB round trips | Verdict |
|---|---|---|---|---|
| 1 | `ModeSiteProvisioner.createDraftSite` called `settings.get()` (a `findMany` on `g4d_plan_settings`) although the runner had already read the same settings for the job | job (once, in step 3) | **+1** | real, avoidable, FIXED |
| 2 | In `renderer` mode the step also runs settings upsert, address read/write, content and plan reads, entitlement, build and a page-insert transaction | job | about +15 to +25 | only if the staging row `siteDraftBuilderMode` is `renderer`. `site-flow.int.spec.ts` sets it for its run and restores it in `afterAll`; if that run was interrupted, or the owner had switched staging to `renderer`, every later provisioning job pays this and the 5.3 worktree would not (it ignores the key). Made impossible for the provisioning suites (see fix 2) |
| 3 | `ThemeRenderService.onModuleInit` lints five themes (about 3 to 4 s measured in the unit suites) | app instance (the test app is built once per spec file in `beforeAll`) | 0 DB | boot cost only; not inside any test's 30 s. Production boots once. Not changed (lint at start is the safety rule from S54.3) |
| 4 | Test app now also registers `SITE_PUBLISH_PROVIDERS` (repository, audit, build, publish, preview, public services) | app instance | 0 | constructors do no I/O |
| 5 | No new global guard, interceptor or filter query; no per-request settings read; no extra audit or event write on the provisioning path in `legacy` mode | n/a | 0 | none |
So in the default `legacy` mode the code accounts for **one** extra query per job, which cannot explain a 1.4x slowdown by itself (a remote round trip is on the order of 50 to 300 ms). The likely contributors are finding 2 (a leftover `renderer` mode) and network or database variation between the two runs; the new timing output (below) will separate them.

**Fixes (test first).** (1) `CreateFreeSiteDraftStep` passes `ctx.settings.siteDraftBuilderMode` (already read once for the job) to the port; `ModeSiteProvisioner` uses it and only reads the setting itself when a direct caller did not pass it. Red: two new tests in `site-provisioning-seam.spec.ts` (zero settings reads when the mode is carried; one read when it is not) failed to compile before the field existed; green after. No rule weakened, no audit write removed; legacy mode still creates no site settings or publication. (2) `buildProvisioningTestApp` pins `siteDraftBuilderMode` to `legacy` in the app instance (an in-memory wrapper on `ProvisioningSettingsService.get`, nothing written to the database) unless the site API is included, so the slice 5.3 provisioning suites cannot be slowed by a leftover staging setting.

**Timing visibility (test code only).** `test/support/job-timing.ts`: `timed()` prints how long the Nest test app takes to boot; `logJobTimings()` prints, after each job run, the wall time of the run call and each step's `finishedAt - startedAt` from `g4d_provisioning_steps`, to stderr as `[timing] ...`. Wired into `provisioning-flow.int.spec.ts`.

**Timeouts.** `jest.setTimeout(120_000)` in `provisioning-flow`, `provisioning-concurrency` and `provisioning-tenant` int specs (the five-step job against a remote database; 30 s was always too tight).

**Results.** Unit 841 of 841 (42 suites); build ok; lint 0 errors; `verify:migrations` 117 ok; `verify:raw-sql` 729 ok; int specs type-check clean. The staging run is NOT RUN here.

**Owner: re-run only the provisioning flow with timings**, from `C:\Get4Domain\get4domain-s54ackend-api`:
1. `npx.cmd jest --ci --runInBand --selectProjects int --verbose test/provisioning-flow.int.spec.ts`  (look for the `[timing]` lines: boot, and per-step times of every job)
2. `npm.cmd run test:cleanup-staging -- --count`  (must be 0)
To rule out finding 2, check the row first: in the Supabase SQL editor of STAGING, `select key, "valueJson" from g4d_plan_settings where key = 'siteDraftBuilderMode';` (no row or "legacy" is expected unless you switched it).
