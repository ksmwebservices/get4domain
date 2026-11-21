# Theme spec reconciliation (read-only lane, 21 Nov 2026)

Two files describe "the theme package" and disagree:

| | **A. Kit format** (this repo, `docs/v3/THEME_PACKAGE_SPEC.md`, 18 Nov) | **B. Flat format** (`get4domain-pub`, `docs/v3/THEME_PACKAGE_SPEC.md`, 20 Nov, "P11") |
|---|---|---|
| Layout | `theme.json`, `templates/*.html`, `css/{base,tokens,motion,print}.css`, `presets/`, `assets/` | `theme.json`, `theme.css`, `home.html` and other `*.html` at the zip root, `assets/`, `preview.png` |
| Manifest | `tier`, `tracks`, `families` (kit families), `categories` (41 kit ids), `marketplace{packs,addons,capabilities,tags,catalogueCategories,previews,...}` | `families` (8: shop booking ...), `categories` (category-pack keys), `pages`, `colors`, `cssVars`, `googleFonts`; claims four new fields `pack`, `track`, `freeMode`, `targets` |
| Validator | `themes/lib/pack.mjs` `validatePackage` + 40 lint rules + `backend-api/src/v3-theme-market/core/theme-package-core.ts` | `backend-api/src/themes/core/sanitise.ts` + `lint.ts` |
| Table | `g4d_theme_market_packages` (`V3ThemeMarketPackage`, schema.prisma:8368, stores the zip bytes) | `g4d_theme_packages` (`ThemePackage`, schema.prisma:446 w2, :345 pub, stores sanitised pages + scoped css) |

**Short answer: they are two different, mutually exclusive formats, each with its own route, validator, table and renderer. The "There is no second format" sentence in file A (line 3) is wrong about the repo as a whole, and so is the "Nothing here is a new format" sentence in file B (line 3).** Details and evidence follow. All paths are relative to `C:\Get4Domain\`; "w2" = `get4domain-w2` (branch `v3-lane-e1`), "pub" = `get4domain-pub` (branch `v3-pub-a1`). They are worktrees of one repo and the branches have diverged; the code of one is not in the other.

I read code only. Nothing was run, no database, staging or live host was touched. What is deployed was not checked, so "today" below means "what the code on these branches does".

---

## 1. Which upload route and validator the admin Themes screen calls today

The admin app of `get4domain-ui` (branch `v3-ui-s17`) does **not** call either backend route that exists.

- Screen: `get4domain-ui/apps/admin/src/pages/themes/ThemesPage.tsx:3` imports `themeLibrary`; its Upload dialog calls `themeLibrary.validate(client, file)` (`UploadDialog.tsx:44`) and `themeLibrary.upload(client, file, { visibility })` (`UploadDialog.tsx:53`).
- Client: `get4domain-ui/packages/api/src/themelib/client.ts:109` `POST /v3/admin/themes/validate`, `:115` `POST /v3/admin/themes/upload` (multipart field `file`, optional `visibility` STARTER|PRIVATE and `vendorId`). Also `GET /v3/admin/themes`, `/:id`, `/:id/preview`, and `POST /:id/review`, `/publish`, `/archive`, `/assign`, `/publish-to-marketplace` (lines 102-125).
- These routes are declared **ASSUMED**: `get4domain-ui/packages/api/src/admin-matrix.ts:221` ("dispatch TM2, ASSUMED routes") and `get4domain-ui/docs/FRONTEND_GAPS.md:5` and `:18` ("TM1 had not written ... any admin theme-library route ... assumed").
- A search of both backends (`get4domain-w2/backend-api`, `get4domain-pub/backend-api`) finds **no controller for `v3/admin/themes`**. The real routes are:
  - Kit format: `@Controller('v3/admin/theme-market')` (`w2 backend-api/src/v3-theme-market/api/theme-market.controllers.ts:53`): `POST validate` (:57), `POST themes` (:62), `GET themes`, `GET themes/:id`, `GET themes/:id/preview`, `POST themes/:id/submit|return|publish|publish-to-marketplace|archive`. Validator: `ThemeMarketService.validate/upload` -> kit `validatePackage` + `inspectPackage` (`v3-theme-market/theme-market.service.ts:5,50,71`).
  - Flat format: `@Controller('admin/themes')` (`w2 backend-api/src/themes/themes.controllers.ts:26`): `POST import` (:33, `?dryRun=1`), `GET`, `GET :id`, `PUT :id`, `POST :id/duplicate`. Validator: `ThemesAdminService.importZip` -> `lintPackage` -> `sanitisePackage` (`themes/themes-admin.service.ts:30-40`; `themes/core/lint.ts:41`, `sanitise.ts:156`).

**Result:** the new admin screen (get4domain-ui) calls a route that does not exist (so an upload from it today returns 404). The UI's data shapes (problem = file + rule, `PACKS`, `COMBINATIONS`, `STARTER|PRIVATE`) are written for the **kit format** (A). It also expects `review` and `assign` actions that the kit controller does not have (the kit has `submit` / `return` / `publish`; a private theme is made by sending `vendorId` at upload) and the status word `APPROVED` where the kit says `REVIEW`.
The only admin screen that works against a real upload route today is the older `get4domain_mvp` admin: `get4domain-w2/get4domain_mvp/src/lib/api.ts:786` -> `POST /admin/themes/import`, used from `get4domain_mvp/src/themes-admin/ThemesAdmin.tsx:48,58,62`. That is the **flat format (B)**. File B's "Admin, Themes, Import" refers to this screen.

## 2. Which format each route accepts, and whether the other is accepted anywhere

- `POST /admin/themes/import` accepts **only B**. `sanitise.ts:185` takes only root-level `*.html` as templates; `:193` errors "home.html is missing"; `:210-218` reads only `theme.css` and leaves `css/*.css` out with a warning; `:115` requires `families` from the 8 flat families. An A zip (templates in `templates/`, families like `education`, `wellness-beauty`) fails on all three.
- `POST /v3/admin/theme-market/themes` accepts **only A**. `themes/lib/pack.mjs:139` allows only `theme.json`, `templates/*.html`, `css/*.css`, `presets/*.json`, `assets/*`; anything else is `unknown-file`; `:152` makes `theme.json`, `templates/home.html` and the four css files required. A B zip (root `home.html`, `theme.css`) fails with `unknown-file` and `missing-file`.
- There is no converter, adapter or dual-format sniffing anywhere (searched `backend-api/src` and `themes/` in w2 and pub). So neither route accepts the other format.
- File B's four "new" fields `pack`, `track`, `freeMode`, `targets` are ignored by the flat validator (B line 5 says so; `grep` of `backend-api/src/themes/core` in both worktrees finds none of them). They exist only in the pub front end: `get4domain_mvp/src/lib/v3-public/site-kit/themes.ts:30-47` (`KitTheme`) and `validateTargets` (`:117`).
- The two route families share nothing in storage: different tables, different entitlements path (the flat table is the one paid unlocks and expiry use: `themes/theme-purchase.service.ts:30,78`, `theme-expiry.service.ts:36`, `starter.service.ts:153`).

## 3. Which format the public renderer and resolver read for a live vendor site

There are **three** render paths in the code, not two. Which one a given vendor gets depends on branch and per-vendor flags.

| Path | Where | Reads | Format |
|---|---|---|---|
| **P-1** Published static site (V3) | w2 `backend-api/src/site-publish/` (`site-build.service.ts:86-98` resolves and `getTheme`; `renderer/theme-render.service.ts` loads the kit's `renderPage`) | library themes (`themes/library`, 5 + starter) **plus** PUBLISHED rows of `g4d_theme_market_packages` loaded at run time (`theme-render.service.ts:9-11,53-55`, 30 s cache) | **A (kit)** |
| **P-2** Next route, uploaded theme | `get4domain_mvp/src/app/site/[subdomain]/[[...rest]]/page.tsx` (w2 :120,:178; pub :104,:169) -> `engine/themepack/package-fetch.ts:7` -> `GET /themes/package/:id` (`themes.controllers.ts:53`) -> `g4d_theme_packages` | when a vendor has `site.docV2` and a `themeRef` | **B (flat)** |
| **P-3** Next route, built-in design kit | pub only: same `page.tsx:219` `themeForSite(site)` -> `site-kit/resolver.ts:41-53` over the in-code array `FLAGSHIPS` (`themes.ts:110`) -> `SiteApp` | nothing from the database; targets (`main` -> `category` -> `sub`) are matched against the code array | **neither**: TypeScript `KitTheme` records with a `design` block |

Notes:
- `resolver.ts` (pub) never reads `g4d_theme_packages`. Its default argument is `FLAGSHIPS` (`resolver.ts:41,87`); `resolveTheme(ctx, themes)` could take database themes, but no caller passes any (`page.tsx:219`, `FreeSiteView.tsx:12`, `app-data.ts:18` all call it with defaults). So the P11 `targets` field is not wired to uploaded packages.
- w2 has no `site-kit/` folder at all (`get4domain_mvp/src/lib/v3-public/site-kit/` exists only in pub). The P11 resolver and the kit renderer are therefore on different branches; neither contains the other. Merge status: `git merge-base --is-ancestor` of pub HEAD in w2 HEAD is false.
- Resolution in P-1 is `resolved.themeId` from the vendor's setting, else `defaultThemeFor(categoryId)` (`site-build.service.ts:86,93`), over kit categories, not P11 main/category/sub.

Conflict between "admin upload" and "renderer": **yes**. Even ignoring the missing route, the legacy admin upload (B) feeds P-2, while the V3 publish pipeline (P-1) cannot draw a B package, and the new admin screen is shaped for A. A theme uploaded through the one screen that works today (legacy `ThemesAdmin`) is invisible to the V3 publish path.

## 4. Which format the built-in themes use

| Set | Count | Format | Evidence |
|---|---|---|---|
| Built-in free (Standard) library themes | 5: `free-service-pro` (13 categories), `free-practice` (11), `free-studio` (5), `free-hospitality` (4), `free-shop-lite` (8), plus `_starter` | **A** (`theme.json` + `templates/` + `css/{base,tokens,motion,print}.css` + `presets/`); `tier` Standard, no `marketplace` block | `themes/library/*/theme.json`; `docs/v3/THEMES_KIT_HANDOVER.md:49` |
| Kit reference themes | 2: `clinic-calm`, `restaurant-hearth` | A | `themes/reference/` |
| P11 "flagship" themes | one per industry pack in `industryContent` plus `GENERAL_THEME` (**I count 30 packs in `data/industry-content.ts` (ids at lines 30 ... 581), so 31 flagships, not 29; confirm with a one-line `PACKS.length` test**) | **neither**: generated TypeScript objects (`flagshipFor(pack)`, `themes.ts:~70-85`), not zips, with `design{hero,services,gallery,type,radius,dark,order,imagery}`; no HTML or CSS files exist for them | `site-kit/themes.ts:41-110`; `packs.ts:84` |
| Engine designs | 20: `real-estate`, `retail`, plus 18 built by `engine/industries/kit/{appointments(9),hospitality(3),commerce(3),projects(3)}` | **neither**: React/TypeScript site models (`KitRenderer`), not a theme package | `get4domain_mvp/src/engine/registry.ts:3-14` |
| `theme-uploads/clinic-demo` | 1 raw-HTML demo (`index.html`, `css/styles.css`, `js/`) | neither (raw HTML, used by the raw-theme frame) | `theme-uploads/clinic-demo` |
| Old built-in design slots (`classic, bold, minimal, warm`) | 4 | neither (code); `replacesDesign` in the flat table swaps one | `schema.prisma` (ThemePackage `replacesDesign`) |

So the only package-shaped built-in themes are format A. The 29/30 flagships and 20 engine designs are code, not packages, and use none of the package spec.

## 5. Does the `themes/` kit produce A, and do the Bolt Theme Studio outputs match?

- The CLI (`themes/cli.mjs` `lint`, `pack`, `validate-package`, `starter`, `bolt-kit`) produces **A** exactly: `pack.mjs:72-74` (`templates/*.html`, `presets/*.json`, `css/<name>.css`), `:139` allow-list, `:152` required files. It cannot produce B (no `theme.css` at root, no `home.html` at root). `themes/BOLT_BRIEF.md` (generated, drift-tested) tells Bolt to deliver `library/<id>/` with `theme.json`, `templates/`, `css/base|tokens|motion|print.css`. File A's section 7 (`node cli.mjs lint|pack`) is accurate.
- The **earlier Bolt Theme Studio briefs** do not match A. `docs/v3/themes-brief/T0_THEME_KIT_AND_PREVIEW_HARNESS.md:5-10` defines a theme as `index.html` pages + a single `theme.css` + `manifest.json` + `assets/`, scoped under `.g4d-theme`, with binding attributes (`data-g4d`, `data-g4d-img`, `data-g4d-href`) and slots written as `<div data-g4d-slot="NAME">`. None of that is A (no `templates/`, `manifest.json` instead of `theme.json`, `data-g4d-slot` divs instead of `<g4d-...>` tags, binding attributes instead of `{{...}}`) and none is exactly B either (B uses `{{slot}}`, `<g4d-...>` tags, `home.html`, `theme.json`). T1B (`.../T1B_FREE_SITES_TECHNICAL_UPGRADE.md`) and T5 (`.../T5_PRO_MOTION_AND_INDUSTRY_VARIANTS.md`) are additions on top of the T0 format (CSS budgets, accessibility, motion) and inherit its mismatch. The kit authors knew: `THEMES_KIT_HANDOVER.md:119` lists the T0 -> `ThemePackage` mapping as an unbuilt "backend slice 5.4", and the T0 brief's constraints were then re-expressed in the kit's own contract (`themes/lib/vocabulary.mjs`: `SLOTS` use `<g4d-...>` tags, `V3_BINDINGS` "map a T0 brief key").
- **Practical rule:** Bolt must be given `themes/BOLT_BRIEF.md` + the Bolt kit zip (`themes/cli.mjs bolt-kit`, 163 files), not T0/T1B/T5 and not file B. File B's own statement "give this file to a design tool such as Bolt" would produce zips that the V3 marketplace route refuses.

## 6. Data slots and platform slots, one table

Sources: A = `themes/lib/vocabulary.mjs` (`BINDINGS` :35, `REPEATERS` :70, `SLOTS` :84, `DATA_ATTRIBUTES` :77). B = `backend-api/src/themes/core/theme-contract.json` (`slots`, `repeaters`, `itemSlots`, `tags`, `dataAttributes`), identical in w2 and pub (byte-compared) and in `get4domain_mvp/src/engine/themepack/`. File B's text is a copy of the flat contract. "Both" means in both; "A only" means A allows it and B refuses it.

| Group | Names | Supported by |
|---|---|---|
| Scalar slots (38) | `site.name site.tagline site.logo site.favicon site.year site.url`, `hero.title hero.subtitle hero.image hero.cta`, `about.title about.text about.image`, `contact.phone contact.phoneHref contact.whatsapp contact.email contact.address contact.mapUrl`, `hours`, `social.instagram facebook youtube linkedin x whatsapp maps custom customLabel`, `page.title page.body page.slug`, `terms.team teamOne items itemOne groups`, `cta.label` | **Both** |
| Scalar slots added by A | `site.established site.registrationNo site.logoAlt`, `hero.imageAlt about.imageAlt hero.badge`, `cta.href cta.secondaryLabel cta.secondaryHref`, `contact.city area pin whatsappHref`, `social.pinterest telegram whatsappChannel`, `page.intro` | **A only** |
| Platform wording | `ui.skip call whatsapp directions menu readMore viewAll home about gallery contact closeImage faq process why hours orderOnWhatsApp shippingNote` (English and Tamil) | **A only** |
| Plan conditions | `entitlements.video cart booking customDomain` (usable in `data-g4d-if`) | **A only** |
| Lists (10) | `items groups team testimonials faqs gallery steps trust stats pages` | **Both** |
| Lists added by A | `areas credentials blocks products offers` (+ nested `block.items`, `group.items`) | **A only** |
| Loop helpers | `n featured shown initial` (and `caption` on gallery) | **A only** (B documents none) |
| Item fields | `id name description price image duration badge href category tags includes location area bedrooms slug` (15) | **Both** |
| Item field `veg` | A's `ITEM_FIELDS` has `veg` (`vocabulary.mjs:36`); B's contract has 15 and no `veg`, yet B's spec text (line 71) lists it | **A only** (B spec text is wrong) |
| Data attributes | `data-g4d-each data-g4d-as data-g4d-if data-g4d-if-not data-g4d-open data-g4d-quickview data-g4d-item` | **Both** |
| Data attributes added by A | `data-g4d-section data-g4d-label data-g4d-optional` (vendor can hide or reorder sections) | **A only** |
| Platform tags, as-built (9) | `g4d-action g4d-header-nav g4d-bottom-nav g4d-footer g4d-social g4d-hours g4d-map g4d-tabs g4d-cart` | **Both** |
| Platform tags added by A (11) | `g4d-enquiry-form g4d-whatsapp-float g4d-reviews g4d-video g4d-booking g4d-product-grid g4d-search g4d-claim-banner g4d-listed-on-badge g4d-open-now g4d-share-qr` | **A only** |
| Required tags | B: `g4d-header-nav g4d-footer g4d-bottom-nav g4d-action` (engine adds them if missing, B spec :72). A: 12 required (`REQUIRED_SLOTS_ALL` :112) incl. enquiry-form, whatsapp-float, map, reviews, open-now, share-qr, listed-on-badge | **differs** |
| Design tokens | A: `--g4d-primary primary-contrast accent bg surface text muted border radius font-heading font-body` + motion `speed ease distance`, in `css/tokens.css`. B: `colors{bg fg muted accent accentFg}` + free `cssVars`; no `--g4d-primary/text` contract | **differs** |
| Page templates (13) | `home about services gallery contact page item menu packages properties courses doctors portfolio` | **Both** |
| Languages | English and Tamil strings in A (`ui.*`); none in B | **A only** |
| Interactivity / scripts | none in either (no `<script>`, forms stripped in B; A also refuses inline events and outside requests) | **Both** |
| Limits | A: 5 MB, 400 files, 1 MB/file, base.css <= 40 KB, motion.css <= 6 KB, HTML page <= 100 KB (`LIMITS` :143-151). B: 5 MB, 400 files, 40 pages, HTML and CSS <= 400 KB each (`theme-contract.json` limits) | **differs** |
| Fields in file B's text only | `pack`, `track`, `freeMode`, `targets` | **nowhere in code except the pub front end** (see 3) |

Gaps this exposes in B vs A: B has no enquiry form, booking, reviews, video, search, open-now, QR or WhatsApp-float slot, so the "Free = listing with no call to action" rule (A section 4, last bullet of slots) cannot be enforced on a B theme; B's `freeMode` is a self-declaration with nothing to check it.

## 7. Recommendation: one canonical format

**Canonical: A, the kit format** (`theme.json` + `templates/` + `css/{base,tokens,motion,print}.css` + `presets/` + `assets/`, with the optional `marketplace` block).

Why A:
1. It is the only one with machinery behind it: CLI lint (40 rules x every template x every category), pack with content hash, JSON schema generated from code and test-checked, in-memory zip validation, a Bolt kit and brief, a preview harness, five shipped themes, and the build-time renderer the V3 publish pipeline already draws every site with (P-1). B has a sanitiser only.
2. The marketplace store (`g4d_theme_market_packages`), lifecycle (DRAFT/REVIEW/PUBLISHED/ARCHIVED), private-to-one-vendor themes, theme switch fee and preview route (`v3-theme-switch`, `v3-theme-market`) are all built on A, and the TM2 admin and vendor screens in `get4domain-ui` are written for A.
3. A is a superset of B's slots (section 6). Everything B can express, A can; the reverse is false.
4. A enforces plan gating through slots and `entitlements`, which B's `freeMode` only claims.

What P11 (B) contributes that A lacks, to keep: **category targeting with `main` / `category` / `sub` levels and the deterministic tie-break** (`resolver.ts:41-53`: vendor's choice, else default, else lowest id) and the **target validator** (`themes.ts:117`). Carry these into A as `marketplace.targets` (same shape), but see the open point on taxonomy below. Drop `pack`, `track`, `freeMode` as new fields: A already has `marketplace.packs`, `tracks`, and `tier`, and free mode is the plan entitlement.

### What has to change

**In the spec files (docs only, about 0.5 day)**
- `get4domain-pub/docs/v3/THEME_PACKAGE_SPEC.md`: replace with a pointer to A (or delete), keeping only the targets section rewritten as `marketplace.targets`, marked "not built". Remove the claim that the "admin upload accepts it" and the statement that Bolt can be given it.
- `get4domain-w2/docs/v3/THEME_PACKAGE_SPEC.md`: change line 3 to say there is a **legacy flat format** (`g4d_theme_packages`, `POST /admin/themes/import`) that is frozen and being retired, and add a "legacy" section pointing at the conversion plan below. Add the 3 render paths (section 3 here) to its lifecycle section.
- Mark `docs/v3/themes-brief/T0/T1B/T5` superseded by `themes/BOLT_BRIEF.md`.

**In code**
| # | Change | Effort |
|---|---|---|
| 1 | Make the new admin screen real: either add a thin `v3/admin/themes` facade over `ThemeMarketService`, or (cleaner) repoint `themelib/client.ts` to `v3/admin/theme-market/*`. Reconcile `review APPROVE/REJECT` (-> `submit` / `return` / `publish`), `assign` (-> upload with `vendorId`), the `APPROVED` status word and the answer shapes. Update `admin-matrix.ts` routes and tests. | 2 to 3 days (UI + backend + tests) |
| 2 | Freeze the flat route: keep `POST /admin/themes/import` read-only behind a flag, point the legacy `ThemesAdmin` import button at a message, and stop uploads of new B packages. | 0.5 day |
| 3 | Decide and build the fate of existing flat rows (`g4d_theme_packages` has paid `ThemeEntitlement`/purchase rows keyed by theme key). Either keep them rendering through P-2 until expiry (no code, but P-2 stays in the Next route), or write a converter B -> A (`pages` -> `templates/`, `theme.css` -> `css/base.css` + `tokens.css`, `colors/cssVars` -> `tokens.css`, `families` -> kit families, `categories` -> kit ids) and migrate entitlements to the new key. **Row count and paid-licence count are unknown to me (no database access); get them first.** | 0 days if kept until expiry; 3 to 4 days for a converter and entitlement migration |
| 4 | Add `marketplace.targets` to the schema (`themes/lib/schema-build.mjs`, regenerate `schema/theme.schema.json`), `theme-package-core.ts`, and the resolver (`site-build.service.ts` `resolved.themeId`); port `validateTargets` and `pickCandidate`. **Do this against the E1 taxonomy** (45 families, 1,213 categories, on this branch `v3-lane-e1`, `docs/v3` and migration `674a572`), not against P11's 30 main categories, or targeting will be done twice. | 2 days after E1 is settled |
| 5 | Turn the P11 flagships into A. The 30 (+1) code-defined flagships and their `design` knobs cannot be uploaded. Generate them as kit library themes with the existing generator (`themes/lib/build-themes.mjs`, `starter-build.mjs`, `themes/starter/recipes.json`), one per family, then retire `site-kit/themes.ts` `FLAGSHIPS` as a render path. This also removes P-3. It is the largest item and needs design review of 30 outputs. | 5 to 8 days |
| 6 | Branch merge: bring pub's `site-kit` front end and w2's publish pipeline to one branch, with `SiteApp` (the P11 mobile shell with PWA install) either mapped onto kit slots or left as the shell around the kit output. Not estimated here: it depends on how much of P11's shell is kept. | needs its own plan |
| 7 | Tests: a contract test that every library theme is A; a test that the legacy route refuses an A zip and the market route refuses a B zip with a clear message naming the other route (cheap, prevents the next mix-up). | 0.5 day |

**Effort in days**
- Spec reconciliation only (items in "spec files" + 7): **1 day**.
- Minimum for one working admin-to-renderer path on A (1, 2, 4, 7, B rows left to expire): **about 5 to 6 days**.
- Full single-format end state (adds 3 as a converter, and 5): **about 13 to 18 days**, excluding item 6.

### Open points that need an owner decision (not decided here)
1. Are there live paid B themes? (Row counts in `g4d_theme_packages` with `status = 'LIVE'` and active `ThemeEntitlement` rows.) This sets item 3.
2. Should `targets` wait for E1 taxonomy? Recommended yes.
3. Does the P11 front-end shell (`SiteApp`, bottom navigation, install button) survive, or is the kit renderer the only look? This sets item 6.
4. The flagship count: 29 in the spec and the brief, 30 packs (31 with the default) in `industry-content.ts`. One of them is stale.

### Evidence index
- Admin UI route: `get4domain-ui/packages/api/src/themelib/client.ts:102-126`; `apps/admin/src/pages/themes/UploadDialog.tsx:44,53`; `packages/api/src/admin-matrix.ts:221-231`; `docs/FRONTEND_GAPS.md:5,18`.
- Backend routes: `get4domain-w2/backend-api/src/themes/themes.controllers.ts:26,33`; `.../v3-theme-market/api/theme-market.controllers.ts:53,57,62`.
- Validators: `.../themes/core/sanitise.ts:115,156,185,193,210`; `.../themes/themes-admin.service.ts:30-40`; `themes/lib/pack.mjs:72,139,152`; `.../v3-theme-market/theme-market.service.ts:5,50,71`.
- Renderers: `.../site-publish/publish/site-build.service.ts:86-98`; `.../site-publish/renderer/theme-render.service.ts:9-11,53`; `get4domain-pub/get4domain_mvp/src/app/site/[subdomain]/[[...rest]]/page.tsx:104,169,219`; `.../engine/themepack/package-fetch.ts:7`; `.../lib/v3-public/site-kit/resolver.ts:41-53,87`; `.../site-kit/themes.ts:30-47,110,117`.
- Tables: `get4domain-w2/backend-api/prisma/schema.prisma` `ThemePackage` (:446) and `V3ThemeMarketPackage` (:8368).
- Built-ins: `themes/library/*/theme.json`; `get4domain_mvp/src/engine/registry.ts:3-14`; `get4domain-pub/get4domain_mvp/src/data/industry-content.ts`.
- Bolt: `themes/BOLT_BRIEF.md`; `docs/v3/themes-brief/T0_*.md:5-10`; `docs/v3/THEMES_KIT_HANDOVER.md:119`.
