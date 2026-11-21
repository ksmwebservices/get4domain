# Category Families — As Built

> Date: 2026-11-03 · Branch `v3-step0` · **Read-only static audit.** Source read only: no server, no database, no tests, no `.env*`. Nothing in the repo was changed.
> Sources: `backend-api/src/site-doc/{families,pack.types,packs.service,pack-resolve,pack-seeds,industry-seeds,shell,site-doc.constants,starter.service}.ts`, `site-doc/seeds/part{1,2,3}.ts`, `site-doc/design-vocab.json`, `backend-api/src/leadspace/leadspace.types.ts`, `backend-api/src/config/industries/index.ts`, `get4domain_mvp/src/engine/registry.ts`, `get4domain_mvp/src/data/{demo-site,industry-content}.ts`, `schema.prisma`.
> Related: `THEME_CONTRACT_AS_BUILT.md` (how themes attach to categories), `EXISTING_UI_AND_DATA_INVENTORY.md`.
> "Which categories exist in the production database" is **not verifiable here**; the lists below are what the code seeds and defines.

## 1. Summary

- A **flow family** decides layout and behaviour for a group of categories. There are **8 families** (`FamilyKey` in `site-doc/families.ts`): `shop booking enquiry packages menu portfolio listings courses`.
- A **category** is a **Category Pack** (`CategoryPack` table, JSON `config`): data, not code. The code seeds **24 launch categories**, each tied to one family. An admin can add or edit packs with no deploy (`packs.service.ts`).
- Every pack has **exactly four enabled designs** (`classic`, `bold`, `minimal`, `warm` in the seeds), one default, a shell (wording + five bottom-nav slots), and sample starter content.
- Category identity is spread across **five separate lists that do not match** (section 6). The nearest thing to a single source is the 24 launch categories.
- Families are about **site layout and visitor action**. They are unrelated to V3 tracks (Handyman / Professional / Ecommerce) and to the `Category` Prisma model (a vendor's product categories).

## 2. The eight families (`FAMILIES`)

| Family | Label | Flow | Goal | Home pages | Item kind | Item layouts | Extra item fields | SEO type | Palette (4 theme keys) |
|---|---|---|---|---|---|---|---|---|---|
| `shop` | Shop and cart | cart | `CART_ORDER` | Home, Products, About, Gallery, Contact | product | catalog-grid, catalog-list, catalog-compact, tiles, cards | tags | Store | bold-violet, midnight-gold, clean-teal, sunset-orange |
| `booking` | Booking and appointment | booking | `APPOINTMENT` | Home, Services, About, Gallery, Contact | service | cards, rows, menu, tiles | duration | LocalBusiness | clean-teal, ocean-dark, soft-rose, warm-sand |
| `enquiry` | Enquiry and services | enquiry | `ENQUIRY` | Home, Services, About, Work, Contact | service | cards, rows, tiles, index | — | ProfessionalService | classic-blue, plum-night, clean-teal, harbour-amber |
| `packages` | Packages and tours | enquiry | `ENQUIRY` | Home, Packages, About, Gallery, Contact | package | package-cards, package-featured, package-horizontal, tiles | duration, includes | TravelAgency | warm-sand, ocean-dark, sunset-orange, fresh-green |
| `menu` | Menu and orders | booking | `BOOKING` | Home, Menu, About, Gallery, Contact | product | menu-twocol, menu-tabs, menu-photo, cards, tiles | veg | Restaurant | warm-sand, midnight-gold, street-orange, fresh-green |
| `portfolio` | Portfolio and gallery | enquiry | `ENQUIRY` | Home, Work, About, Gallery, Contact | case | tiles, rows, cards | location, year | LocalBusiness | midnight-gold, clean-teal, plum-night, soft-rose |
| `listings` | Listings | site-visit | `SITE_VISIT` | Home, Properties, About, Gallery, Contact | listing | cards, rows, tiles | bedrooms, area, location | RealEstateAgent | classic-blue, midnight-gold, fresh-green, warm-sand |
| `courses` | Courses and classes | booking | `BOOKING` | Home, Courses, About, Gallery, Contact | service | cards, rows, tiles, index | duration, mode, level | EducationalOrganization | classic-blue, forest-night, bold-violet, sunset-orange |

Each family also carries: `nav` labels by section (a link shows only if its section has content; e.g. booking's last link is "Book", listings' is "Site visit"), `imageMood`, `imageSetSize` (4–6 starter pictures), and four design templates (`designs[]`).

**Each family's four designs** (same pattern in all eight): Classic (font sans/classic, soft radius, solid button, bar nav, columns footer, `actionBar: tabs`), Bold (sharp radius, centered nav and footer, `actionBar: cta`, announcement bar), Minimal (outline button, minimal nav and footer, `actionBar: split`), Warm (humanist font, round radius, pill button, `actionBar: cta`). What differs per family is the **section order and variants** (for example `hero:split trust:icons items:cards …`).

**Design vocabulary** (`design-vocab.json`): 17 section types (`announce hero trust items about pricing process stats team gallery beforeAfter testimonials faq hours enquiry contact cta`), 4 fonts, 3 radii, 3 button styles, 3 nav styles, 3 footer styles, 3 action-bar styles. `validateDesign` requires a hero and an enquiry section, at least three sections, valid variants, and an items layout that suits the family.

**Older layout vocabulary** (`SITE_VARIANTS`): hero (overlay, split, panel), about (split, centered, columns), services (rows, cards, menu, tiles), gallery (mosaic, grid, strip), testimonials (cards, quote, list), contact (card, split, minimal). 13 colour themes (`SITE_THEME_KEYS`).

## 3. The 24 launch categories (`site-doc/seeds/part1–3.ts`, `CATEGORY_SEEDS`)

| Family | Categories (pack key — name — item noun — SEO type — default theme) |
|---|---|
| shop (2) | `retail` Retail and e-commerce — product — Store — bold-violet · `agriculture` Agriculture — product — LocalBusiness — fresh-green |
| booking (5) | `salon` Salon and beauty — service — BeautySalon — soft-rose · `clinic` Clinic and healthcare — treatment — MedicalClinic — clean-teal · `diagnostics` Diagnostics and labs — test — MedicalClinic — clean-teal · `gym` Gym and fitness — plan — SportsActivityLocation — forest-night · `automobile` Automobile services — service — AutoRepair — ocean-dark |
| enquiry (7) | `professional` Professional services — classic-blue · `advocate` Advocate and legal — practice area — LegalService — ocean-dark · `finance` Finance and advisory — classic-blue · `technology` IT and web services — plum-night · `home-services` Home services — HomeAndConstructionBusiness — sunset-orange · `logistics` Logistics and transport — MovingCompany — classic-blue · `general` Other business — LocalBusiness — clean-teal |
| packages (3) | `travel` Travel and tours — package — TravelAgency — warm-sand · `hotel` Hotel and hospitality — room — LodgingBusiness — warm-sand · `events` Events and venues — package — LocalBusiness — plum-night |
| menu (1) | `restaurant` Restaurant, cafe and catering — dish / "menu" — Restaurant — warm-sand |
| portfolio (3) | `photography` Photography and studio — package — midnight-gold · `freelancer` Freelancer — service — ProfessionalService — clean-teal · `construction` Construction and interiors — project — GeneralContractor — sunset-orange |
| listings (1) | `realestate` Real estate — property — RealEstateAgent — classic-blue |
| courses (2) | `education` Education and schools — course — EducationalOrganization — classic-blue · `coaching` Coaching and tutoring — programme — EducationalOrganization — bold-violet |

Total 2+5+7+3+1+3+1+2 = **24**. Four of them (`advocate`, `freelancer`, `home-services`, `general`) have no website-engine entry and no `IndustryConfig` (section 6). `retail`, `salon`, `clinic` and others carry **aliases** so LeadSpace trade ids resolve to them (for example `shop-retail`, `salon-beauty`, `clinic and doctor`). Aliases for `builders-interiors`, `photography-events`, `tutor`, `startup`, `real-estate`, `restaurant-food` exist in `part2.ts`/`part3.ts`; I did not map each one to its pack.

## 4. What a Category Pack holds (`pack.types.ts → PackConfig`)

`keywords[]` (match a vendor's industry), `goal`, `ctaLabel`, `sections[]` (7 legacy: hero, services, about, gallery, testimonials, faq, contact), `item {kind, noun, nounPlural}`, `defaults {tagline, about, headline, subline, trust[], faq[]}` with `{business} {city} {phone}` placeholders, `themeKey`, `layouts`, `seoType` (17 allowed schema.org types), `aiPrompts {about, tagline, images}`, and the "industry designs" block: `family`, `designs[4]`, `defaultDesign`, `seed` (starter content), `shell`.

- **Starter content** (`StarterSeed`): headline, subline, tagline, about, announce, cta, trust, steps, quotes, 3–12 items, 3–12 FAQs, motif, hue, `images {hero, gallery[4]}` at `/starter/<key>/…webp`. Everything is **marked sample**: prices and quotes are hidden on the public page until the vendor edits them.
- **Shell** (`shell.ts`, `SHELL_OVERRIDES`): wording (`terms.team/teamOne/items/itemOne/groups`, popup title) and five bottom-nav slots. Overrides exist for 14 categories (clinic, diagnostics, salon, gym, restaurant, retail, travel, hotel, realestate, education, coaching, technology, photography, construction); the rest use the family default.
- **Validation** (`validatePack`/`validateDesigns`): plain-sentence errors; exactly 4 enabled designs; a default among them; keys `^[a-z0-9]+(-[a-z0-9]+)*$`.
- **`completePack`**: an admin may supply only a family and starter content; the four designs, default design, shell and legacy fields are filled from the family.

## 5. How a vendor gets a category and a design

- **Resolution:** `StarterService.packFor(packKey, industry)` tries `VendorCMS.packKey`, then `vendor.industry` as a pack key, then a case-insensitive match against pack `keywords`; a pack counts only if it has `seed`. `resolvePack` (`pack-resolve.ts`) does the same for the public site and strips `seed` before it leaves the server.
- **Generate:** `POST generate` (vendor) / `POST sites` (admin) writes `VendorCMS.packKey`, the company details, then lays the starter content over every empty or still-sample field **as a draft**; the vendor edits and publishes. Not allowed for vendors on a connected (own) app.
- **Switch design:** `GET designs` / `POST design` keep the vendor's content; the choice is stored in `VendorCMS.designKey` as a draft. A live free theme can replace one of the four slots (`freeSlots`); a paid theme comes from the marketplace tab (see the theme doc).
- **Admin:** `packs.controller.ts` — list/get/preview (any staff), create/edit/duplicate/seed (`CommercialAdminGuard`). `POST seed/starter` creates the missing launch categories and **adds** the family, designs and starter content to an older pack that lacks them, keeping everything an admin edited (`planStarterSeed`).

## 6. Where "category" is defined — five lists that disagree

| # | List | Where | Size | Notes |
|---|---|---|---|---|
| A | **Category Packs** (launch categories) | `site-doc/seeds/part1–3.ts`, `CategoryPack` table | **24** | Website Manager (`site_doc_v2`) source. Ties each category to a family. |
| B | **Website engine registry** | `get4domain_mvp/src/engine/registry.ts → REGISTRY` | **20** | Real Estate (bespoke), Retail (bespoke), 18 built from the shared kit. The 20 are exactly A minus {`advocate`, `freelancer`, `home-services`, `general`}. |
| C | **Backend `INDUSTRY_CONFIGS`** | `backend-api/src/config/industries/index.ts` | **21** (20 + `general`) | DomainApp dashboard config; aliases `healthcare→clinic`, `beauty→salon`, `fitness→gym`. A second alias map lives in `demo-site.ts`. `IndustryExperience` (20-industry registry) is a database mirror; project notes say there are two code mirrors to keep in sync. **Not re-verified here.** |
| D | **LeadSpace trades** | `leadspace/leadspace.types.ts → CATEGORIES` | **12** | `home-services builders-interiors real-estate freelancer startup photography-events tutor salon-beauty shop-retail restaurant-food advocate clinic`. Different ids (`real-estate` vs `realestate`, `salon-beauty` vs `salon`); `regulated` flag for advocate/clinic/real estate. |
| E | **Frontend demo catalogue** | `get4domain_mvp/src/data/industry-content.ts`, `demo-site.ts` | **30** category ids (the 20 engine ids + `petcare movers astrology pestcontrol interior homeservices rentalservices printing recruitment government`) | `SUBCATEGORIES` has entries for 19 of them: **95 entries in total, 19 of which are the "general" placeholder** (counted by script over the source; treat as ≈76 curated sub-types). `allDemoPaths()` builds ≈678 `/demo/…` URLs from this. |

**Collisions and gaps (facts):**
1. The ten extra demo categories (E) have **no pack, no engine entry and no `IndustryConfig`**: a demo can exist for `petcare` with no way to generate a live site for it.
2. Four packs (`advocate freelancer home-services general`) have no website-engine entry, so `getEngineIndustry()` returns null and the vendor site falls to the generic path unless `site_doc_v2` is on.
3. Pack key `general` ("Other business") is the fallback category; the 20-industry lists have no equivalent.
4. `pack-seeds.ts` still defines an older `starterPacks()` (12 trades + 20 industries, 31 after de-duplication). **Nothing outside that file imports it**; the live seeding path uses `starterDesignPacks()` (the 24). Likely dead code (not run to confirm).
5. The Prisma model `Category` (`g4d_categories`, per-vendor product categories with `vendorId`) is unrelated to all of the above despite the name; so is `VendorProduct.industryType`.
6. **Sub-categories exist only in list E** (frontend demo data). The backend pack model has no sub-category concept; vendors' items carry a free-text `category`.
7. Mapping a vendor's `industry` string to a pack depends on `keywords` equality; there is no foreign key from `Vendor` to `CategoryPack`.

## 7. Observations for V3 planning (facts, not decisions)

- **Families are reusable as the "layout archetype"** for any V3 track: the family set, design vocabulary and pack validation are data-driven and already validated. A V3 category does not need code if it fits one of the 8 families.
- **Tracks have no home yet.** Neither `CategoryPack` nor `FAMILIES` records a track (Handyman / Professional / Ecommerce) or a Free/Pro tier. Handyman categories would map to `home-services` / `booking` / `enquiry` packs; Ecommerce to `shop` / `menu`; Professional to `booking` / `enquiry` / `portfolio` / `courses` — an inference from the data above, not something the code states.
- **Sub-category and city/directory pages** (V3.2/V3.9) would need a new source of truth; the only sub-category data today is a frontend TypeScript file used for demos.
- **Not verified here:** which packs exist and are `enabled` in production, how many vendors use each, and whether production `IndustryExperience` rows match the code.
