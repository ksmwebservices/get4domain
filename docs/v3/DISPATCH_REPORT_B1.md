# Dispatch report B1: D1 one shared duplicate check, D2 one shared footer

Branch `v3-dup-check` (continues from the findings commit 78cae0b). Nothing pushed. No `.env` file or secret was read or printed. Staging was used (this lane only): migration applied, integration tests run.

Commits: D1 `aa30e57`, D2 `fb7b2ce`, this report and the similar-subdomain answer in the commit after them.

## 1. D1: what changed

**New module `backend-api/src/v3-duplicates/`** (global module, so every path gets the same instance)
- `core/duplicate-core.ts`: the pure rules. Signals, strengths, normalisers (phone key, GSTIN, business name, pincode, host), a pg_trgm-compatible trigram function, `classify`, the similar-subdomain rule.
- `duplicate-check.service.ts`: `check` (find and classify), `enforce` (what a path does with the answer), `reviewData`/`record` (hold row, override log), `findAttachableListing`, `subdomainWarning`, `decide` (admin review).
- `duplicate.store.ts` + `prisma-duplicate.store.ts`: the storage port and its Prisma implementation (raw SQL only through `Prisma.sql`, parameterised). In-memory twin for tests: `test/support/memory-duplicate-store.ts`.
- `api/duplicate-admin.controller.ts`: `GET /v3/admin/duplicates/reviews`, `POST .../:id/clear`, `POST .../:id/reject`.

**Signals and outcomes**
| Signal | Strength | Reuses |
|---|---|---|
| phone (last 10 digits), e-mail, GSTIN, existing website (a host row of another vendor), mapped custom domain | strong, **blocks** (409 `DUPLICATE_BUSINESS`) | `phoneKey` helper of business-input, `normalisePhone` |
| name (pg_trgm similarity) + pincode or area + category | medium, **asks** (409 `DUPLICATE_POSSIBLE`) or goes to admin review | pg_trgm, the directory's own index |
| owner name, address | supporting: never decides alone; lifts a near-miss name (0.40) to medium | |

- A visitor's refusal says "A business with these details already exists. Sign in to your account, or claim the listing if it is yours." plus `claim: {businessSlug, startPath: '/v3/claim/start'}` only when the matched listing is UNCLAIMED. It carries no ids, no signal names, no names, no contact details (tested by string search).
- Medium match, visitor: answered with public listing facts only (slug, name, category, city, area, claimable). Answering "different business" (`confirmDistinct: true`) creates the business **held**: a `g4d_duplicate_reviews` row is written in the same transaction as the vendor, and `PublishService.publish` refuses (409 `DUPLICATE_REVIEW_PENDING`) until an ADMIN or SUPER_ADMIN clears it with a written reason. A rejected review stays held. A medium match with no public listing to show (a vendor with no listing, or a removed one) reveals nothing and goes straight to review.
- Medium match, staff path: stopped (staff cannot answer for the owner); staff see which record matched.
- Override: SUPER_ADMIN or ADMIN only, reason 5 to 300 characters, logged in `g4d_duplicate_overrides` (path, staff id and role, reason, outcome, matched vendor and listing, matched signals, new vendor, time). OPERATIONS, SALES and visitors get 403 `DUPLICATE_OVERRIDE_FORBIDDEN`; a bad reason is 400. An overridden business is not held.
- Similar subdomain: warning only. Returned by the public availability check as `similarTo` (the name is still available), logged on creation, and in the service result. Not a block anywhere.
- Existing e-mail 409 (`A vendor with this email already exists`) is unchanged and still comes first.

**Wiring (every creation path)**
| Path | Where | Policy |
|---|---|---|
| `POST /auth/register` (also referral-link signups, path `REFERRAL`) | `VendorsService.create` (selfService) | block / ask / hold. Only the call to `create` gained the extra fields and `{path, selfService}` |
| `POST /vendors` | `VendorsService.create` (staff actor from the token) | block / stop, override with `duplicateOverrideReason` |
| provisioning jobs (staff, team members) | `CreateVendorStep` (+ override carried in the job input, judged at job creation) | block / stop, override |
| seeded sites (single and batch) | `SeededSitesService.create` pre-check, then the same step as safety net | block / stop, override via `duplicateOverrideReason` |
| deal prospects | `DealsService.resolveVendor` | block / stop (no override, see 3) |
| admin starter sites | `StarterService.createSite` | block / stop (no override, see 3) |
| directory | `CreateDirectoryProfileStep` | an UNCLAIMED listing with no owner, same phone or same name+place+category, is **attached** to the new vendor instead of a second listing being created (audited `directory.business.attached`) |
| demo sandboxes | `DemoService.provisionSandbox` | **exempt**, see 4 |

A test (`duplicate-check.spec.ts`, "no creation path skips the check") scans `src/` for every file that creates a vendor row and fails if a new one appears that is not on the list.

**Referral partners and team members:** a partner cannot create a vendor; their referral-link signup is the `REFERRAL` path and gets exactly the register outcomes (test compares the two refusals for equality). Team members create through provisioning or seeded sites and get the staff outcomes; a duplicate shows the claim route and never creates a second site.

**Migration `20270105100000_v3_d1_duplicate_check`** (additive): `Vendor.phoneKey TEXT` nullable + index; backfill `UPDATE ... WHERE phoneKey IS NULL AND phone has 10 or more digits` (idempotent, touches no other column, row locks only; the application also finds a row with no key by its raw phone while any exist); `g4d_duplicate_overrides`, `g4d_duplicate_reviews` (RLS ON, no policy, like every public table; status CHECK); a guarded `pg_trgm` extension and a guarded GIN trigram index on `Vendor.businessName`.
- **`verify-migrations-additive`: does NOT flag the new migration** (`PASS 20270105100000_v3_d1_duplicate_check`). The script's summary reads "91 passed, 4 failed"; the 4 failures are older migrations (`20261219110000`, `20261219150000`, `20261219200000`, `20261230100000`: DROP CONSTRAINT / RENAME / DROP INDEX) and were failing before this lane. `verify-migrations` (box-drawing etc.) passes, `verify:raw-sql` passes.
- Applied to staging with `db:staging:migrate-deploy`; `rls-off` count 0.

**Tests** (all green): `duplicate-core.spec` (12), `duplicate-check.spec` (30: each strong signal, refusal privacy, medium rules, override rules, subdomain warning, review queue, path guard), `duplicate-paths.spec` (29: VendorsService register/admin/referral, AuthService hand-over, provisioning step and job API, directory attach, seeded, deals, starter, publish hold, availability check), `duplicate-check.int.spec` on staging (8: migration, backfill, RLS, store queries, transaction, review and override rows, similar subdomains). Also re-run and green: `admin-role-matrix` (oracle now 432 routes), `provisioning-steps`, `seeded-service`, `wave2-catalogue-categories`, `wave3-trial`, `provisioning-wiring`, `provisioning-isolation`, `directory-isolation`, `live-baseline`; on staging `provisioning-flow`, `provisioning-tenant`, `provisioning-concurrency`, `seeded`, `trial-signup`, `wave2-h`, `media-import`.

## 2. D2: what changed

- `get4domain_mvp/src/engine/components/PoweredBy.tsx`: `PoweredBy` (prints "Powered by Get4Domain", link text the brand name only, `https://get4domain.com`, `target="_blank" rel="noopener"`) and `PoweredByBar` (for pages in their own frame). Its only prop is `className`: no plan, vendor, theme or setting reaches it.
- Used by: `KitRenderer.tsx`, `design-sections.tsx` (both footers), `ShellFooter.tsx` (all three layouts; the **minimal layout had no mark at all before**), the retail and real-estate footers, the legacy `/site/[subdomain]` page (it linked to `/`, which on a vendor host is the vendor's own site), the campaign landing page, and `raw-theme-frame.tsx` (an uploaded theme is its own document in an iframe: the mark sits in a bar under it, the frame gives up exactly the bar height).
- **Published sites (the V3 static renderer):** `themes/lib/render.mjs` printed no mark either, so Free and Pro published sites had none. Its footer now writes the same mark (constants `POWERED_BY_HREF` / `POWERED_BY_BRAND`; a test keeps the React and the static copies in step). This goes beyond the four files named in the dispatch; without it the requirement "every vendor site" would not hold. The golden snapshot `listing-only-site.spec.ts.snap` changed by exactly one line per snapshot (3).
- New jest project `web` (`test/web/`): renders each footer to HTML with `react-dom/server`, React taken from this package, a few Next/icon/API imports stubbed. `npm run test:ci` now runs `unit` and `web`. `test/web/powered-by-footers.spec.tsx` (14): the shared component, ShellFooter x3, DesignFooter x2, KitRenderer (default and designed footers), retail, real-estate, the frame; source contracts (no other file types the words, every footer imports the component, no plan/setting input, the static renderer matches). `themes/test/powered-by.test.mjs` (3): every library theme, Free and Pro, home and contact, exactly one mark inside the footer, and nothing passed to the renderer can switch it off. The kit's own 289 tests pass.

## 3. What was left

- **Branches** (second branch under one vendor): no model exists; needs your decision (`Vendor.parentVendorId` or a branch table). Not started.
- **Override on deals and starter sites**: the role is not plumbed through those two services. Staff create the business with `POST /vendors` plus an override reason, then attach the deal with `vendorId`.
- **GSTIN** is checked on registration and `POST /vendors` only (the only paths that take one), and matches only vendors that saved a tax profile; nothing stores a GSTIN at registration (not changed: another lane owns that route).
- **Seeded CSV dry-run and the listing-import dry-run** (`classify`) do not run the shared check; their apply does (through the job step), so a dry run can say OK for a row the apply refuses as `DUPLICATE_*`.
- The frontend has no `node_modules` here, so `next build` and `next lint` were **not** run for D2; the footers are proven by the new render tests and a syntax-level compile. Please run `npm ci && npm run build` in `get4domain_mvp` before merging.
- `.g4d-footer__powered` has no dedicated CSS in the theme library (it inherits the footer's paragraph style).
- `themes/lib/render.mjs` only affects pages built from now on; already published pages get the mark when they are rebuilt.
- `raw-html-site.tsx` (used only by the theme preview page) was not changed.
- Not pushed; no Vercel preview was created.

## 4. Decisions (design details I chose)

1. Medium needs a place and a category: with neither pincode/area nor a category the medium rule stays quiet (city alone is not "location" as the dispatch defined it). Registration and `POST /vendors` accept optional `city`, `area`, `pincode`, `gstin`, `confirmDistinct`; provisioning jobs accept optional `area`, `pincode`.
2. Thresholds: name similarity 0.55; 0.40 when the owner or the address also matches. Candidates are fetched by pg_trgm `%` (existing GIN index); without the extension the same rule runs in the application on rows narrowed by place.
3. Strong match on an UNCLAIMED listing nobody owns blocks a visitor (shown the claim route) but does not stop a staff path (it attaches). A listing that has an owner always counts.
4. Demo sandboxes (`isSandbox` with an expiry) never count as existing businesses and `DemoService.provisionSandbox` is exempt: a lead who took the tour would otherwise block their own signup. Pre-sale prospects (`isSandbox`, no expiry) do count.
5. Who answers "Is this your business?": only a visitor path. Staff paths are stopped, because staff cannot speak for the owner.
6. A held business is held by the review row (PENDING or REJECTED); `PublishService.publish` is the single choke point. The vendor and its review row are created in one transaction.
7. A second table `g4d_duplicate_reviews` next to the requested `g4d_duplicate_overrides`, because "send to admin review without publishing" needs somewhere to live. Both have plain ids (no foreign keys) so the log outlives either business.
8. Override authority: ADMIN and SUPER_ADMIN, in the service (not just the route), also for clearing a held review. The review routes are OPERATIONS+SUPER in the matrix (ADMIN inherits); the service refuses other roles.
9. Staff see matched signals and ids in the refusal body; visitors never do.
10. Dependency injection of the check into `CreateVendorStep`, `CreateDirectoryProfileStep`, `SeededSitesService` and `TrialSignupPolicy` is `@Optional()` in the constructor only so the older hand-built unit tests keep working; the module is global, so the application always provides it (and the "no path skips" test guards the call sites).
11. Footer link: `target="_blank" rel="noopener"`, dofollow (no `nofollow`), English text in every language. Say if you want `nofollow` (a site-wide backlink from every vendor site is something search engines can treat as a link scheme).
12. Mark placement in an uploaded-theme frame: a fixed 2.25rem bar under the iframe, so it is always visible and the theme is not touched.
13. Two existing int fixtures were adjusted: `seeded.int.spec` gives each create its own area (same name+area+category now counts as a possible duplicate), and `test/support` fakes record the override.
