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
