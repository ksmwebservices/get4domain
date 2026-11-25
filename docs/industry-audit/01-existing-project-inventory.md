# 01 Existing project inventory (Stage 1, lane V2)

> Read only audit. Date: 2026-11-20. Nothing was run: no server, no test, no build, no database, no staging. No `.env` file or secret was read. Only files under `docs/industry-audit/` were created.

## 1. What was read, and how

| Part | Where | Branch and commit | Read by |
|---|---|---|---|
| Backend (NestJS, Prisma) | `C:\Get4Domain\get4domain-w2` | `v3-lane-e1` `d74c9c0` | `git archive` of the branch into the session scratch folder (an object-database read, like `git show`); the working tree of that folder, which another lane is editing, was not opened |
| Public site, kit, V2 dashboards, client apps | this folder | `v3-pub-a1` `aa0d08d` (working tree, read only) | direct read |
| Vendor app | `C:\Get4Domain\get4domain-ui` | `v3-ui-s17` `725c8d0` | `git archive` into scratch |
| Admin app | same repo | `v3-ui-s16` `72f6a0d` | `git archive` into scratch |
| Inputs | `get4domain-w2/docs/v3/inputs` and `docs/v3` | working tree files | direct read: the brief, the 48-family checklist, the 45-family master, audit V1, E1 taxonomy note |

Audit V1 (`WEBSITE_ENGINE_AUDIT.md`, branch `v3-lane-r1`) is cited, not redone. Where this file says "V1" it means that file. I re-checked the V1 claims that the four test cases and the pack audit depend on (sections 4 and 5) and found them accurate; the new or doubtful points are listed in section 4.

**Limits.** Every status below is from reading code, seed files and test titles. Where V1 found a test, the status says so; tests were not run. The live database was not read, so "exists in the seed file" never means "exists in production". Counts are from the named branches only.

**Status words** (from the brief): COMPLETE, PARTIAL, CONFIGURED ONLY, PLACEHOLDER, MISSING, DUPLICATED, MISCLASSIFIED, NEEDS VALIDATION. **No area is marked COMPLETE**, because nothing was executed and every pack is still `DRAFT`.

## 2. Headline numbers

| Thing | Count | Source |
|---|---|---|
| Backend module folders / V3 folders | 138 / 39 | `backend-api/src` |
| Controller files / route decorators | 180 / about 1,485 | `src` |
| Prisma models / migrations | 336 / 133 | `schema.prisma`, `prisma/migrations` |
| Migrations that enable row level security | 62 (the seven vendor tables I sampled each have a policy statement: jobs, quotes, bookings, pack records, vendor packs, customers, requests; policy bodies not read) | `prisma/migrations` |
| Industry packs (V3, the real ones) | 16 (all `DRAFT`) plus 5 add-on packs | `g4d_packs`, pack-engine seed |
| Other things also called a pack | 24 V2 category packs, 20 V2 industry experiences / engine designs, 30 public kit design packs | file 08 |
| Registrable categories today | 196 in 21 code families (110 not matched to the 45-family master by name or alias) | `CATEGORY_MASTER_V3_ADMIN_REGISTRATION.csv` |
| Master categories (E1 data file) | 1,213 unique in 45 families (1,277 links, 61 categories in several families) | `data/category-master-45.json` |
| Pack tabs / seeded field sets | 16 packs x 4 to 6 own tabs; 26 common tabs; 89 field sets | pack seed, `tab-field-seed.ts` |
| Vendor capabilities (pack engine keys) | 14 | `g4d_capabilities` |
| Vendor-app test files / admin / partner | 38 / 27 / 4 | UI branches |

## 3. Inventory by the 22 areas of brief phase 1

| # | Area | What actually exists (evidence) | Status | Missing or doubtful |
|---|---|---|---|---|
| 1 | Backend architecture and APIs | NestJS modules, tenant context decorator, route baseline tests. Two generations coexist: V2 industry modules (`clinic`, `hotel`, `gym`, `restaurant`, `retail`, `travel`, `logistics`, `construction`, ...) and V3 modules (`v3-appointments`, `v3-jobs`, `v3-store`, `v3-customers`, `v3-pack-records`, `v3-packs`, ...) | PARTIAL | The two generations overlap (jobs, customers, catalogue, stock, invoices exist twice or more, see file 11). Not shown that a V3 vendor can reach a V2 module (NEEDS VALIDATION) |
| 2 | Frontend and navigation | Vendor app: five fixed groups plus pack tabs sent by the server (`/v3/me/navigation`) and opened by one generic `PackScreen`; admin app with a Catalog page (packs, categories, tier matrix, add-ons, eligibility, switches, tab fields); public Next app with the kit renderer | PARTIAL | Pack tab screens are generic lists. Jobs, quotes and work items are shown only for the `handyman` track (`config/nav.ts`). No admin screen for the 45-family taxonomy exists (no hit for "taxonom" in any UI app) |
| 3 | Database, migrations, seed | See section 2. Seeds: pack engine (16 packs, 196 categories, tabs, matrix), directory (53), plans, E1 taxonomy data file | PARTIAL | E1 migration `20270110100000_v3_e1_taxonomy` is on the branch; I cannot tell if it was applied anywhere. Taxonomy tables stay empty until the loader runs |
| 4 | Industry packs and templates | 16 V3 packs, 5 add-on packs, 24 V2 category packs, 20 engine designs, 30 kit design packs (file 08) | CONFIGURED ONLY (12 of 16 packs), PARTIAL (4: FIELD_SERVICE, RETAIL, CLINIC, MEMBERSHIP_WELLNESS) | No pack is operationally complete. Counsel gate hides CLINIC, LAB, PHARMACY, PRACTICE_LEGAL_FINANCE by default |
| 5 | Category and subcategory definitions | 196 live categories (one pack and one tier each); 1,213 master categories in a data file; no sub-category table. The owner agreed three levels (family, category, service) | PARTIAL | Third level (service) is a JSON list of names per category (248 names in 143 categories); lane E4 not built |
| 6 | Service and product catalogues | Services: starter names, `V3Item`, `V3ApptService`, V2 `VendorProduct`. Products: `V3StoreProduct` + variants, V2 `RetailProduct`, `CatalogItem` | PARTIAL, DUPLICATED | No master service list per category that a vendor ticks; no action type; no price rules |
| 7 | Dynamic forms and fields | Vendor side: `V3PackTabField` (89 sets, editable by SUPER_ADMIN, values validated into `V3PackRecord` JSON); profile fields inherit pack to category | PARTIAL | Public forms per category: MISSING. Request fields are fixed per kind (`requests-core.ts`: message; service/date/time; service/details/budget) |
| 8 | CRM and lead management | `V3Request` inbox (events, consent, tracking token), `V3Customer` with sources, V2 `Lead`/`Contact` and TeleCRM, LeadSpace | PARTIAL, DUPLICATED | Three lead paths. Linking a request to a booking or quote stores ids only |
| 9 | Booking, appointment, scheduling | `v3-appointments`: services with length, providers with weekly hours, slot search, request then confirm, decline, cancel, complete, no-show | PARTIAL | One provider and one service per booking; no emergency priority; Handyman tier cannot enable it (tier matrix: SERVICES and DISPATCH only) |
| 10 | Quotation, estimate, proposal | `V3Quote`: draft lines with GST rate, send, accept, decline, expire; accepting books the job | PARTIAL | "Send" only marks; acceptance is recorded by the vendor (route text: "Record that the customer accepted"); no public quote route; no versions |
| 11 | Job, task, work order | `V3Job` path REQUESTED, QUOTED, BOOKED, IN_PROGRESS, DONE, PAID, CANCELLED; calendar; pay-request link | PARTIAL | **Defect found (read, not run):** vendor app "Mark done" posts `COMPLETED`, the API accepts only `DONE` and only one step at a time (`MoveJobDto @IsIn(JOB_STATES)`); the job screen offers only Mark done, Mark paid, Archive. No parts, photos or checklist fields although the nav text promises "parts and photos". Second system `ServiceJob` (vehicle only) |
| 12 | Technician, staff, resource assignment | `V3Job.assignedTo` is free text; `V3ApptProvider` has hours; `TeamMember` holds access areas | PARTIAL | Nothing links a job to a person row, hours or availability |
| 13 | Inventory, stock, purchasing | `V3StockLevel`/`Reservation`/ledger for the store; BOS stock and purchases; V2 `PartStock`, `ProduceStock` | PARTIAL, DUPLICATED | Parts not tied to jobs; no supplier master in V3 |
| 14 | Billing, invoicing, payments | V3 receipts and invoices typed from the GST profile; UPI pay request with manual "mark paid"; BOS documents; domainapp invoices; V2 `GenericInvoice` | PARTIAL, DUPLICATED | PDF renderer is a fake in this build (route text); no milestone or advance/balance; no gateway reconciliation for service jobs |
| 15 | Contracts, subscriptions, AMC | Generic `amc_contracts`, `plans_and_renewals` tabs; V2 `Membership`, `Contract` (travel) | CONFIGURED ONLY | No visit schedule, renewal reminder, warranty |
| 16 | Customer, vendor, supplier management | Customers: `v3-customers`. Suppliers: none in V3 (BOS purchases only) | PARTIAL (customers), MISSING (supplier portal) | |
| 17 | Website CMS, page builder, navigation | `v3-website` managed document, draft, publish, revisions, restore; kit and backend renderers (V1 sections E to J) | PARTIAL | Drawn menu fixed; no landing pages by family; single hero (V1) |
| 18 | Theme and template configuration | Theme store, switch, imported packages, marketplace (V1 K and L) | PARTIAL | Theme targets (main, category, sub) not stored (V1 L.4) |
| 19 | Roles, permissions, access control | Eight team access areas, owner-only tabs, admin role matrix, tier and capability gates on tabs | PARTIAL | Area switches only: no "own jobs only" or per-pack roles |
| 20 | Reports, analytics, notifications | Vendor Reports page, analytics module, activity log, V3 notifications and alerts | PARTIAL | No report defined per workflow; notifications per step missing |
| 21 | Integrations and automation | Registrar (ResellerClub paths marked to verify), integration settings (R1), mail lanes, WhatsApp bot, message outbox (sandbox, no provider called) | PARTIAL | Live providers unverified; flags default OFF |
| 22 | Mobile and PWA | Kit sites: Install button, bottom navigation, per-vendor manifest (V1 E.7) | PARTIAL | Missing on engine designs and imported themes (V1 L.2); vendor app mobile behaviour not checked |

## 4. What is new or doubtful compared with audit V1

New (found in this run):

1. **Job completion button mismatch.** `apps/vendor/src/pages/real/real-records.ts` line 138 posts `{ status: 'COMPLETED' }`; `backend-api/src/v3-jobs/api/jobs.controllers.ts` accepts only the seven `JOB_STATES` (no `COMPLETED`). Also a job must pass BOOKED and IN_PROGRESS before DONE, and the screen has no action for those steps. Fix belongs to a later lane; nothing was changed here.
2. **Handyman tier cannot hold appointments or a store.** `pack-engine-settings.json` tier matrix: HANDYMAN gets SERVICES (owner rule) and DISPATCH (marked ASSUMED_FOR_OWNER_REVIEW) only. Gas stove, pest control, tiles and ambulance categories all sit on Handyman (499), so a customer-chosen visit slot is not available to them.
3. **Admin cannot add a category or a pack.** `PUT /v3/admin/pack-engine/categories/:key` answers 404 for an unknown key (`editCategory`); there is no create route for a pack or a category. New categories exist only through the seed loaders.
4. **One category per vendor is a database rule.** `g4d_vendor_packs.vendorId` is `@unique`.
5. **The master list lacks several businesses named in the brief and the checklist**: gas stove and LPG stove repair, mosquito mesh and window nets, roller shutters, ICU and ventilator ambulance, patient attendants, key duplication, clothing alteration, lift and escalator maintenance, borewell drilling (file 12). Four of those exist among the 196 existing categories; the others exist nowhere.
6. **Ambulance and towing are mapped to the wrong packs**: `ambulance-service` is on LOGISTICS (family "Moving and transport", Handyman tier, no services seeded); `towing-roadside-assistance` is on VEHICLE_SERVICE.
7. **The vendor menu follows the plan tier, not the industry.** `config/nav.ts` shows Jobs and Quotes only on the `handyman` track, Work (bookings) and Deals only on `professional`, Orders and Stock only on `ecommerce`; a track is the tier a category is on (Handyman 499, Professional 999, Ecommerce 1,499). So a plumber, a pest controller, a tiles contractor and an ambulance operator all get the same five items (Enquiries, Jobs, Quotes, Customers, Tasks) plus the pack's generic record tabs. The brief's per-industry menus (phase 5) do not exist; three menus exist.
8. `indianambulance/` in this repository is a content site connected to the Website Manager (pages, sitemap, revalidate route); it has no booking or dispatch code.

Confirmed from V1 (re-checked in code): one primary pack per vendor; no category-specific public forms; fixed menu; four unrelated category lists; Free sites carry no forms or buttons by owner rule; the V3 pack engine is built and unit-tested but all packs are `DRAFT`.

## 5. Four different meanings of "pack"

| Meaning | Where | Count | What it holds |
|---|---|---|---|
| V3 industry pack | `g4d_packs` | 16 (+5 add-on) | tab menu, field sets, capability rules, CRM stage text |
| V2 category pack | `g4d_category_packs` (`site-doc/seeds`) | 24 | site starter text, items, FAQ, sample quotes |
| V2 industry experience / engine design | `g4d_industry_experiences`, `src/engine` | 20 | primary operation, vendor module list, CRM stages, a kit-built demo site |
| Public kit design pack | `site-kit/packs.ts` | 30 ids (V1 counted 29 plus general) | layout family, hue, starter names |

The owner decision "one pack key per family" (45) therefore has to say which of these four it means; file 15 assumes the V3 industry pack.

## 6. Where the pieces of the workflow live today (short map for Stage 2)

- Enquiry to inbox: `requests-orders` (V3Request) and the V2 `engine.enquiry` lead.
- Visit slot: `v3-appointments` (professional track) or `V3Job.scheduledAt` set by the vendor (handyman track).
- Estimate: `v3-jobs` quotes. Job: `v3-jobs`. Payment: `v3-payments` (UPI link, offline record). Invoice: `v3-payments` documents. History: generic `service_history` tab.
- Everything else named in a pack tab list (dispatch, AMC, parts, trips, vehicles, drivers, batches, matters, deadlines, availability, deposits, shipments, tracking, proof of delivery) is a `V3PackRecord` list with a small field set: the record is stored and validated, but no status path, no link to another record, no reminder.

## Appendix A. The 39 working archetypes used in file 09

The archetype is a classification of how a business operates, made for this audit. It is **not** an existing object in the code and not a new pack. Stage 2 will turn them into shared workflow blocks. 1,212 of 1,213 master categories received one; `Miscellaneous Local Services` is INCOMPLETE (no honest classification exists). Method counts: rule on the name 976, hand override 190, family default 47 (19 of all assignments are low confidence and say so in file 09).

Workflow status counts over the 39: 8 PARTIAL, 26 CONFIGURED ONLY (17 on a fitting pack, 9 on a NEAR-fit pack), 4 MISSING, 1 listing only, **0 COMPLETE**.

| Code | Archetype | Master categories | Existing (196) | Pack that fits | NEAR-fit pack | Workflow status today | Capability set beyond the common set |
|---|---|---|---|---|---|---|---|
| A01 | FIELD_SERVICE_VISIT | 33 | 18 | FIELD_SERVICE | none | PARTIAL (a dedicated module backs the core step) | service_catalogue, booking_appointments, calendar_availability, technician_dispatch, job_work_order, quotation_estimation, inventory_stock, warranty_service_history, contracts_amc, form_definition |
| A02 | SITE_PROJECT_BOQ | 34 | 9 | FIELD_SERVICE | none | PARTIAL (a dedicated module backs the core step) | site_inspection, boq_estimation, quotation_estimation, task_project, staff_scheduling, inventory_stock, job_work_order, document_compliance, form_definition |
| A03 | INSPECT_TREAT_RECURRING | 6 | 2 | FIELD_SERVICE | none | PARTIAL (a dedicated module backs the core step) | site_inspection, quotation_estimation, technician_dispatch, job_work_order, inventory_stock, recurring_visit_schedule, contracts_amc, warranty_service_history, document_compliance, form_definition |
| A04 | CLINICAL_APPOINTMENT | 51 | 10 | CLINIC | none | PARTIAL (a dedicated module backs the core step) | booking_appointments, calendar_availability, staff_scheduling, document_compliance, case_matter_management, form_definition |
| A05 | EMERGENCY_DISPATCH | 2 | 2 | none | none | MISSING (no pack, no tab, no module) | emergency_dispatch, fleet_vehicle, technician_dispatch, job_work_order, staff_scheduling, calendar_availability, form_definition |
| A06 | INPATIENT_FACILITY | 7 | 1 | none | CLINIC | CONFIGURED ONLY on a NEAR-fit pack | admission_bed_management, booking_appointments, staff_scheduling, inventory_stock, document_compliance, case_matter_management, multi_branch |
| A07 | DIAGNOSTIC_ORDER | 8 | 1 | LAB | none | CONFIGURED ONLY (generic record tabs) | service_catalogue, booking_appointments, job_work_order, document_compliance, delivery_logistics, form_definition |
| A08 | PHARMACY_COUNTER | 2 | 2 | PHARMACY | none | CONFIGURED ONLY (generic record tabs) | product_catalogue, inventory_stock, document_compliance, online_ordering, delivery_logistics |
| A09 | RETAIL_CATALOGUE_ORDER | 126 | 40 | RETAIL | none | PARTIAL (a dedicated module backs the core step) | product_catalogue, online_ordering, inventory_stock, delivery_logistics |
| A10 | WHOLESALE_B2B_QUOTE | 83 | 7 | B2B_DEALER | none | CONFIGURED ONLY (generic record tabs) | product_catalogue, quotation_estimation, inventory_stock, purchase_supplier, delivery_logistics |
| A11 | FOOD_ORDER_RESERVATION | 32 | 4 | FOOD_SERVICE | none | CONFIGURED ONLY (generic record tabs) | product_catalogue, online_ordering, booking_appointments, delivery_logistics, inventory_stock |
| A12 | RECURRING_SUPPLY_SUBSCRIPTION | 10 | 2 | FOOD_SERVICE, RETAIL | none | CONFIGURED ONLY (generic record tabs) | membership_subscription, delivery_logistics, recurring_visit_schedule, inventory_stock |
| A13 | EVENT_BOOKING_QUOTE | 27 | 6 | HOSPITALITY_EVENTS, FOOD_SERVICE | none | CONFIGURED ONLY (generic record tabs) | quotation_estimation, calendar_availability, booking_appointments, rental_assets, task_project, staff_scheduling |
| A14 | STAY_RESERVATION | 32 | 4 | HOSPITALITY_EVENTS | none | CONFIGURED ONLY (generic record tabs) | calendar_availability, booking_appointments, rental_assets, membership_subscription |
| A15 | TRIP_PACKAGE_ITINERARY | 22 | 2 | HOSPITALITY_EVENTS | none | CONFIGURED ONLY (generic record tabs) | service_catalogue, quotation_estimation, booking_appointments, document_compliance |
| A16 | PASSENGER_TRANSPORT_FLEET | 7 | 2 | RENTAL_FLEET | none | CONFIGURED ONLY (generic record tabs) | fleet_vehicle, booking_appointments, job_work_order, staff_scheduling, calendar_availability |
| A17 | FREIGHT_COURIER_MOVE | 41 | 7 | LOGISTICS | none | CONFIGURED ONLY (generic record tabs) | delivery_logistics, fleet_vehicle, quotation_estimation, job_work_order, document_compliance |
| A18 | RENTAL_ASSET_BOOKING | 35 | 2 | RENTAL_FLEET | none | CONFIGURED ONLY (generic record tabs) | rental_assets, calendar_availability, booking_appointments, document_compliance |
| A19 | VEHICLE_WORKSHOP_JOBCARD | 13 | 7 | VEHICLE_SERVICE | none | CONFIGURED ONLY (generic record tabs) | job_work_order, inventory_stock, warranty_service_history, booking_appointments, quotation_estimation, recurring_visit_schedule |
| A20 | MEMBERSHIP_RECURRING | 19 | 2 | MEMBERSHIP_WELLNESS | none | PARTIAL (a dedicated module backs the core step) | membership_subscription, booking_appointments, calendar_availability, staff_scheduling |
| A21 | COURSE_ADMISSION | 66 | 12 | EDUCATION | none | CONFIGURED ONLY (generic record tabs) | class_batch_admission, calendar_availability, document_compliance, customer_portal |
| A22 | PROFESSIONAL_ENGAGEMENT | 76 | 7 | PRACTICE_LEGAL_FINANCE | none | CONFIGURED ONLY (generic record tabs) | case_matter_management, booking_appointments, document_compliance, task_project, customer_portal |
| A23 | CREATIVE_PROJECT_AGENCY | 106 | 11 | AGENCY_CONSULTING | none | CONFIGURED ONLY (generic record tabs) | task_project, quotation_estimation, contracts_amc, document_compliance |
| A24 | LISTING_VISIT_ENQUIRY | 26 | 3 | PROPERTY, B2B_DEALER | none | CONFIGURED ONLY (generic record tabs) | listing_management, booking_appointments, site_inspection, document_compliance |
| A25 | PERSONAL_APPOINTMENT_STAFF | 36 | 9 | MEMBERSHIP_WELLNESS | none | PARTIAL (a dedicated module backs the core step) | booking_appointments, calendar_availability, staff_scheduling, membership_subscription, inventory_stock |
| A26 | MADE_TO_ORDER_FABRICATION | 37 | 4 | none | FIELD_SERVICE | CONFIGURED ONLY on a NEAR-fit pack | manufacturing_production, quotation_estimation, inventory_stock, job_work_order, delivery_logistics, form_definition |
| A27 | ITEM_INTAKE_PROCESSING | 37 | 6 | none | FIELD_SERVICE, AGENCY_CONSULTING | CONFIGURED ONLY on a NEAR-fit pack | item_intake_tracking, job_work_order, delivery_logistics, quotation_estimation |
| A28 | MANPOWER_PLACEMENT | 17 | 1 | none | AGENCY_CONSULTING | CONFIGURED ONLY on a NEAR-fit pack | case_matter_management, document_compliance, booking_appointments |
| A29 | CITIZEN_DOCUMENT_ASSISTANCE | 23 | 1 | none | PRACTICE_LEGAL_FINANCE | CONFIGURED ONLY on a NEAR-fit pack | case_matter_management, document_compliance, booking_appointments, customer_portal |
| A30 | CONSULT_OR_CEREMONY_BOOKING | 29 | 4 | AGENCY_CONSULTING | none | CONFIGURED ONLY (generic record tabs) | service_catalogue, booking_appointments, calendar_availability |
| A31 | VENUE_SLOT_TICKET | 26 | 0 | none | RENTAL_FLEET, MEMBERSHIP_WELLNESS | CONFIGURED ONLY on a NEAR-fit pack | calendar_availability, booking_appointments, rental_assets, membership_subscription |
| A32 | AGRI_PRODUCE_INPUT_TRADE | 14 | 0 | none | RETAIL, B2B_DEALER | CONFIGURED ONLY on a NEAR-fit pack | product_catalogue, inventory_stock, online_ordering, quotation_estimation, delivery_logistics |
| A33 | SITE_CONTRACT_SERVICE | 28 | 2 | none | PROPERTY, FIELD_SERVICE | CONFIGURED ONLY on a NEAR-fit pack | contracts_amc, staff_scheduling, recurring_visit_schedule, quotation_estimation, document_compliance |
| A34 | NONPROFIT_DONATION_MEMBER | 7 | 0 | none | none | MISSING (no pack, no tab, no module) | membership_subscription, document_compliance, payments_donation |
| A35 | SCHEDULED_PICKUP_COLLECTION | 15 | 0 | none | none | MISSING (no pack, no tab, no module) | recurring_visit_schedule, fleet_vehicle, job_work_order, document_compliance |
| A36 | DOMESTIC_STAFF_CARE | 6 | 0 | none | none | MISSING (no pack, no tab, no module) | staff_scheduling, booking_appointments, contracts_amc, document_compliance |
| A37 | EQUIPMENT_SALE_INSTALL | 27 | 5 | FIELD_SERVICE, RETAIL | none | PARTIAL (a dedicated module backs the core step) | product_catalogue, site_inspection, quotation_estimation, technician_dispatch, job_work_order, contracts_amc, inventory_stock |
| A39 | MANUFACTURER_PRODUCTION_B2B | 27 | 1 | none | B2B_DEALER | CONFIGURED ONLY on a NEAR-fit pack | product_catalogue, quotation_estimation, manufacturing_production, inventory_stock, purchase_supplier |
| A40 | INFORMATION_LISTING_ONLY | 19 | 0 | none | none | LISTING ONLY (no workflow) | website_cms_only |

Common set given to every archetype (not repeated in the column): business profile, customer CRM, lead and enquiry, billing and invoicing, payments and receipts, reviews, WhatsApp, e-mail and SMS, website CMS, reports, staff roles.
