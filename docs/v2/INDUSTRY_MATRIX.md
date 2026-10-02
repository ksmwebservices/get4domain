# Industry Matrix (PRD §92.4)

> Part of the Get4Domain V2 audit baseline (2026-10-02, audit-only; no code changed by this work). Statuses use the PRD §64.2 vocabulary. **Static-verified only** — nothing here was executed against a running system. Source evidence: `evidence/industry.md`. Summary and verdict: [AUDIT_REPORT.md](AUDIT_REPORT.md).

> Industry list follows PRD §68 (32 industries). 20 are configured in the Operation/Industry Experience registry; the rest are MISSING.

## 8. INDUSTRY MATRIX (all PRD industries)

Columns: Industry | Client WebApp | Vendor Modules (backend module + Prisma models + frontend tab) | Workflow (data-backed?) | Reports | Automation | Status | Suggested target
"Target" is a recommendation for sequencing (V2.0 = must for PRD claim; V2.1 / V3 = later), not a statement of any approved plan.

| # | PRD industry | Config key | Client WebApp | Vendor modules | Workflow data-backed? | Reports | Automation | Status | Gaps | Target |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Business/Service | `general` | No engine site; classic fallback (home/listings/contact) + marketing chatbot | domainapp generic: Contact, CatalogItem, Record, GenericInvoice; tabs transactions/customers/catalog/billing | Generic CRUD, data-backed | domainapp/summary only | none | PARTIAL | no service-booking, no quote->invoice, no proposal | V2.0 |
| 2 | E-commerce/Retail | `retail` | Bespoke RetailSite (grid/PDP/cart drawer/checkout) | retail module (9 routes), RetailProduct + PosSale; PosView/Products/Inventory | POS+refund+stock atomic = real; web checkout partial | retail summary | none | PARTIAL | D1-D5, no shipping/tax/coupons/orders lifecycle/tracking, 3 product stores | V2.0 |
| 3 | Restaurant/Food | `restaurant` | Kit site (menu variant), lead-only ordering | restaurant module (15), PosTable/RestaurantOrder/Item; Orders/Tables/Kitchen | Dine-in order->kitchen->bill real; web orders not linked | restaurant summary | none | PARTIAL | no cart/add-ons/QR/delivery/GST/stock; web order never reaches kitchen | V2.0 |
| 4 | Grocery/Kirana | none (demo sub `retail/grocery`) | demo only | none | none | none | none | MISSING | no weight/units, khata, route, repeat orders | V2.1 |
| 5 | Catalogue/WhatsApp Enquiry | none dedicated | any kit site + wa.me link + engine.enquiry | CMS products; whatsapp-bot module (adjacent, not audited here) | enquiry->CRM lead real | none | WhatsApp bot (adjacent) | PARTIAL | no catalogue-share links, no enquiry cart | V2.0 |
| 6 | Salon/Spa | `salon` | Kit site, book tab = lead | salon (13): Stylist, SalonChair, SalonAppointment; Schedule/Stylists | CRUD+summary; no conflicts/billing/rebook/loyalty | summary by stylist | none | PARTIAL | availability, packages, loyalty, billing link | V2.0 |
| 7 | Clinic | `clinic` | Kit site, book tab = lead; fabricated doctors | clinic (9): Doctor, ClinicAppointment; Appointments/Doctors/Prescriptions | CRUD+summary; no patient/EMR/billing | summary by doctor | none | PARTIAL | consultation, prescription doc, follow-up reminders | V2.0 |
| 8 | Gym | `gym` | Kit site | gym (9): GymClass, Membership; Classes/Members; attendance=ComingSoon | CRUD+summary (buggy expiry) | summary by plan | none | PARTIAL | attendance, renewals, auto-expiry, trainers | V2.0 |
| 9 | Coaching/Education | `coaching`,`education` | Kit sites | coaching (13), education (9): Batch/Enrollment/Session; Batches/Students | CRUD; fees manual | summaries | none | PARTIAL | attendance, exams/results, parent comms, fee ledger | V2.1 |
| 10 | Real Estate | `realestate` | Bespoke RealEstateSite; visit booking real; token payment broken | realestate (13): Listing, Deal, PropertyVisit; Listings/Deals/Visits; documents=ComingSoon | Public enquiry->Deal and visit->PropertyVisit real; pipeline stages free-string | pipeline summary | none | PARTIAL | site reads VendorProduct not Listing, documents/payments/closure, R2 | V2.0 |
| 11 | Vehicle Dealer | none | none | none (automobile = service workshop) | none | none | none | MISSING | vehicle stock, test drive, finance/insurance/RTO | V2.1 |
| 12 | Vehicle Rental | none (closest `travel` fleet) | Travel kit site | travel: Vehicle, Driver, Trip, Contract | Fleet/driver/trip CRUD; no availability/KYC/pickup/return/inspection | accounts travel-summary | contract billing cron | PARTIAL | rental booking engine absent | V2.1 |
| 13 | Travel | `travel` | Kit site, plan-my-trip = lead | travel (16+5): Vehicle, Driver, Trip, VisaApplication, Contract(+Assignment); 5 dedicated views + generic bookings | Recurring contract GST billing real; trips/visa CRUD; bookings = generic Record | summary | daily billing @Cron | PARTIAL | package/traveller/availability/payment/documents missing | V2.0 |
| 14 | Hotel/Homestay | `hotel` | Kit site (check availability = lead) | hotel (9): Room, RoomBooking; Rooms/Reservations/Housekeeping | CRUD; no availability or state link | occupancy summary | none | PARTIAL | availability calendar, folio, channel sync | V2.0 |
| 15 | Finance/Insurance | `finance` | Kit site | finance (10): FinanceCase, FinanceCaseDocument; Cases/Documents | Case + auto doc checklist real; no eligibility/renewal | summary | none | PARTIAL | policy renewals, disbursement, commissions | V2.1 |
| 16 | News/Media | none | none | none | none | none | none | MISSING | articles, categories, authors, ads | V3 |
| 17 | Jewellery | none (demo sub `retail/jewellery`) | demo sub only | generic retail only | none specific | none | none | UI-ONLY | gold rate, making charges, hallmark, schemes | V2.1 |
| 18 | Pharmacy | none | none | none | none | none | none | MISSING | batch/expiry, Rx, schedule drugs | V3 |
| 19 | Electronics | none (demo sub `retail/electronics`) | demo sub only | generic retail | none specific | none | none | UI-ONLY | serial/warranty/EMI | V2.1 |
| 20 | Clothing | none (demo sub `retail/fashion`) | RetailSite supports size/colour in seed only; real products single image | generic retail | no variants for real products | none | none | UI-ONLY | variants, size chart, returns | V2.0 |
| 21 | Sweet shop/Bakery | none (demo sub `restaurant/bakery`) | restaurant kit | restaurant/retail modules reusable | as restaurant | none | none | UI-ONLY | pre-orders, weight-based pricing | V2.1 |
| 22 | Astrologer | none (demo category `astrology`) | demo only | none | none | none | none | UI-ONLY | consultation booking/kundli | V3 |
| 23 | Portfolio | `photography` (closest) | Kit site + VendorCMS.portfolio JSON | photography (10): PhotoShoot, ShootDeliverable | shoot + deliverables CRUD | summary | none | PARTIAL | generic portfolio/case-study site | V2.1 |
| 24 | Corporate | none dedicated (`technology`/`professional` kit sites) | Kit sites | technology (9), professional (10) | CRUD | summaries | none | PARTIAL | corporate pages, careers, investor info | V2.1 |
| 25 | Landing Page | n/a | /go/[slug] public page, view tracking, lead capture (campaign-pages) — existence verified only | CampaignPage, CampaignLead; dashboard/landing-page | page+lead real (static) | page analytics endpoint | none | PARTIAL | not deeply audited here | V2.0 |
| 26 | Distributor/Wholesaler | none | none | none | none | none | none | MISSING | | V3 |
| 27 | Export House | none | none | none | none | none | none | MISSING | | V3 |
| 28 | Group of Companies | none | none | none (no multi-business/branch model) | none | none | none | MISSING | | V3 |
| 29 | Manufacturing | none | none | none (no BOM/production) | none | none | none | MISSING | | V3 |
| 30 | Logistics | `logistics` | Kit site, quote = lead | logistics (5): Shipment; Shipments + reused Fleet/Drivers | Shipment CRUD + status stamps | summary | none | PARTIAL | pickup/hub/route/POD/billing/tracking | V2.1 |
| 31 | Repair/Workshop | `automobile` | Kit site | automobile (13): ServiceJob, JobLine, PartStock; Jobs/Parts | Job card + lines + parts stock CRUD; no estimate approval/QC/parts consumption/billing link | summary | none | PARTIAL | | V2.0 |
| 32 | Professional Services | `professional`,`technology`,`construction` | Kit sites | professional (10), technology (9), construction (13) | Engagement + checklist; tasks; milestones; no timesheets/milestone invoicing | summaries | none | PARTIAL | proposal->project->invoice chain | V2.0 |

Counts: PARTIAL 19, UI-ONLY 5, MISSING 8, WORKING 0.

---------------------------------------------------------------------

---

## Registry and configured industries (PRD §63I)


### Where it lives (four+ hand-synced copies, no single source)
| Copy | File | Contents |
|---|---|---|
| Frontend ops | get4domain_mvp/src/config/operations.ts | 17 operations (appointment, booking, site_visit, cart, order, quote, enquiry, lead, application, consultation, membership, subscription, payment, pos, delivery, pickup, service_request) |
| Frontend industry experience | get4domain_mvp/src/config/industry-experience.ts | 20 industries: primaryOperation, secondaryOperations, primaryCta, vendorModules, vendorMobileNav, clientModules, crmPipeline (+ generic fallback) |
| DB seed | backend-api/prisma/seed-registry.ts | same 17 ops + 20 industries, upserted into `OperationType` (g4d_operation_types) and `IndustryExperience` (g4d_industry_experiences) |
| Backend industry config | backend-api/src/config/industries/*.ts (index.ts) | 21 keys (20 + `general`), 3 aliases (healthcare->clinic, beauty->salon, fitness->gym): entity labels, recordStatuses, custom fields, addons, websiteTemplate, dashboardTabs, skin |
| Engine registry | get4domain_mvp/src/engine/registry.ts + engine/readiness.ts ENGINE_KEYS | 20 engine industries |
| Marketing/demo | data/industries-list.ts (20), data/industry-content.ts (30 categories), sitemap.ts (20 hard-coded) |

### Findings
1. `OperationType` and `IndustryExperience` DB tables are WRITE-ONLY. grep shows `prisma.operationType` / `prisma.industryExperience` only in seed-registry.ts. No backend service, controller or API reads them. The "config-in-DB so the platform can evolve without a redeploy" claim in the schema comment is not true: the live consumers read the TS constants. Status: BACKEND-ONLY (seed) / effectively unused.
2. Consumers of the frontend registry are narrow: `crmPipeline` (dashboard/crm/page.tsx:45), `primaryOperation` label (dashboard/layout.tsx:233, customer/page.tsx:249), operation allow-list in engine/kit/html-to-sectionkit.ts:134. `vendorModules`, `vendorMobileNav`, `clientModules`, `secondaryOperations` (as UI) have NO consumers (grep). The vendor mobile bottom nav (dashboard/layout.tsx:395) is a fixed 5-tab bar, not per-industry. So "industry selection drives vendor modules + mobile nav" is config-only, not behaviour.
3. Operations are labels, not capabilities. 9 of 17 operations map to `engine.enquiry` (appointment, booking, quote, enquiry, lead, application, consultation, service_request ... all = CRM lead). membership/subscription/payment/cart/order map to `engine.checkout.order` (one-time Razorpay; no recurring/subscription logic). delivery/pickup = null intent. Only `site_visit` (realestate.site_visit) and `pos` (retail.create_sale, vendor-only) map to a distinct domain persistence path. Status: PARTIAL.
4. IndustryConfig (backend config/industries) does deliver terminology, status lists, custom fields, tabs and customer-portal shape (deriveCustomerPortal). That is the part of 63I that is real: Clinic -> Patient/Appointment, etc. Missing from 63I: enabled-modules enforcement, dashboard widgets, forms, reports, document templates, automation rules, default roles/tasks/notifications. Owner "enable/disable capabilities later" is partly there via VendorAddon/VendorModule (UI-level; backend does not enforce, see R8).
5. "Changing industry must never delete/hide historical data": not tested/handled; per-industry data lives in separate tables so it is not deleted, but the dashboard dispatcher keys on the CURRENT industry only, so previous-industry data becomes unreachable in the UI (inference from domain-app/[tab]/page.tsx).

### The 20 configured industries (real list)
travel, restaurant, clinic, hotel, salon, gym, realestate, education, retail, construction, events, finance, automobile, logistics, diagnostics, photography, professional, agriculture, coaching, technology  (+ `general` fallback; aliases healthcare/beauty/fitness).
Signup (register/page.tsx via industries-list.ts) offers exactly these 20.
Demo/marketing has 10 MORE categories with NO backend config / engine site / ops module: petcare, movers, astrology, pestcontrol, interior, homeservices, rentalservices, printing, recruitment, government. A vendor cannot sign up as these; they are demo-only (UI-ONLY).

---------------------------------------------------------------------

## Backend industry modules — endpoints, models, logic depth


Route counts are from decorator counts in each controller (static). All controllers are vendor-JWT scoped (`u.sub` = vendorId) with per-row ownership guards (findFirst {id, vendorId}); tenant isolation by vendorId is consistently applied. All use hard `delete` (no soft delete; `deletedAt` appears once in schema.prisma). None enforce that the caller's industry matches the module (any vendor can call /clinic/*), and none enforce addon/module toggles server-side (grep: no addon guard anywhere in backend).

| Industry module | Routes | Prisma models | Logic depth (what the service really does) | Frontend view(s) -> API |
|---|---|---|---|---|
| travel (+contracts) | 16 + 5 | Vehicle, Driver, Trip, VisaApplication, Contract, ContractAssignment (bookings = shared generic Record) | CRUD; trip vehicle/driver ownership guards; **Contract recurring billing is REAL**: atomic period-claim, idempotent, GST invoice via GenericInvoice, @Cron daily 6am + manual "generate" (contracts.service.ts:90-155). Only @Cron in the whole backend | FleetView, DriversView, TripsView, VisaView, ContractsView; bookings tab = generic RecordsView |
| salon | 13 | Stylist, SalonChair, SalonAppointment | CRUD + ref guards + summary (today/upcoming/revenue by stylist). No slot-conflict check, no billing link, no rebooking | SalonScheduleView, StylistsView |
| gym | 9 | GymClass, Membership | CRUD + summary. Defect: summary only reads status=='active' rows, "expired" = active rows past endDate (no auto-expiry transition); monthlyRevenue = sum of all active prices | GymClassesView, MembershipsView; `attendance` tab = ComingSoon |
| hotel | 9 | Room, RoomBooking | CRUD + summary. No availability/overlap check; check-in/out does not change Room.status/housekeeping; no folio/billing | RoomsView, ReservationsView, HousekeepingView |
| realestate | 13 | Listing, Deal, PropertyVisit | CRUD + pipeline summary. Used by public Action Registry (enquiry->Deal, site_visit->PropertyVisit). Public website reads VendorProduct (CMS), NOT Listing -> two disconnected property stores | ListingsView, DealsView, VisitsView; `documents` tab = ComingSoon |
| education | 9 | Batch, StudentEnrollment | CRUD + batch existence check; fee fields manual (feePaid) | BatchesView, EnrollmentsView |
| coaching | 13 | CoachingBatch, CoachingEnrollment, CoachingSession | CRUD + batch check; sessions per batch; fee fields manual | CoachingBatchesView, CoachingStudentsView |
| professional | 10 | Engagement, EngagementDocument | CRUD + **auto-creates a document checklist per engagement type** (e.g. Legal: engagement letter, KYC, conflict check) + received timestamps | EngagementsView, DocumentsView |
| finance | 10 | FinanceCase, FinanceCaseDocument | CRUD + **auto-creates a required-documents checklist per case type**; deadline alerts in summary | CasesView, FinanceDocumentsView |
| construction | 13 | ConstructionProject, ProjectMilestone, ProjectMaterial | CRUD; milestone completedAt stamping; budget/spent are manual fields | ProjectsView, MaterialsView |
| events | 10 | EventBooking, EventVendorAssignment | CRUD; vendor cost aggregate in summary | BookingsView, EventVendorsView |
| automobile | 13 | ServiceJob, JobLine, PartStock | CRUD; job lines (parts/labour); estimateAmount is manual (not derived from lines); adding a part line does NOT decrement PartStock | JobsView, PartsInventoryView |
| logistics | 5 | Shipment | Plain CRUD + deliveredAt stamp + summary. No pickup/hub/route/driver assignment/POD/billing | ShipmentsView; fleet/drivers reuse Travel views |
| diagnostics | 9 | TestOrder, TestOrderItem | CRUD; sample_collected/report_ready timestamps; no report file/PDF delivery | TestOrdersView, ReportsView |
| photography | 10 | PhotoShoot, ShootDeliverable | CRUD; **auto-creates deliverables** per shoot; deliveredAt stamp | ShootsView, DeliveryView (gallery tab) |
| agriculture | 9 | ProduceOrder, ProduceStock | CRUD; dispatch/delivery date stamping; stock not linked to orders | ProduceOrdersView, ProduceInventoryView |
| technology | 9 | TechProject, ProjectTask | CRUD + project existence check; task counts in summary; no timesheet/milestone-invoice | TechProjectsView, TechTasksView |
| clinic | 9 | Doctor, ClinicAppointment (diagnosis/prescriptionNotes/followUpDate stored on the appointment) | CRUD + summary by doctor. No patient entity (uses generic Contact), no consultation/EMR, no billing link; `PrescriptionsView` is a read view over appointments | ClinicAppointmentsView, DoctorsView, PrescriptionsView |
| restaurant | 15 | PosTable (reused), RestaurantOrder, RestaurantOrderItem | **Real flow**: order total recompute from items, table occupied/available follows order lifecycle, kitchen-display query (unserved items on active orders), bill -> frees table. Missing: stock/ingredient deduction, GST, delivery/dispatch, QR table ordering | OrdersView, TablesView, KitchenView |
| retail | 9 | RetailProduct, PosSale (reused) | **Real**: POS sale validates stock then atomically decrements stock + writes receipt in `$transaction`; refund restores stock atomically (retail.service.ts). Stock check is outside the tx (race window). Web orders (PosSale type 'web') are NOT counted in retail summary and do NOT touch RetailProduct stock | PosView, ProductsView, InventoryView |

Totals: 20 modules, ~218 endpoints, ~39 dedicated models, 20 summary endpoints (all rendered on dashboard/accounts/page.tsx lines 129-245).

Tiering of the 20 (is there a REAL operational workflow?):
* Tier A — real state/transaction logic: retail (POS+refund), restaurant (order/table/kitchen/bill), travel (recurring contract billing).
* Tier B — CRUD + auto-seeded checklists/timestamps: finance, professional, photography, diagnostics, logistics, agriculture, construction, coaching, education (data-backed; workflow = manual status edits).
* Tier C — plain CRUD + KPI: salon, clinic, gym, hotel, realestate, events, automobile, technology.
* No industry implements the full PRD 63X chain. Typical missing links: availability/conflict control, billing/invoice from the operational record, customer-facing status, reminders/follow-up automation, GST, inventory linkage, reports beyond one summary card block.
* No cross-module automation: grep `@Cron` = 1 hit (travel contracts). No reminders (appointment/renewal/follow-up), no queues, no schedulers.

### Frontend dispatcher (get4domain_mvp/src/app/dashboard/domain-app/[tab]/page.tsx + domainapp/tab-registry.ts)
* `resolveView(tabKey)` returns one of records | contacts | catalog | billing | addon. Order of precedence in the page: (1) DomainApp-enabled guard, (2) addon guard (TAB_ADDON_REQUIREMENT), (3) per-industry `if (cfg.industry.key === ...)` branches returning dedicated views, (4) fallback to resolveView -> shared RecordsView/ContactsView/CatalogView/InvoicingView/ComingSoon.
* Dedicated views (47) all call real endpoints through `api.*` (lib/api.ts) — verified by grep of api calls per directory. They are real list/create/edit/delete screens.
* Shared generic tabs: customers/clients/patients/members(non-dedicated)/guests -> ContactsView (generic Contact); services/menu/products/packages/courses/plans/tests/properties/produce -> CatalogView (generic CatalogItem); billing/invoicing/fees -> InvoicingView (GenericInvoice, GST computed exclusive, PDF html, Razorpay payment-link, manual mark-paid); everything else -> RecordsView (generic Record).
* ComingSoon (UI-ONLY stubs): gym/attendance, realestate/documents (they hit TAB_ADDON_REQUIREMENT -> 'addon' and have no industry branch). STUB_TABS (doctors, stylists, kitchen, prescriptions, reports) are all superseded by dedicated branches for their own industry.
* Disconnected catalogues: THREE unsynced product stores — VendorProduct (website/CMS), CatalogItem (DomainApp), RetailProduct (retail ops). RestaurantOrder items can reference CatalogItem; website uses VendorProduct; no sync code exists (grep).

---------------------------------------------------------------------

## Not verified (be honest)

* Nothing was executed: no runtime rendering, no DB state, no migration status (several ops migrations are VM-apply only per project memory), no deployed-environment check (DNS, TLS, whether sub.get4domain.com resolves, whether Razorpay/Fast2SMS/ResellerClub/Supabase/OpenAI credentials are set).
* Visual distinctness of the three webapp modes (63E) was judged from component/theme code, not screenshots.
* Landing-page (campaign-pages), whatsapp-bot, CRM, wallet and payments internals were only touched where they intersect the engine; they belong to other audit areas.
* Sub-category count (76) and sitemap URL estimate (~640) come from pattern counting of TS data files, not by executing allDemoPaths().
* Upstream docs (docs/*.md, memory notes) were used only as pointers; every claim above was confirmed in source except where marked.
