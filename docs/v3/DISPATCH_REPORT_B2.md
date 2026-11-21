# Dispatch report B2: registration creates the site, staff create a business with a site, the nine plan prices

Branch `v3-dup-check`. Nothing pushed. No `.env` file or secret was read or printed. Staging was used (this lane only): one migration applied, the price script run.
Commits: B2.1 `bcfb079`, B2.2 `0db4d51`, B2.3 and this report in the commit after them.

## B2.1 Registration creates the site
- (a) `RegistrationHook.afterRegister` no longer needs a track. Track = the one sent, else the category's minimum tier (`V3PackCategory.minTier`, lower-cased), else `handyman`. A track that is not one of the three counts as none. The `registrationProvisioning` staff switch is unchanged and still gates everything (default false): with it off nothing is made and the answer says `NOT_SWITCHED_ON`.
- (b) `POST /auth/register` now answers `data.site = { status: LIVE | FAILED | NOT_SWITCHED_ON, published, subdomain, url }` (url only when LIVE: `https://<sub>.<SITE_BASE_DOMAIN>`). A replayed registration (same email, business and password) still returns the plain sign-in answer without `site`.
- (c) A failure (plan or site) is logged without the error text and recorded on the vendor: `siteProvisionStatus = FAILED`, `siteProvisionCode` (the error's own plain upper-case code, else `SITE_FAILED` / `PLAN_FAILED`), `siteProvisionFailedAt`. Migration `20270106100000_v3_b2_site_provision_state` (three nullable columns; `verify-migrations-additive` passes it; applied to staging). Retry route: `POST /v3/me/site/create` (owner only, "Create my site"), same steps from the vendor's stored details, idempotent, works even with the switch off, clears the failure. The vendor app still has to read `siteProvisionStatus` (not exposed by any read route yet) or simply show the button when `site.status` is not LIVE.
- (d) `SiteSettingsService.ensureTheme`: the first website-manager call saves the category default theme when none is stored. `NO_THEME` now only remains for a business with no category the library has a design for (message now says to choose a business category). Note: the audit's reading ("settings row has no themeId") was only half right: the check was on the *resolved* theme, which is null only when no category resolves; both cases are now handled.
- Tests: `b2-registration-site.spec` (13), one in `website-service.spec`; `plans-registration` and `wave3-trial` updated to the new return value (the old "no track = skipped" rule is replaced by the default rule).

## B2.2 Admin create vendor with site
- No existing route did this for SALES (`POST /v3/admin/provisioning/jobs` is OPERATIONS only, async, draft only; `POST /vendors` makes no plan or site; seeded sites make unclaimed listings). New module `v3-admin-vendor-site`: `POST /v3/admin/vendor-sites` and `GET /v3/admin/categories/tree`, both SUPER_ADMIN, OPERATIONS (ADMIN inherits) and SALES (matrix and oracle updated, 434 routes).
- Create takes category, business name, owner name, phone, email, city, subdomain (+ optional area, pincode, GSTIN, `duplicateOverrideReason`). Flow: category check, subdomain check (same rules as signup), `VendorsService.create` with path `ADMIN_VENDOR` (so the shared duplicate check, override rules and held reviews apply), vendor `source=STAFF` and `registeredByStaffId`, then the Free plan and live trial site from the industry pack. Returns `{ vendorId, subdomain, site, siteUrl }`.
- Starter content and banners: the pack seed gives starter text, services, FAQ and pictures (`/starter/<pack>/hero.webp`, `g1-g4.webp`; original artwork, no photographs, per `public/starter/LICENCE.md`). Only 24 packs have seeds; the other categories got an empty draft and no banner. Banners are **not** added automatically beyond that (the AI hero seeding in `VendorsService.create` is dormant without credentials; the Banner Library is a manual pick). Fix: `ModuleTrialSite.ensureBanner` gives every trial site an empty-banner fallback, the plain generated gradient SVG `get4domain_mvp/public/starter/generic/hero.svg` (no stock photo), marked as a sample like any starter picture. Vendors replace content and pictures afterwards in the website manager (`hero.image`, gallery, media) as before.
- Category list: the old picker endpoint is flat (no sub categories, no search). The new tree returns families -> categories -> sub categories (the sheet's specialisations) with `?q=` search by name, key, family or sub category. Checked on staging: 196 of 196 catalogue categories present in the pack table, none missing; **Driving school** (`driving-school`, Education and training, tier Professional, sub category "Driving School") is present and found by `q=driving school`.
- Tests: `b2-admin-vendor-site.spec` (9).

## B2.3 Prices
- Why approve failed with "Some details do not look right": the admin Prices screen sends `{ effectiveFrom: "YYYY-MM-DD" }` with today as the default. The server parsed that as midnight UTC, which is already more than a minute past, and refused it with `PRICE_DATE_IN_PAST`; the UI has no message for that code and falls back to its generic 400 text. Fix in `PlansAdminService.approvePrice`: a bare date equal to today (UTC or India date) means "from now"; yesterday still fails; a later bare date starts at its midnight. Test added in `price-book.spec`. (Cleaner long term: add a `PRICE_DATE_IN_PAST` message to the UI; that repo was not touched.)
- Route to propose exact amounts: `POST /v3/admin/plans/:id/prices { termMonths, amountPaise, taxInclusive, status: 'PROPOSED' }` (SUPER_ADMIN, term 3, 6 or 12; paise).
- `scripts/live/propose-v3-prices.js` (+ `-lib.js`): dry run by default, `--staging` for staging, typed `LIVE` before a live `--apply` (terminal only), writes through `PlansAdminService` (audited, actor SYSTEM), only ever PROPOSED, never calls approve. It supersedes older PROPOSED rows of the same plan and term (deleted through the audited service; same amount = kept, so a second run changes nothing) and never touches an APPROVED row (reported as "kept"). Amounts: Handyman 2247/3774/5988, Professional 4497/7494/11988, Ecommerce 5847/9774/15588 rupees before GST.
- Staging run: dry run, apply (9 old proposals superseded, 9 created, 18 audit rows), second dry run shows nine "already proposed, same amount". Staging had an approved Handyman annual price of Rs 9600, left untouched. **Live has not been touched**; run the dry run on live first, then `--apply`, then approve each price in the admin screen.
- Tests: `b2-propose-prices.spec` (7).

## Decisions I made
1. Track default order: sent track, category minimum tier, `handyman`.
2. The `registrationProvisioning` switch stays the gate for signup; the vendor's "Create my site" and the staff route ignore it (an explicit action, idempotent).
3. Failure stored as a code only, never an error text.
4. Staff-created vendor gets a random 16+ character password that is never returned or logged; the owner receives the existing welcome e-mail from `VendorsService.create`.
5. Staff-created subscription source is `STAFF`.
6. Generic banner is an SVG file under the website's public folder (data URIs are stripped by the renderer's URL check), applied only to an empty banner, in both the live column and the draft.
7. "Supersede" = delete an old PROPOSED row (the price status has only PROPOSED and APPROVED), audited.
8. Bare-date rule for approve (above).

## Not done / watch
- Vendor app and public page changes (read `data.site`, show "Create my site", message for `PRICE_DATE_IN_PAST`) are in other repos.
- Banner path `/starter/generic/hero.svg` is relative like the other starter pictures; the published static sites resolve it on the vendor host only if that host serves the website's public folder (same as the existing starter pictures; not verified live).
- Categories without a pack seed still get no starter text or services, only the generated banner.
- GSTIN, branches and the other open items of B1 are unchanged.
- `tsc` was clean for `src/`; the only errors are the existing `remotion/` folder. Full unit suite was not run (only affected suites: b2-*, plans-registration, wave3-trial, website-service, admin-role-matrix, price-book).
