# B9 run log (Stage 13, Block 3 Part 1)

Worktree `C:\Get4Domain\get4domain-b9`, branch `v3-b9`, from `origin/v3-b5` (`8d9ca51`, the Stage 9 finish). Dispatch `docs/v3/stages/STAGE_13_WEBSITE_MANAGER_BATCH_9.md` with the banner library addendum, Amendments 06 and 07, Amendment 08 Part B (B1 to B4 only; B5 is not in this run) and owner overrides 1 to 7. Amendment 09 read for context only. No push. No `.env.staging` here, so staging steps are written and marked NOT RUN.

## GATE CHECK
`git fetch` ran. `origin/v3-b8` does not exist (Release 1 skips Stages 10 to 12); by override 1 the base is `origin/v3-b5`. Its log tail shows the Stage 9 FINISH commit (`8d9ca51`: design document, API documentation, final state). The owner's override states 43 integration suites green on staging. Gate satisfied.

## B9.0 rules document
`docs/v3/V3_WEBSITE_MANAGER.md`.

## Slice 5.5a: Website manager core (draft overlay, publish, snapshots, restore, compare)
Migration `20261128100000_v3_website_manager` (additive: `g4d_site_drafts`, `g4d_site_snapshots`, RLS on). Code: `src/v3-website/` (pure core: managed-doc, editor-map, wording-core; store port with Prisma implementation; service; 11 vendor routes under /v3/me/site) and `src/site-publish/content/` (managed content source, snapshot sink; the build records the document each publication used, so the live document is the snapshot of the current publication and every build route stays consistent). Additive edits to Stage 5.4 code only: `ContentSource.load` takes an optional overlay, `BuildOptions.overlay`, the adapter reads the new extras and renderer settings.
Order of work, stated plainly: the core spec was written first, but its red run was lost (the first invocation passed `--selectProjects unit <file>`, which swallowed the path and ran the whole suite against a half-edited tree). The service and its spec were written service-first. The core spec then went green at once (29 tests) and the service spec at 26 of 27 (the one failure was a wrong assumption in my own test: every page changes when the about text changes, because it feeds the structured data; the assertion was corrected to the invariant).
Changed expectation (intended): `site-wiring.spec.ts` now expects `ManagedContentSource` for `ContentSource`.
Staging test written, NOT RUN: `test/website-manager.int.spec.ts` (harness option `website: true`, compile guard extended).
Gates: tsc (build config) clean, eslint clean on touched paths, build ok, verify:migrations 163/163, verify:migrations-additive 47/47, verify:raw-sql ok, route baseline regenerated (1092 routes), route classification, role matrix, DI metadata, site wiring, site isolation, b9-isolation (legacy check over `v3-website`) all green.
Gaps recorded: landing pages have no renderer template; the renderer's menu is fixed (navigation is validated and stored, not drawn); opening hours stay free text. See `V3_WEBSITE_MANAGER.md` section 11.
Full unit run: 145 suites / 2955 tests (was 140 / 2874). The first full run found one real failure, `tenant-model-registry.spec.ts` (new tenant tables must be classified); the two tables were classified as store-reached tenant data and the suite is green.
