# Website Engine Audit (lane V1, read only)

> Date: 2026-11-20. Static audit: nothing was run (no server, no database, no staging, no tests, no `.env*` read). Only this file was created.
> Backend read from this folder `C:\Get4Domain\get4domain-w2`, branch **`v3-lane-r1`** (HEAD `22f9231`). Note: the folder name says "w2" but the branch is `v3-lane-r1`; the Wave 2 tables (profile fields, pack records) are present on it.
> Public site and kit: `C:\Get4Domain\get4domain-pub`, branch `v3-pub-fe19` (commit `dd8e1dc`), read with `git show` / `git grep`.
> Vendor app: `C:\Get4Domain\get4domain-ui`, branch `v3-ui-s17` (`725c8d0`). Admin app: same repo, branch `v3-ui-s16` (`72f6a0d`).
> Inputs read (all three files in `docs/v3/inputs/`): `REQ_CATEGORY_MASTER_45_FAMILIES.md`, `REQ_WEBSITE_ENGINE_ARCHITECTURE.md`, `V3_WEBSITE_ENGINE_DECISIONS_20NOV2026.md`. The brief names them `category_master_45.txt` and `website_engine_architecture.md`; the files on disk have the names above.
> Pack keys and entity names in the architecture file are illustrative; the real keys in the code and seeds are used here.

## Scope (owner update, 20 Nov)

No priorities and no limited families. The target is **all 45 families and all their sub categories** (1,277 listed, 1,213 unique, 61 of them in two or three families; I recounted from the input file and the numbers are exact). Every industry pack must be complete with its own tab menu and fields. Sample data for every category is created from the admin side, flagged as sample and editable. Every vendor gets: install app, mobile bottom navigation, animation, hero, several landing pages, a theme customised with the vendor name, and customised SEO, AEO and GEO. Section 14 plans the whole scope with no priority order.

Owner rule added later (20 Nov): **a vendor's public address is always `<name>.get4domain.com`, never a path.** Section M audits it, the directory keyword and location pages, canonical and sitemap rules per vendor subdomain, the footer link, how the subdomain name is chosen and locked, and how a new vendor address gets its nginx entry.

## Status words

- **BUILT AND PROVEN BY TESTS**: code exists and a test file in the repo exercises it (a unit test counts; "int" tests are written for staging and **have not been run**, so they do not count as proof here).
- **BUILT NOT PROVEN**: code exists, no test or only an unrun staging test found.
- **PARTIAL**: some of the item exists; the line says what is missing.
- **MISSING**: nothing found under any name.

Tests were not executed by me. "Proven" means "a test exists that asserts it", read from file names and titles, not from a run.

---

## 1. Headline numbers

| Thing | Input requirement | What the code has |
|---|---|---|
| Families | 45 | **21** sheet families (strings on `g4d_pack_categories.family`), no family table, none equal to the 45 names |
| Main categories | 45 (one per family) | 29 in frontend data (`get4domain_mvp/src/data/industry-content.ts`), 24 launch category packs (V2 `CategoryPack`), 196 V3 categories, 53 directory categories (12 parents) |
| Categories/sub categories | 1,277 listed, 1,213 unique | 196 V3 categories; 248 starter service names (not rows); **no sub category table** |
| Industry packs | "complete, own tabs and fields" | 16 packs, 109 tabs (incl. common and capability), 89 tab field sets, 14 capabilities; all packs `reviewStatus` DRAFT until owner approves |
| Vendor site layout families | 12 archetypes | 8 flow families (`shop booking enquiry packages menu portfolio listings courses`) |
| Sample data | per category, admin made | 16 pack demo sets (one per pack, `isSample: true`) and 24 V2 starter seeds; no per-category generator |

---

## A. Category master

### A.1 Counts in the code

| Source | Where | Count | Notes |
|---|---|---|---|
| V3 category master (the live one) | `backend-api/prisma/seed/pack-engine/CATEGORY_MASTER_V3_ADMIN_REGISTRATION.csv` → table `g4d_pack_categories` (`V3PackCategory`), migration `20261213100000_v3_pack_engine` | **196 categories**, **21 families**, 16 packs | 143 have starter services (248 names in total), **53 `needsBlueprint`**. Tier mix: Handyman 56, Professional 85, Ecommerce 55 |
| V2 launch categories | `backend-api/src/site-doc/seeds/part1-3.ts` → table `g4d_category_packs` (`CategoryPack`) | 24 | grouped into 8 layout families; separate list from the 196 |
| Frontend demo/site data | `get4domain_mvp/src/data/industry-content.ts`, `demo-site.ts` | 29 main categories (P11 report says 29; older audit said 30 ids) | `SUBCATEGORIES` hard-coded in TypeScript (about 76 curated) |
| Directory categories | `backend-api/prisma/seed/v3-directory.seed.json` → `g4d_directory_categories` | 53 (12 parents), flagged `proposed` | has a real parent tree (`parentId`), `themeCategoryId`, `family` |
| Vendor product categories | `g4d_categories` (`Category`) | per vendor | unrelated to the taxonomy despite the name |

So there are **four unrelated category lists** plus the frontend list. `docs/v3/CATEGORY_FAMILIES_AS_BUILT.md` (3 Nov) said five; the V3 list and the directory list are the additions since.

The 21 sheet families (with category counts): Home repair and trades 18, Hospitality travel and events 18, Electronics and home 15, Appliance electronics and security 15, Consulting and creative 15, Healthcare 13, Fashion and lifestyle 12, Education and training 12, Beauty and wellness 11, Food and daily needs 9, Vehicle services 8, Legal and finance 8, Cleaning pest and garden 7, Property and design 7, Hardware building and auto parts 6, Logistics and freight 6, Moving and transport 4, Other local services 4, B2B suppliers (enquiry only) 4 + 3 ("optional family" variant, a second family name for the same idea), Vehicles and dealers 1.

### A.2 Comparison with the 45 families (status: PARTIAL, far from complete)

Name-based comparison of the 1,213 unique input sub categories against every seeded category name and starter service (normalised, case and punctuation ignored): **111 of 1,213 unique (132 of 1,277 listed) match**. That is a lower bound (exact-name match only; for example "Home Appliance Repair" does not match "Appliance repair"), but it shows the order of size: about **9%** present, **about 1,100 absent**, and the existing 196 are categories of a different shape (trades and shops), not the owner's sub category list.

Per family: sub categories found by exact name / listed (my script, `cov.js`, not committed):

01 Home Services 19/39 · 02 Healthcare 3/55 · 03 Beauty 5/29 · 04 Automobiles 5/40 · 05 Education 10/52 · 06 Restaurants 7/41 · 07 Grocery 4/29 · 08 Shopping 12/46 · 09 Real Estate 5/25 · 10 Construction 9/42 · 11 Interior 2/23 · 12 Travel 4/28 · 13 Transport 5/30 · 14 Hotels 4/28 · 15 Weddings 4/32 · 16 Photography 2/32 · 17 Finance 1/31 · 18 CA 3/23 · 19 Legal 2/25 · 20 Consultants 3/24 · 21 IT 0/31 · 22 Electronics 1/28 · 23 Industrial 1/29 · 24 Agriculture 0/31 · 25 Pets 1/22 · 26 Security 2/24 · 27 Repairs 5/29 · 28 Rental 2/32 · 29 Entertainment 1/26 · 30 Sports 0/26 · 31 Astrology 2/23 · 32 Government 0/24 · 33 Recruitment 0/20 · 34 Housekeeping 1/22 · 35 Shipping 2/22 · 36 Advertising 0/30 · 37 Textiles 1/24 · 38 Wellness products 2/18 · 39 Waste 0/20 · 40 Home & Garden 1/22 · 41 Professional services 1/24 · 42 Baby and family 0/20 · 43 Medical equipment 0/15 · 44 Industrial and office 0/20 · 45 Other local 0/21.

Which of the 45 families "exist":

| Input family | Closest sheet family in code | Status |
|---|---|---|
| 01 Home Services | Home repair and trades (18) + Cleaning, pest and garden (7) | PARTIAL (two families, 25 categories; 19 of 39 names) |
| 02 Healthcare | Healthcare (13) | PARTIAL (3 of 55 sub categories by name; the pack is gated off by default) |
| 03 Beauty | Beauty and wellness (11) | PARTIAL |
| 04 Automobiles | Vehicle services (8) + Vehicles and dealers (1) | PARTIAL |
| 05 Education | Education and training (12) | PARTIAL |
| 06 Restaurants & Food | Food and daily needs (9) | PARTIAL (mixed with grocery) |
| 07 Grocery | Food and daily needs (same family) | MERGED with 06 |
| 08 Shopping & Retail | Fashion and lifestyle (12), Electronics and home (15) | SPLIT across two |
| 09 Real Estate | Property and design (7) | PARTIAL (3 categories on the PROPERTY pack) |
| 10 Construction | Hardware, building and auto parts (6), Property and design | PARTIAL |
| 11 Interior Design | Property and design | MERGED |
| 12 Travel, 14 Hotels, 15 Weddings | Hospitality, travel and events (18) | THREE families merged into one |
| 13 Transportation, 35 Shipping | Logistics and freight (6), Moving and transport (4) | PARTIAL |
| 16 Photography, 20 Consultants, 36 Advertising, 21 IT | Consulting and creative (15) | FOUR families merged into one |
| 17 Finance, 18 CA, 19 Legal | Legal and finance (8) | THREE families merged into one |
| 22 Electronics | Appliance, electronics and security (15) | PARTIAL |
| 23 Industrial, 44 Industrial/office | B2B suppliers and manufacturers (4 + 3) | PARTIAL |
| 24 Agriculture | none (one B2B category "Agricultural machinery dealer") | **MISSING** |
| 25 Pets | none | **MISSING** |
| 26 Security | inside Appliance, electronics and security | MERGED |
| 27 Repairs | Home repair and trades / Appliance | MERGED |
| 28 Rental | none as a family (RENTAL_FLEET pack, 2 categories) | MISSING as family |
| 29 Entertainment, 30 Sports & Fitness | Beauty and wellness (gym lives on MEMBERSHIP_WELLNESS) | PARTIAL / MISSING |
| 31 Astrology, 32 Government, 33 Recruitment, 34 Housekeeping, 37 Textiles, 38 Wellness products, 39 Waste, 40 Home & Garden, 41 Professional services, 42 Baby & Family, 43 Medical equipment, 45 Other local | none by name (a few land in Other local services (4), Cleaning, pest and garden, Fashion and lifestyle, B2B) | **MISSING** as families (12 families) |

Summary: no family exists with the owner's name and scope. About 20 of the 45 are missing outright or have no named home; the rest are merged or partial. The sub categories are almost entirely missing.

### A.3 Multi-family and related-only rules

- **A category in more than one family: MISSING.** `V3PackCategory.family` is a single string and `packKey` a single pack (`@@index([family])`, `packKey` not unique but one value per row; `categoryKey` unique). The 61 input sub categories that sit in 2 to 3 families have no way to be stored. A code-level hint of the same idea exists in the V2 alias maps (`demo-site.ts`, P11 `ID_ALIASES`), which map names, not relations.
- **Related-only sub category rules: MISSING.** Nothing stores "which families are related" or limits a vendor to related families. A vendor has exactly one primary pack and one category (`g4d_vendor_packs`; `POST /v3/me/pack/register` answers `PACK_ALREADY_SET` for a second, different category). The owner decision "a vendor may pick several sub categories from related families" has no field, no table and no rule. The only multi-pick that exists is `starterServices` picked at registration (up to what the category lists).
- **Admin picker**: `backend-api/src/v3-admin-vendor-site/category-tree.ts` (family → category → "subCategories" = the starter services) is the nearest thing to a sub category tree; unit-tested in `test/b2-admin-vendor-site.spec.ts`. Status: PARTIAL, read only, built from the 196.

---

## B. Packs

Source of truth: `V3Pack` (`g4d_packs`), `V3PackTab` (`g4d_pack_tabs`), `V3Capability`, `V3TierCapability`, `V3PackAddon`; loader `backend-api/scripts/seed-v3-pack-engine.js`; docs `docs/v3/V3_PACK_ENGINE.md`. Status of the engine: **BUILT AND PROVEN BY TESTS** (`pack-core`, `pack-nav-core`, `pack-engine-service`, `pack-wire`, `pack-part-b`, `pack-part-b-http`, `pack-engine-schema` specs; the staging `pack-engine.int.spec.ts` is not run). Content of the packs: **PARTIAL** (all 16 `DRAFT`, see below).

Real pack keys, vendor tabs, public site sections, tier mix of their categories (H = Handyman 499, P = Professional 999, E = Ecommerce 1,499) and the number of categories that use each:

| Pack key | Name | Vendor tabs (seed) | Public site sections (seed) | Tiers of its categories (H/P/E) | Categories | Needs blueprint | Gated |
|---|---|---|---|---|---|---|---|
| PROPERTY | Property and real estate | Listings; projects and units; site visits; owners and tenants; rent roll (5) | Listing page, project page, filters, map, enquiry per property, RERA field | 0/3/0 | 3 | 0 | no |
| CLINIC | Clinic and patient care | Patients; appointments; visit notes; prescriptions; billing; follow-ups (6) | Doctors, services, timings, book appointment, fixed health disclaimer | 0/11/0 | 11 | 4 | yes |
| LAB | Lab and diagnostics | Test catalogue; orders; sample tracking; reports (4) | Test list, packages, home collection, report status | 0/1/0 | 1 | 0 | yes |
| PHARMACY | Pharmacy and medical store | Stock with batches and expiry; prescriptions; billing; refills (4) | Catalogue, upload prescription, order request, drug-licence field | 0/0/2 | 2 | 1 | yes |
| RETAIL | Retail and ecommerce | Products; stock; cart and orders; returns; offers (5) | Shop pages, product pages, cart, checkout | 0/0/41 | 41 | 8 | no |
| FOOD_SERVICE | Food service | Menu; table or online orders; kitchen status; delivery (4) | Menu with photos, order online, table booking, catering enquiry | 0/2/4 | 6 | 0 | no |
| FIELD_SERVICE | Field services and trades | Jobs; technician dispatch; quotes; AMC contracts; service history (5) | Services and areas, request a quote, book a visit | 44/0/0 | 44 | 22 | no |
| VEHICLE_SERVICE | Vehicle services | Job cards; vehicle records; service history; reminders; parts (5) | Services, book service, pickup and drop, status check | 8/0/0 | 8 | 2 | no |
| LOGISTICS | Logistics and freight | Shipments; trips; vehicles; drivers; tracking; POD (6) | Get a quote, track shipment, services and routes | 4/6/0 | 10 | 2 | no |
| MEMBERSHIP_WELLNESS | Gym, salon and wellness | Members; plans and renewals; attendance; appointments; product sales (5) | Plans and prices, book trial, timings, trainers | 0/11/0 | 11 | 2 | no |
| EDUCATION | Education and training | Courses; batches; admissions; fees; attendance; results (6) | Courses, batches, apply online, fees, faculty | 0/12/0 | 12 | 2 | no |
| PRACTICE_LEGAL_FINANCE | Legal and finance practice | Clients; matters or files; documents; deadlines; fees (5) | Practice areas, book consultation, fixed disclaimer | 0/8/0 | 8 | 3 | yes |
| AGENCY_CONSULTING | Consulting and creative | Projects; proposals; retainers; deliverables; time (5) | Services, portfolio, book a call, testimonials | 0/16/0 | 16 | 5 | no |
| HOSPITALITY_EVENTS | Hospitality, travel and events | Packages; availability calendar; bookings; advance payments (4) | Rooms or halls, packages, gallery, check availability | 0/13/0 | 13 | 1 | no |
| RENTAL_FLEET | Rentals and fleet | Assets or vehicles; availability; per-day pricing; deposit; handover and return (5) | Fleet list, rates, check availability, book | 0/2/0 | 2 | 0 | no |
| B2B_DEALER | B2B supplier and dealer | Catalogue; quotations; bulk price tiers; vehicle or equipment listings; test drives (5) | Catalogue, request quotation, brochures, dealer locator | 0/0/8 | 8 | 1 | no |

Tab menu shape (all packs): 24 common tabs (website, industry, promotion, CRM, TeleCRM, billing, accounting, social, AI studio, domain, support, plan, migration, tasks, offerings, reviews, chat, reports, wallet, packs, team, profile, notifications, legal, account), then the pack's own tabs (4 to 6 each, above), then capability tabs (14 capabilities), then add-on tabs (4 add-on packs: SHOP, ONLINE_ORDERING_DELIVERY, PHARMACY_COUNTER, HOME_SAMPLE_COLLECTION; prices PENDING).
Free trial tabs: website, industry, support, plan, profile, notifications, legal. Locked tabs say "Open with a Pro plan" (vendor app A4.4).
Tab **fields**: `V3PackTabField` (`g4d_pack_tab_fields`), seed `backend-api/src/v3-pack-records/seed/tab-field-seed.ts`: **89 field sets**, usually 3 to 6 fields each, with a generic (title, note) set for any tab without one. Records are `V3PackRecord` (`g4d_pack_records`, soft delete, JSON data validated against the fields). Tests: `pack-records-core`, `pack-records-http`; `pack-records.int` not run. Status: **BUILT AND PROVEN BY TESTS** for the mechanism; **PARTIAL** for completeness (small honest sets, not "complete" per industry; no per-category fields except `V3CategoryProfileField`, section D).
Counsel-gated packs (hidden until `packGatedPacksOpen`): CLINIC, LAB, PHARMACY, PRACTICE_LEGAL_FINANCE. These cover families 02, 17, 18, 19 and parts of 43, so the "all 45 families complete" target needs the counsel switch decision.

Comparison with section 8 of the architecture file (illustrative keys):

| Architecture key | Real key | Status |
|---|---|---|
| CLINIC | CLINIC | exists; tabs differ (patients, appointments, visit notes, prescriptions, billing, follow-ups; architecture said "doctors, specialities" which are public sections, not vendor tabs) |
| EDUCATION | EDUCATION | exists (courses, batches, admissions, fees, attendance, results) |
| RESTAURANT | FOOD_SERVICE | renamed; no tables, reservations or kitchen "orders" beyond the seed tabs |
| ECOMMERCE | RETAIL (capability STORE; Ecommerce is a **tier**, not a pack) | different meaning |
| REAL_ESTATE | PROPERTY | renamed; only 3 categories use it |
| TRAVEL | none; folded into HOSPITALITY_EVENTS (packages, availability calendar, bookings, advance payments) | no destinations or itineraries |
| LOGISTICS | LOGISTICS | exists (shipments, trips, vehicles, drivers, tracking, POD) |
| AGENCY_CONSULTING | AGENCY_CONSULTING | exists |
| B2B_DEALER | B2B_DEALER | exists |
| MEMBERSHIP_WELLNESS | MEMBERSHIP_WELLNESS | exists |
| FIELD_SERVICE | FIELD_SERVICE | exists (jobs, technician dispatch, quotes, AMC, service history) = the architecture's list |
| (none) | LAB, PHARMACY, VEHICLE_SERVICE, RENTAL_FLEET, PRACTICE_LEGAL_FINANCE | real packs the architecture file did not list |

Pack gaps for "complete with its own tab menu and fields" across 45 families: a pack per family does not exist (16 packs serve 196 categories); families such as Agriculture, Pets, Security, Government, Recruitment, Astrology, Waste, Baby and Family have **no pack-specific tab menu** and would fall onto the nearest of the 16 (for example FIELD_SERVICE has 44 categories, 22 of them `needsBlueprint`). The decision "every pack complete" needs the owner to say whether the 16 stay (and 45 families map onto them) or packs are added.

Packs in the public kit (P11, `get4domain_mvp/src/lib/v3-public/site-kit/packs.ts`) are a **different, second pack list**: one per main category in the frontend data (29) plus `general`, each with a layout family, hue, starter text and image style. These are design packs, not the 16 industry packs. Two uses of the word "pack" exist; the V2 `CategoryPack` is a third. Status of unification: MISSING.

---

## C. Entities (architecture section 10, 17 entities)

| # | Architecture entity | Equivalent in the code (table / model) | Status | What is missing |
|---|---|---|---|---|
| 1 | industry_packs | `g4d_packs` `V3Pack` | BUILT AND PROVEN BY TESTS | all `DRAFT` until the owner approves |
| 2 | category_families | no table; `family` string on `g4d_pack_categories` and `g4d_directory_categories` | PARTIAL | a family table with the 45, display data, defaults (section D) |
| 3 | categories | `g4d_pack_categories` (196), `g4d_directory_categories` (53), `g4d_category_packs` (24, V2) | PARTIAL | one master; the 45-family master; multi-family |
| 4 | subcategories | none. `V3PackCategory.starterServices` JSON; `V3DirectoryCategory` parent tree (53 rows); frontend `SUBCATEGORIES` | **MISSING** | a sub category table (1,213 rows) with parent and multi-family links |
| 5 | category_pack_mappings | `V3PackCategory.packKey` (one pack per category) | PARTIAL | many-to-many; the family to pack default |
| 6 | website_templates | `g4d_theme_packages` `ThemePackage` (imported themes, `categories` JSON, role FREE_DEFAULT or MARKETPLACE) and `g4d_website_themes`, `g4d_ai_templates` (V2) | BUILT AND PROVEN BY TESTS (upload, lint, purchase) | targets (main, category, sub) not stored, section L |
| 7 | website_configurations | `g4d_site_settings`, `g4d_site_drafts`, `g4d_site_snapshots`, `g4d_site_publications`, `g4d_vendor_cms` | BUILT AND PROVEN BY TESTS (`website-service` and the `site-*` specs) | no per-category or per-family default configuration |
| 8 | website_menus | none; `navigation` is a key inside the managed content document (`header`, `footer`) | PARTIAL | stored and validated but the renderer menu is fixed (V3_WEBSITE_MANAGER.md gap 2) |
| 9 | website_menu_items | inside the same JSON | PARTIAL | as above |
| 10 | website_pages | `g4d_site_publication_pages` (built pages), managed doc `lists.pages` (extra pages) | PARTIAL | no family, category or sub category page definitions |
| 11 | page_sections | managed doc `sections { hidden, order }`; section list derived from the theme (`v3-website/core/editor-map.ts`) | PARTIAL | the editor map only expects `hero about services faq gallery contact`; see E |
| 12 | media_assets | `g4d_media` `V3Media`, `g4d_site_pictures`, `g4d_banner_images` (platform banner library with licence manifest), legacy `g4d_media_assets` | BUILT AND PROVEN BY TESTS (`website-media-core`, `website-media-service`) | no real storage adapter bound (`STORAGE_NOT_CONFIGURED`, V3_WEBSITE_MANAGER.md gap 8; R1 work may have changed this, not checked) |
| 13 | service_catalogue | vendor side: `VendorProduct` (offerings), `g4d_appt_services`, `g4d_store_products`; platform side: `starterServices` JSON on the category | PARTIAL | no master catalogue per sub category with the vendor ticking items (decision doc), no action type |
| 14 | form_templates | none for the public side. Request fields are fixed per kind in `requests-core.ts`. `g4d_pack_tab_fields` is the vendor's internal record form | **MISSING** | category-specific enquiry/booking forms (AC type and problem, speciality and date) |
| 15 | feature_mappings | `g4d_features`, `g4d_plan_features`, `g4d_tier_capabilities`, `g4d_pack_tabs` (minTier, capabilityKey, freeTrial) | BUILT AND PROVEN BY TESTS | none for the site features list shown in the architecture example |
| 16 | seo_metadata | `g4d_page_seo` `V3PageSeo` (per vendor page), `g4d_seo_category_keywords`, `g4d_seo_keyword_targets` | BUILT AND PROVEN BY TESTS (`seo-*` specs, `website-service`) | no SEO template per family, category or sub category for the vendor site (templates are global in `seoPageTemplates` setting) |
| 17 | website_revisions | `g4d_site_drafts` (rev counter), `g4d_site_snapshots`, `g4d_site_publications` | BUILT AND PROVEN BY TESTS | none |

Count: 17 entities; 7 BUILT AND PROVEN (1, 6 partly, 7, 12, 15, 16, 17), 8 PARTIAL (2, 3, 5, 8, 9, 10, 11, 13), 2 MISSING (4, 14). Entity 6 is built but its target storage is not (L).

---

## D. Inheritance (family defaults, category overrides, sub category overrides)

Status: **PARTIAL, only for profile fields; MISSING for site configuration.**

- Built: **profile fields** inherit pack → category. `V3CategoryProfileField` (`g4d_category_profile_fields`, key `packKey + categorySlug + fieldKey`) and `V3ProfileSiteMap` (`g4d_profile_site_map`, "the most specific row wins: category, then pack, then every pack"), `backend-api/src/v3-profile-fields/core/profile-core.ts` (comment: "a pack has a set of fields every one of its categories inherits; a category can override or add a field"). Tested: `profile-core` and `profile-service` specs (names read, not run).
- Built in the public repo only (not stored): theme target resolution **sub → category → main category → closest pack → safe default** (`get4domain_mvp/src/lib/v3-public/site-kit/resolver.ts`, 24 tests in `p11.test.ts`). It resolves from data that is not stored (section L).
- Missing: family-level defaults (pages, theme, layout, modules), category-level overrides of hero, menu, catalogue and forms, sub-category overrides of content, sections and SEO. There is no family object to hold defaults, and no override table. The pack tab menu is per pack (16), not per family or category.
- The architecture's example ("Solar Water Heater Installation inherits Home Services; admin can customise before publishing") cannot be done today: a new sub category cannot be added at all (A.3), and nothing inherits a website template.

---

## E. Public site

Two public renderers exist and they are not the same code:
1. **Kit renderer** (`get4domain_mvp/src/app/site/[subdomain]/[[...rest]]/page.tsx` → `src/components/site-kit/SiteApp.tsx`, `src/lib/v3-public/site-kit/*`), P11. Free page and the generic Pro design.
2. **Backend renderer** (`backend-api/src/site-publish/renderer`, themes from `g4d_theme_packages` and `themes/library/*`), relayed by `/vendor-site` (`get4domain_mvp/src/app/(directory)/vendor-site/[[...path]]/route.ts`). Pages stored and served as HTML.
3. Plus the older engine designs (`src/engine/kit`, `src/engine/industries/*`, 20 industries) and imported theme packages (`src/engine/themepack`).

### E.1 The 16 homepage sections of the architecture file

Sections the kit draws (`SiteApp.tsx`): hero (5 variants), services (4), gallery (3), reviews, FAQ, pricing, map, contact. The V2 design vocabulary (`backend-api/src/site-doc/design-vocab.json`, used on the `site_doc_v2` path) has 17 section types: announce, hero, trust, items, about, pricing, process, stats, team, gallery, beforeAfter, testimonials, faq, hours, enquiry, contact, cta.

| Architecture section | Kit (P11) | V2 design vocab | Backend theme editor map | Status |
|---|---|---|---|---|
| Hero | yes | yes | yes | BUILT AND PROVEN BY TESTS (every pack renders, p11) |
| Quick Search | no | no | no | MISSING |
| Categories (sub category cards) | no | items | no | MISSING (no sub categories) |
| Featured Services | services | items | services | PARTIAL |
| About | yes | yes | yes | BUILT AND PROVEN |
| Why Choose Us | no | trust | no | PARTIAL (V2 only) |
| Packages | pricing | pricing | no | PARTIAL |
| Portfolio | gallery | gallery, beforeAfter | gallery | PARTIAL |
| Offers | no (offers exist as banners and coupons in the vendor Offers screen, with optional dates) | no | no | PARTIAL |
| Testimonials | reviews | testimonials | testimonials (Pro, from `g4d_testimonials`) | BUILT AND PROVEN (`website-testimonials`) |
| Team | no | team | no | PARTIAL (V2 only) |
| Brands | no | no | no | MISSING |
| Service Areas | no | no (location is one address; `g4d_site_locations`) | no | MISSING (area pages) |
| FAQ | yes | yes | yes | BUILT AND PROVEN |
| Blog | no | no | no | MISSING |
| Contact | yes | contact, enquiry | yes | BUILT AND PROVEN |

Add/remove/reorder/hide per section: backend managed document `sections { hidden, order }` is built (Pro writes, Free submits). Admin side configuring which sections a **category** gets: MISSING.

### E.2 Hero (several slides, desktop and mobile images, focal point, scheduling)

Status: **MISSING for the architecture's hero; PARTIAL for what exists.** Nothing in the code has a focal point, a mobile image, multiple slides or a schedule (a search for `focal`, `focus`, and publish-from dates on banners found nothing in `backend-api/src`). What exists: one `hero.image` field per site; a platform **Banner Library** per category (`g4d_banner_images`, licence manifest, `hasPeople`, tests `website-media-core`); the vendor picks a banner or an own picture (`V3SitePicture`); five hero variants and generated hero art in the kit; Offers with optional start and end dates (legacy engine path). The Pro-only motion kit (`themes/MOTION_KIT.md`, `themes/shared/css/motion.css`, levels off/low/medium/rich, `prefers-reduced-motion` honoured) gives the **animation** requirement for the backend theme packages (BUILT, tests in `themes/test/motion-kit.test.mjs`); the P11 kit CSS animation was not checked.

### E.3 Page archetypes (12) against the 8 layout types P11 built

P11 and V2 both use the 8 flow families: shop, booking, enquiry, packages, menu, portfolio, listings, courses.

| Architecture archetype | Closest of the 8 | Status |
|---|---|---|
| Service landing page | enquiry / booking | PARTIAL |
| Professional profile | enquiry | PARTIAL (no profile layout) |
| Product catalogue | shop | BUILT |
| Appointment page | booking | BUILT (public request `APPOINTMENT` kind) |
| Booking page | packages / booking | PARTIAL |
| Restaurant menu | menu | BUILT |
| Property listing | listings | BUILT |
| Course catalogue | courses | BUILT |
| Portfolio page | portfolio | BUILT |
| Dealer directory | none | MISSING |
| Corporate page | enquiry | PARTIAL |
| Membership page | none (plans shown as pricing) | MISSING |

8 layouts cover 9 of 12 archetypes in part; dealer directory and membership are not covered. Proven by tests: p11 "every pack renders in both modes".

### E.4 Landing pages and addresses by family, category and sub category

Status: **MISSING** on vendor sites. Theme-based pages: `home about services gallery contact` + `item` + `page` (V3_WEBSITE_MANAGER.md section 11, gap 1: "landing pages per service and area have no renderer template; the API and document model do not store landing text"). No `/home-services/ac-repair/` style hierarchy on a vendor site. The `item` template gives each service one page.
Directory (platform-level) pages **exist**: `backend-api/src/seo-directory` (state, city, category, city + category, locality + category, pincode + category, business profile; URL scheme `/`, `/state/{state}`, `/{city}`, `/category/{category}`, `/{city}/{category-plural}`, ...), public routes `(directory)/directory-pages/[...path]`, tests `seo-pages`, `seo-sitemaps`, `seo-templates`. BUILT AND PROVEN BY TESTS, but **noindex by default** (`directoryPagesIndexable` OFF) and built on 53 proposed directory categories, not the 45 families and sub categories. Marketing site also has `(v3site)/v3-site/industries/[slug]/[category]` (industry pages of the product site).

### E.5 Sitemap and structured data

- Sitemap: per vendor site `get4domain_mvp/src/app/site/[subdomain]/sitemap.xml/route.ts` and backend site files (`site-publish/seo/site-files.ts`); directory sitemaps (`(directory)/sitemaps/[file]`, `seo-directory/sitemaps`). BUILT AND PROVEN (`seo-sitemaps`, `seo-vendor-site`). Only the canonical host is in the sitemap (owner rule 1).
- Structured data (`backend-api/src/site-publish/seo/page-seo.ts`): BreadcrumbList, Organization and WebSite (home), FAQPage only from vendor-entered questions. **LocalBusiness / Service / Product / Offer markup: not found in `page-seo.ts`** (the V2 pack has a `seoType` of 17 schema.org types, used on the V2 path). Status: PARTIAL.
- AEO: FAQPage (vendor-entered) and per-site `llms.txt` (`site-publish/seo/llms-txt.ts`, test `seo-llms`). GEO: address, geo point and directions (`g4d_site_locations`, B2), directory locality facts. No per-city or per-area page on vendor sites. Per-vendor customised SEO: `g4d_page_seo` (vendor edits SEO text and slug per page, wording check forbids ranking promises and prices). Status for "customised SEO, AEO and GEO for every vendor": **PARTIAL**: the per-page fields exist; nothing generates category-aware SEO, FAQ or area content from the family and sub category (the architecture's AI Website Setup).

### E.6 Directory portal pages (architecture 11A)

Status: **BUILT NOT PROVEN end to end / PARTIAL.** Pages for browse by category and location, search (`(directory)/search`), vendor profile, claim, click-out, sitemaps are built (see E.4). Unit tests exist; `seo-directory.int.spec.ts` was written and **not run**. "Browse all 45 business families" cannot be shown (A). "Send enquiries to businesses" from a directory profile: click-out only (`/v3/go/{id}`), the enquiry goes through the vendor's own site.

### E.7 Install app, bottom navigation, per-vendor manifest

Status: **BUILT AND PROVEN BY TESTS (kit sites only).** `SiteApp.tsx` shows bottom navigation on a phone and top navigation on a computer; `InstallButton.tsx` (Android prompt, iOS guide sheet, no button on desktop); `app-manifest` and `app-icon` routes per vendor host; `Powered by Get4Domain.com` line once. Tests: `p11.test.ts` (bottom nav, install rules, vendor manifest, footer) and the browser script `scripts/v3-public/p11-shots.mjs` (reported all passed at 375, 768, 1280; not rerun here). **Not covered:** the 20 Pro engine-design sites, imported package themes, and `/vendor-site` pages (section L). The service worker `apps/site/public/sw.js` exists only in the UI repo's marketing site; whether vendor sites register a worker was not checked (offline use is not asserted).

---

## F. Admin: the 12 Website Experience Builder tabs

Admin app today (`get4domain-ui`, branch `v3-ui-s16`, `apps/admin/src/pages/registry.tsx`): 20 screens: overview, catalog (tabs: Packs, Categories, Matrix, Add-ons, Eligibility, Switches; plus Tab fields modal), vendors, invoices, prices, **themes**, golive, directory, policies, payments, partners, domains, **onbehalf** (create business, bulk import, claim tracking, listing states, pictures, profile fields), **vendorsite** (staff view of a vendor's site), tickets, duplicates, included, staff, firm, settings. No screen is called Website Experience Builder.

| # | Architecture tab | Admin screen today | Status | What is missing |
|---|---|---|---|---|
| 1 | Website Templates | Themes (upload zip, lint report, price, status, role, categories; `ThemesPage`, `ThemeDetail`, `UploadDialog`) | PARTIAL | assign a template to a pack or category or sub category ("Choose targets", L); public themes route |
| 2 | Header & Navigation | none (menus are JSON in the vendor's document; renderer menu fixed) | MISSING | |
| 3 | Hero & Banners | none for admin. Banner Library has a loader script and backend routes (V3 website media, staff) | MISSING in admin UI | slides, desktop and mobile images, focal point, schedule |
| 4 | Homepage Sections | none | MISSING | |
| 5 | Landing Pages | none | MISSING | no data model either (E.4) |
| 6 | Category Mapping | Catalog > Categories (edit category pack, tier, starter services) | PARTIAL | families table, sub categories, multi-family, related rules |
| 7 | Service Catalogue | none (starter services are an edit field of a category) | MISSING | master list per sub category with price, action type |
| 8 | Forms & Enquiries | Catalog > Tab fields (internal record fields only) | MISSING for public forms | |
| 9 | Themes (colors, typography...) | Themes screen (package level); kit themes are code (`site-kit/themes.ts`, 29 flagships + default) | PARTIAL | admin cannot edit tokens |
| 10 | SEO & Metadata | settings screen has SEO settings? not verified; backend has staff SEO APIs (`seo-admin`, `seo-targets-admin`) | PARTIAL | an admin UI for per-family SEO templates |
| 11 | Preview | Themes: preview (`theme-preview`), `vendorsite` view | PARTIAL | desktop, tablet, mobile switch not verified |
| 12 | Publish | vendor side only; staff review of Free submissions and act-on-behalf routes exist in the backend | PARTIAL | |

Status for the builder as a whole: **MISSING**. 0 of 12 are fully there, 6 partial. The admin screens are tested (`ThemesPage.test`, `CatalogPage.test`, `CatalogWave2.test`, `VendorSitePage.test`, `OnBehalfPage.test`).
The architecture's key feature, **category-to-template mapping with menu preset and enabled features**, is MISSING: the backend stores `categories` on a theme package and a category's pack and tier on `g4d_pack_categories`, but the two are not joined by a mapping the admin can edit, and the template does not set menu or features.

---

## G. Vendor app: website manager

Vendor app (`get4domain-ui`, `v3-ui-s17`, `apps/vendor/src/pages/grow/website/`): `WebsiteScreen.tsx`, `website-data.ts`, `MediaPanels.tsx`, `ThemePanel.tsx`; theme store `pages/grow/themes/ThemeMarketplace.tsx`.

| Part | Backend | Vendor app | Status |
|---|---|---|---|
| Content (typed fields, lists faqs, gallery, steps, trust, stats, team, credentials, extra pages) | `GET/PUT /v3/me/site/draft/field`, `editor/map` | WebsiteScreen edits fields from the map | BUILT AND PROVEN BY TESTS (backend `website-service`; app `WebsiteScreen` tests) |
| Services | read from Offerings (`VendorProduct`), vendor edits in "My services/Offerings" | separate Offerings screen | PARTIAL (no master list to tick) |
| Layout | section order and hide in the doc (`sections`) | UI for show/hide exists on the map's sections; reorder not verified | PARTIAL |
| Media | `/v3/me/media` upload, banner library | `MediaPanels` (Gallery, description required) | BUILT NOT PROVEN end to end (no storage adapter bound, uploads refuse until `mediaMaxBytes` etc. are set) |
| Theme | `PUT /v3/me/site/theme`, theme switch fee from wallet, theme market | `ThemePanel`, `ThemeMarketplace` | BUILT AND PROVEN BY TESTS |
| SEO | per-page SEO text and slug (B1), Amendment 07 removed the vendor SEO tab | not in the vendor UI by design | PARTIAL (by decision; the architecture wants a vendor SEO surface) |
| Location, review link, testimonials | B2, B3, B4 | in the manager | BUILT AND PROVEN (specs) |
| Draft, preview, publish | `draft`, `draft/preview`, `draft/publish`, `submissions`, `revisions` | all present, plus failed-site card (A4.3) | BUILT AND PROVEN |

---

## H. Services, booking and quotes

- **Service catalogue**: platform starter list is `starterServices` JSON on `g4d_pack_categories` (248 names across 143 categories) plus per-pack `PACK_DEMO` services. The vendor picks starter services at registration (`g4d_vendor_packs`). The vendor's own services are `VendorProduct` (offerings: `name`, `price` as display string, `priceAmount`, `category`) and, for appointments, `g4d_appt_services` (name, duration, `pricePaise` optional). Status: **PARTIAL** (no master catalogue per sub category that the vendor ticks and edits; no `actionType` per service. The word `actionType` found in the code belongs to campaigns and notifications, not service actions).
- **Category-specific forms**: **MISSING.** `backend-api/src/requests-orders/core/requests-core.ts` fixes the fields per kind: ENQUIRY (message), APPOINTMENT (service, date, time), QUOTE (service, details, budget), PRODUCT_ENQUIRY (productRef, message). Nothing varies by category.
- **Where a booking or quote request is stored**: `g4d_requests` (`V3Request`, kinds `ENQUIRY APPOINTMENT QUOTE PRODUCT_ENQUIRY ORDER_REQUEST ORDER`), with events (`g4d_request_events`, append only), consent (`g4d_request_consents`), tracking token (`g4d_request_tracking`). Public routes `POST /v3/public/sites/:host/requests`, `/enquire`, `/orders` and `GET /v3/public/requests/track/:token` (`requests-orders/api/public-requests.controller.ts`). The site's enquiry form also writes the business inbox. The older engine path (`engine.enquiry` in `engine/action-registry.ts`) writes a CRM lead instead. Status: **BUILT AND PROVEN BY TESTS** (`requests-core`, `requests-service`, `requests-api`, `enquiry-form` specs; `requests.int` not run). The five owner action types (Book, Quote, Enquiry, Order, Appointment) map onto six stored kinds; **Book has no kind** (APPOINTMENT is the closest).
- **How the vendor sees and confirms it**: vendor app `pages/business/enquiries/RequestsView.tsx` and `InboxScreen.tsx` call `GET /v3/me/requests`, `POST /v3/me/requests/:id/respond`, and `POST .../link` records the customer and booking ids it became. Appointments: `POST /v3/me/appointments/:id/confirm | decline | cancel | complete | no-show` (REQUESTED stays until the business confirms; nothing confirms itself). Quotes: `g4d_job_quotes` (`V3Quote`, DRAFT lines, sent, decided). Status: BUILT AND PROVEN for appointments (`appointments-core`, `appointments-service`); PARTIAL for linking a public request to a booking or quote (only the ids are stored, "the CRM and booking modules arrive later").
- **Notifications**: customer and business messages go through `MessagingService` (sandbox, no provider called, `V3_ORDER_REQUEST_MODE.md`); e-mail enquiry forward and inbox in `V3_ENQUIRY_INBOX.md` (flags `EMAIL_LIVE_SEND`, `EMAIL_FORWARD_LIVE` default OFF). Status: **BUILT NOT PROVEN live** (no real provider used; R1 integration settings exist but no live send was verified here).
- **Free sites**: no forms or buttons by owner rule and decision doc. Public requests answer one plain 404 unless the site is Pro with `site.cta` ACTIVE (`public-requests.service.ts` line about `site.cta`, `requests.inbox`).

---

## I. Prices

- Optional price: **PARTIAL.** `VendorProduct.price` (display string, may be "On Request") and `priceAmount` nullable; `V3ApptService.pricePaise` nullable; `V3StoreProduct.pricePaise` required (store only). The starter content is marked sample and "prices and quotes are hidden on the public page until the vendor edits them" (V2 starter, `site-doc` `sample-markers.ts`). The platform text rules forbid a rupee price in SEO text (`isUnsafeSeoText`).
- Admin default price for vendor approval: **MISSING** for vendor services. The only `price approval` hit in the code is the Get4Domain price book for the platform's own services (`v3-services/api/services.controllers.ts`, `price-book.service.ts`): a PENDING to ACTIVE flow for Get4Domain prices, not vendor service prices.
- Hide option: **MISSING** as a per-service flag (no `hidePrice` field anywhere). The `Category.hidden` flag hides a filter category, not a price.
- The open decision (default prices hidden until the vendor approves, proposed) has no storage: needs `defaultPricePaise`, `priceApprovedAt`, `priceHidden` on the vendor's service record.

---

## J. Draft, publish, rollback, vendor content kept separate from template configuration

- Draft, publish, rollback: **BUILT AND PROVEN BY TESTS.** `g4d_site_drafts` (one draft per vendor, compare-and-set `rev`), `g4d_site_snapshots` (one per publication), `g4d_site_publications`; `POST /v3/me/site/draft/publish`, `GET /v3/me/site/revisions`, restore recreates the earlier version byte for byte; double publish is harmless (`website-service` spec per V3_WEBSITE_MANAGER.md section 13). Free: "publish" is a submission (`g4d_content_submissions`) reviewed by staff.
- Vendor content separate from template configuration: **BUILT (by design), PROVEN for the managed document.** The vendor's content lives in the managed document and the draft; the theme is chosen separately (`PUT /v3/me/site/theme`), and the live site is the snapshot of the publication, so a theme or template update does not rewrite the vendor's words ("D-2"). Starter text only fills **empty or still-sample** fields (`site-doc` starter, `free-home-content.ts`). Weak point: there is no template content to update yet (no family or category defaults, D), so the guarantee is not tested against a changed template default.

---

## K. Free versus Pro gating

| Area | Free | Pro | Evidence | Status |
|---|---|---|---|---|
| Public site | information only; phone as plain text; no form, chat, button link, e-mail; anchors and the Install button allowed | full calls to action for the tier | `p8.test`, `p9.test`, `p11.test` ("no form, input, chat, button element, mailto, tel or wa.me link"), backend adapter D-9 | BUILT AND PROVEN |
| Public requests | one plain 404 | needs `site.cta` and `requests.inbox` ACTIVE | `public-requests.service.ts` | BUILT AND PROVEN (`requests-service`) |
| Website edits | submissions reviewed by staff | live at once | Amendment 06, `website-review` spec | BUILT AND PROVEN |
| Review link, testimonials, directions | not drawn | drawn; kept after a downgrade | `website-reviewlink`, `website-testimonials`, `website-location` | BUILT AND PROVEN |
| Tabs | 7 trial tabs ACTIVE, rest LOCKED_PREVIEW | by tier and capability | `pack-nav-core`; server `@RequiresTab` on the domain screen only | PARTIAL (the shipped module controllers still use `@RequiresFeature`, V3_PACK_ENGINE.md section 6) |
| Themes | free themes of the category | library from a paid plan, switch fee from wallet | `theme-switch`, theme market specs | BUILT AND PROVEN |
| Install app, bottom navigation, footer line | yes (both plans, also on subdomains) | yes | `p11.test` | BUILT AND PROVEN for kit sites; MISSING on engine and imported-theme sites |
| Animation | not specified | motion kit levels | `themes/MOTION_KIT.md` | no Free/Pro rule found |
| Hero slides, landing pages, vendor-name customised SEO, services catalogue, price rules | not defined | not defined | nothing built | the owner has not set a Free/Pro rule for these new items |

Free/Pro rules for the **new** engine items (multi-slide hero, landing pages, forms per category, price hiding) are not stated anywhere in the inputs; section 15 asks.

---

## L. P11 follow-ups

### L.1 Diffs P11 made to p8, p9, p9b (commit `dd8e1dc`)

All three edits replace a source-text `assert.match` or `indexOf` with the new kit's text. None deletes a behaviour test, but one check weakens and one is dropped:

| File | Change | Weakens? |
|---|---|---|
| `p8.test.ts` line 80 | in the ordering check, `'<ChatBot />'` replaced by `'<SiteApp view={view}'`. The test still requires the Free branch to come before the other branches | **Slightly**. The old list proved the Free branch preceded the demo chatbot render. The chatbot is removed, so the entry has no counterpart; `p11.test.ts` (lines 236 to 245, 280 to 283) asserts no chat, form, `mailto:`, `tel:`, `wa.me` in the real rendered Free HTML and in the Free page file, which is stronger for the owner rule. Net: not weaker for the rule, but the file-order check now guards less |
| `p9.test.ts` lines 80 to 86 | three assertions about `getCategory(site.vendor.industry)`, `cat?.coverImage || ''` and `industryLabel = cat?.name ?? 'business'` replaced by `themeForSite(site)` and `<SiteApp view={view} theme={theme} />` | **Yes for two checks.** The removed assertions covered the Free page's category label and cover image; `p11.test.ts` "H1 is the business name ... category only a small label" and "page title is `<name> | <real category> | Get4Domain`" cover the label, nothing re-covers the cover image. All are source-text matches rather than behaviour, as before |
| `p9b.test.ts` lines 102 to 104 | `<img src={view.banner}` replaced by `<img className="sk-art" src={art}` and `view.banner ?? heroArt(` | **Partly.** The line before (`freeViewOf(...).banner === '/starter/generic/hero.svg'`) is kept, but the kit shows `view.banner ?? heroArt(...)`; the check now allows the neutral placeholder to be replaced by generated art, and it only matches strings in the component, so it does not prove an `<img>` renders |

Recommendation: a follow-up lane should turn these three string matches into rendered-HTML assertions using the same `renderToStaticMarkup` approach as `p11.test.ts`.

### L.2 Pro engine-design sites and imported themes without the app shell and Install button

Confirmed by search: the only `InstallButton` use is `components/site-kit/SiteApp.tsx`; the per-vendor manifest route and icon route exist, but `<name>.<domain>` pages built by other renderers do not link it. The list (all in `get4domain_mvp/src/engine`):

- 20 bespoke or kit-built industry designs registered in `engine/registry.ts`: Real Estate (`industries/real-estate/sections/blocks.tsx`, line 221 "Powered by Get4Domain"), Retail (`industries/retail/RetailSite.tsx`, line 146) and the 18 built from `engine/kit` (`KitRenderer.tsx` line 49; `design-sections.tsx` lines 313 and 326), plus `engine/shell/ShellFooter.tsx` (lines 43 and 56). All say "Powered by Get4Domain", not the decided "Powered by Get4Domain.com" line, and have no Install button or per-vendor manifest. `engine/shell/ShellBottomNav.tsx` gives them a bottom bar already (BUILT) but not the install flow.
- Imported package themes: `engine/themepack/*`, `engine/raw-theme-frame.tsx`, `app/theme-pack/[id]/[[...rest]]/page.tsx`; no install button, manifest or footer line.
- `/vendor-site` pages (backend built HTML, served via `(directory)/vendor-site/[[...path]]/route.ts`): no install button either.
Status: **MISSING** for all three groups. This matches the P11 report's own "Next lane".

### L.3 `/vendor-site` Free flaws

**Not reproduced** (no render was run; I did not start a server). The P11 report names: the category used as the H1, and an "Hours: Opening hours" placeholder line. The backend code that builds that content: `backend-api/src/site-publish/content/content-adapter.ts` (maps the vendor document to the theme fields; its header says "Hours stay empty" and builds the About heading) and `backend-api/src/site-publish/content/free-home-content.ts` (builds Free tagline, about and services from the category as typed), with the section label "Opening hours" coming from the theme templates (`themes/library/free-hospitality|free-practice/templates/home.html` line 66 and 72, `data-g4d-label="Opening hours"`) and the renderer `backend-api/src/site-publish/renderer/theme-render.service.ts`. The fix is backend side as P11 said; which of these files is the exact origin needs a render to confirm. Status: PARTIAL (reported by P11, source files identified, not reproduced).

### L.4 The four changes needed to store theme targets (confirmed)

Verified in the code: `backend-api/src/themes/core/sanitise.ts` `validateManifest` (lines 103 to 143) returns only `id, name, version, author, description, families, categories, pages, itemsPage, cssVars, colors, googleFonts`; `targets`, `pack`, `track`, `freeMode` are dropped without an error. `PUT /admin/themes/:id` takes `UpdateThemeDto` with `categories` and others only (`themes.controllers.ts` lines 13 to 21, 43). `ThemePackage.categories` is a flat JSON list of category keys, so only the category level is storable. The four changes:

1. `sanitise.ts` `Manifest` type and `validateManifest` read and validate `targets` (level main, category or sub; id or slug), `pack`, `track`, `freeMode`. Reuse the kit validator messages (`site-kit/themes.ts` `validateTargets`).
2. `UpdateThemeDto` / `PUT /admin/themes/:id` accept `targets` validated against the category data (needs the family, category and sub category master of section A), plus an `isDefault` flag per target group.
3. Admin Themes screen "Choose targets" field (main, category and sub pickers), in `apps/admin/src/pages/themes/ThemeDetail.tsx` and `UploadDialog.tsx`.
4. A public route listing live themes with targets for the renderer, and the vendor's chosen theme on the site answer. Today `v3/public/themes` (`v3-theme-catalog`) lists themes; whether it exposes targets was not checked.
Migration: none needed (manifest JSON holds it), as P11 said. But change 2 is **blocked by section A**: there is nothing to validate a main or sub target against until the master exists.

---

## M. Vendor address rule and host plumbing (owner rule added 20 Nov)

**Rule:** a vendor's public address is always `<name>.get4domain.com`, never a path. Read from the code on `v3-lane-r1`, `v3-pub-fe19`; nothing was run, so every "reachable" below is from reading the middleware and routes, not from a request.

### M.1 Is the rule kept? Status: PARTIAL (three places break it)

| Place | Evidence | Verdict |
|---|---|---|
| Vendor host rewrite | `get4domain_mvp/src/middleware.ts` `vendorHostRewrite`: `<name>.<base>` (any label that is not reserved) is rewritten internally to `/site/<name>/...` | OK: the visitor sees the host address |
| **`/site/<name>` on the main host** | `site` is in `LIVE_SEGMENTS` (`lib/v3-public/routes.ts`) and the route folder `app/site/[subdomain]` exists; `isInternalOnlyPath` does not list it (it lists `/v3-pages`, `/vendor-site`, `/v3-site`, the robots handler) | **BREAKS THE RULE (by reading):** `get4domain.com/site/<name>` appears to serve the vendor's site as a path address. Not tested |
| **Internal links of engine, kit-engine and theme-pack pages** | `app/site/[subdomain]/[[...rest]]/page.tsx` passes `base: /site/${subdomain}` into `ThemeSite` (line 180), `withShell` and `KitRenderer` (lines 189, 204); the middleware comment says a vendor host reaches its own `/site/<name>/...` links "as they are (a visitor's browser prefetches them)" | **BREAKS THE RULE:** on `<name>.get4domain.com` the links go to `<name>.get4domain.com/site/<name>/about`: the host is right but the address carries a path prefix and duplicates `/about` |
| Canonical on those pages | theme-pack pages: `canonical = https://<name>.<base><routePath>` (`engine/themepack/site.tsx` line 78, host only, good). Engine designs: canonical only when `site.docV2` (page.tsx lines 121 to 122); otherwise none | the path duplicates are not canonicalised for non-docV2 engine designs |
| Dev view `/_vendor/<name>/...` | `middleware.ts` `devVendorRewrite`, only with two flags and never in a production build | OK |
| `/vendor-site` relay (backend built pages) | host only; relative links | OK |
| Directory click-out target | `siteUrlOf` = `https://<subdomain>.<baseDomain>` (`directory/core/visits.ts`); never a custom domain | OK |
| Kit (Free and generic Pro) | one page, in-page anchors (`#services`), no path | OK |
Tests: `hostnames.test.ts`, `host-routing.test.ts` exist (not run); nothing found that asserts "no public `/site/<name>` path". Needed: close the main-host `/site/` route (404 or 301 to the host address), build links relative to the host, set one canonical on every page (lane A1 below).

### M.2 Directory keyword and location pages

- **Do they exist: yes (BUILT AND PROVEN BY unit tests; `seo-directory.int.spec.ts` and `directory-host.int.spec.ts` written, not run).** Backend page models: `backend-api/src/seo-directory` (state, city, category, city + category, locality + category, pincode + category, business profile; URL scheme in `core/url-scheme.ts`); keyword targets with their own title, description and H1 per page path (`g4d_seo_keyword_targets`, `seo-targets-admin.controller`), keyword plan and modifiers (`seoKeywordModifiers`). Public rendering: `get4domain_mvp/src/app/(directory)/directory-pages/[...path]/page.tsx`, reached by the middleware directory gate.
- **Which host serves them:** a dedicated host when `DIRECTORY_PUBLIC_BASE_URL` is set (`directoryBase()` in `url-scheme.ts`; RUNBOOK value `https://directory.get4domain.com`, with `DIRECTORY_HOST` for the public site). Then every canonical, sitemap, breadcrumb, robots and llms URL is on that origin and the home is `/`. With it unset the pages live on the app origin under **`/directory`** (a path address, but for the directory, not a vendor). nginx file: `deploy/v3live/nginx/directory.get4domain.com.conf` (to `:3006`, Host header passed on). Not installed anywhere that I could see (the runbook installs it at step 33, owner's).
- **Noindex until staff switch on `directoryPagesIndexable`** (default OFF); thin pages (fewer than 3 businesses) stay noindex.
- **Do they link to vendor subdomains: only through a click-out, with `nofollow`.** A card or profile carries `visitUrl` = the API click-out `/v3/go/{businessId}?src=...` (`seo-page.service.ts` lines 127 and 322, `clickOutUrl`). The click-out answers **302** to `https://<name>.get4domain.com/?src=dir&ref=<ref>` with `X-Robots-Tag: noindex, nofollow` (`click-out.controller.ts`); the public page renders the link with `rel="nofollow noopener"` (`components/directory/BusinessPage.tsx` line 79) and a business with no site on a subdomain is "listing only" (no link). So the directory passes visitors but no followed link equity to vendor subdomains, by design (counted by `seo-click-out.spec`).
- **Reverse direction (vendor site to directory): data only, not drawn.** The backend builds the backlink block (`core/backlink-block.ts`: one brand link `Get4Domain` to the main site plus up to four rotating directory links, only while the directory pages are indexable) and puts it into the site build as `directoryLinks` (`site-publish/publish/site-build.service.ts` line 116), with the comment "drawing them is a theme task". **No theme in `themes/` and no kit component draws it** (search for `directoryLinks` in `themes/` found nothing). Status: **BUILT NOT PROVEN end to end / MISSING on the page.** Also the directory pages show backlinks for a business on its profile (`BacklinkLinks` in `BusinessPage.tsx`), which is the other direction.
- Directory pages are built from the 53 proposed directory categories, not the 45 families (section A, E.4).

### M.3 Canonical and sitemap per vendor subdomain

Backend rules (BUILT AND PROVEN BY TESTS: `canonical-switch.spec`, `domain-core.spec`, `domain-host.spec`, `seo-sitemaps`, `seo-vendor-site`):
- Exactly one canonical host per site (owner rule 4), `site-domains/core/canonical.ts`: the subdomain by default; an ACTIVE verified custom domain serves the same site and declares the subdomain canonical (`serveHosts`); with the custom-domain promotion add-on active the custom domain is canonical and the subdomain redirects to it; a lapsed plan changes the answer (`customServing: false`), never the stored rows; `planRedirect` keeps path and query; www never canonical.
- Sitemap (`site-publish/seo/site-files.ts` `buildSitemap`): an empty `urlset` while the site is not indexable; only canonical-host URLs; hreflang alternates for the second language. `robots.txt`: everything stays crawlable, the `Sitemap:` line only when indexable; noindex is expressed in the page and header, never in robots.
- A subdomain change writes a host-level 301 row from the old host to the new (`addRedirect`, fromPath `/`, toPath `/`, source SYSTEM); the old host row is REMOVED but keeps its name. Whether deeper paths follow the 301 was not read (`planRedirect` keeps the path, so likely yes).
- Directory click-out and the kit use the subdomain host only.

Public-site rules (`get4domain_mvp/src/app/site/[subdomain]/sitemap.xml/route.ts`, `lib/site-public.ts`):
- The sitemap URLs are **always `https://<subdomain>.<SITE_BASE>`**, never the vendor's canonical custom domain, and list the pages only when `mayIndex(site)` = `docV2 && indexable`. **Conflict with the backend rule:** with the custom-domain add-on active, the backend says the custom domain is canonical while this route still lists subdomain URLs, and the theme-pack canonical is also built on `<subdomain>.<SITE_BASE>`.
- A site that is not `docV2` (older engine designs) lists nothing and has no canonical tag (see M.1). A Free site's canonical and robots tag in the kit were not read.
- The two sitemap sources (backend `site-files.ts` via `/vendor-site`, and this Next route) are different code paths with different page lists (theme pages and item pages here, published pages there). Which one answers a vendor host depends on the renderer that serves it.

### M.4 How the footer link is built

Three implementations, and they disagree:

| Where | Output | Notes |
|---|---|---|
| Static renderer (`themes/lib/render.mjs` lines 267 to 274) | `<p class="g4d-footer__powered" data-g4d-powered-by>Powered by <a href="https://get4domain.com" target="_blank" rel="noopener">Get4Domain</a></p>` | constants `POWERED_BY_HREF` and `POWERED_BY_BRAND`, hard-coded; "nothing passed to the renderer can switch it off"; a followed link (no `nofollow`), no UTM, no vendor or category context; text "Get4Domain", not "Get4Domain.com". Whether the backend loads exactly this file at runtime (`renderer-loader.ts`) was not confirmed |
| P11 kit (`components/site-kit/SiteApp.tsx` line 173) | `<footer class="sk-foot"><small>Powered by Get4Domain.com</small></footer>` | **plain text, no link**; the decided wording |
| Engine designs (`engine/shell/ShellFooter.tsx` 43 and 56, `engine/kit/*`, `real-estate`, `retail`) | `<p>Powered by Get4Domain</p>` | plain text, no link, no `.com` |

The code comment of `render.mjs` names a React twin `get4domain_mvp/src/engine/components/PoweredBy.tsx`; **that file is not on the branch**. The directory backlink block (M.2) is a separate, undrawn footer element. Net: only the static-rendered themes carry a link; the kit and engine sites carry text only; none points to the vendor's directory category or city page.

### M.5 How the subdomain name is chosen and locked

- **Chosen:** at registration. Public check `GET /v3/public/subdomain-availability` (`v3-trial`, `TrialSignupPolicy.check`) answers AVAILABLE, INVALID (with a reason), RESERVED or UNAVAILABLE, plus a similar-address warning (`DuplicateCheckService`, a warning never a block). Registration (`resolveSubdomain`) uses the same rules: length 3 to 40 by default, lowercase letters, digits and single hyphens, no hyphen at either end, look-alike folding, the reserved list and blocked words. A chosen name that fails is refused with the registered code (`SUBDOMAIN_INVALID`, `SUBDOMAIN_RESERVED`, `HOST_UNAVAILABLE`). With no choice a name is made from the business name and numbered (`admin` becomes `admin-2`) until allowed and free, up to 200 tries.
- **Reserved:** 19 mandatory names (`www app admin api gapi directory media partner mail send` plus the 9 V2 client names) can never be removed by the setting (`site-domains/settings/reserved-subdomains.ts`); the editable list adds to them; the public site adds its own union (`hostnames.ts`: about 70 technical names, and any label starting `v3` or `t3-`). **The blocked-word list is empty until the owner supplies it** (comment in `domain-settings.ts`: "none is invented here").
- **Taken means:** `Vendor.subdomain` is unique, or a host row of any state exists, so **a removed address keeps its name forever** and nobody else can take it.
- **Locked?** **No, limited.** `PUT /v3/me/domains/subdomain` is `@TabOpen`, open on every plan including Free. Default limit **2 changes per 365 days** (`subdomainChangeLimitPerPeriod`, `subdomainChangePeriodDays`); over the limit answers `429 SUBDOMAIN_CHANGE_LIMIT`; staff are not limited but need a written reason (3+ characters). Each change retires the old host row, creates or reactivates the new one, updates `Vendor.subdomain`, adds a 301 from the old host and writes an audit row (`domain.subdomain.set`). Nothing locks the name after first publish or after indexing. `docs/v3/V3_PACK_ENGINE.md` section 13 (B11) still says a Free vendor can no longer change it; the code now has `@TabOpen` on that route, so the document is stale.

### M.6 How a new vendor address gets its nginx entry today

- **There is no per-vendor nginx entry for V3, and nothing writes one.** No backend code touches nginx (the word appears only in proxy-trust comments), and no certificate automation exists for vendor hosts (a search for certbot, acme and caddy found only the old `indianambulance.conf` comment and one unrelated line).
- **The mechanism is a wildcard:** one server block `server_name *.get4domain.com` on the host, a wildcard certificate, and a wildcard DNS record through Cloudflare (`deploy/v3live/nginx/WILDCARD_SWITCH_LATER.md`). The public site's middleware then reads the Host header and rewrites `<name>.get4domain.com` to `/site/<name>` (`middleware.ts`); the backend resolves the host to the vendor (`site-domains/host-directory.ts`). A registration therefore needs no nginx change or reload.
- **Today the wildcard points at V2** ("Today the wildcard serves the V2 vendor sites", `WILDCARD_SWITCH_LATER.md`). The switch to V3 is one `proxy_pass` change to the public site on `:3006` plus two include lines, `nginx -t`, reload; it is **E1c, owner's, not done**, and is blocked until every V2 vendor name has its own explicit server block (list from `Vendor.subdomain`). The V2 upstream is not recorded in the repo.
- **V2 clients with their own app needed one hand-written file each** (example `deployment/nginx/indianambulance.conf`: `server_name indianambulance.get4domain.com`, `proxy_pass http://localhost:3017`, `ln -s` into `sites-enabled`, `nginx -t`, reload, HTTP only because "Cloudflare SSL/TLS mode on this zone is Flexible"). Explicit files for `mrtravels` and `s2travels` are in `deploy/v3live/nginx/` with unfilled upstream placeholders on purpose. The five V3 platform hosts (`api app admin partner directory`) have explicit files filled by the runbook (steps 30 to 34).
- **Cloudflare mode conflict:** `indianambulance.conf` says the zone is Flexible (no certbot, no redirect); `RUNBOOK.md` step 35 says SSL/TLS must be Full (strict) and its server blocks redirect 80 to 443 with a certificate. Both cannot hold on one zone; the owner must confirm which is live.
- **Custom domains:** ownership is verified by a TXT check (`site-domains/core/verification.ts`, `serveHosts` in the canonical plan), but **no nginx server block and no certificate is created for a custom domain** by anything in the repo. Status: MISSING (custom domains cannot serve over HTTPS without manual work).
- **Free versus Pro address:** both get the same `<name>.get4domain.com` wildcard path; the Free site's address is created when the vendor registers (`v3-trial/module-trial-site.ts` publishes on the chosen subdomain; for the V2 public app it also sets the legacy site status LIVE, S1.1). With the wildcard still on V2, a new V3 vendor is reachable only through the V2 public app's `GET /cms/site/<subdomain>` route; whether the V2 wildcard target runs the same Next app as `v3-pub-fe19` is not known from the repo.

---

## 12. What the owner's scope adds to the audit (new requirements against the code)

| Requirement | Status | Evidence / gap |
|---|---|---|
| All 45 families and 1,213 unique sub categories | MISSING | A.2, A.3, C4 |
| Sub categories in more than one family (61) | MISSING | A.3 |
| Each pack complete with own tab menu and fields | PARTIAL | B: 16 packs DRAFT, small field sets, 53 categories `needsBlueprint` |
| Admin-created sample data per category, flagged sample, editable | PARTIAL | 16 pack demos (`v3-packs/pack-demo/pack-demo-content.json`, `isSample: true`) and the V2 starter seeds with sample markers (`site-doc/sample-markers.ts`, vendor edits replace them). No generator, no per-category or per-sub-category set, no admin screen |
| Install app | BUILT (kit sites) | E.7, L.2 |
| Mobile bottom navigation | BUILT (kit sites, engine shell) | E.7 |
| Animation | BUILT for backend theme packages (motion kit) | not for the P11 kit proven; check |
| Hero | PARTIAL | E.2 |
| Multiple landing pages | MISSING | E.4 |
| Theme customised with the vendor name | PARTIAL | the kit uses the business name for H1, title, manifest, app icon (initial on accent colour); no logo derived palette; name appears in the theme text only through content fields |
| Customised SEO, AEO, GEO | PARTIAL | E.5 |

---

## 13. Verified or unverified: what I did not check

- No test, build or render was run. Test coverage is read from file and test names.
- Frontend admin `Settings` SEO controls, tablet/mobile preview, `v3/public/themes` target exposure, the P11 kit's CSS animation and whether R1 work on this branch changed storage and mail status were not read in detail.
- Vendor app `WebsiteScreen` reorder UI was not read to the line.
- The `2 MISSING` and counts are from the code on the named branches only; the live database may differ (the seeds were not compared with staging, and I touched neither).

---

## 14. Proposed lane list (whole scope, no priority order)

Order is build order by dependency, not priority: engine lanes, then the sample-data generator, then review by family. Size S (about one lane-day), M (several), L (a week or more). Each lane names its repo: **BE** = backend (`backend-api`), **AD** = admin (`get4domain-ui` apps/admin), **VA** = vendor app (apps/vendor), **PS** = public site (`get4domain-pub` get4domain_mvp).

### Engine lanes

| Lane | Repo | What | Depends on | Size |
|---|---|---|---|---|
| E1 | BE | **Taxonomy tables**: `category_families` (45), `categories`, `subcategories` (1,213 unique), link table family to sub category (many to many), `related families` table, pack default per family; additive migration, RLS, loader from the owner's input file (dry run first), counts test (45 / 1,277 listed / 1,213 unique / 61 multi). Decide the fate of the 196 (map them in) | decisions Q1 to Q4 | L |
| E2 | BE | Inheritance model: family defaults, category overrides, sub category overrides (config JSON per level, resolver pure function, "most specific wins", tested like `profile-core`) | E1 | M |
| E3 | BE | Pack completion engine: pack per family or family to pack map for all 45; tab menu and field sets completed per pack, `reviewStatus` flow; per-category field overrides | E1, Q5 | L |
| E4 | BE | Service catalogue per sub category (master list), vendor selection and edits (text, price, images), action type per service (Book, Quote, Enquiry, Order, Appointment), vendor edits never change the master | E1 | L |
| E5 | BE | Price rules: optional price, admin default price for vendor approval, approve, change or hide, public hide until approved (per Q9) | E4 | M |
| E6 | BE | Category-specific forms: `form_templates` per family, category and sub category, validated field sets on `V3Request`, new `BOOK` kind mapping, vendor sees the form answers | E1, E4 | L |
| E7 | BE | Request flow completion: confirm and decline for every kind, notification to vendor and customer (flag-gated sandbox), link request to appointment and quote | E6 | M |
| E8 | BE | Website configuration per level: template assignment (family, category, sub), menu preset, section list, enabled features; theme targets storage (L.4 changes 1, 2, 4) | E2 | L |
| E9 | BE | Hero model: slides, desktop and mobile images, focal point, scheduling window, plan gating; banner library kept | E8 | M |
| E10 | BE | Landing pages: family, category and sub category pages with the address scheme, parent and child, specific service pages, sitemap entries, vendor-owned content kept separate from template defaults | E1, E4, E8 | L |
| E11 | BE | SEO, AEO and GEO engine for each vendor: per-level SEO templates using vendor name, service and area; LocalBusiness, Service, FAQ structured data from vendor data only; llms.txt; area pages; wording rules kept | E10 | L |
| E12 | PS | Kit renderer: 16 homepage sections, 12 archetypes (add dealer directory and membership), hero slides with mobile images and focal point, animation level, landing page templates, theme tokens from the vendor name | E8, E9, E10 | L |
| E13 | PS | App shell, Install button, per-vendor manifest, footer line on the 20 engine designs, imported themes and `/vendor-site` pages (L.2) | none | M |
| E14 | BE | Fix `/vendor-site` Free flaws (L.3) and move the relayed pages onto the same footer and shell rules | E13 | S |
| E15 | PS | Public directory portal across the 45 families (browse families and sub categories, city and sub category pages) | E1, E10 | M |
| E16 | AD | **Website Experience Builder** screens (12 tabs): templates and targets, header and navigation, hero and banners, homepage sections, landing pages, category mapping, service catalogue, forms, themes, SEO, preview (desktop, tablet, mobile), publish | E2 to E11 | L |
| E17 | AD | Admin taxonomy screens: families, categories, sub categories, related families, multi-family | E1 | M |
| E18 | VA | Website manager additions: services tick list and edit, price approve and hide, hero slides, landing page content, pack tabs and forms per category, SEO surface per decision | E4, E5, E6, E9, E10 | L |
| E19 | BE | Theme package spec update (targets, hero, landing, motion) and upload validation; keep `THEME_PACKAGE_SPEC.md` aligned for Bolt | E8 | S |
| E20 | BE | Free and Pro gating for all new items in one matrix (data, tested) | Q10 | S |
| E21 | BE | Test hardening: turn p8, p9, p9b string matches into rendered assertions (L.1); run the staging int suites (owner) | none | S |
| A1 | PS | **Address rule**: 404 or 301 for `/site/<name>` on every host that is not the vendor's own; internal links relative to the host (no `/site/<name>` prefix); one canonical tag on every page of every renderer; a test that no rendered link or canonical contains `/site/` | none | M |
| A2 | PS + BE | **One canonical and one sitemap source per vendor host**: the Next sitemap route and the kit/theme canonicals use the backend's canonical host (custom domain when the add-on is active), and a single page list; Free canonical and robots decided | A1 | M |
| A3 | PS + BE | **One footer**: a single Powered by Get4Domain.com link rule used by the static renderer, the kit and the engine designs (text, href from config, `rel`, UTM decision), plus drawing the backlink block (`directoryLinks`) in the kit and in the theme runtime | A1, Q23 | M |
| A4 | BE + AD | Subdomain policy: lock or limit decision applied (Q21), blocked-word list loaded, address-change screen text, the stale pack-engine doc corrected | Q21 | S |
| A5 | owner + BE | **nginx and TLS**: switch the wildcard to V3 (E1c), confirm Cloudflare mode, explicit blocks for every V2 name; a documented, tested path for custom-domain certificates and server blocks (no code exists) | Q24, Q25 | L |
| A6 | PS | Directory host as the only directory address (set `DIRECTORY_PUBLIC_BASE_URL`, retire `/directory` on the main host), keyword and location pages over the 45 families, followed link decision for the click-out | E1, E15, Q22 | M |

### Sample-data generator (after the engine)

| Lane | Repo | What | Depends on | Size |
|---|---|---|---|---|
| G1 | BE | Sample data model and flag: sample services, prices (hidden by default), FAQ, hero banner, testimonials-free, tab sample records, per sub category; `isSample` stored, vendor edit clears the flag, never shown as real | E4, E5, E9 | M |
| G2 | BE | Generator: admin-triggered, deterministic per sub category, uses family and pack defaults, no invented claims (owner rules 4 and 13), prohibited-term scan on output; dry run, counts, idempotent | G1, E2 | L |
| G3 | AD | Admin screen: generate, review, edit, approve sample sets per family, sub category | G2, E16 | M |
| G4 | VA | Vendor sees sample marks, replaces sample items, publish blocks nothing but never marks sample as real | G1 | S |
| G5 | PS | Render sample flags (sample text in previews only, live pages never show unreplaced sample, matching P11 rule) | G1 | S |

### Review by family (after the generator)

45 review lanes, one per family, no order. Each lane covers: sub categories correct and related-only rules, pack tabs and fields, service catalogue, forms, hero and sample data, landing page tree, SEO/AEO/GEO output, Free and Pro view at 375, 768 and 1280, install app and bottom nav, counsel text where a pack is gated. Size S to M each (S for families that map onto an existing pack, M for the 12 families that have no pack home today: Agriculture, Pets, Security, Government, Recruitment, Astrology, Waste, Baby and Family, Medical equipment, Textiles, Wellness products, Other local). Lanes R01 to R45 in the input file's numbering, plus one cross-family review for the 61 multi-family sub categories (M).

---

## 15. Decisions the owner must make (yes or no)

1. Keep the 196 existing categories as the starting point and re-home them under the 45 families (yes), or rebuild the master from the input file only (no)?
2. Is the input file's list the final sub category list (1,213 unique), so duplicates across families are stored once and linked to each family (yes)?
3. Should the 61 multi-family sub categories keep every family they appear in (yes), instead of choosing one?
4. May a vendor pick sub categories from related families only, with the related-family map written by us from the 45 (yes), or should the owner supply that map (no)?
5. Should each of the 45 families get its own pack (45 packs), instead of mapping the 45 onto the existing 16 plus new ones only where the workflow differs? (Answer yes for 45 packs.)
6. Do you want the four counsel-gated packs (Clinic, Lab, Pharmacy, Legal and finance) built to full completeness now, with the counsel switch still OFF until counsel approves (yes)?
7. Is a service's action type (Book, Quote, Enquiry, Order, Appointment) one per service, chosen by the platform per sub category, with the vendor allowed to change it (yes), or fixed by the platform (no)?
8. Should "Book" be a separate stored request kind from "Appointment" (yes), or the same?
9. Should admin default prices stay hidden publicly until the vendor approves them (yes, the proposed rule)?
10. Should the vendor be able to hide any price after approving it (yes)?
11. Should a Free site show the sample services from the admin generator (yes), or only the vendor's own entries plus category-level service names (no)?
12. Does Free get the multi-slide hero and animation (yes), or only Pro (no)?
13. Do Free sites get landing pages for their category and sub category, as plain information pages with no forms (yes)?
14. Should Free sites carry the per-vendor customised SEO, AEO and GEO described above (yes), given the rule that Free is information only?
15. Is the Free-edit review step (staff approve each Free change, Amendment 06) to continue for the new content (hero, services, landing text) (yes)?
16. Should the theme customised with the vendor name mean name in text, title and icon only (yes), or also a palette taken from the vendor's logo (no)?
17. Are the Pro engine-design sites and imported themes to be brought to the same shell, Install button and footer line (yes), or retired in favour of the kit and package themes (no)?
18. Should the admin Website Experience Builder be built as one new screen group with all 12 tabs (yes), or added to the existing Themes and Catalog screens?
19. Should a directory page exist for every one of the 45 families and sub categories, indexable once counsel approves (yes)?
20. Should the sample-data generator write straight into every vendor site at registration (yes), or only into previews and admin-created sites (no)?
21. Should a vendor's subdomain be locked once the site is first published (yes, only staff can change it with a reason), instead of the present two changes per 365 days on every plan?
22. Should the directory's "Visit site" link stay a `nofollow` click-out (yes), or become a normal followed link to `<name>.get4domain.com` once the directory pages are indexable (no)?
23. Should the footer link be one rule everywhere: text "Powered by Get4Domain.com", pointing to the main site, followed, with no vendor-specific tracking (yes)?
24. Is the Cloudflare SSL mode Full (strict) for the whole zone, with the old Flexible vhost files retired (yes)?
25. Should the wildcard switch to V3 (E1c) happen before any new V3 vendor is registered (yes), rather than keep new vendors on the V2 wildcard?
26. Must `get4domain.com/site/<name>` return 404 on the main host (yes)?
27. Is a custom domain to be served automatically (certificate and server block created by us) (yes), or by hand for each request (no)?

---

## 16. Conflicts between the input files and the code

1. **File names**: the brief says `category_master_45.txt` and `website_engine_architecture.md`; the files are `REQ_CATEGORY_MASTER_45_FAMILIES.md` and `REQ_WEBSITE_ENGINE_ARCHITECTURE.md`, plus a third file (`V3_WEBSITE_ENGINE_DECISIONS_20NOV2026.md`) the brief does not name.
2. **Folder and branch**: the brief calls `get4domain-w2` the Wave 2 backend; its branch is `v3-lane-r1`.
3. **"Data has 29 main categories"** (decisions file) is true of the frontend data file only. The backend has 196 V3 categories in 21 families, 24 V2 launch categories and 53 directory categories. Counting "main categories" depends on which list.
4. **Families**: the input says 45 families; the code has 21 (V3), 8 (layout flow families) and 12 (directory parents). The word "family" means three different things in the code (sheet family, layout flow family, directory family). The 8 flow families are layout archetypes, not the 45.
5. **Pack keys**: the architecture file's keys (RESTAURANT, ECOMMERCE, REAL_ESTATE, TRAVEL) do not exist; real keys are FOOD_SERVICE, RETAIL, PROPERTY, HOSPITALITY_EVENTS. "Ecommerce" is a **plan tier** (1,499) in the code, not a pack. The decisions file lists 13 real keys; the code has 16. LAB and PHARMACY appear in the decision file as real keys but are counsel-gated (hidden by default).
6. **"Not 45 separate apps"** matches the code's data-driven approach; the code, however, has three separate renderers (kit, backend theme renderer, engine designs) not one reusable frontend engine, so "one reusable frontend engine" is not true today.
7. **Inheritance**: the architecture says the system "inherits the Home Services family configuration"; the code inherits only profile fields (pack to category). The decision "family defaults, then category, then sub category" is not implemented.
8. **A vendor may pick several sub categories from related families** (decision) conflicts with the code's rule "one primary pack and one category, never changes" (`PACK_ALREADY_SET`, `V3_PACK_ENGINE.md` section 7).
9. **Free sites**: the architecture shows Free-style pages with "Book a Service", "WhatsApp Us" and "Send Enquiry" buttons; the decisions file and the code say Free has none (information only).
10. **Hero**: the architecture asks for scheduling, desktop and mobile images and focal point; nothing of the three exists, and the vendor app has no hero editor beyond one image.
11. **Landing page address scheme**: architecture uses `/home-services/ac-repair/`; the existing public URL scheme for the directory is `/{city}/{category-plural}` and vendor site pages are `/services`, `/gallery` and one `item` page each, with the page slug fixed by the kit (`V3_WEBSITE_MANAGER.md` gap 5).
12. **Site sections**: the architecture's 16 homepage sections vs the kit's 9 block types vs the editor map's six expected sections (`hero about services faq gallery contact`): three different lists.
13. **Menu**: the architecture says menus are configured in admin and drawn; the code stores `navigation` but draws a fixed menu (`navigation:renderer-menu-fixed`).
14. **Amendment 07 conflicts with the architecture**: the vendor SEO tab was removed from the vendor UI by owner amendment, while the architecture lists "SEO & Metadata" as an admin tab and "vendor customisation" of SEO.
15. **Footer line**: the decision says "Powered by Get4Domain.com" everywhere; engine designs print "Powered by Get4Domain" (without .com), and only the kit prints the decided line.
16. **Sample data**: the decision says sample data is created from the admin side for every category; the existing sample content lives in code and JSON (`pack-demo-content.json`, `site-doc/seeds`), created by developers, not by an admin screen.
17. **Counts**: the decisions file says "about 1,300 sub categories"; the input file has 1,277 listed and 1,213 unique (confirmed by recount).
18. **Address rule vs code**: "never a path" conflicts with the public site, where `/site/<name>` is a live route on the main host and engine, kit and theme-pack pages build links as `/site/<name>/...` even on the vendor's own host (M.1). The architecture file's `/home-services/ac-repair/` example is a path under the vendor host and does not conflict, but the directory fallback `/directory` is a path address on the main host when `DIRECTORY_PUBLIC_BASE_URL` is unset.
19. **Canonical**: backend rule 4 (custom domain canonical when the add-on is active) vs the public sitemap route and the theme-pack canonical, which always use `<subdomain>.<base>` (M.3).
20. **Footer**: decision says "Powered by Get4Domain.com"; the static renderer writes a link with the text "Get4Domain" to a hard-coded URL; the kit prints the decided text with no link; engine designs print text without `.com`; a React twin named in `render.mjs` does not exist (M.4).
21. **Subdomain "locked"**: the owner's wording (chosen and locked) vs the code, which lets every plan change it twice a year; `V3_PACK_ENGINE.md` says Free cannot change it, the route says it can (M.5).
22. **Cloudflare mode**: `deployment/nginx/indianambulance.conf` (zone is Flexible, no redirect, no certbot) vs `RUNBOOK.md` step 35 (Full strict, 80 redirects to 443) (M.6).
23. **Wildcard**: the public site's middleware assumes `<name>.get4domain.com` reaches it, but the wildcard still serves V2 until E1c; `WILDCARD_SWITCH_LATER.md` says the switch is not part of the first deploy.
