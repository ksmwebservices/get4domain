# Driving school pack: end-to-end readiness (read only, 21 Nov 2026)

Question: can our team (admin dashboard) and a vendor (vendor dashboard) create and edit a driving school website with the kit theme `road-sign-driving`, and publish it on `<name>.get4domain.com`?

**Short answer: not yet end to end.** The backend can create the vendor and its site, and a vendor can edit plain text, publish and roll back. Four things stop the road-sign theme from showing a real driving school: the theme cannot be assigned from the admin screen, most of the theme's lists are never filled from a vendor's data, the vendor and admin screens have no editors for those lists, and the wildcard still points at V2.

## How this was checked

- Static read only. Nothing was run: no server, no database, no staging, no tests. No `.env` file was read. Only this file was written.
- Branches read: `get4domain-w2` `v3-lane-e1` (HEAD `d74c9c0`), `get4domain-ui` `v3-ui-s17` (vendor and admin apps), `get4domain-pub` `v3-pub-a1` (only through `docs/v3/WEBSITE_ENGINE_AUDIT.md` and `docs/v3/THEME_SPEC_RECONCILIATION.md`, both already on w2; the pub public-site claims in step 8 come from those two files, not from a fresh read).
- Status words: **PROVEN** = the code exists and a spec file in the repo asserts it (a unit spec counts; "int" specs written for staging do not, because nobody has run them). **PARTIAL** = some of it exists, the line says what is missing. **NOT BUILT** = nothing found under any name.
- Paths are relative to `get4domain-w2` unless they start with `get4domain-ui` or `themes/`. "UI" = `get4domain-ui`.
- The live database was not checked, so "seeded" below means "the seed file has it".

## Scorecard (68 rows)

| Step | PROVEN | PARTIAL | NOT BUILT |
|---|---:|---:|---:|
| 1 Category | 2 | 2 | 3 |
| 2 Admin creates a vendor and site | 4 | 2 | 0 |
| 3 Vendor dashboard | 4 | 7 | 4 |
| 4 Admin edits for a vendor | 3 | 0 | 2 |
| 5 Theme choice and assignment | 4 | 1 | 2 |
| 6 Data feed to the kit theme | 9 | 3 | 4 |
| 7 Default or sample content | 1 | 3 | 1 |
| 8 Publish path | 4 | 2 | 1 |
| **Total** | **31** | **20** | **17** |

---

## 1. Category

There are three different ids for "driving school", and they are not joined.

| Id | Where | Family | Pack |
|---|---|---|---|
| `driving-school` | V3 master `backend-api/prisma/seed/pack-engine/CATEGORY_MASTER_V3_ADMIN_REGISTRATION.csv:138`; directory list `backend-api/src/directory/core/catalogue-categories.ts:142` | "Education and training" | `EDUCATION`, minimum tier Professional (999), optional capability `VEHICLE_RENTAL`, add-on `SHOP`, one starter service ("Driving School"), field hints "Licence categories; batch timings; course fees; instructor profiles; training duration; vehicle types" |
| `driving-schools` | E1 taxonomy `backend-api/data/category-master-45.json:1591` (name), `:5714` (family `automobiles-and-two-wheelers`), `:5990` (family `education-and-training`) | two families (stored once, linked twice) | planned pack key = family slug in upper case (`AUTOMOBILES_AND_TWO_WHEELERS`, `EDUCATION_AND_TRAINING`), a record only, no foreign key (`docs/v3/E1_TAXONOMY.md:9`) |
| `coaching-centre` | kit `themes/lib/categories.mjs:45`, kit family `education` | `education` | kit pack `coaching` (`themes/data/category-map.json:147`) |

Links between them: the alias file maps legacy `driving-school` to `driving-schools` (`backend-api/data/category-master-45-aliases.json:91`), and the related file says driving schools sit under automobiles and education (`category-master-45-related.json:88`). Nothing in the code reads the E1 tables when a vendor registers or a site is built (`backend-api/src/v3-taxonomy/` holds only the loader, store and core; no other module imports it).

The kit has **no driving school category**. A driving school site is built from the kit category of its pack: `PACK_KIT_FALLBACK.EDUCATION = 'coaching-centre'` (`backend-api/src/directory/core/listable-categories.ts:15-17`, resolved by `kitCategoryFor` at `:28-34`, called from `categoryFor` in `backend-api/src/site-publish/content/content-adapter.ts:36-42`). So `road-sign-driving` (which lists `coaching-centre`) is the right kit category today, but its blocks are the coaching blocks (courses, fees, results, faculty, batches), not driving blocks.

| # | Item | Status | Evidence and what is missing |
|---|---|---|---|
| 1.1 | A driving school category in the V3 master and seed | PROVEN | CSV `:138`, `catalogue-categories.ts:142`; unit spec `backend-api/test/b2-admin-vendor-site.spec.ts:24-28` finds "Driving school" with family and sub category |
| 1.2 | In the E1 taxonomy (45 families) | PARTIAL | `category-master-45.json:1591,5714,5990`, additive migration `20270110100000_v3_e1_taxonomy`; loader is dry-run by default and nothing consumes the tables. The E1 key is plural (`driving-schools`) and the V3 key is singular (`driving-school`); only the alias file joins them |
| 1.3 | A kit category and design for it | NOT BUILT | not in `themes/lib/categories.mjs` (41 ids); falls back to `coaching-centre` |
| 1.4 | One consistent id, family and V3 pack key | PARTIAL | V3 pack `EDUCATION`, V3 family "Education and training", E1 families two, kit family `education`. A decision is needed on which id is canonical and on the multi-family rule (`g4d_pack_categories.family` holds one string, so the second E1 family cannot be stored on the V3 row) |
| 1.5 | A vendor can register under it (database and API) | PROVEN | `POST /v3/me/pack/register` (`backend-api/src/v3-packs/api/pack.controllers.ts:51`, `pack-engine.service.ts:214`) sets the pack, starter services and capabilities; `POST /auth/register` takes `industry` as a plain string (`backend-api/src/auth/dto/register.dto.ts:26`, `auth.controller.ts:26`). The live table `g4d_pack_categories` (model at `schema.prisma:7495`) is filled by `scripts/seed-v3-pack-engine.js`; I could not check that it was run |
| 1.6 | Public signup page offers it | NOT BUILT | the page is the old Next app `get4domain_mvp/src/app/register/page.tsx:10,64` and its list `get4domain_mvp/src/data/industries-list.ts` has 20 broad industries (Education, Coaching, Automobile ...), no driving school. `get4domain-ui` has no signup page (apps/vendor pages: Claim, Login only) |
| 1.7 | Vendor app lets an owner pick or change the category | NOT BUILT | no call to `pack/register` anywhere in `get4domain-ui/apps/vendor` or `packages/api` (searched); the Packs screen reads `me/pack` only |

---

## 2. Admin creates a vendor with a site for this category

| # | Item | Status | Evidence and what is missing |
|---|---|---|---|
| 2.1 | Category picker for staff | PROVEN | `GET /v3/admin/categories/tree` (`backend-api/src/v3-admin-vendor-site/admin-vendor-site.controller.ts:16`); search by name finds "Driving school" (spec above); UI call `get4domain-ui/packages/api/src/sites/client.ts:28` |
| 2.2 | Create vendor, Free plan and live trial site | PROVEN | `POST /v3/admin/vendor-sites` (`admin-vendor-site.controller.ts:20`, `admin-vendor-site.service.ts:42-56`): duplicate check, vendor row with `source STAFF`, address, then `createMySite` (`plans/registration/registration.hook.ts:55`). Roles SUPER_ADMIN, OPERATIONS, SALES. Spec `backend-api/test/b2-admin-vendor-site.spec.ts:48-72` |
| 2.3 | Admin screen | PROVEN | `get4domain-ui/apps/admin/src/pages/onbehalf/CreateForm.tsx` posts through `sites/client.ts:47`; screen test `OnBehalfPage.test.tsx` |
| 2.4 | Bulk create businesses with sites | PARTIAL | `BulkImport.tsx` and `POST /v3/admin/seeded-sites/batches/dry-run` and `/apply` (`backend-api/src/seeded-sites/api/seeded-admin.controller.ts:53,56`) create **seeded Free listings** (a public page for a business that has not signed up, later claimed). They create no vendor account and no login. A CSV that creates real vendors with sites does not exist |
| 2.5 | Credential delivery | PARTIAL | the owner gets a welcome e-mail with the login address and a random password in plain text (`backend-api/src/email/email.service.ts:68-82`, called from `vendors/vendors.service.ts:90`); the admin response never returns the password (`admin-vendor-site.service.ts:47` comment). No reset link or one-time code in that mail. If the mail provider is not configured, `send` throws (`email.service.ts:222`) and `vendors.service.ts:92` only logs it, so the vendor is created and nobody is told |
| 2.6 | Site exists straight after create | PROVEN | `createMySite` returns the site answer and `siteUrl` (`admin-vendor-site.service.ts:54-55`); trial site built from the pack (`backend-api/src/v3-trial/module-trial-site.ts:22`) |

---

## 3. Vendor dashboard for the EDUCATION pack

Vendor tabs are the 24 common tabs plus the pack's own: for EDUCATION that is Courses, Batches, Admissions, Fees, Attendance, Results (`docs/v3/WEBSITE_ENGINE_AUDIT.md` section B; field sets in `backend-api/src/v3-pack-records/seed/tab-field-seed.ts:81-85`). **Those six are private business records** (`g4d_pack_records`), not website content. The public website is edited in the Website tab (`get4domain-ui/apps/vendor/src/pages/grow/website/`).

What the site editor can change is fixed by two tables in `backend-api/src/v3-website/core/managed-doc.ts`: `FIELD_DEFS` (`:27-48`, 21 text, link and image fields) and `LIST_DEFS` (`:54-62`, 8 lists).

| What the owner asked | In the editor today | Evidence |
|---|---|---|
| Business name | **no** site field | not in `FIELD_DEFS`; the site reads `cms.businessName` or the vendor's name (`content-adapter.ts:83`) |
| Tagline, About text | yes | `managed-doc.ts:28,35` |
| Logo | API only | `PUT /v3/me/site/draft/brand` (`website.controllers.ts:59`); the vendor app never calls it |
| Favicon | **no** | the adapter reads `cms.favicon` (`content-adapter.ts:110`) but no field or upload writes it |
| Hero title, sub title, announcement, image, image description | yes (text boxes) | `managed-doc.ts:29-33`; image is a text field, not a picker |
| Banners | API only | `POST /v3/me/site/banner` selects from the banner library (`media.controllers.ts:55`); not called by the vendor app |
| Courses or services with price | yes, from Offerings | the adapter builds items from the vendor's products (`content-adapter.ts:94-97`); `VendorProduct` (`schema.prisma:521`) has name, description, price, image, category |
| Course duration, badge, area | **no** | `VendorProduct` has no duration column; the adapter sets `duration:''`, `badge:''`, `area:''` (`content-adapter.ts:96`) |
| Batch timings | **no** | no list for it; `blocks: []` (`content-adapter.ts:127`) |
| RTO or related services | **no** | the adapter has no `offers` key at all (`content-adapter.ts:108-131`) |
| FAQs, gallery, steps, trust points, stats, team, credentials, extra pages | API yes, screen no | `PUT /v3/me/site/draft/list/:name` (`website.controllers.ts:47`); the vendor app calls none of the list, brand, sections, location, navigation or restore routes (searched `get4domain-ui/apps/vendor/src` and `packages/api/src`) |
| Service areas | **no** | `areas: []` (`content-adapter.ts:127`); no list definition |
| Contact: phone, e-mail, WhatsApp, address | yes | `managed-doc.ts:37-40` |
| Location with map link and city | API only | `PUT /v3/me/site/draft/location` (`website.controllers.ts:89`) |
| Hours | service only | `website.service.ts:43,210` handles `hours`, but no controller route exposes it and the editor map lists `hours:free-text-only` as a gap (`editor-map.ts:24`) |
| Social links | yes | `managed-doc.ts:41-46` (Instagram, Facebook, YouTube, LinkedIn, X, one custom link). The kit's Pinterest and Telegram bindings have no field |
| SEO title and description per page | yes | `PUT /v3/me/site/draft/seo/:pageKey` (`website.controllers.ts:75`), screen `MediaPanels.tsx:139` (SeoPanel) |

**Image upload.** `POST /v3/me/media` (`backend-api/src/v3-media-upload/api/media-upload.controllers.ts:46`): JPEG, PNG, WebP, SVG and PDF, detected by their bytes (`core/media-upload-core.ts:11`); an SVG with anything that can run is refused (`:43`). Size and pixel caps and the allowed types are **staff settings that start empty**, and an upload is refused with `UPLOAD_NOT_CONFIGURED` until staff set them (`media-upload-core.ts:31,37`). Storage is the Cloudflare R2 adapter, which answers `STORAGE_NOT_CONFIGURED` until its keys and settings exist (`media-upload.module.ts:15`). The vendor Gallery panel uploads into the business's media library with a required description (`MediaPanels.tsx:25-50`); it does not add the picture to the site's gallery list, and there is no picker to put an uploaded picture into the logo, banner or hero field.

**Draft, publish, rollback.** All present: autosave draft, preview, discard (`website.controllers.ts:37-121`), publish (`:124`, owner only; Pro goes live, Free is sent for staff review, `backend-api/src/v3-website/review/review.service.ts:48-50`), revisions, compare and restore as a new version (`:136-149`).

| # | Item | Status |
|---|---|---|
| 3.1 | Pack tabs for EDUCATION | PROVEN |
| 3.2 | Business name | PARTIAL (not in the site editor; a vendor-profile edit was not checked) |
| 3.3 | Tagline, about, hero text, contact, social links (text boxes) | PROVEN |
| 3.4 | Logo | PARTIAL (API only) |
| 3.5 | Favicon | NOT BUILT |
| 3.6 | Hero image and banners | PARTIAL (text field and API; no picker or upload into the field) |
| 3.7 | Courses with price and duration | PARTIAL (price yes; duration has nowhere to be stored) |
| 3.8 | Batch timings | NOT BUILT |
| 3.9 | RTO or related services | NOT BUILT |
| 3.10 | FAQs, gallery, steps, trust, stats, team, credentials lists | PARTIAL (API yes, vendor screen no) |
| 3.11 | Service areas | NOT BUILT |
| 3.12 | Location and hours | PARTIAL (location API yes; hours no route) |
| 3.13 | SEO fields | PROVEN |
| 3.14 | Image upload (storage, limits, formats) | PARTIAL (built, off until configured; not connected to the fields) |
| 3.15 | Draft, publish, rollback | PROVEN |

**Can a vendor edit logo, banner and courses today? No.** Evidence: logo is `draft/brand` and banner is `site/banner`, and neither route is called from the vendor app (no match in `get4domain-ui/apps/vendor/src` or `packages/api/src`); the Content panel saves plain text values only through `saveField` (`website-data.ts:192`, `WebsiteScreen.tsx:193-200`); courses come from Offerings (a separate screen) and carry no duration.

---

## 4. Admin edits the same on behalf of a vendor

Not the same screen. The admin app has `vendorsite` (a read view of the site, `get4domain-ui/apps/admin/src/pages/vendorsite/VendorSitePage.tsx`) and `onbehalf` (create business, bulk import, claim tracking, pictures, profile fields for seeded listings). Neither edits site text or lists.

What exists on the backend for staff acting on a vendor: a session (`POST /v3/admin/vendors/:id/act-on-behalf`, `backend-api/src/v3-website/api/act-on-behalf.controllers.ts:34`, reason required, vendor is told) and an interceptor that accepts the session header only on `/v3/admin/vendors/:id/...` routes and refuses payment, bank, UPI and password changes (`act-on-behalf.interceptor.ts:30-46`). The site routes under that prefix are only: theme, build, publish, rollback, noindex, preview (`site-publish/api/sites-admin.controller.ts:45-77`), banner and media (`v3-website/api/media.controllers.ts:78-90`) and read-only views of testimonials, review link, location and SEO (`seo.controllers.ts:29-41`). There is no staff version of `draft/field`, `draft/list`, `draft/brand`, `draft/sections` or `draft/location`.

| # | Item | Status |
|---|---|---|
| 4.1 | Same screen as the vendor | NOT BUILT |
| 4.2 | Staff session with reason, audit and vendor notice | PROVEN |
| 4.3 | Staff routes that write text, lists, brand, sections, location | NOT BUILT |
| 4.4 | Staff upload and banner pick for a vendor | PROVEN (backend; no admin screen found for it) |
| 4.5 | Staff theme, build, publish, rollback for a vendor | PROVEN (backend; the admin `vendorsite` screen shows state) |

---

## 5. Theme: how it is chosen, and what blocks assigning the kit theme

How it works today:
- A site is built with `resolveTheme` (`backend-api/src/site-publish/content/theme-resolution.ts:27-48`). Without a stored choice it uses `defaultThemeFor(categoryId)`, which is the first **library** theme whose manifest lists the kit category (`site-publish/renderer/theme-render.service.ts:147-150`); a marketplace theme is never a default (`:29`). For driving schools that default is `free-studio` (its preset exists for `coaching-centre`, `themes/library/free-studio/presets/coaching-centre.json`).
- Any other theme needs the plan feature `site.themes = library` (a Pro entitlement) and the theme's `tracks` must include the vendor's track (`theme-resolution.ts:38-46`). `road-sign-driving` lists `professional`, and driving school's minimum tier is Professional, so that check passes.
- The vendor picks with `PUT /v3/me/site/theme` (`site-publish/api/me-site.controller.ts:50`); staff pick for a vendor with `PUT /v3/admin/vendors/:id/site/theme` (`sites-admin.controller.ts:45`).
- Kit zips go in through `POST /v3/admin/theme-market/themes` (`backend-api/src/v3-theme-market/api/theme-market.controllers.ts:62`). Without `vendorId` the theme is for the marketplace; with `vendorId` it is PRIVATE to that one business (`theme-market.service.ts:79-101`). Lifecycle: submit, return, publish, publish-to-marketplace, archive (`:77-90`).

What blocks it:
1. **Upload route 404 from the admin screen.** The admin app calls `/v3/admin/themes/validate`, `/upload`, `/:id/review`, `/:id/assign` (`get4domain-ui/packages/api/src/themelib/client.ts:109,115,119,123`). No controller in `get4domain-w2` or `get4domain-pub` serves `v3/admin/themes` (searched both `backend-api/src`); the real route is `v3/admin/theme-market`. The routes are declared "ASSUMED" in `get4domain-ui/packages/api/src/admin-matrix.ts:221`. The status word `APPROVED` and the actions `review` and `assign` also differ from the backend (`submit`, `return`, `publish`; private theme by `vendorId` at upload).
2. **Targets are not stored.** There is no field or table that says "this theme is for this category" (`V3ThemeMarketPackage`, `schema.prisma:8368`, has packs, add-ons, capabilities, tags and a private vendor, no targets), and `defaultThemeFor` ignores marketplace themes. Only a library theme can be a category default, so the road-sign theme cannot become the default for driving schools without being copied into `themes/library/` and shipped with a release.
3. **Two upload formats.** The old Next admin (`get4domain_mvp/src/themes-admin`, `POST /admin/themes/import`) accepts a different, flat format; a kit zip is refused there and a flat zip is refused by theme-market (`docs/v3/THEME_SPEC_RECONCILIATION.md` sections 1 and 2).

| # | Item | Status |
|---|---|---|
| 5.1 | Library default theme per kit category | PROVEN |
| 5.2 | Kit zip upload, review, publish on the backend | PROVEN |
| 5.3 | Admin screen can upload | NOT BUILT (calls a route that does not exist) |
| 5.4 | Assign the uploaded theme to one vendor | PARTIAL (backend: private upload and staff theme pick; no working admin button) |
| 5.5 | Assign the uploaded theme to a category | NOT BUILT (no targets) |
| 5.6 | Vendor chooses a theme | PROVEN (Pro only) |
| 5.7 | A driving school reaches the theme's category | PROVEN (via `coaching-centre`) |

---

## 6. Data feed: what the site builder fills from a vendor's data

Source: `toRendererInput` in `backend-api/src/site-publish/content/content-adapter.ts:78-134`, the vendor overlay `applyToSource` in `v3-website/core/managed-doc.ts:310-340`. Road-sign sections that depend on each list are from `themes` copy `road-sign-driving-school-lint/templates/home.html`.

| Kit list or field | Filled from | Road-sign section it feeds | Status |
|---|---|---|---|
| `items` | the vendor's Offerings (`:94-98`); name, description, price, image, category only | Courses | PARTIAL (duration, badge, area always empty) |
| `groups` | nothing, `groups: []` (`:121`) | Vehicle quick-pick | NOT BUILT, section never draws |
| `steps` | vendor list `steps` (`:124`) | How it works | PROVEN |
| `blocks` | nothing, `blocks: []` (`:127`) | Slot timings and fees | NOT BUILT, section never draws |
| `offers` | not set at all | RTO and related services | NOT BUILT, section never draws |
| `faqs` | vendor list `faqs` (`:100,123`) | FAQ | PROVEN |
| `areas` | nothing, `areas: []` (`:127`) | Areas we serve | NOT BUILT, section never draws |
| `trust` | vendor list `trust` (`:125`) | hero facts | PROVEN |
| `gallery` | vendor list `gallery` (`:99,123`) | Gallery | PROVEN |
| `team` | vendor list `team` (`:121`) | About page | PROVEN |
| `stats` | vendor list `stats` (`:126`) | Numbers | PROVEN |
| `credentials` | vendor list `credentials` (`:127`) | About page | PROVEN |
| `hero.*` | headline, sub line, announcement, banner, alt (`:111`); title falls back to tagline then name; `hero.cta` is `''` | Hero | PROVEN |
| `about.*` | text and image (`:112`); the title is generated from the kit wording, there is no title field | About | PARTIAL |
| `contact.*` | phone, WhatsApp, e-mail, address, city and pincode from location, map link (`:113-116`); `contact.area` is `''` | Contact | PROVEN |
| `hours` | saved hours (`:117`) | Contact | PARTIAL (nothing in the editor writes them) |

`page.intro`, `cta.secondaryLabel`, `site.established` and `site.registrationNo` are also never set (`:119`, `:110`); a theme that binds them gets empty values.

---

## 7. Default or sample content

| # | Item | Status | Evidence |
|---|---|---|---|
| 7.1 | Kit preset for driving schools | PARTIAL | only `themes/library/free-studio/presets/coaching-centre.json` (palette, fonts, hero pattern, starter services and FAQs); `road-sign-driving` has no `presets/` folder and the kit has no driving category |
| 7.2 | Starter services for the category | PARTIAL | one name, "Driving School" (CSV `:138`); no course list, no prices, no licence classes |
| 7.3 | Pack demo set | PARTIAL | `backend-api/src/v3-packs/pack-demo/pack-demo-content.json` has an EDUCATION set ("Arivu Coaching Academy", kit category `coaching-centre`), typed `isSample: true` (`pack-demo/*.ts:15`); it is a coaching centre, not a driving school |
| 7.4 | How sample text is flagged | PROVEN | starter text carries a `sample` mark per field and loses it when the vendor edits (`backend-api/src/site-doc/sample-markers.ts`); sample prices and sample quotes never reach the public page |
| 7.5 | Admin-made sample data per category | NOT BUILT | no per-category generator (`docs/v3/WEBSITE_ENGINE_AUDIT.md` section 1) |

---

## 8. Publish path to `<name>.get4domain.com`

1. The vendor or staff publish; the backend stores a snapshot and publication (`site-publish/publish/publish.service.ts`, `site-build.service.ts:77-98`). Free publish goes to staff review first (`review.service.ts:48-50`); Pro goes live at once.
2. The public Next app answers `https://<name>.get4domain.com` by rewriting the host to `/site/<name>` (`get4domain_mvp/src/middleware.ts:59,81`) and asking the backend which vendor owns the host (`GET /v3/public/site/by-host`, `site-publish/api/public-site.controller.ts:18-24`).
3. **nginx needs one wildcard server block** for `*.get4domain.com` with a wildcard certificate and a wildcard DNS record through Cloudflare. No per-vendor file is needed and nothing in the backend writes nginx. **Today that wildcard serves V2, not V3**; switching it is a one-line `proxy_pass` change after every V2 client name has its own explicit block (`deploy/v3live/nginx/WILDCARD_SWITCH_LATER.md`). It is the owner's step E1c and is not done.
4. Free and Pro get the same address. They differ in review (Free), in which fields and slots show (`entitlements`), in the theme choice (Pro `library`), and in custom domains, which have no nginx block or certificate automation (`docs/v3/WEBSITE_ENGINE_AUDIT.md` M.6).

| # | Item | Status |
|---|---|---|
| 8.1 | Build and publish pipeline | PROVEN |
| 8.2 | Free review versus Pro live | PROVEN |
| 8.3 | Host to vendor resolution | PROVEN |
| 8.4 | Wildcard points at V3 | NOT BUILT (owner step E1c) |
| 8.5 | Certificate and Cloudflare mode | PARTIAL (two files disagree on Flexible versus Full strict; the owner must say which is live) |
| 8.6 | "Address is always `<name>.get4domain.com`, never a path" | PARTIAL (per the earlier audit, `get4domain.com/site/<name>` may serve a site and some links carry `/site/<name>`; from that audit, not re-read) |
| 8.7 | Subdomain choice, reservation and change limit | PROVEN |

---

## 9. Lanes, in dependency order (days for one developer)

| # | Lane | What it does | Depends on | Days |
|---|---|---|---|---|
| 1 | Category decision | Owner picks the canonical id (`driving-school` or `driving-schools`) and the multi-family rule; add a kit category (or an explicit map entry) so a driving school no longer borrows `coaching-centre`; join V3 and E1 ids; unit tests | none | 2 |
| 2 | Theme assignment | Repoint the admin themes screen to `v3/admin/theme-market` (fix statuses and actions); store `marketplace.targets`; make the resolver use a published marketplace theme as the default for a category; private theme for one vendor from the screen | 1 | 5 |
| 3 | Data feed | Add `groups`, `areas`, `blocks` (batch timings) and `offers` (RTO) as vendor lists; add duration, badge and area to Offerings and to the adapter; add a business-name field, an about title, `page.intro`; extend `LIST_DEFS` and `editor-map`; tests | 1 | 4 |
| 4 | Vendor editors | Screens for every list, logo and favicon, banner and hero picture pickers wired to `/v3/me/media` and the banner library, brand, sections, location, hours route and screen, restore | 3 | 6 |
| 5 | Admin edits for a vendor | Staff routes `/v3/admin/vendors/:id/site/draft/*` under the act-on-behalf session; admin screen that reuses the vendor editors | 4 | 4 |
| 6 | Create and deliver | CSV that creates real vendors with sites; replace the plaintext password mail with a set-password link; make a failed mail visible to staff; set media size caps, R2 keys and the mail provider | 2 | 3.5 |
| 7 | Driving school content | Kit preset and starter courses, licence classes, FAQs and steps for the category, flagged as sample; a driving pack demo set | 1, 3 | 2 |
| 8 | Signup and category pick | Add driving school to the public signup (or move signup to the V3 category list) and add a category picker to the vendor app | 1 | 2.5 |
| 9 | Publish path | Switch the wildcard to V3 (owner), explicit blocks for V2 names, close the `/site/<name>` path address, one canonical per page, confirm Cloudflare mode | 2 | 2 |
| 10 | Staging proof | Upload theme, assign, create vendor in admin, edit as vendor and as staff, publish, fetch the host; fix what breaks | 2 to 9 | 3 |
| | **Total** | | | **34 days** |

Parallel work by two developers can cut the calendar time (lanes 6, 8 and 9 do not wait on 4 and 5), but the effort stays near 34 days. Lane 9 also needs the owner's decisions and server access, which are not developer days.

## Open questions for the owner

1. Which id is canonical: `driving-school` (V3, live registration) or `driving-schools` (E1)?
2. May a driving school sit in two families (automobiles and education), and does that change the vendor's tabs?
3. Should `road-sign-driving` become the default theme for driving schools (needs lane 2), or only a Pro choice?
4. Is Cloudflare SSL mode Flexible or Full (strict) on the live zone?
5. When may the wildcard move to V3 (step E1c)?
