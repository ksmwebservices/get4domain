# Vendor Dashboard — Proposed Information Architecture (2026-10-08)

> Proposal only (no code changed). Evidence for every "today" statement is in [VENDOR_DASHBOARD_AUDIT.md](VENDOR_DASHBOARD_AUDIT.md); the registry that would generate this navigation is specified in [FEATURE_REGISTRY_DESIGN.md](FEATURE_REGISTRY_DESIGN.md); wording fixes are in [CLAIMS_VS_REALITY.md](CLAIMS_VS_REALITY.md).

## 1. Design principles

1. **Organise by the vendor's job, not by our modules**: Home · Sell · Website · Grow · Money · Operate · Settings. Seven top-level groups, no more.
2. **One home per job.** Every purpose has exactly one screen; duplicates become tabs of that screen (audit §3.4, D1–D12).
3. **One product store.** `VendorProduct` is the catalogue for every industry (its universal columns are already live); `CatalogItem` and `RetailProduct` screens are retired behind redirects once the cutover (V-010) lands.
4. **Plan and profile decide what is visible — not manual per-vendor toggles.** The billing term's `planKey` and the vendor's business-model profile (§2) compute the menu. Admin toggles remain only as exceptions.
5. **Locked ≠ hidden ≠ "coming soon".** A feature that exists but is not in the plan shows an **upgrade card**; a feature that is not built is **not rendered anywhere** (menu, pricing, bot, matrix). The words "coming soon" never appear.
6. **The first thing a vendor needs is on the first screen**: payment due, go-live checklist, low stock, new leads.
7. **Mobile first**: five bottom tabs — Home · Sell (or the profile's primary operation) · Website · Grow · More.

## 2. Business-model profiles (Task 5)

The 20 industries (`config/industries/*.ts`, `config/industry-experience.ts`, `data/listing-fields.ts`) collapse into five profiles. A vendor has exactly one *primary* profile (from `Vendor.industry`) and may switch on one *secondary* module (e.g. a clinic that also sells products).

| Profile | Industries | What the vendor needs | What exists today | What is missing |
|---|---|---|---|---|
| **A. Product commerce** | retail, restaurant, agriculture | Catalogue (price, photos, **stock, variants**), cart + online payment, orders with address and status, POS, inventory with low-stock alerts, refunds/cancel, customers, GST invoices | `VendorProduct` + public API; checkout (needs vendor keys); Website Orders list; Retail POS/Inventory on `RetailProduct`; restaurant tables/kitchen; produce orders/stock | Single store; stock on web sales; atomic stock; out-of-stock state; address; order workflow; refunds; low-stock alert; variants; payment onboarding |
| **B. Appointments & memberships** | clinic, salon, gym, diagnostics | Services with duration/price, staff or doctor calendar, bookable slots, reminders, patient/member records, recurring membership billing, deposits | appointment `Record`s, schedule views (salon, clinic), memberships/classes (gym), test orders; `engine` appointment action | Slot availability on the public site; reminders (no scheduler); recurring billing; gym attendance (stub) |
| **C. Packages & bookings** | travel, hotel, events, photography | Packages/rooms with dates, enquiry → quote → booking → token payment, itineraries/contracts, galleries | booking records, trip sheets, fleet/drivers/contracts (addon-gated), rooms/reservations, shoots + delivery, `engine` booking-token action | Availability calendar; quote builder for the vendor (the quote tool is admin-only); payments on the vendor's own keys |
| **D. Services, projects & enquiries** | professional, finance, coaching, education, construction, technology, logistics, automobile | Service pages, enquiry capture, quotes, cases/projects/batches, documents, invoices/fees, follow-ups, task board | engagement/case/project/batch views, documents, contacts, invoicing, parts inventory (automobile) | Vendor-side quote builder; client portal depth; recurring fees; **task board** (`VendorTask` model has no API/UI); e-sign |
| **E. Listings** | realestate | Rich listings, search/filter/map, enquiries → site visits → deals, documents | `ListingsView`, `DealsView`, `VisitsView`, listing fields | Public search/filter/map; documents tab is a stub |

Hybrids are expressed as modules, not new profiles: restaurant = A + tables/kitchen; automobile = D + parts stock; hotel = C + housekeeping; agriculture = A + enquiries.

## 3. Proposed navigation

```
Home            Overview · Reports · Notifications (bell)
Sell            Products & services · Stock* · Orders / Bookings / Enquiries† · POS* · Payments
Website         Website hub  (Content · Pages · Design · Domain · Search & AI visibility · Chat widget · Readiness)
Grow            Leads (Board · Call queue) · Customers · Campaigns & landing pages · Messages (+ WhatsApp bot) · AI Studio
Money           Plan & billing · Invoices (Your plan | Customer invoices) · Expenses & P&L · Wallet · Online payments
Operate         Industry workspace tabs · Team & roles · HR* · Tasks*
Settings        Business profile · Connections · Help & support
```
`*` appears only for profiles/plans that use it · `†` the label follows the profile's primary operation (Orders · Bookings · Appointments · Enquiries · Site visits).

### 3.1 Where the things KSM asked about live

| Question | Home |
|---|---|
| Website manager | **Website ▸ Website hub** — one screen with tabs (Content, Pages, Design, Domain, Search & AI visibility, Chat widget, Readiness). Replaces Website Manager, Website Engine, Embed/Widget and Domain. |
| Domain | Website hub ▸ **Domain** (search/register/connect, DNS status) |
| Website content | Website hub ▸ **Content** (text, logo, contact, hours, social) and **Pages** (add/arrange sections — new) |
| Products / services | **Sell ▸ Products & services** (the one catalogue; label follows the profile: Products / Menu / Services / Packages / Listings / Courses) |
| Stock | **Sell ▸ Stock** (adjust, history, low-stock list), shown for profile A and any vendor with stock-tracked items |
| SEO / GEO / AEO | Website hub ▸ **Search & AI visibility**: title/description/keywords per page, structured data preview (LocalBusiness, Product, FAQ), sitemap/robots/`llms.txt` status, Google Analytics ID, a plain-language checklist and score. This is where "see results" happens. |
| AI Studio | **Grow ▸ AI Studio** (Create · Templates · Library). Entry points inside Products ("describe with AI"), Website ▸ Content ("write with AI") and Campaigns. |
| Billing / "where do I pay?" | **Money ▸ Plan & billing** — also a banner on Home whenever a payment is due |

### 3.2 Visibility rules (generated from the registry)

| Item | Workspace | BOS | Profile filter |
|---|---|---|---|
| Home, Products, Orders/Bookings, Website hub, Leads, Customers, Campaigns, Messages, AI Studio, Plan & billing, Invoices, Expenses & P&L, Wallet, Online payments, Team, Business profile, Help | ✔ | ✔ | all (labels vary) |
| Stock, POS | upgrade card unless the vendor is profile A *and* BOS inventory is included — **decision for KSM**: today's public list makes Inventory BOS-only, but a Workspace shop cannot sell responsibly without stock | ✔ | A (and automobile/agriculture stock) |
| WhatsApp bot | upgrade card | ✔ | all |
| GST pack (GSTR tracking), Tasks, HR | upgrade card | ✔ **only once built** (HR/Tasks hidden everywhere until V-060/V-061) | all |
| Search & AI visibility (GEO/AEO parts) | — | — | **hidden until V-032**; title/description/keywords stay |
| Social publishing | — | — | **hidden until V-050**; "AI-written posts" remain under AI Studio |

An **upgrade card** shows the benefit in one sentence, what it unlocks, and a Contact/Upgrade button. It never says "coming soon" and is never a dead link.

## 4. Disposition of every existing screen

KEEP = stays (possibly moved) · MERGE INTO x = becomes a tab/section of x, old route redirects · HIDE = not in the menu (reachable only by the owner/admin when needed) · REMOVE = delete the route.

| Existing route / tab family | Action | Target / reason |
|---|---|---|
| `/dashboard` Overview | **KEEP** (rebuild) | Home: payment-due banner, go-live checklist, today's leads/orders, low stock, AI credit |
| `/dashboard/reports` Analytics Hub | **KEEP** | Home ▸ Reports |
| `/dashboard/notifications` | **KEEP — rewrite** | real notifications API; remove the hard-coded mrtravels items |
| `/dashboard/my-products` | **MERGE INTO** Sell ▸ Products & services | becomes the single catalogue editor (price, SKU, stock, status, variants, photos, category, listing fields) |
| Industry tabs `products`, `catalog`, `menu`, `services`, `packages`, `courses`, `tests`, `plans`, `properties`, `produce` (`CatalogItem` / `RetailProduct` views) | **REMOVE** after V-010 | redirect to Sell ▸ Products & services |
| Retail tabs `inventory`, `orders` (POS) | **MERGE INTO** Sell ▸ Stock / POS | read `VendorProduct` |
| `/dashboard/orders` Website Orders | **MERGE INTO** Sell ▸ Orders / Bookings / Enquiries | one orders list: web + POS, buyer + address + status |
| `/dashboard/payments` | **MERGE INTO** Money ▸ Online payments (and a setup card in Sell) | name collision with the wallet removed |
| `/dashboard/my-website` Website Manager | **MERGE INTO** Website hub (Content, Design, Search & AI visibility tabs) | |
| `/dashboard/website-engine` | **MERGE INTO** Website hub ▸ Readiness | keep the readiness checklist; move the raw "wired actions" list to admin |
| `/dashboard/embed` | **MERGE INTO** Website hub ▸ Chat widget | |
| `/dashboard/domain-management` Domain | **MERGE INTO** Website hub ▸ Domain | |
| `/dashboard/campaigns` Growth Hub + `/dashboard/landing-page` | **MERGE INTO** Grow ▸ Campaigns & landing pages | they call the same four endpoints |
| `/dashboard/telecrm` | **KEEP** | Grow ▸ Leads ▸ Call queue |
| `/dashboard/crm` (not in menu) | **MERGE INTO** Grow ▸ Leads ▸ Board | one leads screen, two views (same `CampaignLead` table) |
| `/dashboard/customer-hub` + industry `customers`/`clients`/`patients`/`buyers`/`members`/`students`/`guests` tabs | **MERGE INTO** Grow ▸ Customers | one `Contact` list; auto-create a customer from a captured lead (new) |
| `/dashboard/communication` + `/dashboard/whatsapp-bot` | **MERGE INTO** Grow ▸ Messages (bot as a tab) | |
| `/dashboard/ai-studio` | **KEEP** | Grow ▸ AI Studio; Library moves server-side (V-041) |
| `/dashboard/go-live` Subscription | **MERGE INTO** Money ▸ Plan & billing | purchase flow for demo vendors; Home CTA until bought |
| `/dashboard/billing` (not in menu) | **KEEP — promote** | Money ▸ Plan & billing is its front door |
| `/dashboard/my-services` (not in menu) | **MERGE INTO** Money ▸ Plan & billing ▸ Add-ons | DomainCampaign / managed services |
| `/dashboard/wallet` Wallet & Billing | **KEEP — rename** "Wallet" | Money ▸ Wallet (credits for AI/messaging) |
| `/dashboard/invoices` | **MERGE INTO** Money ▸ Invoices ▸ "Your plan" | |
| Industry `billing`/`invoicing`/`fees` tabs (`GenericInvoice`) | **MERGE INTO** Money ▸ Invoices ▸ "Customer invoices" | pay links on the vendor's keys (V-017) |
| `/dashboard/accounts` | **KEEP** | Money ▸ Expenses & P&L; the 20 per-industry summaries become Home widgets |
| `/dashboard/hrm` | **HIDE** (BOS upgrade card only once built) | placeholder removed from every surface |
| `/dashboard/stationery` | **HIDE** | rarely used physical-stationery tracker → Settings ▸ Extras |
| `/dashboard/team` | **KEEP** | Operate ▸ Team & roles |
| `/dashboard/settings` (+ the duplicate "Profile" entry) | **KEEP — rebuild** | Settings ▸ Business profile (real save: name, GSTIN, address, hours, logo); remove the second menu entry |
| `/dashboard/support` | **KEEP** | Settings ▸ Help & support |
| `/dashboard/domain-app` (old index) | **REMOVE** | orphan since 2026-07-18 |
| Industry operational tabs (bookings, fleet, drivers, rooms, housekeeping, trip sheets, visa, batches, cases, projects, shoots, shipments, kitchen, tables, jobs, test orders…) | **KEEP** under Operate ▸ \<industry workspace\> | profile-specific, unchanged |
| `ComingSoon` stub (gym ▸ attendance, realestate ▸ documents) | **REMOVE** | build or hide; no stub copy |

## 5. New screens needed

1. **Sell ▸ Stock** — per-product stock, adjust with reason, history, low-stock list.
2. **Order detail** — buyer, address, items, payment, status workflow (new → packed → shipped → delivered / cancelled), refund action.
3. **Website hub shell** with **Pages** (add/arrange sections) and **Search & AI visibility**.
4. **Plan & billing** front door + a payment-due banner component used on Home and in the header.
5. **Go-live / readiness checklist** on Home (payments connected? products added? domain? SEO basics? first lead test?) — computed from the registry per profile.
6. **Connections** (Settings): WhatsApp number, Google (Business/Analytics/Search Console), social accounts — each shows connected / not connected.
7. **Upgrade card** component and the `module → plan` mapping screen for admins (V-022).
8. **Customer from lead** — one click (or automatic) creation of a `Contact`.

## 6. Migration order (summary)

Small, reversible steps — each ships alone and keeps old URLs working (full plan in FEATURE_REGISTRY_DESIGN.md §7):

1. Register every existing route in the registry as-is (no UI change); add the CI guard in *report* mode.
2. Add Billing to the menu and the payment-due banner; replace fake Notifications/Settings. *(V-001, V-002)*
3. Generate the existing nav from the registry (identical output); delete the hand-written arrays.
4. Introduce the new groups behind a per-vendor flag `nav_v2`; ship to KSM's QA tenant (`ksm-webtech-services`), then stepnrock.
5. Move screens group by group (Money → Website → Grow → Sell → Operate/Settings) turning old routes into redirects.
6. Flip the flag for everyone; switch the guard to *fail* mode; delete dead routes.
