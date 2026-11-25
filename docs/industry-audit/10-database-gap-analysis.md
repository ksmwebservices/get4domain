# 10 Database gap analysis (Stage 1, lane V2)

Read only. Tables are named as in `backend-api/prisma/schema.prisma` on branch `v3-lane-e1` (`d74c9c0`). "Proposed entity" is from brief phase 7. The brief says these are logical entities, not instructions to create tables: the verdict column says whether an existing table already does the job. **Verdicts are recommendations; the "exists" column is what was verified in code.**

Verdict words: USE (existing table serves), EXTEND (existing table plus a column or a child table), NEW (nothing exists), CONSOLIDATE (several exist; do not add another), NOT NEEDED.

## 1. Proposed entities against what exists

| # | Proposed entity | Exists today (table or field) | Verdict | Gap |
|---|---|---|---|---|
| 1 | business_families | `g4d_taxonomy_families` (E1: 45 rows when loaded, `plannedPackKey`, no foreign key); strings `family` on `g4d_pack_categories` and `g4d_directory_categories` | EXTEND | Defaults and inheritance (menu, disclaimers, sample data, theme, landing); display data; a foreign key from family to its pack bundle |
| 2 | business_categories | `g4d_taxonomy_categories` (E1: 1,213), `g4d_taxonomy_family_categories` (1,277 links), `g4d_taxonomy_legacy_map` (E1: existing to new); `g4d_pack_categories` (196, the table registration uses); `g4d_directory_categories` (53); `g4d_category_packs` (V2, 24); `g4d_categories` (vendor product categories, unrelated) | CONSOLIDATE | Five lists. Registration still reads `g4d_pack_categories` (one `family` string, one `packKey`). Point it at the taxonomy category (86 of the 196 already map) and let the directory and V2 lists read the same master |
| 3 | business_subcategories | none | NOT NEEDED | Owner agreed three levels; reasons in file 15 section 4 |
| 4 | business_specializations | `g4d_category_profile_fields` + `g4d_vendor_profile_values` (profile fields, pack to category inheritance, tested per V1) | EXTEND | An admin option list per category (specializations as a controlled field), not a taxonomy level |
| 5 | business_services | `starterServices` JSON on `g4d_pack_categories` (248 names, 143 categories); vendor side: `V3Item`, `V3ApptService`, V2 `VendorProduct` | NEW master table, then CONSOLIDATE vendor side | Master service per category (lane E4), nullable link from a vendor service to it; one vendor service store instead of four |
| 6 | service_variants | `g4d_store_variants` (products only) | EXTEND | Service options with their own price (1 BHK, 2 BHK; per sq ft and tile type) |
| 7 | business_attributes | profile fields as row 4 | USE | |
| 8 | category_field_definitions | `g4d_pack_tab_fields` (per pack tab, 89 sets, admin editable); profile fields per category | EXTEND | Per-category override of a tab's fields (family to category inheritance); public form definitions (row 12) |
| 9 | capability_definitions | `g4d_capabilities` (14 keys), `g4d_tier_capabilities` | USE | Add the audit-added capability keys that Stage 2 keeps (file 05 lists 11) |
| 10 | category_capability_mappings | `optionalCapabilities` JSON on `g4d_pack_categories` | EXTEND | A link table to the taxonomy category (many to many, default or optional) |
| 11 | workflow_definitions, workflow_steps, category_workflow_mappings | none. Stage names are text in `g4d_packs.config`; job and quote and appointment status sets are constants in code (`jobs-core.ts`) | NEW, after the owner decides data-driven or coded blocks (file 14 Q9) | The biggest structural gap: no table says what steps a category has |
| 12 | form_definitions, form_fields | `g4d_pack_tab_fields` (vendor record forms only) | EXTEND | A public scope (enquiry or booking form per category) with the same field types and validation (`record-core.ts`) |
| 13 | vendor_categories | `g4d_vendor_packs` (**`vendorId` is `@unique`**, one `packKey`, one `categoryKey`) | CHANGE | Many rows per vendor with one marked primary. This is the hard conflict with the owner decision (file 14 C1). Existing rows stay valid as the primary row |
| 14 | vendor_services | `g4d_items`, `g4d_appt_services`, V2 `VendorProduct`, `g4d_store_products` | CONSOLIDATE | |
| 15 | vendor_capabilities | `g4d_vendor_capabilities` | USE | |
| 16 | vendor_module_settings | `g4d_vendor_pack_addons`, `g4d_vendor_modules` (V2), `g4d_site_settings` | USE | |
| 17 | vendor_navigation | none stored; the tab list is computed by `nav-core.ts` from common, pack, capability and add-on tabs and the tier; the website menu is a key in the managed document | USE (derived) | Store overrides only if admin must edit one vendor's menu |
| 18 | vendor_site_pages | `g4d_site_publication_pages`, managed document `lists.pages` | EXTEND | Landing pages by family, category, service (V1 E.4) |
| 19 | vendor_cta_configurations | none; the public request gate is the `site.cta` feature; the kit picks a CTA word per layout family (`CTA_OF` in `site-kit/packs.ts`) | NEW (small) | Per category CTA, target form, lead destination |
| 20 | vendor_theme_settings | `g4d_site_settings`, theme package tables | USE | Theme targets not stored (V1 L.4) |
| 21 | vendor_custom_fields | `g4d_vendor_profile_values` (profile only) | EXTEND | Vendor-added fields on records within admin limits |

Counts: 21 rows covering the brief's 24 names (rows 11 and 12 group several). USE 6, EXTEND 9, CONSOLIDATE 2 (plus 1 inside row 5), NEW 3 (rows 5, 11, 19), CHANGE 1, NOT NEEDED 1.

## 2. The brief's database requirements, one by one

| Requirement | Verified state | Status |
|---|---|---|
| One vendor operates several related categories | Blocked by `g4d_vendor_packs.vendorId @unique` and `POST /v3/me/pack/register` answering `PACK_ALREADY_SET`. The transactional tables hold no category column (`g4d_jobs`, `g4d_job_quotes`, `g4d_appt_bookings`, `g4d_requests`, `g4d_customers`, `g4d_vendor_invoices`), so a second category needs the registration and menu layer only, not a data split | MISSING |
| Categories share customers, leads, invoices, staff | Yes by construction: those tables are keyed by `vendorId`, not category. `V3Customer` is per vendor with a source history | COMPLETE for the structure (not run) |
| Vendor-level services and pricing | Vendor services and prices exist in four stores (row 5); no default price from admin, no approval, no hide | PARTIAL, DUPLICATED |
| Industry fields without hardcoding every category | Vendor record fields are data (`g4d_pack_tab_fields`), but per pack tab, not per category; public request fields are constants in `requests-core.ts` | PARTIAL |
| Vendor adds custom services and fields within admin limits | Services yes (own records); fields no; no admin limit table | PARTIAL |
| No duplicated customer and transaction records | Two job systems (`g4d_jobs`, `g4d_service_jobs`), two customer stores (`g4d_customers`, V2 `g4d_contacts` and `g4d_leads`), two to four invoice stores, four stock stores, several appointment tables (`g4d_appt_bookings`, `g4d_appointments`, `g4d_clinic_appointments`, `g4d_salon_appointments`, `g4d_room_bookings`) | DUPLICATED |
| Tenant isolation | Every vendor table read carries `vendorId` with composite indexes. 62 of 133 migrations enable row level security; the seven vendor tables I sampled each have a policy statement. Policy bodies and the application guard (`@Tenant()`) were not read in depth | NEEDS VALIDATION |
| Master configuration separate from vendor configuration | Yes: pack, tab, capability, category, matrix tables have no `vendorId`; vendor choices live in `g4d_vendor_*` | COMPLETE for the structure (not run) |

## 3. What the master taxonomy needs from the database (E1 as built)

Built on the branch (not verified applied anywhere): `g4d_taxonomy_families`, `g4d_taxonomy_categories`, `g4d_taxonomy_family_categories` (many to many), `g4d_taxonomy_related_families` (symmetric, `CHECK familyAId < familyBId`), `g4d_taxonomy_legacy_map`; additive, RLS on; loader dry run by default. The 61 multi-family categories fit (stored once). `g4d_pack_categories` is untouched, so vendors still register through the old 196.

## 4. Smallest additive set the audit points to (recommendation, not an instruction)

Ordered by what unblocks the owner decisions; every item is additive except the first:

1. Drop the uniqueness on `g4d_vendor_packs.vendorId`; add `isPrimary`. (CHANGE, needs a migration plan and a check of every reader of the table: nav, tier, overview.)
2. Link `g4d_pack_categories` to `g4d_taxonomy_categories` (nullable foreign key filled from the legacy map), then read the master for registration.
3. Category to capability link table; family to pack-bundle foreign key.
4. Workflow definition, step and category mapping tables (after Q9).
5. Public form definitions (scope on `g4d_pack_tab_fields` or a sibling table).
6. Master service table and variant option table (lane E4 scope).
7. Per-category CTA row.
8. Hide and approve fields on the vendor service record (price rules).

Not recommended: a separate table per archetype, a table per family pack, or a fourth level of taxonomy.

## 5. Risks to preserve working behaviour

- `g4d_pack_categories.packKey` is a foreign key with `onDelete: Restrict` and `categoryKey` is unique: changing a category's pack is allowed through the admin route, deleting a pack that has categories is not.
- Seeds are idempotent and never update or delete (`seed-v3-pack-engine.js`, `seed-v3-taxonomy.js`): a changed sheet row is only reported. Any reclassification of the four misfiled categories (ambulance, towing, bus-travels, distribution-services) must go through the admin route or a one-off data change decided by the owner.
- Existing vendors hold a `packKey` and `categoryKey`; the 196 category keys must stay valid.
- `V3Job` has no category or pack column; moving a job screen between archetype blocks needs no data migration.
