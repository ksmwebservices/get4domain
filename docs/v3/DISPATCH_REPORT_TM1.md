# Dispatch TM1 report: the theme marketplace, backend lane

Branch `v3-theme-mp` (from `v3-build-be`), worktree `C:\Get4Domain\get4domain-w2`. **Never pushed.** Status table and M0 findings: `docs/v3/DISPATCH_STATUS_TM1.md`. Contract: `docs/v3/API_CONTRACT_WAVE4.md` section TM1-3. Package format: `docs/v3/THEME_PACKAGE_SPEC.md`. See it yourself: `docs/v3/SEE_IT_THEMES_BACKEND.md`.

## Done

**Before M0 (asked first)**
- `test/vendor-gaps.int.spec.ts` failed on an extra `onFreePlan` field. **The test was stale, the response is right**: `onFreePlan` was added on purpose (its own rule in `gaps-core.ts` and unit tests in `wave3-trial.spec.ts`), and a business with no subscription correctly gets `false`. The expectation now names the field (stricter, nothing loosened). Run alone on staging: 6 of 6.
- **`GET /v3/me/overview`** (additive; `GET /v3/me/app-shell` is unchanged and returned whole inside it): the app-shell, the business, the site state and the order and customer counts for the vendor Home screen. A data matrix cuts it (`core/overview-access.ts`: a team member gets the order count and the site state only with the `website` area, and never the customer count; a Free plan gets `locked:true` and no number). Counts of real records only. Route baseline and contract updated.
- **`POST /v3/me/terms/accept` body, confirmed against the code and now documented** (it was not in the contract): `{ "documents": [ { "kind", "version" } ] }`, 1 to 8 items, and it must list **every** document that `GET /v3/me/terms` shows under `outstanding` with exactly that version; anything else is 409 `TERMS_STATE_INVALID`.

**The queue**

| Job | Result |
|---|---|
| M0 | Findings: a theme is a folder built into the renderer at build time; the kit already had a zip package format and a safe validator; nothing could load a theme at run time. `theme-uploads/` is one raw legacy demo site, not used. |
| M1 | Package spec v1 = the kit's own zip plus an optional `marketplace` block in `theme.json` (schema file `themes/schema/theme.schema.json`). Backend core `v3-theme-market/core/theme-package-core.ts` checks names, tags, tracks, content-free rules and runs the kit lint; every problem is `{ file, rule, message }`. |
| M2 | Table `g4d_theme_market_packages` (additive migration, RLS on, checks in the database). Admin routes: validate (dry run), upload (multipart, DRAFT, idempotent on the same bytes), list, detail, submit, return, publish (re-checks the stored package), archive. 14 registered error codes, role matrix rows, throttling, audit row in the same transaction. |
| M3 | The renderer serves PUBLISHED packages at run time: 30 s cache, dropped on publish and archive; a new theme is in the chooser and renders with no rebuild and no restart. A render failure falls back to the previous or the default theme. Archived themes keep working for businesses already on them. |
| M4 | Private theme per customer (upload with `vendorId`; visible and usable by that business only). `publish-to-marketplace` needs the recorded consent (a yes and a note, audited, repeated by a database check) and refuses a package that carries the business's name, web addresses, phone (any spacing), e-mail or own media (by hash). |
| M5 | Public, owner and admin marketplace routes (filters by pack, catalogue category, add-on, capability, combination tag, tier, starter), detail with preview paths, the plan gate through the existing switch, and a server-side preview with a strict content security policy and no cookie; an admin can preview a draft. |
| M6 | **32 starter themes**, built from data (`themes/starter/recipes.json`): every pack has 4 to 8, all 14 combination tags are used, the four kit-only category ids are never listed (their catalogue equivalents are). The gallery lists every theme per pack with combinations. |
| M7 | This report, the contract, the see-it guide, the baseline, the full test run. |

**Blocked: nothing.** No job reached the three-attempt limit; `TM1_LOG.md` was not needed.

## Commits (oldest first)

| Commit | What |
|---|---|
| `b695d74` | pre-M0: overview route, stale int test fixed, terms body documented |
| `a47d79a` | M0 findings and status file |
| `b7d8d6c` | M1 package spec v1, schema, backend core, tests |
| `5275d3c` | M2 upload, validation, storage, flow, migration, role matrix |
| `79bb80e` | M3 run-time loading, privacy, archived, render fallback |
| `046e38a` | M4 custom customer themes, consent, release to the marketplace |
| `8737bf5` | M5 marketplace API and preview |
| `7506f0a` | M6 starter themes and gallery |
| (this report) | M7 docs |

## Migrations

One: `20261231100000_v3_tm1_theme_market` (new table `g4d_theme_market_packages`, nothing existing is changed; the legacy V2 table `g4d_theme_packages` is separate on purpose). Written from `prisma migrate diff`, **verified additive** (`scripts/verify-migrations-additive.js` passes it), **applied to STAGING only** with `npm.cmd run db:staging:migrate-deploy`; then `db:staging:rls-off` printed **0** and `db:staging:drift` showed **only the 2 documented items**. **Not applied to production.**

`verify-migrations-additive.js` reports `90 passed, 4 failed`: the 4 are older migrations from other lanes (`wave2_vendor_gaps`, `wave2_site_mapping`, `wave2_index_name_63`, `wave4_commission_adjustment`: a DROP CONSTRAINT, a RENAME, a DROP INDEX). They are not part of this lane and were not touched; they need an owner decision for the `ALLOW` list.

## Tests

- `npm.cmd run build`: clean (renderer built). ESLint on `src`: 0 errors (22 existing warnings).
- `npm.cmd run test:ci` (separately): first run **301 of 302 suites, 5782 of 5783 tests**. The one failure was `pack-wire.spec.ts`, which counts the pure cores under `v3-packs/core` (expected 4); my new `overview-access.ts` is the fifth and passes the same purity check, so the count now says 5 and the check itself is unchanged. Re-run alone: 17 of 17. No other suite failed.
- Theme kit (`cd themes; node --test test/*.test.mjs`): **289 of 289** (270 before this lane). `build-themes --check` and `contract-table --check` are current.
- Integration, each file alone (`--runInBand --selectProjects int`, path first): `vendor-gaps.int.spec.ts` 6 of 6 (was failing), `theme-market.int.spec.ts` 6 of 6. `test:cleanup-staging` then `--count` printed **0**.
- New unit specs: theme-package-core 16, theme-market.service 18, theme-market-http 8, theme-runtime 13, theme-custom 12, theme-marketplace 15, theme-starter 10, theme-gallery 12 (3 new), plus the overview tests in pack-part-b-http.
- Route baseline: 1448 to 1465, the diff against the lane base is exactly the 17 new routes.
- Staging: migration applied, `rls-off` 0, `drift` only the 2 documented items.

## Security decisions

1. **An uploaded theme is untrusted and never runs.** The zip is inspected in memory (kit `validatePackage`): nothing is extracted to disk, parsed as code or fetched. Allow-listed layout only (`theme.json`, `templates/*.html` of known names, four CSS files, `presets/`, `assets/` of png, jpg, webp, svg, woff2). Limits: 5 MB, 400 files, 1 MB a file, 100 KB a page, 40 KB layout CSS, 6 KB motion CSS, 50 times expansion (zip bomb). Unsafe paths, symbolic links, duplicate paths, executable extensions **and executable first bytes**, a zip inside a zip are refused; a picture must be that picture type; an SVG may hold no script, handler, animation, `foreignObject`, `javascript:` or outside address.
2. **No JavaScript at all**: the renderer supports no script set, so a theme has none (a `<script>` or an inline handler is a lint failure). **No remote URL** except the platform's own, the map hosts and the video hosts; fonts are named, never loaded (the platform self-hosts the approved ones). Output is escaped by the renderer (a pure function: no network, file, clock or randomness).
3. **Content-free**: no e-mail, phone or outside address in any package; before a custom theme is released to the marketplace also the business's name, web addresses, phone in any spacing, e-mail and own media files (by hash). A refusal names the file and the rule and **never repeats the detail it found**.
4. **Live only after validation passes and an ADMIN or SUPER_ADMIN publishes it** (DRAFT, REVIEW, PUBLISHED); the stored bytes are checked **again** at publish, and again when the renderer loads them (a package that no longer validates is skipped and the business falls back, no error page). DRAFT and REVIEW themes can be previewed by staff only.
5. **Rendering is isolated per business**: `listThemes(vendorId)` shows a private theme to its own business only; the library default of a category is never a marketplace theme (Free keeps the default); an archived theme is neither offered nor choosable except by the business already using it; a theme that fails while drawing can never take a site down (falls back to the previous or default theme).
6. **Previews are sandboxed**: `default-src 'none'`, no script, no form, no frame, no outside request, `sandbox`; no cookie; `no-store`; `noindex`; the content is an invented business with every price emptied.
7. **Role matrix as data**, with an independent oracle test: reads OPERATIONS, ADMIN, SUPER_ADMIN; changes ADMIN and SUPER_ADMIN; SALES, SUPPORT, labels, vendors, partners refused. The vendor marketplace view is owner only (it shows the switch fee). The public routes are read only and carry no vendor, price, count or source business. `sourceVendorId` is returned by no vendor or public route.
8. **Consent is enforced twice**: by the service and by a database check constraint (a published public theme made for a customer needs `consentObtained`). The note is audited; no legal wording is written anywhere.
9. **Audit** row in the same transaction for every change; **throttling** (upload and dry run 10 a minute, preview 60 a minute); **registered error codes** (the filter passes `problems` through bounded to 100 entries and 300 characters, never file content); the table has **row level security on with no policy**.
10. **No fake numbers**: no popularity, download, install, rating or ranking field exists anywhere; lists are sorted by name; starter themes say they are starter themes built by the team.

## Assumptions

1. `docs\v3` is the worktree-root folder, as in G1; the branch already existed and was clean.
2. "Category ids" in the manifest are the **196 catalogue ids**; the kit's own 41 category ids stay in `categories` (the renderer needs them). A package names both. The four kit-only ids (gym-yoga, salon-spa, tutor, auto-mechanic) are not catalogue ids: starters list their catalogue equivalents (`gym-fitness-centre`, `yoga-meditation-studio`, `unisex-salon`, `gents-salon-barber`, `spa-massage-centre`, `tutor-home-tuition`, `car-mechanic-garage`, `bike-mechanic-two-wheeler`). The G1 `KIT_ONLY_PACK` rule keeps working for vendors that use the kit ids.
3. **Storage in the database** (a `bytea` column, at most 5 MB a row) because object storage is unset and a local disk does not survive a redeploy or a second server.
4. Releasing a theme to the marketplace requires the theme to be **already published for its business** and the consent note to be **3 to 500 characters** (the dispatch asked for "a boolean and a note"; I made the note required when the answer is yes so the audit record means something).
5. A custom (private) theme may contain the customer's name or addresses for its own use; the **release** to the marketplace is where those are refused, so the flow is: upload a clean version for the same business, publish it, then release it.
6. **Add-on and combination tags describe what the layout contains**: SHOP, ONLINE_ORDERING_DELIVERY and PHARMACY_COUNTER starters add the product-grid section to the home page (a test checks it); HOME_SAMPLE_COLLECTION relies on the enquiry form every theme has. The marketplace validator checks a tag is coherent with the packs, add-ons and capabilities the theme declares.
7. The marketplace key is the theme id, so the **existing switch route is the selection route** (nothing new was added to it); a version of a key must be higher than every stored one, and a key stays with one business or the marketplace.
8. A theme that fails to draw falls back silently (a note is kept); when the content has not changed the previous build is reused and nothing is drawn.
9. The vendor marketplace view shows the themes designed for the business's **own track** (as the switch allows); it cannot show other tracks because the business could not apply them.
10. Starter themes were **built and tested but not uploaded to staging or production** (that changes data; the zips and the upload steps are in the see-it guide).

## Questions for the owner

1. **Which environment should get the 32 starter themes, and when?** They are zips built by `node themes/cli.mjs starter`; an admin uploads and publishes them (or I can write a one-time script that does it with the admin login). I did not load them into staging or production unasked.
2. **Premium tier.** Every starter is `Standard` (a theme still has no price of its own). Do you want a first set of `Premium` starters, and what would a Premium theme add (the kit requires per-variant CSS for it)?
3. **When object storage is configured**, should the zips move out of the database? (The table keeps the hash; moving is a data-only change.)
4. **The four older migrations that fail the additive check** (see Migrations): add them to the guard's `ALLOW` list with the reason, or leave as they are?
5. **Consent wording.** The consent is a yes and a short note by the admin. Do you want a fixed set of reasons to choose from instead of free text?
6. **Legacy V2 theme store** (`ThemePackage`, `website-themes`, `theme-uploads/`): still untouched and still separate (audit job T5). Retire it, or keep it until the customers on it have moved?
7. **Vendor chooser across tracks.** A handyman business only sees handyman themes. Do you want a clearly marked "designed for another kind of business" section, or keep it as is?
