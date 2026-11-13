# V3 Pack Engine (Amendment 13 Part A, with V3A)

A **pack** is the main industry workflow of a vendor (16 of them). A **capability** is an extra thing a vendor also does (14). The **tier** is the plan track (HANDYMAN, PROFESSIONAL, ECOMMERCE). "Pro" means any paid plan; Free is a trial.
A vendor has exactly one primary pack, chosen from the category, and it never changes with the tier. Everything below is data: nothing in code names a pack, a price, or the tier of a capability.

## 1. Data model (one additive migration: `20261213100000_v3_pack_engine`, RLS on, no policy)

| Table | Model | Holds |
|---|---|---|
| `g4d_packs` | `V3Pack` | one record per pack: names, `disclaimerKey`, `reviewStatus` (DRAFT until the owner approves), `config` JSON (entities, workflows, CRM pipelines, TeleCRM lines, task templates, report set, site sections, field hints, flags, the sheet's own words in `source`) |
| `g4d_pack_tabs` | `V3PackTab` | every tab: `scope` COMMON, PACK, CAPABILITY or ADDON, `ownerKey`, `key`, label, route, `minTier`, `capabilityKey`, `freeTrial`, sort order, active |
| `g4d_capabilities` | `V3Capability` | the 14 capabilities |
| `g4d_tier_capabilities` | `V3TierCapability` | the tier to capability matrix, one row per tier and capability, with a `basis` (AMENDMENT_13_V3, ASSUMED_FOR_OWNER_REVIEW, STAFF) |
| `g4d_pack_categories` | `V3PackCategory` | the 196 categories: pack, minimum tier, optional capabilities, starter services, add-on packs available, notes, `needsBlueprint` |
| `g4d_pack_addons` | `V3PackAddon` | the add-on packs (V3A). **No price column**: price and bundle discount are `PENDING` until the owner sets them in the price book |
| `g4d_vendor_packs` | `V3VendorPack` (tenant) | the vendor's one pack, category and picked starter services |
| `g4d_vendor_capabilities` | `V3VendorCapability` (tenant) | capabilities the vendor switched on (a row is switched off, never deleted) |
| `g4d_vendor_pack_addons` | `V3VendorPackAddon` (tenant) | add-on packs active for the vendor (ENDED, never deleted) |

Tenant tables carry `vendorId` (tenant guard scopes them; every store query names the vendor; listed in `tenant-model-registry.spec.ts`). The V2 `CategoryPack` model (site generation) and the V3 wallet `V3AddonPack` (usage packs) are different things and are untouched.

## 2. Loaders (idempotent, dry run by default)

Sources are in `backend-api/prisma/seed/pack-engine/`: `PACK_SUMMARY_V1.csv`, `CATEGORY_MASTER_V3_ADMIN_REGISTRATION.csv` (replaces the V2 sheet), `CATEGORY_TO_PACK_MAP_V1.csv` (cross-check) and `pack-engine-settings.json` (capabilities, the tier matrix, common tabs, capability tabs, add-on packs, pack meta).

```
node scripts/seed-v3-pack-engine.js --offline   dry run against an empty database: no database, no environment
node scripts/seed-v3-pack-engine.js             dry run against STAGING (staging guard)
node scripts/seed-v3-pack-engine.js --apply     write the missing rows to STAGING
```
Rules: create what is missing; never touch a row that exists (a staff edit is never overwritten; a row that differs from the sheet is only named); delete nothing; an apply is refused while a sheet has a problem (unknown pack, capability or add-on pack, bad tier, duplicate, copy-rule word, price). The one plain swap the copy rules allow ("leads" to "enquiries") is applied and counted. The tier word is kept from "Ecommerce (1,499)" and the price is dropped.

First-load counts (offline): 14 capabilities, 42 matrix cells, 16 packs, 109 tabs, 4 add-on packs, 196 categories (53 marked `needsBlueprint`), 0 problems.

## 3. Tier rules (PROPOSED; edit the matrix, not code)

Handyman: services (and DISPATCH, assumed). Professional: services, appointments, memberships, listings, brokerage, rentals, made to order, plus the assumed workflow capabilities (DISPATCH, DELIVERY, PHARMACY, LAB, FOOD_SERVICE, VEHICLE_RENTAL). Ecommerce: everything including STORE. Cells that Amendment 13 does not state carry `ASSUMED_FOR_OWNER_REVIEW`. SUPER_ADMIN edits cells through `PUT /v3/admin/pack-engine/tier-matrix/:tier/:capabilityKey`.

## 4. Add-on packs (V3A)

SHOP (grants STORE), ONLINE_ORDERING_DELIVERY, PHARMACY_COUNTER (stock with batches and expiry, dispensing to the clinic's own patients only, no online sale, bundle discount pending) and HOME_SAMPLE_COLLECTION. A category lists the add-ons it may buy in `addonPacks`. While prices are PENDING an add-on cannot be bought; SUPER_ADMIN switches one on or off for a vendor. Ending an add-on hides what it gave and keeps every record.

## 5. Resolver and navigation (A3, A4)

The resolver does **not** redo plan arithmetic. `EntitlementsService.resolve` (Stage 5.1) already decides the plan that applies now (grace, expiry, cancel, suspension, fall-back to Free) and returns `mode`, `level`, `track`. `core/nav-core.ts` (pure) turns those, the vendor's pack, capabilities and add-ons, and the matrix into tabs.

`GET /v3/me/navigation` returns `{ mode, level, tier, plan, pack, flags, tabs[] }`; each tab has `state` ACTIVE, LOCKED_PREVIEW or HIDDEN plus `reason` and `needsTier`. Order: common tabs, pack tabs, capability tabs, add-on tabs.

- **LEGACY** vendor (Version 2 rules): every tab ACTIVE, nothing restricted.
- **Free trial** (level FREE, or a V3 vendor with no plan yet): only tabs with `freeTrial` (website, industry management, plan, support) are ACTIVE; the rest LOCKED_PREVIEW (reason FREE_TRIAL).
- **Paid** (any PRO plan): a tab is ACTIVE unless its `minTier` or `capabilityKey` is above the tier (LOCKED_PREVIEW, NEEDS_TIER). A held capability the tier no longer allows is HIDDEN (TIER_DOWNGRADE). A capability the vendor never held is not listed.
- **Counsel gated packs** (CLINIC, LAB, PHARMACY, PRACTICE_LEGAL_FINANCE): their pack tabs are HIDDEN (GATED_PACK) until SUPER_ADMIN switches `gatedPacksOpen` on. Default OFF.
- **Downgrade and expiry** only change a state. No row is deleted; the tabs return with the plan.

## 6. Server-side enforcement

`@RequiresTab('<key>')` (`requires-tab.ts`) puts `TabGuard` on a route or controller. A tab that is not ACTIVE, or that the vendor does not have, answers 403 with the registered code `TAB_LOCKED` (and `tab`, `state`, `reason`, `needsTier`). LEGACY vendors pass. The engine is asked once per request. A module using it imports `V3PacksModule`.
**Not yet applied to the shipped module controllers** (customers, accounts, appointments, store, jobs): they keep their `@RequiresFeature` gates. Applying `@RequiresTab` to them is a separate, reviewed step because it changes shipped routes (a capability tab would lock out paid vendors who use a module today and hold no capability row).

## 7. Registration and capabilities (A5)

`GET /v3/public/pack-categories` and `/:categoryKey` (public): the pack, the tier (the category minimum), starter services, each capability with `included` or `needsTier`, add-on packs with `priceStatus: PENDING`.
`POST /v3/me/pack/register` (owner): sets the primary pack, the picked starter services (must be offered) and capabilities. A capability above the tier answers `CAPABILITY_NEEDS_TIER` naming the tier. A second, different category answers `PACK_ALREADY_SET`.
`GET /v3/me/pack/capabilities`, `PUT /v3/me/pack/capabilities/:key` (owner): switch on (needs the tier or an active add-on) or off (hides, keeps records).

## 8. Staff routes (A6) under `/v3/admin/pack-engine`

Reads (OPERATIONS and SUPER_ADMIN): `packs`, `packs/:key`, `tabs`, `categories`, `tier-matrix`, `addons`, `settings`, `vendors/:vendorId/navigation`.
Changes (**SUPER_ADMIN only for now**, because the staff ADMIN role does not exist in the code; Part B adds it and can widen packs, tabs and categories to ADMIN): `PUT packs/:key`, `tabs`, `categories/:categoryKey`, `vendors/:vendorId/addons/:addonKey`. The tier matrix `PUT tier-matrix/:tier/:capabilityKey` and the two switches `PUT settings/:name` stay SUPER_ADMIN only. Every change writes an activity row (`pack.*`).

## 9. Switches (both default OFF, stored in `g4d_plan_settings`)

`packGatedPacksOpen` and `packOnlineMedicineCheckout`. **Online medicine checkout is OFF by default**: the Pharmacy pack is order-request with prescription upload, no payment taken by Get4Domain, a drug licence number required (`flags.drugLicenceRequired`), and the fixed health disclaimer. Counsel decides before any checkout is switched on. No checkout is built in Part A; the flag is exposed in the navigation answer for the Pharmacy pack only.

## 10. Error codes (registered through `BUSINESS_ERROR_CODES`)

`TAB_LOCKED`, `CAPABILITY_NEEDS_TIER`, `PACK_INVALID`, `PACK_NOT_FOUND`, `PACK_CATEGORY_UNKNOWN`, `PACK_CAPABILITY_UNKNOWN`, `PACK_STARTER_UNKNOWN`, `PACK_ALREADY_SET`, `PACK_MATRIX_INVALID`. `test/pack-wire.spec.ts` sends each through the real exception filter and fails on a thrown code that is not registered.

## 11. How to add a pack

1. Add a row to `PACK_SUMMARY_V1.csv` (key, name, tabs, CRM pipeline, TeleCRM, task templates, site sections) and, if it needs a disclaimer, a gate or flags, an entry in `pack-engine-settings.json` `packMeta`.
2. Point categories at it in `CATEGORY_MASTER_V3_ADMIN_REGISTRATION.csv`.
3. Run the loader dry run, read the counts and problems, then `--apply` on staging. Existing rows are left alone.
4. Fill the entities, report set and field hints in the pack's wave (through `PUT packs/:key`); `reviewStatus` moves to OWNER_REVIEWED and APPROVED.
No code change is needed. To add a capability, add it to `capabilities`, `tierMatrix` and `capabilityTabs` in the settings file.

## 12. Tests

`pack-engine-schema`, `pack-core` (parsers, copy rules, sheets), `pack-nav-core` (Free vs each tier, each of the 16 packs, downgrade, add-ons, LEGACY), `pack-engine-service` (loaders dry run and apply and idempotency, registration, needs-tier, downgrade keeps data, cross-tenant isolation, add-ons, medicine switch, admin edits and activity, the `TabGuard` refusal), `pack-wire` (legacy isolation, pure cores, error codes, DTO decorators, role matrix). The integration run (`test:int`) is the owner's, on staging.
