> **Evidence file — static audit, 2026-10-02.** Produced by read-only code inspection (no runtime, no DB writes, no provider calls). Every status is "static-verified only" unless stated. This is raw supporting evidence for [AUDIT_REPORT.md](../AUDIT_REPORT.md); where it disagrees with AUDIT_REPORT.md or STATUS.md on post-audit changes, those win.

# AUDIT — INDUSTRY ENGINE + CLIENT WEBAPP (V2 PRD 63A-63G, 63I, 63X, 51/52, 40/41)

Repo: C:\Get4Domain\get4domain-site  |  Method: static inspection only (Read/Grep/ls). Nothing was run, built, migrated or queried.
Everything marked "static-verified" means the code path was read end-to-end in source; no runtime/DB/browser evidence was gathered.

NOTE ON PRD SECTION NUMBERS: the PRD file in the repo (GET4DOMAIN_V2_PRD_CLAUDE_CODE_PROMPT.md, 3,680 lines) ends at Section 63 (63A-63AF). It has NO Sections 67, 68, 83 or 92.4. The "PRD Section 68 industry list" was therefore taken from the list in the audit brief, cross-checked against PRD Section 6 (Category coverage, lines 398-432) and Section 63X (industry operations). Section 51/52 = Demo Environment, Section 40/41 = Website/CMS and Client PWA.

Status vocabulary used exactly: WORKING, PARTIAL, UI-ONLY, BACKEND-ONLY, MOCKED, BROKEN, MISSING, BLOCKED-EXTERNAL, DEFERRED-APPROVED. No item was marked DEFERRED-APPROVED: nothing in the repo is a signed-off deferral against this PRD (code comments saying "future work" are not approvals).

---------------------------------------------------------------------
## 0. BOTTOM LINE

The app is NOT 100% functional against the V2 PRD in this area. Zero of the 32 PRD industries are WORKING end-to-end against the PRD 63X workflow chains.

* 20 industries are configured; each has a real data-backed back-office CRUD module (Prisma model + Nest controller + dedicated React view). That is genuine UI -> API -> DB, but it is thin: ~218 endpoints, almost all plain CRUD + a KPI `summary()`. Only 3 areas have real transactional/state logic (retail POS, restaurant order/table/kitchen, travel recurring-contract billing).
* The public Client WebApp is 20 bespoke-looking sites on a shared "kit". For 18 of 20, "Book appointment / Reserve table / Place order / Request quote" all collapse to one `engine.enquiry` call that creates a CRM lead with a free-text message. No appointment/booking/order record is created, no slot/availability, no confirmation. Only Real Estate (site visit) creates a domain record from the public site.
* Real checkout exists (cart -> Razorpay with the VENDOR's keys -> PosSale 'web' + CRM lead) but is exposed only on Retail (bespoke) and on one kit section variant; it trusts client prices, has no idempotency/webhook, no address/shipping/fulfilment, no order tracking, and stock decrement is a silent no-op for retail products.
* Live vendor sites render hard-coded sample content (invented doctors, "15k+ patients", "4.9 stars", testimonials, opening hours, seed properties/prices) whenever the vendor has not overridden it — which for the kit sections is always.
* Subdomain serving and custom-domain serving are not implemented in the app (middleware only matches /demo). Domain registration/DNS verification code is real but untested against a live registrar.
* PWA is platform-level only; there is no per-vendor/client branded PWA. Customer portal is read-only OTP-login (in-memory OTP, no rate limit).
* No automated tests exist anywhere in backend-api/src or get4domain_mvp/src. Only one scheduled job exists in the whole backend.

### Status counts
Master Feature Matrix (Section 9, 50 rows): WORKING 16, PARTIAL 14, UI-ONLY 1, BROKEN 2, MISSING 15, BLOCKED-EXTERNAL 2, BACKEND-ONLY 0, MOCKED 0, DEFERRED-APPROVED 0.
Industry Matrix (Section 8, 32 PRD industries): WORKING 0, PARTIAL 19, UI-ONLY 5, MISSING 8.

---------------------------------------------------------------------
## 1. OPERATION REGISTRY + INDUSTRY EXPERIENCE REGISTRY (63I)

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
## 2. BACKEND INDUSTRY MODULES — endpoints, models, logic depth

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
## 3. CLIENT WEBAPP ENGINE — what is real vs placeholder

### 3.1 Engine structure (get4domain_mvp/src/engine)
* registry.ts: 20 entries. `realestate` = hand-built RealEstateSite; `retail` = bespoke RetailSite (product grid, PDP modal, cart drawer); the other 18 = `kit(...)` -> KitRenderer with a per-industry builder (engine/industries/kit/appointments|hospitality|commerce|projects.ts) giving theme + section order + copy. "Add industry = 1 registry entry" holds for the kit path.
* Rendering paths on /site/[subdomain]/[[...rest]]/page.tsx in precedence: uploaded raw-HTML theme (iframe) -> data-driven template (renderKitTemplate) -> engine industry -> classic fallback (only home/listings/contact). Engine/template/theme paths render ONLY at `rest.length===0 || 'home'` (page.tsx:129,138); any other sub-path (e.g. /site/x/contact) drops to the classic renderer with a different design. So engine sites are single scrolling pages with anchor nav; PRD-style multi-page client sites (Shop / Categories / Product URL / Orders) do not exist.
* Section kit (KitRenderer) has 13 section types; EngineBottomNav gives real per-industry mobile bottom navigation (4-5 anchor items, scroll-spy, emphasised primary action) — WORKING, but anchors on one page.

### 3.2 Public Action Registry (backend-api/src/engine)
Registered intents (action-registry.ts): `engine.enquiry` (public -> CrmService.createLead + vendor notification), `engine.checkout.order` + `engine.checkout.confirm` (public), `restaurant.bill_order` (vendor), `retail.create_sale` (vendor), `realestate.enquiry`, `realestate.site_visit`, `realestate.payment_cta` (public). Dispatch resolves vendorId from the subdomain server-side (engine.service.ts:dispatchPublic), DTO-validates with whitelist/forbidNonWhitelisted, and is correctly restricted to `public: true` intents. Tenant boundary for anonymous callers is sound. No rate limiting/CAPTCHA (grep `Throttle` = 0 hits across backend) so engine.enquiry is a spam vector.
Only ONE public action exists for 18 of 20 industries (enquiry). There is no public `clinic.book`, `salon.book`, `hotel.reserve`, `restaurant.order`, `gym.join`, etc.

### 3.3 Cart -> Checkout -> Razorpay -> order persisted (63B/63F verification)
Path traced: EngineCart.tsx / retail CartDrawer.tsx -> `api.engineDispatchPublic(sub,'engine.checkout.order')` -> PublicCheckoutService.createOrder (VENDOR Razorpay keys via VendorPaymentsService.getKeys; 400 if vendor payments not enabled) -> Razorpay Checkout -> handler -> `engine.checkout.confirm` -> HMAC verify with vendor secret -> `$transaction`: `PosSale{type:'web', paymentMethod:'razorpay', status:'completed'}` + CatalogItem.stock decrement -> best-effort CRM lead 'web-order'. Vendor sees them in dashboard/orders (api.engineWebOrders -> /engine/orders).
* Persisted as PosSale 'web' — NOT RestaurantOrder, so restaurant web orders never reach the Kitchen Display. Status: no kitchen integration.
* Cart self-hides unless live + paymentsEnabled: VERIFIED. KitRenderer: `CartProvider enabled={shop && !!subdomain}` with `shop = mode.kind==='live' && !!site.paymentsEnabled`; `AddToCartButton` returns null when cart disabled; RetailSite: `canCheckout = live && paymentsEnabled && subdomain`. `paymentsEnabled` = VendorPaymentConfig.enabled && keyId && keySecret (cms.service.ts getSiteBySubdomain). WORKING.
* Kit cart (EngineCart): state is in-memory React state (lost on refresh); retail cart persists in localStorage. AddToCartButton appears ONLY in the Showcase 'cards' variant (kit/sections.tsx:111) — the Restaurant uses variant 'menu', which has no add-to-cart. Prices are parsed from display strings (`priceNum`, sections.tsx:17), so "from ₹45,000/mo" becomes 45000.
* Defects (public-checkout.service.ts, engine.dto.ts):
  - D1 Price integrity: `CheckoutLine.price` is client-supplied (engine.dto.ts:65). `total()` (service:47) sums client prices; createOrder never looks up server-side price. The comment "recomputed server-side from the cart" only means summed from client items. A buyer can pay ₹1 for any item. HIGH.
  - D2 confirm() recomputes the total from client items again and never compares it with the paid Razorpay order amount, nor ties the order id to the vendor/cart; the signature check proves the payment exists, not that it matches the cart. No uniqueness on razorpayPaymentId -> replaying the same (valid) confirm call creates duplicate PosSale rows, duplicate stock decrement and duplicate leads. HIGH.
  - D3 No Razorpay webhook for vendor-keyed orders (payments webhook only handles platform Invoice by razorpayOrderId == payment-link id): if the buyer closes the tab after paying, money is taken but no order exists (frontend text even says "keep your payment id").
  - D4 No shipping/delivery address, fulfilment type (dine-in/takeaway/delivery), tax/GST, coupon, notes beyond free text; `taxAmount: 0` hard-coded; no order number; no confirmation email/WhatsApp to the buyer; no order status lifecycle (PosSale.status is always 'completed').
  - D5 Stock decrement no-op for retail: retail sends `catalogItemId = product.id` where product is a VendorProduct (retail/data.ts:107-118, cart-context.tsx:101), but the backend decrements `CatalogItem` (service:96). updateMany matches 0 rows silently. The kit cart sends no catalogItemId at all. Stock is never decremented from public orders; RetailProduct (POS stock) is never touched.
* Status: cart UI WORKING; checkout->PosSale PARTIAL; order lifecycle/customer tracking MISSING.

### 3.4 PRD 63A-63G: three distinct customer experiences?
| PRD mode | Reality | Status |
|---|---|---|
| 63A Business Website WebApp (Brand -> Trust -> Services -> Enquiry -> Booking -> Contact) | 18 kit industries + classic fallback: genuinely different themes/sections; conversion = enquiry lead; no booking records; trust content is fabricated sample copy (R3) | PARTIAL |
| 63B E-commerce Shopping WebApp (Products -> Cart -> Checkout -> Order) | RetailSite: product grid with category chips, PDP modal (sizes/colours only in seed data; real products = single image, no variants), cart drawer (localStorage), Razorpay checkout -> PosSale. No search/sort/filters, no per-product URLs (no SEO/Product JSON-LD), no shipping, tax, coupons, order history/tracking, wishlist | PARTIAL |
| 63F Restaurant/Food (Menu -> Item -> Add-ons -> Cart -> Dine-in/Takeaway/Delivery -> Payment) | Distinct look (theme + 'menu' variant) but the "Order food" tab is `engine.enquiry` (free-text lead); no cart on the menu, no add-ons, no order-type captured structurally, no table/QR route, no kitchen link. On-page copy promises "Instant confirmation" and "Live order updates" which do not exist | UI-ONLY |
| 63G "must not be one generic template" | Visually distinct per industry: yes. Behaviourally distinct: only retail checkout and real-estate site-visit | PARTIAL |
| 63D Enable commerce on a business website without duplicating it | The only switch is the vendor's Razorpay config (`VendorPaymentConfig.enabled`, dashboard/payments). When on, an "Add to cart" button + floating cart pill appear on the same site. There is no "Commerce -> Enable Online Store" capability that adds Shop/Categories/Products/Cart/Checkout/Orders navigation or pages; and for kit sites the cart only shows on 'cards' sections | PARTIAL |
| 63E Visual distinction | Business vs e-commerce visually distinct (kit themes vs RetailSite); verified from code only, no rendering done | PARTIAL (static) |

### 3.5 Live-site content integrity (HIGH — R3)
KitRenderer renders the builder's hard-coded sections regardless of mode; only the hero banner is swapped for the vendor's banner on live (registry.ts withVendorBanner) and catalogue `items` via itemsFrom(). Examples rendered on live vendor sites: clinic — "Dr. Anjali Mehta, MBBS MD 18 yrs", stats "20+ years / 15k+ patients / 4.9 rating", health packages with prices, opening hours, 3 named testimonials, FAQ (kit/appointments.ts:28-52); restaurant — "Open today 12-11pm", offers table, "Delivery radius 6 km", testimonials by "Karthik/Meera" (kit/commerce.ts:27-45); real estate — seed projects "2 BHK Whitefield 68 L" when the vendor has no products (real-estate/model.ts:59-61, 101); retail — "Delivery Same day / Returns 7 days" rows, seed catalogue if empty. `brandFrom()` falls back to defaults ("CareWell Clinic" etc.) when CMS is empty. hasRealItems() exists (content.ts:55) but is never used by any caller. A live vendor can publish a site showing invented credentials and reviews they did not write. Status: BROKEN (as a launch-readiness/compliance matter).

### 3.6 Customer portal (/customer; backend customer module)
* Auth: phone OTP -> customer JWT (separate secret, kind:'customer'), resolve() verifies kind/sub/vendorId. WORKING mechanically.
* Defects: OTP store is an in-memory Map (customer.service.ts:24) — lost on restart/multi-instance despite the doc comment "stateless… survive restarts"; no attempt counter/lockout/rate limit on /customer/verify (6-digit code, 5-min TTL) -> brute-forceable; OTP from Math.random (:55); `[MOCK] OTP for <phone>: <otp>` is logged unconditionally even in production (:60); contact lookup `findFirst({ where:{ phone } })` (:50) is not vendor-scoped, so the same phone number registered with two vendors logs into whichever row is first (cross-business mix-up); `portalAccess` flag is never checked at login; `devOtp` is returned in non-prod. SMS is MOCK when no Fast2SMS key (sms.service.ts:43).
* Data: `me` (industry-shaped tabs via deriveCustomerPortal), `records` (generic Record rows for contactId only — industry operational tables such as ClinicAppointment/RoomBooking/SalonAppointment are NOT visible to the customer), `catalog` (active CatalogItem, read-only), `invoices` (read-only; UI states payment is "separate future work"), `contact`, `actions/engine.enquiry` (creates CRM lead; the portal does not create appointments/bookings/orders). Customer cannot pay, track orders, see wallet/loyalty, or receive notifications. Status: PARTIAL.

### 3.7 PWA (PRD 41)
Platform-level only: app/manifest.ts (name "Get4Domain", start_url '/'), public/sw.js (cache 'g4d-v2', offline page, Web Push handlers), InstallPrompt used only in dashboard/layout.tsx. No per-vendor manifest (brand name/icon/theme), no service worker scope for /site/[subdomain] or /customer, no customer push subscription. A client WebApp cannot be installed as the CLIENT's app. Status: platform PWA WORKING; client PWA MISSING.

### 3.8 CMS-managed content (PRD 40)
VendorCMS (identity, banner, logo, social, GA id, hours, SEO fields, themeId, portfolio JSON) + VendorProduct + Category, edited in dashboard/my-website (api.getVendorCMS/updateVendorCMS/uploadImage). Public read: GET /cms/site/:subdomain (non-sandbox vendors only; includes theme, products, paymentsEnabled). WORKING for fields/products. MISSING: pages/sections editor, menus, header/footer, blog, forms builder, landing-page builder inside the site (landing pages exist separately as campaign-pages /go/[slug]).

### 3.9 Theme marketplace
WebsiteTheme (cssVars, layout, raw-HTML `pages` multi-page, css, js, fonts, price, preview), VendorTemplateUnlock, admin create/update/delete (AdminGuard), vendor list-with-unlocked, unlock order/confirm (platform Razorpay, price + 18% GST, GST invoice created best-effort), apply gating in cms.service.ts:81-84. Raw-HTML themes render in an iframe (raw-theme-frame.tsx:119 sandbox="allow-scripts allow-forms allow-same-origin …"; srcDoc + allow-same-origin + allow-scripts means theme JS shares the page origin — acceptable only because themes are admin-uploaded). Defect R5: confirmUnlock verifies only the Razorpay signature; it never checks that the orderId was the one created for THIS vendor+theme or that the paid amount equals the price, so any valid platform payment signature (e.g. a cheaper order) can unlock a premium theme. Status: PARTIAL (works, one integrity gap). Memory notes also say multi-page raw-HTML ingest "pending push" — repo contains the code; deployment state not verifiable here.

### 3.10 Domains (subdomain / custom domain)
* Registration: DomainsService.register — checks availability, requires registrar name servers + per-vendor ResellerClub customer/contact, debits wallet FIRST then calls registrar and REFUNDS on failure (money-safe by construction), persists DomainRegistration (status mapping_pending). Search throws 503 RESELLERCLUB_NOT_CONFIGURED until credentials are set. resellerclub.service.ts self-declares "not yet verified against a live account". Status: BLOCKED-EXTERNAL (creds + live test).
* Connect/verify: records external domain; verifyMapping does a real dns.resolve4 against SERVER_IP (default hard-coded 34.14.130.68) or CNAME to *.get4domain.com and flips status to 'active'. Real. But status 'active' only means DNS points at the box.
* Serving: NOT implemented. middleware.ts matcher is '/demo/:path*' only; no code anywhere reads the Host header (grep `x-forwarded-host|headers()` in frontend = 0). docs/GET4DOMAIN_SUBDOMAIN_INFRA_REQUIREMENT.md (06 Sep 2026) states "no host->path rewrite" and wildcard DNS/TLS not confirmed. nginx-get4domain.conf has a `*.get4domain.com` server block on :80 only (no TLS, no per-custom-domain blocks, no cert automation). Vendor sites are only reachable at get4domain.com/site/<subdomain>. DomainRegistration is never consulted by the site route. Status: subdomain host rewrite MISSING; wildcard DNS/TLS BLOCKED-EXTERNAL; custom-domain serving + SSL MISSING.

---------------------------------------------------------------------
## 4. SEO / AEO / GEO ON CLIENT SITES (verified output)

| Capability | Where | Result |
|---|---|---|
| title/description/keywords/OG per vendor site | site/[subdomain]/.../page.tsx generateMetadata (uses cms.seoTitle/seoDesc/seoKeywords/banner) | WORKING. Not per-page; engine sites are one page. A transient API failure returns notFound -> 404 title "Site not found" |
| JSON-LD | only inside the classic fallback branch (page.tsx:168, LocalBusiness: name, description, image, telephone, address as plain string, url under get4domain.com/site/...) | PARTIAL: absent on all 20 engine industries, templates and raw-HTML themes, i.e. on essentially every real vendor site. No openingHours, geo, sameAs, Product/Service/FAQ/Offer schema |
| canonical / hreflang | none for vendor sites (all `alternates.canonical` hits are marketing pages) | MISSING |
| sitemap | app/sitemap.ts is platform-level: 16 static pages + 20 industry pages + allDemoPaths() (~106 demo home paths + section pages, estimated ~640 URLs). No vendor-site URLs. Demo URLs are listed although middleware 307-redirects them to /visit-demo (OTP gate) -> sitemap lists unindexable URLs | MISSING for vendors; PARTIAL (inconsistent) for platform |
| robots | app/robots.ts platform-level (allows AI bots, disallows /dashboard, /admin, /customer, /api, /login, /register); no per-vendor robots; /demo not disallowed | MISSING for vendors |
| Google Analytics | `VendorCMS.googleAnalyticsId` stored and editable in my-website; grep shows it is never rendered on any site | MISSING (field is UI-ONLY) |
| Local SEO fields | address/phone/hours/maps stored; footer shows phone/email/address/hours; no LocalBusiness schema on engine sites, no Google-Business sync | PARTIAL |
| AEO/GEO (llms.txt, FAQ schema, entity data) | public/llms.txt + FAQ JSON-LD (components/marketing/Faq.tsx) are Get4Domain marketing assets only | MISSING for client sites |
| Product SEO (PRD 16) | Retail PDP is a modal: no URL, no Product schema, no per-product meta | MISSING |
| Classic fallback site embeds `<ChatBot />` = "Get4Domain Assistant" (marketing sales bot) on a vendor's public page | page.tsx import ChatBot | BROKEN (wrong brand on client site; low) |

---------------------------------------------------------------------
## 5. STANDALONE VENDOR SITES

| Site | What it is | Wired to backend? | Deploy config |
|---|---|---|---|
| stepnrock/ | Next 14 e-commerce style site (shop, product, cart, about, contact) | YES: reads GET /cms/site/<subdomain> + /cms/vendor/:id/categories (lib/site-data.ts); cart calls engine.checkout.order/confirm directly with the same Razorpay-vendor flow (CartView.tsx) -> inherits defects D1-D5 | Dockerfile, docker-compose (port 3015), nginx-stepnrock.conf, netlify.toml, .env.local present |
| deebiphotography/ | Next 13 photography portfolio + booking modal | YES: CMS read (lib/site-data.ts) + engine.enquiry CRM lead via BookingModal/Contact (awaited; real) ; booking = enquiry lead | Dockerfile, compose, nginx conf, netlify.toml |
| ksm-quantum/ | Next 15 corporate parent-company site (about, products, technology, contact), has sitemap.ts + robots.ts + OG image | NO backend calls; contact = mailto link | Dockerfile, compose (port 3014), nginx-ksmquantum.conf; deploy+DNS pending per memory (not verifiable here) |
| allwin-tours/ | Next 15 tours/fleet/packages brochure site | NO CMS/CRM; contact = wa.me link; /api/chat route calls Claude API (needs CLAUDE_API_KEY, placeholder otherwise) | Dockerfile, compose (port 3010); no nginx conf in dir; nginx-get4domain.conf notes allwintours host exists in prod (infra doc) |
| theme-uploads/clinic-demo | 12 static HTML/CSS/JS files for the raw-HTML theme ingest (Theme Marketplace sample) | n/a | not an app |

Standalone sites are separate Next apps, not tenants of the engine; they do not benefit from engine fixes. Two of four are actually integrated with the platform backend.

---------------------------------------------------------------------
## 6. DEMO ENVIRONMENT (PRD 51/52)

* Gate: middleware.ts runs before any /demo/* page: unknown sub-category keywords are canonicalised (307), otherwise a signed httpOnly category-scoped pass cookie (lib/demo-access, set by OTP flow /api/demo/verify) is required, else redirect to /visit-demo. WORKING (static-verified). Side effect: ~640 demo URLs are in sitemap.xml but unreachable to crawlers.
* Content: 30 demo categories (industry-content.ts) = the 20 industries + 10 demo-only; 76 curated sub-categories across 19 categories (demo-site.ts SUBCATEGORIES, counted by pattern; 11 categories have only `general`); ~106 category/sub home paths + section pages (allDemoPaths()). Category homes for the 20 engine industries render the same engine site in `demo` mode (sub-category only varies about copy + cover image); section pages and the 10 extra categories use the classic DemoSiteNav/DemoCatalogGrid renderer. Demo content is static TS (data/demo-site.ts 1,220 lines, demo-catalog.ts 1,278, industry-content.ts 599) — not generated; backend/src/demo/demo-content.ts (361 lines) holds per-industry service/testimonial seed used for sandboxes.
* Demo enquiries (mode 'demo') post to api.demoEnquiry (real lead to TeleCRM) — not into any vendor tenant.
* Sandbox vendor (interactive tour): demo.service.provisionSandbox creates a real Vendor row isSandbox:true with 48h expiry, seedVendor() creates 5 contacts, N catalog items, 6 Records, 2 GenericInvoices from the industry config; cleanup is admin-triggered (POST /demo/cleanup-sandboxes, AdminGuard) — no @Cron so expired sandboxes persist until someone calls it. Public site endpoint excludes sandbox vendors (cms.service.ts:getSiteBySubdomain throws 404 for isSandbox), and `convertSandbox` flips isSandbox off on purchase. Separation from production: WORKING.
* Gaps vs PRD 51: sandbox seeds ONLY generic Contact/Catalog/Record/Invoice. None of the 20 dedicated industry tables (ClinicAppointment, RoomBooking, SalonAppointment, ServiceJob, Shipment…) are seeded, so in the tour the dedicated operational views for the industry are empty. No demo leads/tasks/campaigns/analytics/SEO/communications/orders. PRD 52 mandatory review of every tab/empty/loading/error states cannot be claimed.
* Status: gating WORKING; category/sub-category content WORKING; operational demo data PARTIAL.

---------------------------------------------------------------------
## 7. KEY RISKS / DEFECTS (ranked, with evidence)

| # | Sev | Defect | Evidence |
|---|---|---|---|
| R1 | HIGH | Public checkout trusts client prices; confirm not bound to paid amount; replayable; no webhook fallback | engine.dto.ts:65 (price from client); public-checkout.service.ts:47-48, 68-110 |
| R2 | HIGH | Real-estate booking-token payment charges the PLATFORM Razorpay account (env RAZORPAY_KEY_ID), not the vendor's; no verification/confirm; UI shows "Payment received" in the handler without any server call | action-registry.ts:187-189; real-estate/sections/ReEnquiry.tsx handler |
| R3 | HIGH | Fabricated doctors, ratings, patient counts, testimonials, hours, offers, seed properties shown on live vendor sites | kit/appointments.ts:28-52, kit/commerce.ts:27-45, real-estate/model.ts:59-61,101; hasRealItems never called |
| R4 | HIGH | Customer OTP: in-memory, no attempt limit, Math.random, OTP logged in prod, phone lookup not vendor-scoped | customer.service.ts:24,50,55,60 |
| R5 | MED | Premium theme unlock not bound to the paid order | website-themes.service.ts:48-52 |
| R6 | HIGH (for PRD) | Subdomain/custom-domain serving not implemented | middleware.ts:39; docs/GET4DOMAIN_SUBDOMAIN_INFRA_REQUIREMENT.md |
| R7 | MED | Stock decrement from public orders silently no-ops; three disjoint product stores | retail/data.ts:107-118; cart-context.tsx:101; public-checkout.service.ts:96 |
| R8 | MED | No server-side industry/addon/module enforcement; hard deletes; no audit; no rate limiting on public endpoints; zero automated tests | grep (no addon guard, no Throttle, no *.spec/*.test) |
| R9 | MED | Registry DB tables write-only; vendorModules/vendorMobileNav/clientModules unused; 4-5 hand-synced copies | seed-registry.ts only writer; grep consumers |
| R10 | MED | DomainApp invoice payment links created with PLATFORM Razorpay env keys; webhook handles only platform Invoice, not GenericInvoice -> manual mark-paid | invoices.service.ts:13-18,115-141; payments.service.ts handleWebhookEvent |
| R11 | MED | Public "booking" in 18 industries is an enquiry; UI/copy promises confirmation/live updates | KitEnquiry.tsx; kit builders `points` arrays |
| R12 | LOW | Sandbox seeds generic data only; cleanup is manual | demo.service.ts:207-290, controller :52 |
| R13 | LOW | Module logic defects: gym expiry/revenue summary, hotel check-in no room state, no double-booking checks, automobile lines don't move stock | gym.service.ts summary; hotel/salon/clinic services |
| R14 | LOW | Sitemap lists OTP-gated /demo URLs; fallback site embeds marketing chatbot; GA id never injected | sitemap.ts, site page.tsx, my-website |

---------------------------------------------------------------------
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
## 9. MASTER FEATURE MATRIX — CLIENT WEBAPP

| ID | Feature | Route / code | Status | Notes |
|---|---|---|---|---|
| F01 | Live vendor site by subdomain (path form) | app/site/[subdomain]/[[...rest]]; GET /cms/site/:subdomain | WORKING | Sandbox vendors 404; force-dynamic; static-verified |
| F02 | Host-based subdomain routing (sub.get4domain.com) | middleware.ts (matcher /demo only) | MISSING | Infra doc says not implemented |
| F03 | Wildcard DNS + TLS + nginx for *.get4domain.com | nginx-get4domain.conf (HTTP :80 block only) | BLOCKED-EXTERNAL | Needs KSM infra |
| F04 | Domain search + register (ResellerClub) with wallet debit/refund | backend domains module; dashboard/domain-management | BLOCKED-EXTERNAL | Code real; creds + live test missing |
| F05 | Connect external domain + DNS verify | domains.service verifyMapping | PARTIAL | Real DNS lookup; status only |
| F06 | Custom domain serving + SSL | none | MISSING | No Host lookup anywhere |
| F07 | Engine registry renders 20 industries (live/demo/preview) | engine/registry.ts | WORKING | Static-verified |
| F08 | Live sites show only vendor data (no fabricated fallback) | kit builders, real-estate model | BROKEN | R3 |
| F09 | Real Estate bespoke site | engine/industries/real-estate | PARTIAL | Seed props fallback; token payment broken |
| F10 | Retail bespoke grid / PDP / category chips | engine/industries/retail | WORKING | UI; no search/sort/URLs |
| F11 | engine.enquiry -> CRM lead + notification | action-registry.ts | WORKING | No rate-limit/CAPTCHA |
| F12 | Public appointment/booking/quote (18 kit industries) | KitEnquiry.tsx | PARTIAL | Lead with text only |
| F13 | RE site-visit booking -> PropertyVisit | realestate.site_visit | WORKING | + vendor notification |
| F14 | RE booking-token payment | realestate.payment_cta | BROKEN | R2 |
| F15 | Cart/checkout self-hide unless live+paymentsEnabled | KitRenderer/RetailSite/EngineCart | WORKING | Verified |
| F16 | Retail cart -> Razorpay (vendor keys) -> PosSale 'web' | CartDrawer + public-checkout.service | PARTIAL | D1-D5 |
| F17 | Kit cart ('cards' variant only) | EngineCart.tsx | PARTIAL | In-memory cart; display-string pricing |
| F18 | Restaurant menu -> cart -> order type -> payment | kit 'menu' variant, enquiry tab | UI-ONLY | No cart on menu; lead only |
| F19 | Order lifecycle, fulfilment, tracking, buyer order history | none | MISSING | PosSale.status always completed |
| F20 | Enable commerce on business site (63D) | VendorPaymentConfig.enabled | PARTIAL | Cart pill only; no Shop nav/pages |
| F21 | Three distinct modes: Business / E-commerce / Restaurant (63A/B/F/G) | engine | PARTIAL | Distinct looks; restaurant flow not real |
| F22 | Customer OTP login | customer.service | PARTIAL | R4 |
| F23 | Customer portal records/catalogue/invoices/contact | /customer | PARTIAL | Generic Record only; read-only |
| F24 | Customer portal enquiry action | customer/actions/engine.enquiry | WORKING | Lead only |
| F25 | Customer pays invoice/order online in portal | none | MISSING | UI text says future work |
| F26 | Customer wallet / loyalty / offers / referrals | none | MISSING | Only marketing copy |
| F27 | Customer notifications / push | none | MISSING | Push subs are vendor-only |
| F28 | Platform PWA (manifest, SW, offline page, install, push) | manifest.ts, public/sw.js | WORKING | Platform brand only |
| F29 | Per-vendor branded installable PWA | none | MISSING | |
| F30 | Per-industry public bottom nav | EngineBottomNav + builders | WORKING | Anchor scroll-spy, 20 industries |
| F31 | Per-industry vendor mobile nav / module list from registry | industry-experience vendorMobileNav/vendorModules | MISSING | Config with no consumer |
| F32 | CMS fields, logo/banner upload, products, categories | my-website; /cms/* | WORKING | Static-verified |
| F33 | CMS pages/sections/menus/blog/forms builder | none | MISSING | |
| F34 | Theme marketplace (list, unlock w/ Razorpay+GST invoice, apply gate, admin CRUD) | website-themes, cms.service | PARTIAL | R5 |
| F35 | Raw-HTML multi-page theme in isolated iframe | raw-theme-frame, raw-html-site | WORKING | Static; admin-trusted JS |
| F36 | Per-site title/description/OG | generateMetadata | WORKING | |
| F37 | JSON-LD on vendor sites | classic fallback only | PARTIAL | Missing on engine sites |
| F38 | Per-vendor sitemap / robots / canonical | none | MISSING | |
| F39 | Google Analytics injection | googleAnalyticsId stored only | MISSING | |
| F40 | AEO/GEO for client sites (llms.txt, FAQ/Product schema) | none | MISSING | |
| F41 | Demo OTP gate (server middleware) | middleware.ts | WORKING | Signed cookie, category-scoped |
| F42 | Demo content library (30 categories / 76 subs) | data/demo-site.ts etc. | WORKING | Static TS |
| F43 | Demo operational data depth (PRD 51) | demo.service seedVendor | PARTIAL | Generic tables only |
| F44 | Demo vs production separation | isSandbox, cms.service | WORKING | |
| F45 | Operation Registry (17 ops) | config/operations.ts + OperationType | PARTIAL | Labels; DB unused |
| F46 | IndustryExperience registry (20) | config/industry-experience.ts + table | PARTIAL | Only crmPipeline/primaryOp consumed |
| F47 | IndustryConfig (terminology, statuses, fields, tabs, portal shape) | backend config/industries | WORKING | |
| F48 | Server-side industry/addon/module enforcement | none | MISSING | |
| F49 | Automated tests (unit/integration/e2e) | none found | MISSING | |
| F50 | Scheduled automation/reminders (appointments, renewals, follow-ups) | only travel contract @Cron | MISSING | |

Counts: WORKING 16, PARTIAL 14, UI-ONLY 1, BROKEN 2, MISSING 15, BLOCKED-EXTERNAL 2.

---------------------------------------------------------------------
## 10. WHAT WAS NOT VERIFIED (be honest)
* Nothing was executed: no runtime rendering, no DB state, no migration status (several ops migrations are VM-apply only per project memory), no deployed-environment check (DNS, TLS, whether sub.get4domain.com resolves, whether Razorpay/Fast2SMS/ResellerClub/Supabase/OpenAI credentials are set).
* Visual distinctness of the three webapp modes (63E) was judged from component/theme code, not screenshots.
* Landing-page (campaign-pages), whatsapp-bot, CRM, wallet and payments internals were only touched where they intersect the engine; they belong to other audit areas.
* Sub-category count (76) and sitemap URL estimate (~640) come from pattern counting of TS data files, not by executing allDemoPaths().
* Upstream docs (docs/*.md, memory notes) were used only as pointers; every claim above was confirmed in source except where marked.
