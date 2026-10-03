# Universal Catalogue Model — audit, design, migration runbook

> Dispatch 03-Oct-2026. **Additive only.** Nothing was applied to the database, nothing dropped, `CatalogItem` and `RetailProduct` are untouched and still serve live code. Cutting live code over to the unified table, and retiring the old tables, is a **separate future dispatch** (checklist at the bottom).

## 1. Audit — what actually exists (live DB, read-only, 2026-10-03)

| Model (table) | Rows | Vendors | Industries | Real vs demo |
|---|---|---|---|---|
| `VendorProduct` | **28** | 3 | retail 14 (stepnrock), travel 7 (mrtravels), photography 7 (deebiphotography) | all real (`isSandbox=false`), all active |
| `CatalogItem` (`g4d_catalog_items`) | **117** | 39 | clinic 30, realestate 18, retail 21, restaurant 9, salon 9, finance 6, photography 6, + 6 other industries × 3 | **100% sandbox demo vendors** (3 seeded rows each by `DemoService.seedVendor`); 0 real |
| `RetailProduct` (`g4d_retail_products`) | **0** | 0 | — | the retail POS never had a row; `PosSale` is also empty |
| `Category` (`g4d_categories`) | 9 | 2 | retail 8, photography 1 | all linked from `VendorProduct`; mrtravels has 7 products and **no** `categoryId` (free-text `category` only) |

**Finding that reframes the dispatch:** the three-store split is real in code but, in data, there is only *one* store with live content (`VendorProduct`). `CatalogItem` is throw-away demo seed data; `RetailProduct` is empty. So the data migration of *real* data is trivially small and risk is concentrated in **code paths**, not rows.

Other facts the design depends on:
- No same-name duplicates inside a vendor across the three models; **0** id collisions between `CatalogItem.id` and `VendorProduct.id`.
- `g4d_records.catalogItemId` has an FK to `CatalogItem` (`ON DELETE SET NULL`); **234 of 234** records point at a catalogue item (all demo). `PosSale` is empty.
- `VendorProduct.price` is a **string**: 14 plain amounts, 6 × `"On Request"`, 1 × garbage test value (`asdfasdfasdfas`, stepnrock "Sports Shoe"), 7 null (deebiphotography).
- The Operation Registry **is** populated in the DB (17 `g4d_operation_types`, 20 `g4d_industry_experiences`) — so a real FK to it is safe.

### `customFields` pattern (the foundation we build from)
Keys seen live on `VendorProduct`: stepnrock — `gallery, features, sizes, colors, stock ("In Stock"), stockQty (number, 12 rows), rating, reviews, brand, isNew, isBestSeller, originalPrice, tags`; deebiphotography — `slug, eyebrow, title, answer, includes, deliverables, keywords, video{}, gallery, features`; mrtravels — `duration` (1 row). `CatalogItem.customFields` is **unused** (0 rows with a value). The per-industry authoring keys already exist in `get4domain_mvp/src/data/listing-fields.ts` (realestate: area/config/type; restaurant: course/diet/serves; clinic: duration/department; diagnostics: report/sample; hotel: occupancy/amenities; gym: duration/includes; education: duration/seats; …).

### Field inventory — every genuinely distinct field across the three models
| Concept | VendorProduct | RetailProduct | CatalogItem | Unified |
|---|---|---|---|---|
| name, description, image | ✔ | name | ✔ | existing columns |
| price | `String?` (display) | `Float` | `Float` | `price` (display) **+ `priceAmount Float?`** (typed) |
| category | free text + `categoryId` FK | free text | — | existing `category` + `categoryId` |
| active | `Boolean` | `Boolean` | `Boolean` | `active` (legacy flag) **+ `status`** |
| sku | — | ✔ | — | **`sku`** |
| stock | in JSON only | `stockQty Int` (default 0) | `stock Int?` (null = untracked) | **`stockQty Int?`** (null = untracked) |
| reorder level | — | ✔ (default 5) | — | **`reorderLevel Int?`** |
| unit | — | — | ✔ | **`unit`** |
| customFields | ✔ | — | ✔ | existing |

## 2. Design — evolve `VendorProduct`, no fourth table

`VendorProduct` becomes the single catalogue table. It is the only one with live data, the only one the public site/checkout/WhatsApp bot/My Products already read, and the only one with the `Category` relation and the proven `customFields` pattern.

New columns (all nullable or defaulted — see `prisma/schema.prisma`):

| Column | Type | Why |
|---|---|---|
| `industryType` | `String?` | Discriminator = `Vendor.industry` (engine id). Tells readers which `customFields` shape applies. Denormalised on purpose: lets a query/index filter catalogue by industry without a vendor join, and survives a vendor changing industry. |
| `priceAmount` | `Float?` | Typed price for checkout/POS/reports. `price` stays the display string ("On Request", "from ₹500"). Float matches the rest of the schema (`CatalogItem`, `PosSale`). |
| `unit` | `String?` | Promoted from `CatalogItem`: kg, session, night, month — useful in every industry that sells by a unit. |
| `sku` | `String?` | Promoted from `RetailProduct`. Applies to any physical/inventory item (retail, agriculture, restaurant packaged goods, automobile parts); null for services. Indexed `(vendorId, sku)`, **not unique** — `RetailProduct.sku` was never unique, a unique index could make the data copy fail. |
| `stockQty` | `Int?` | **null = not tracked** (CatalogItem semantics); a number = tracked. Resolves the `stockQty 0` vs `null` ambiguity between the two old tables. Promoted because stock/availability recurs across retail, restaurant, agriculture, events (seats), education (seats), hotel (rooms). |
| `reorderLevel` | `Int?` | Promoted from `RetailProduct`; meaningful only when `stockQty` is tracked. |
| `status` | `String default 'active'` | `active \| inactive \| draft \| archived \| out_of_stock`. `active` (Boolean) remains what **live readers filter on** until cutover. |
| `operationKey` | `String?` → FK `g4d_operation_types.key` (`ON DELETE SET NULL`) | Operation Registry linkage (below). |
| `sourceModel`, `sourceId` | `String?`, unique together | Provenance of copied rows (`catalog_item` \| `retail_product`). Makes the copy idempotent and auditable. |

Deliberately **not** promoted (stays in `customFields`): gallery, sizes/colors, rating/reviews, brand, tags, originalPrice, duration/inclusions/deliverables, doctor specialization/qualification/experience, sqft/bedrooms/bathrooms/furnishing, course/diet/serves, occupancy/amenities, seats/mode, warranty, coverage. Reason: each applies to one industry group; promoting them would give 20 industries a table full of columns that are null for them. `customFields` keys per industry are governed by `listing-fields.ts` (frontend authoring) — extending it for the not-yet-listed attributes (clinic `specialization`, realestate split `sqft`/`bedrooms`, retail `sizes`/`colors`) is a cutover-time task, not a schema task.

### Operation Registry linkage
`operationKey` = the operation this item *triggers* (e.g. a salon service → `appointment`, a flat → `site_visit`, a shoe → `cart`/`order`, a tour → `enquiry`/`booking`).
**Resolution rule (to be implemented at cutover):** `item.operationKey ?? IndustryExperience(industryType).primaryOperation`, then validated against `[primary, ...secondary]`. Current registry (live): clinic/salon → `appointment`; diagnostics/hotel → `booking`; realestate → `site_visit`; retail/restaurant → `order` (+`cart`, `pos`, `delivery`, `pickup`); gym → `membership`; finance → `lead`; automobile → `service_request`; coaching/education/construction/events/logistics/photography/professional/technology/travel/agriculture → `enquiry` (secondaries as seeded). `NULL` therefore means "inherit the industry default" — no row is guessed at migration time.

### Behavioural guarantees of the copy (designed in, tested)
- Copies keep the **source id** → `Record.catalogItemId` and future `PosSale` lines remain valid after cutover (verify step checks all 234 records resolve).
- Copies are inserted **`active=false`** with the true state in `status`: every current reader (`WHERE active = true` — public site, checkout, WhatsApp bot) sees exactly what it saw before. Cutover flips `active := (status='active')` for `sourceModel IS NOT NULL` rows in one UPDATE.
- Backfill on the 28 existing rows **only fills NULLs** and never touches `updatedAt`: `industryType` ← vendor industry; `priceAmount` ← parsed plain-numeric price (13 stepnrock + 1 mrtravels; `"On Request"`/garbage stay null); `stockQty` ← `customFields.stockQty` where numeric (12 stepnrock rows; the JSON key is left in place). `status` → `inactive` only for rows already `active=false` (none today).

## 3. Risks found during the audit (read these)
1. **Sandbox cleanup would have broken.** `DemoService.cleanupExpiredSandboxes` deletes `CatalogItem` rows then `vendor.delete`, but never `VendorProduct`. Copying the 117 demo rows would make that cron fail on the `VendorProduct.vendorId` FK and roll back its whole transaction. **Fixed in this dispatch** (one `deleteMany`, a no-op today). The data script defaults to `--scope=real` (excludes sandbox vendors → copies **0** rows today); `--scope=all` requires that fix deployed first.
2. **Public CMS response will expose the new columns.** `GET /cms/site/:subdomain` returns whole `VendorProduct` rows, so `sku`, `stockQty`, `reorderLevel`, `sourceId`, `operationKey` become public once populated. Today they are null for every public row except `stockQty` (12 stepnrock rows, backfilled from a value that is *already public* in `customFields.stockQty`). **Cutover precondition:** replace that `findMany` with an explicit `select` whitelist.
3. `status` vs `active` exist side by side until cutover — intentional, but any new writer must set both.
4. stepnrock's `Sports Shoe` has a garbage price and `stock: "Out of Stock"`; left as-is (not our data to fix).
5. Two stores of "truth" for stepnrock stock (`customFields.stockQty` and the new `stockQty`) until cutover; nothing decrements either today.

## 4. What KSM runs, in order

Run from the VM, `cd backend-api`. **Nothing here has been run against production.**

| # | Command | Writes? | Expected |
|---|---|---|---|
| 1 | `node scripts/catalogue-migration/migrate-catalogue.js` | no (dry run) | schema "NOT applied", plan 0/0/0 (real scope), backfill preview `deebiphotography 7 / mrtravels 7 / stepnrock 14` |
| 2 | `npx prisma migrate deploy` | **yes** — applies `20261003100000_universal_catalogue_columns` (+ the two still-pending `20261002120000`, `20261002130000`) | additive DDL only |
| 3 | `node scripts/catalogue-migration/migrate-catalogue.js` | no (dry run) | schema "APPLIED"; same plan |
| 4 | `CATALOGUE_MIGRATION_CONFIRM=I_HAVE_APPLIED_THE_SCHEMA_MIGRATION node scripts/catalogue-migration/migrate-catalogue.js --apply` | **yes**, one transaction, rolls back if counts differ from the plan | `0` rows copied (real scope), backfill `industryType 28`, `priceAmount 14`, `stockQty 12` |
| 5 | `node scripts/catalogue-migration/verify-catalogue.js` | no | `ALL CHECKS PASSED` — **do not touch anything old until this prints** |
| 6 *(optional, demo data)* | deploy backend with the cleanup fix, then repeat 3–5 with `--scope=all` | yes | copies 117 `CatalogItem` rows as hidden rows; verify then also checks 234/234 records resolve |

Order constraint (same as all migrations here): **apply the schema migration before deploying a backend built on the new Prisma client** — the generated client selects the new columns on every `VendorProduct` query.
Re-running step 4 is a no-op. There is no automated "undo" for the data step because it only adds rows and fills NULLs; the schema rollback SQL is in the migration header.

## 5. Verification evidence (this dispatch)
- `prisma validate` OK; migration SQL is the exact output of `prisma migrate diff` (HEAD schema → new schema, offline): 10 `ADD COLUMN`, 3 indexes, 1 unique index, 1 FK — no `DROP`/`ALTER COLUMN`/`UPDATE`.
- `tsc -p tsconfig.build.json` clean; `nest build` OK; security suite (`scripts/security-verify/run-all.js`) still passes. (`tsc -p tsconfig.json` reports errors only in `backend-api/remotion/` — pre-existing, outside the Nest build.)
- `scripts/catalogue-migration/test-catalogue-sql.js` — 11 offline assertions: write guard, old tables never a write target, column/order parity, copies hidden + id preserved, idempotency, scope handling, `--vendor` injection guard, fill-NULL-only backfill, price regex.
- **Live read-only dry run** (`migrate-catalogue.js`, both scopes): same `SELECT`s the apply step inserts from, executed against production with no writes; a `pg_typeof` probe proves all 22 select expressions have exactly the target column types (this catches the classic "untyped NULL resolves to text" INSERT failure before it can happen).
- **Not provable without writing:** the `INSERT`/`UPDATE` statements themselves have not been executed (no scratch database, and writes to the shared DB are off-limits). Their `SELECT` halves are exercised live; the `INSERT` column list is generated from the same list the type probe checks; the transaction aborts and rolls back unless the inserted counts equal the dry-run plan.

## 6. Future dispatch — cutover & retirement (NOT done here)
1. Public CMS `select` whitelist (risk 2). 2. `CmsService`/`CreateProductDto`/My Products accept & return the universal fields; write `status` + `active` together. 3. Retail module (`retail.service.ts`, POS) reads/writes `VendorProduct` (`stockQty` decrement) instead of `RetailProduct`. 4. `domainapp/catalog.service.ts`, `records.service.ts`, `customer.service.ts`, `summary.service.ts`, `demo.service.ts` seeding and `public-checkout.service.ts` (stock decrement currently targets `CatalogItem`) move to `VendorProduct`; checkout drops the dual lookup. 5. Add `Record.productId` FK → `VendorProduct`, backfill from `catalogItemId` (ids are identical), flip `active := (status='active')` on copied rows. 6. Implement the `operationKey ?? industry primary` resolver and mirror it in `get4domain_mvp/src/config/`. 7. Only then: stop writing the old tables, observe, and *separately* drop `g4d_catalog_items` / `g4d_retail_products` (destructive; own dispatch + backup).
