> **Evidence file — static audit, 2026-10-02.** Produced by read-only code inspection (no runtime, no DB writes, no provider calls). Every status is "static-verified only" unless stated. This is raw supporting evidence for [AUDIT_REPORT.md](../AUDIT_REPORT.md); where it disagrees with AUDIT_REPORT.md or STATUS.md on post-audit changes, those win.

# BOS CORE audit (V2 PRD 63H-63AF, 69-71, 77-86) - static, read-only

Scope: `backend-api/src` + `prisma/schema.prisma` + `get4domain_mvp/src`. Method: opened service/controller/page code; no runtime, no DB, no network. Every status below is **static-verified only** unless stated. PRD text used for reference: `GET4DOMAIN_V2_PRD_CLAUDE_CODE_PROMPT.md` (63J Business Setup L2572, 63K Roles/Tasks L2621, 63N Quote L2896, 63P Billing L2970, 63R GST L3077, 63S Inventory L3111, 63T Purchase L3139, 63U POS L3160, 63V HR L3185, 63AB Audit L3449).

Status vocabulary: WORKING, PARTIAL, UI-ONLY, BACKEND-ONLY, MOCKED, BROKEN, MISSING, BLOCKED-EXTERNAL, DEFERRED-APPROVED. (No item is DEFERRED-APPROVED: nothing in the repo records an approved deferral for these PRD areas.)

## 0. Headline answer

**No - the existing application is NOT 100% functional against the V2 PRD BOS sections.** What exists is a solid *record-keeping* layer: tenant-scoped CRUD for contacts, catalog, generic records, 22 per-industry operation modules, a TeleCRM, expenses/payments/GST-status trackers and simple GST invoices, all persisted in Postgres through Prisma with vendorId taken from the JWT. What does not exist: Business Master (GSTIN/PAN/branches/numbering/FY/bank/T&C/signature), granular roles, HR/payroll, task engine (model orphaned), purchase/supplier/PO/GRN, stock ledger/warehouses, vendor quotation engine, credit notes, CGST/SGST/IGST, GSTR reports, double-entry accounting, audit log, soft delete, CSV import/export beyond CRM leads, and any automated test. Four money paths are insecure (section 8).

Tests: **confirmed none.** `find` for `*.spec.ts`, `*.test.ts(x)`, `*.e2e-spec.ts`, jest/vitest/playwright configs returned nothing; neither `backend-api/package.json` nor `get4domain_mvp/package.json` defines a `test` script (only `lint`; backend lint is `eslint --fix`). The Tests column is therefore "none" for every row.

Cross-cutting facts that shape many rows:
* Auth: global `JwtAuthGuard` + `ModuleGuard` (`app.module.ts:158-170`). JWT strategy `auth/jwt.strategy.ts:27-77`; for a vendor team member `sub` = parent vendorId (`jwt.strategy.ts:50-55`), so every vendorId-scoped endpoint treats a team member as the owner unless explicitly guarded.
* Permission model is **8 coarse areas** (`team/team-access.ts:91-99`: telecrm, campaigns, communication, accounts, wallet, website, reports, ai_studio) enforced by `@RequireModule` on only 8 controllers: accounting, analytics, campaigns, cms, communication, crm, vendor-comms, wallet (+ growth-hub). Everything else (domainapp contacts/catalog/records/invoices/summary, retail, restaurant, all 20 industry modules, stationery, vendor-payments, customer invite, engine dispatch, finance) has **no team permission check** at all. The frontend hides nav (`app/dashboard/layout.tsx:170-178`) but its own comment says backend is "the real boundary".
* No entitlement check server-side for BOS/Workspace: `/domainapp/*` and industry endpoints do not check subscription status, plan tier, expiry or `VendorModule` flags (grep for `vendorModule` outside `addons/` = 0). Gating is client-only (`domain-app/[tab]/page.tsx:75-91`).
* Deletes are hard deletes everywhere (`prisma.*.delete`). `deletedAt` exists only on `VendorCommsSettings` (schema.prisma:1335) and is never used in `src`. No `AuditLog` model, no audit interceptor (grep `auditlog|audit_log|activityLog` in src = 0 relevant hits). This also violates the repo's own CLAUDE.md rule ("never hard delete").
* Only one `@Cron` in the whole backend: monthly contract billing (`travel/contracts.service.ts:137`). No overdue-invoice, reminder, follow-up or task automation.
* Money is stored as `Float` rupees in vendor tables (GenericInvoice, Expense, PosSale, PaymentRecord, RetailProduct) but `Int` paise in platform tables (Invoice, Subscription). `Math.round(x*100)/100` rounding; no Decimal.

---

## 1. Business Master (63J)

| Capability | Where | Status |
|---|---|---|
| Business name, address, phone, email, hours, social links, logo/banner | `VendorCMS` (schema.prisma:190-225), `Vendor.businessName/phone/email` (schema.prisma:11-30); edited via My Website / CMS controller `cms/cms.controller.ts:57-66` | PARTIAL (marketing profile, not a business master) |
| Legal name, business type, GSTIN, PAN, tax settings, currency, time zone | **No field on Vendor, VendorCMS or any settings table.** `grep -i gstin` in `get4domain_mvp/src/app/dashboard`, `domainapp`, `components`, `lib` = 0 hits. GSTIN/PAN exist only for the *platform company* (`platform-settings.constants.ts:20-25`, used in `invoices/templates/invoice.template.ts:39,125`) | MISSING |
| Invoice prefix, numbering, financial year | Hard-coded: vendor `INV-<first 6 chars of vendorId upper>-<count+1>` (`domainapp/invoices.service.ts:28-31`); platform `INV-<year>-<count+1>` (`invoices/invoices.service.ts:150-157`). No FY, no per-vendor config | MISSING |
| Bank/UPI details, T&C, signature, document footer | Not present. Only `VendorPaymentConfig` (Razorpay key id + encrypted secret, `vendor-payments.service.ts:31-43`) | MISSING |
| Branches (+ per-branch warehouse/POS/stock/invoice series/hours/manager) | No Branch model; no `branchId` on any model (schema grep `branch` = 0) | MISSING |
| Business Setup Wizard | No wizard. "Go-live" is a plan purchase flow (`dashboard/go-live/page.tsx`). | MISSING |
| Account Settings page (`/dashboard/settings`) | `get4domain_mvp/src/app/dashboard/settings/page.tsx:11-14` `handleSave` is a `setTimeout` that only flips a "Saved" flag; inputs have hard-coded `defaultValue` "Muthukumar R", "info@mrtravels.com", "MR Travels" (:30-:56); change-password fields are not wired to any API | MOCKED |
| Vendor payment keys (own Razorpay) | `PUT /vendor-payments` `vendor-payments.controller.ts:18-21` -> encrypted storage. **No permission guard**: any team member (even Support/CRM-only) can overwrite the vendor's Razorpay keys and redirect public-checkout money (no `@RequireModule`, no `VendorOwnerGuard`) | PARTIAL (works; authorization gap) |

## 2. Users / roles / permissions / HR (63K, 63V)

Evidence: `TeamMember` model (schema.prisma:459-476): `role String` (free text), `department String?` (label), `modules Json` (array of labels), `status`, `inviteToken`, `password`. `AdminTeamMember` + `AdminRole` enum SUPER_ADMIN/MARKETING/OPERATIONS (schema.prisma:762-786) are *platform staff*, not vendor staff. `Role` enum VENDOR/ADMIN/SUPER_ADMIN (schema.prisma:685-689).

| Capability | Evidence | Status |
|---|---|---|
| Invite / accept / login / remove vendor team member | `team/team.controller.ts:18-52`, `team.service.ts:20-77`, login `auth/auth.service.ts:148-190`; removal is a soft status flip (`team.service.ts:63-64`) and JWT re-checks status every request (`jwt.strategy.ts:41-45`) | WORKING (invite email/WhatsApp awaited with no try/catch at `team.service.ts:36-39`: a provider failure after the row is created returns 500 and invites duplicate on retry) |
| Module-level access (8 areas) | `team-access.ts:91-126`, `module.guard.ts:43-55`; enforced only on the 8 controllers listed in section 0 | PARTIAL |
| Configurable roles (Owner/Manager/Sales/Cashier/Accountant...) | `role` is an arbitrary string, no role table, nothing reads it for authorization | MISSING |
| Granular permissions (view/create/edit/delete/approve/export/print/assign/manage money/staff/settings) | None. No permission matrix anywhere | MISSING |
| Departments | 4 hard-coded presets in UI (`dashboard/team/page.tsx:21-26`: Sales, Support, Accounts, Marketing) mapping to module labels; `department` stored but `update` ignores it (`team.service.ts:55`) | PARTIAL |
| Team members visibility of secrets | `GET /team/members` (`team.controller.ts:25-29`, `team.service.ts:45-46`) returns full `TeamMember` rows **including `password` hash and `inviteToken`** to any vendor principal, including a restricted team member (no `VendorOwnerGuard` on the GET) | BROKEN (data exposure) |
| Platform staff roles (MARKETING/OPERATIONS) | `AdminGuard` accepts any role ADMIN/SUPER_ADMIN (`auth/guards/admin.guard.ts:9-12`); only `SuperAdminGuard` (admin-team, platform-settings) differentiates. MARKETING and OPERATIONS therefore have identical API power | PARTIAL |
| Employee master / HR | No Employee model | MISSING |
| Attendance | No model. Gym tab `attendance` resolves to `ComingSoon` stub (`tab-registry.ts:5-13`: `attendance` is in `TAB_ADDON_REQUIREMENT` -> `resolveView` returns 'addon') | UI-ONLY (stub) |
| Leave, payroll, payslip, shifts | None in schema or src | MISSING |

## 3. Leads / CRM / TeleCRM (63M)

Three lead stores - explained:
* `Lead` (`g4d_leads`, schema.prisma:287-319) = **platform-level** Get4Domain sales leads (Book-a-Demo, OTP demo gate, managed-services enquiries). Worked by admin staff in `admin-crm` (`admin-crm.service.ts`) and `leads`. Not vendor data.
* `CampaignLead` (`g4d_campaign_leads`, schema.prisma:398-422) + `CallLog` (:424-438) = **the vendor CRM / TeleCRM** (`crm/crm.service.ts`, `dashboard/crm`, `dashboard/telecrm`). Fed by campaign pages, manual add, CSV import, WhatsApp bot, public site enquiry (`engine.enquiry` -> `crm.createLead`, `action-registry.ts:55-71`) and web orders (`public-checkout.service.ts:109`).
* `Contact` (`g4d_contacts`, :528-552) = vendor **customer master** (DomainApp). `Record` (:597-617) = generic booking/order. `Deal` (:1547-1566) = real-estate pipeline only (has `value`, `stage`, `agent`).
* There is **no lead -> Contact conversion** anywhere (grep "convert" in crm, domainapp, telecrm = 0).

| Capability | Evidence | Status |
|---|---|---|
| Vendor lead list, filter by status/source/date, add, update status/notes/follow-up | `crm.controller.ts:17-63`, `crm.service.ts:23-110`; UI `dashboard/crm/page.tsx:70,91,105,114` | WORKING |
| Notes / activity timeline | `UpdateCrmLeadDto.notes` **overwrites** a single string (`crm.service.ts:92`, UI `crm/page.tsx:114`); only call logs form a history (`CallLog` rows) | PARTIAL |
| Call log, duration, outcome, follow-up, today's tasks/queue, recent calls, win-rate | `crm.service.ts:64-150`, `components/telecrm/TeleCrmBoard.tsx:195,246,273-275` (duration measured by browser timer) | WORKING |
| Click-to-call | `window.open('tel:...')` (`TeleCrmBoard.tsx:246`) - native dialer only, no telephony/recording integration | PARTIAL |
| Owner / assignee | `assignedTo` exists on model and `PUT /crm/leads/:id` accepts it (`crm.service.ts:93`), but **no UI sets or shows it** (no `assign` token in `TeleCrmBoard.tsx`/`crm/page.tsx`) | BACKEND-ONLY |
| Assignment rules / round-robin | None | MISSING |
| Lead score, tags, deal value on CampaignLead | None (only `Deal.value` for real estate; `Contact.tags` JSON on customers) | MISSING |
| Pipeline stages per industry | Static registry `config/industry-experience.ts` (mirrored to `g4d_industry_experiences` table, schema.prisma:2296-2314) -> `crm/page.tsx:45-49`; stage is stored as free-text `status` with no server validation (`UpdateCrmLeadDto.status` is any string); `logCall` hard-maps outcome to won/lost/contacted (`crm.service.ts:195`). Not editable per business | PARTIAL |
| CSV import | `POST /crm/leads/import` max 5000 rows, `createMany`, no dedupe/phone validation (`crm.service.ts:51-61`) | PARTIAL |
| CSV export | Client-side Blob of the *filtered in-memory list* (`crm/page.tsx:122-133`) | PARTIAL |
| CRM reports | Funnel by status + conversion% in Analytics Hub (`dashboard/reports/page.tsx:85-101`); win rate in TeleCRM | PARTIAL |
| Platform admin TeleCRM over `g4d_leads` | `admin-crm.service.ts` (call logs, status, follow-up, assignedTo) | WORKING (platform scope) |
| Public enquiry -> CRM | `engine.enquiry` public action; no rate limit/throttle anywhere (`@nestjs/throttler` not present), no dedupe | PARTIAL |

## 4. Task engine (63K)

* `VendorTask` model (schema.prisma:1040-1058: stage new|assigned|in-progress|review|completed, priority, assignee string, subtasks JSON, dueDate) is **orphaned**: zero references in `backend-api/src`, no controller/service/DTO, no frontend page (grep `vendorTask|VendorTask|kanban` in `src` = no consumer). Its own comment ("the reference's drag-drop is non-functional; here stage is real") describes a feature that has no code path.
* States are 5, not the PRD's 8 (Accepted, Waiting, Verified, Closed absent). No linkage fields to lead/customer/order/invoice, no comments, no checklist beyond JSON, no recurrence/escalation/reminders/dependencies.
* Only working task board: Technology industry `ProjectTask` (`technology/*`, UI `domainapp/technology/TasksView.tsx`, 3 states todo/in_progress/done, `assignee` free text).
* Automation (new lead -> sales task, quote sent -> follow-up task, invoice overdue -> collection task, etc.): none. Only cron is contract billing.

Status: VendorTask engine = MISSING (schema orphan); Technology task board = PARTIAL; task automation = MISSING.

## 5. Product / service master (63L)

Three disconnected product stores:
1. `VendorProduct` (+ `Category`) - website listing: `price String?`, `image`, `customFields`, `active` (schema.prisma:227-278). CRUD in `cms/cms.service.ts:184-263`, UI `dashboard/my-products/page.tsx:111-204`. Ownership checked in the controller via `getProductOwner` + `assertOwnerOrAdmin` (`cms.controller.ts:94-113`) - correct.
2. `CatalogItem` - DomainApp catalogue: `price Float`, `unit`, `stock Int?`, `customFields` (schema.prisma:575-595). CRUD `domainapp/catalog.service.ts`. **`stock` can never be set through any API**: `CreateCatalogItemDto`/`catalog.service.ts:30-37,54-62` omit it, and no other writer exists; the only writer is the public-checkout *decrement* (`public-checkout.service.ts:96-99`, guarded by `stock: { not: null }`) - so web-order stock decrement is effectively dead. Also the public cart sends `VendorProduct` ids, not `CatalogItem` ids.
3. `RetailProduct` - retail only: `sku`, `price`, `stockQty`, `reorderLevel`, `active` (schema.prisma:2253-2269). CRUD + restock in `retail/retail.service.ts`.

| Capability | Status |
|---|---|
| Product/service CRUD (website listing, catalogue, retail) | WORKING (as separate stores; hard delete; no UI delete for CatalogItem - `daDeleteCatalogItem` defined in `lib/api.ts:757` but referenced by no component) |
| Variants / options | MISSING |
| SKU / barcode | PARTIAL (`sku` free text on RetailProduct only; no barcode, no uniqueness) |
| HSN/SAC, GST rate per item, MRP / cost / sale price tiers, supplier | MISSING |
| Archive / active flag | PARTIAL (`active` on all three; delete is hard) |
| CSV import/export of products, bulk edit | MISSING |
| Category taxonomy | PARTIAL (`Category` per vendor, case-insensitive unique, only for VendorProduct) |

## 6. Inventory, purchase, supplier (63S, 63T)

| Capability | Evidence | Status |
|---|---|---|
| Retail stock decrement on POS sale | `retail.service.ts:49-80`: stock checked at :59 from a prior read, then unconditional `decrement` inside `$transaction([...])` (:68-79) - **not concurrency-safe**: two simultaneous sales can drive `stockQty` negative; the same `productId` repeated across cart lines is checked per line, not summed | PARTIAL |
| Stock adjust / restock | `restock` increments by any integer incl. negative (`retail.service.ts:37-40`, `RestockDto.delta @IsInt` no sign/reason); no ledger row | PARTIAL |
| Stock ledger / movements (purchase, sale, transfer, adjust) | No StockMovement model | MISSING |
| Warehouses / locations / transfers | None | MISSING |
| Reorder alerts | Count-only: `lowStockProducts` in `retail.service.ts:93-102`; no notification/PO suggestion | PARTIAL |
| Per-industry stock (PartStock automobile, ProduceStock agriculture, ProjectMaterial construction) | Quantity tables with CRUD; not linked to sales/POs | PARTIAL |
| Stationery tracker | `stationery/*` simple vendor-scoped list with threshold (schema.prisma:967-980) | WORKING (office list, not procurement) |
| Supplier master, purchase order, GRN, purchase invoice, purchase returns, supplier payments | None. `ProjectMaterial.supplier String?` (schema.prisma:1735) and outward `PaymentRecord` are the only traces | MISSING |

## 7. POS (63U)

| Capability | Evidence | Status |
|---|---|---|
| Retail POS sale | UI `domainapp/retail/PosView.tsx:57` -> `POST /retail/sales` (`retail.service.ts:49-80`). Prices read server-side from DB (:59-62 good). `taxAmount` is whatever the client sends (`CreateSaleDto.taxAmount`, `retail.dto.ts:181`; UI sends none -> 0) so tax is not computed server-side. Persists `PosSale` (items JSON, subtotal, taxAmount, total, paymentMethod) | PARTIAL |
| Barcode scan | None (search box only: `PosView.tsx:74`) | MISSING |
| Hold / resume cart, discounts, split / partial payment, customer link, shift/cash drawer | None; `paymentMethod` is a single enum | MISSING |
| Returns | Whole-sale refund only (`retail.service.ts:84-96`): restores stock and flips status; check-then-flag is not atomic (double click can double-restore); no partial return, no credit note, no payment reversal | PARTIAL |
| Thermal / receipt print | None | MISSING |
| Stock deduction | see section 6 | PARTIAL |
| POS revenue in Accounts | `accounting.summary` reads only `GenericInvoice` paid rows (`accounting.service.ts:106-111`); `PosSale`/`RestaurantOrder`/web orders never feed P&L/GST | BROKEN (accounting blind to POS) |
| Restaurant tables / orders / kitchen display | `restaurant/*`: tables (PosTable), orders + items, kitchen list, bill (UI `domainapp/restaurant/*`). Item `price` is client-supplied (`restaurant.dto.ts:26`, used at `restaurant.service.ts:59-60`, never reconciled with menu); `billOrder` has no status guard (can bill cancelled/already-billed orders, `restaurant.service.ts:85-90`) and creates no sale/invoice/payment record; table state side-effects are best-effort | PARTIAL |
| `KitchenTicket`, generic `Appointment` models | Orphans: no code references (`grep -i kitchenTicket|prisma.appointment` = none) | MISSING |

## 8. Quotation / Estimate engine (63N)

* Vendor-side quotation engine: **MISSING** (no vendor quote model/route/UI).
* `Quote` model + `quotes/*` is **platform-admin only** (`quotes.controller.ts:13-17` `@UseGuards(AdminGuard)`): Get4Domain quoting prospects/vendors (single-item "send quote" and multi-line Managed-Services proposal with shareable public token). Statuses draft/sent/viewed/accepted/declined are a free string (`UpdateQuoteStatusDto`). Public `PUT /quotes/public/:token/respond` has no state guard (accepted<->declined can be flipped repeatedly; `quotes.service.ts:125-128`). `create()` persists status 'sent' before delivery succeeds (`quotes.service.ts:47`). No versioning, no expiry, no quote->invoice/order conversion, no line-item carry-over.
Status: Admin proposal tool = PARTIAL (platform sales tool, not the PRD capability); vendor quotation engine = MISSING; versioning = MISSING; quote->invoice conversion = MISSING.

## 9. Billing / invoice engine (63P)

Two distinct invoice systems:
* `Invoice` (schema.prisma:156-175, `invoices/*`, `payments/*`) = **Get4Domain -> vendor** subscription/top-up invoices, paise integers, 18% constant `GST_RATE = 0.18` (`invoices.service.ts:99`), admin-created (`POST /invoices` AdminGuard) or auto-created on payment. Numbering `INV-<year>-<count+1>` (:150-157) races under concurrency (unique violation -> 500 / lost invoice; `createPaidInvoice` swallows all errors, :258-260).
* `GenericInvoice` (schema.prisma:620-644, `domainapp/invoices.*`) = **vendor -> their customer** invoices.

GenericInvoice engine facts (`domainapp/invoices.service.ts`):
* Totals are computed server-side from line items: `subtotal = sum(qty*rate)`, single `gstRate` (client-chosen), `round2` (:21-26, :47). Deterministic and not overwritable: **no update endpoint exists** (only create/get/pdf/send-link/mark-paid, `invoices.controller.ts`). Good.
* Numbering `INV-<vendorId[0..6]>-<count+1>` (:28-31) but `invoiceNumber` is **globally** `@unique` (schema.prisma:628). Prefix = first 6 chars of a cuid, which is `c` + the high timestamp chars, identical for vendors created within the same ~47-second window; count+1 is not transactional. Collisions across vendors/concurrent creates -> unique violation 500. Not configurable, no FY, no per-branch series.
* No CGST/SGST/IGST split, no place of supply, no HSN/SAC, no per-line GST, no discount, no vendor GSTIN/PAN on the document (`generic-invoice.template.ts:66-72` prints vendor name/email/phone only), no bank/UPI/T&C/signature.
* PDF: HTML for browser print (`GET /domainapp/invoices/:id/pdf`). **Template does not HTML-escape** `item.description`, `contact.name`, `vendor.businessName` (`generic-invoice.template.ts:32,68,80`); the UI renders it as a same-origin Blob (`InvoicingView.tsx:82-87`) -> stored XSS reachable by any user who can create a contact/invoice (see no team permission check) and executing in the owner's browser (token in `localStorage`, `lib/api.ts:8`).
* Payment link: `sendLink` creates a Razorpay payment link using the **platform's** `RAZORPAY_KEY_ID/SECRET` (`invoices.service.ts:16-18,122`), not the vendor's keys (contradicts the vendor-direct model of `VendorPaymentConfig`); stores `razorpayLinkId`, but **no webhook ever matches it**: `payments.service.ts:184-199` looks up only `prisma.invoice` by `razorpayOrderId`; `grep razorpayLinkId` shows no reader. A paid vendor-invoice link never flips the GenericInvoice to PAID and the money lands in Get4Domain's account. -> BROKEN.
* Mark paid: `PUT /domainapp/invoices/:id/mark-paid` (`invoices.service.ts:144-150`) sets status PAID/`paidAt=now` unconditionally, callable repeatedly (overwrites `paidAt`), no amount/mode/reference, no `PaymentRecord`, no partial payment, no overdue state (`OVERDUE` is never set; no cron).
* Credit/debit notes, cancel/void, invoice edit with revision: MISSING.
* Recurring: only travel Contracts (`travel/contracts.service.ts:137-190`): daily cron + manual "generate this month", idempotent per `lastBilledPeriod` claim. WORKING for that one feature.
* Delivery: platform invoices email (Resend) via `InvoicesController.email`; vendor invoices have no email/WhatsApp send; WhatsApp/SMS providers are mock-first (`whatsapp.service.ts:44-50`, `sms.service.ts:40-43`) -> BLOCKED-EXTERNAL until Fast2SMS configured.
* Contact/Record deletion with existing invoices: FK has no `onDelete` -> Prisma error 500 (no friendly handling); `recordId` is `@unique`, so a second invoice for the same record fails with 500.

## 10. GST engine (63R)

* `GstFiling` (schema.prisma:1157-1172): per vendor/period/form (GSTR-1, GSTR-3B, GSTR-2B, Annual) **status dropdown only** (pending/in_progress/filed/not_due); `upsert` (`accounting.service.ts:~230-250`). A manual tracker; nothing computed or exported. UI `dashboard/accounts/page.tsx:808-830`.
* Output vs input GST summary: `accounting.summary` (`accounting.service.ts:106-130`): output GST = sum of `gstAmount` of PAID `GenericInvoice`s in period (cash basis by `paidAt`); input GST = sum of `Expense.gstAmount` regardless of whether the vendor is GST-registered or ITC-eligible (no GSTIN on vendor to decide). Excludes POS, restaurant, web orders, platform invoices, purchases.
* Missing: HSN summary, CGST/SGST/IGST, place of supply, reverse charge, ITC reconciliation (GSTR-2B), GSTR-1/3B JSON/CSV, e-invoice/e-way bill, TDS/TCS.
Status: filing-status tracker WORKING; GST summary PARTIAL; GST engine MISSING.

## 11. Accounting / finance (63Q)

| Capability | Evidence | Status |
|---|---|---|
| Vendor expense entry | `Expense` (schema.prisma:946-964), GST-exclusive math server-side (`accounting.service.ts:37-52`), vendorId from JWT, attachment URL, voucher HTML. No edit endpoint; **hard delete** (`:99-101`); no category master | PARTIAL |
| Payment ledger (inward/outward) | `PaymentRecord`; manual entry, not linked to invoices/expenses/orders; hard delete (`accounting.service.ts:189`) | PARTIAL |
| P&L | `summary()` = revenueNet (paid GenericInvoice subtotals) - expensesNet; cash-basis; no COGS/purchases/stock valuation/POS/web revenue | PARTIAL |
| Receivables | `revenue.pending` sum only (`domainapp/summary.service.ts:38-41`); no aging, no customer statements, no reminders | PARTIAL |
| Payables / vendor bills | None | MISSING |
| Ledgers / chart of accounts / double-entry / journals / trial balance / balance sheet / cash-flow / bank reconciliation | None | MISSING |
| Immutable history / audit | None; records are hard-deletable | MISSING |
| Travel accounts depth | `travelSummary` (package cost vs sell, supplier outward payments) `accounting.service.ts:~60-88` | WORKING |
| **Admin accounting page** (`app/admin/accounting/page.tsx`) | **Expenses live in browser `localStorage`** key `g4d_expenses` (:29,36,55,70) - add/delete never call an API (`addExpense` :58-72, `removeExpense` :74-76); revenue comes from `api.getInvoices()` (real DB, platform invoices). 18% ITC hard-coded (:102); "Total income" uses GST-inclusive `totalAmount` while expenses are net -> profit mixes bases (:84,106-107); month filter is client-side; expenses are per-browser and vanish on another device or cache clear | MOCKED (expenses) / PARTIAL (revenue) |
| Vendor Accounts page (`dashboard/accounts`) | Fully API-backed: `api.accountingSummary/getExpenses/getPaymentRecords/getGstFilings` (:129-132), create/delete expense and payment (:258-296); delete errors swallowed `.catch(() => {})` (:269,296). 20 per-industry overview cards call per-industry `*/summary` endpoints (:146-245) | WORKING (as a bookkeeping view) |

## 12. Orders / bookings / cases (63O, 63X)

Each industry has a dedicated Prisma model set + NestJS module with `vendorId` from JWT and an `own*()` ownership helper (sampled: agriculture, automobile, clinic, coaching, construction, diagnostics, education, events, gym, hotel, logistics, photography, professional, realestate, salon, technology, travel; counts of ownership checks vs mutations in a scripted scan all >= mutations except realestate/salon/logistics which use a generic `own(model, ...)` helper - lines `realestate.service.ts:94`, `salon.service.ts:106`, `logistics.service.ts:72` - read and OK).

| Industry | Models | Frontend view (dispatch in `domain-app/[tab]/page.tsx`) |
|---|---|---|
| travel | Trip, Vehicle, Driver, VisaApplication, Contract(+Assignment) | Trips/Fleet/Drivers/Visa/Contracts (:121-127); bookings & invoicing generic |
| salon | Stylist, SalonChair, SalonAppointment | :130-133 |
| gym | GymClass, Membership | :136-139 (attendance tab = stub) |
| hotel | Room, RoomBooking | :142-146 |
| realestate | Listing, Deal, PropertyVisit | :149-153 (documents tab = stub) |
| education / coaching | Batch, StudentEnrollment / CoachingBatch, CoachingEnrollment, CoachingSession | :156-159, :217-220 |
| professional | Engagement, EngagementDocument | :162-165 |
| construction | ConstructionProject, ProjectMilestone, ProjectMaterial | :168-171 |
| events | EventBooking, EventVendorAssignment | :174-177 |
| finance (CA) | FinanceCase, FinanceCaseDocument | :180-183 |
| automobile | ServiceJob, JobLine, PartStock | :186-189 |
| logistics | Shipment (+ fleet/drivers reuse) | :192-196 |
| diagnostics | TestOrder, TestOrderItem | :199-202 |
| photography | PhotoShoot, ShootDeliverable | :205-208 |
| agriculture | ProduceOrder, ProduceStock | :211-214 |
| technology | TechProject, ProjectTask | :223-226 |
| clinic | Doctor, ClinicAppointment (Prescriptions view is a real read-only view over appointments, `PrescriptionsView.tsx:27-31`) | :229-233 |
| restaurant | RestaurantOrder(+Items), PosTable | :236-240 |
| retail | RetailProduct, PosSale | :243-247 |
| all other / generic | `Record` + `Contact` + `CatalogItem` (RecordsView/ContactsView/CatalogView) | `resolveView` `tab-registry.ts:23-35` |

Caveats applying to all of them: status columns are free strings or DTO `@IsIn` lists with **no transition rules** (e.g. generic `Record.status` accepts any string, `record.dto.ts` / `records.service.ts:42-50`); **no double-booking / slot-conflict detection** (grep overlap/conflict/clash in clinic, salon, hotel, gym, travel, events, photography = 0); no link from a booking to an invoice/payment except the manual "Generate Invoice" on generic Records (`RecordsView.tsx:149-165`); no unified Case/Job engine (FinanceCase, ServiceJob, Engagement, TestOrder are separate per-industry).
Status: per-industry record-keeping CRUD = PARTIAL (persisted, tenant-scoped, no state machine/conflicts/billing link); generic Case/Job engine = MISSING; website (web) orders = PARTIAL (read-only list `dashboard/orders/page.tsx`, no fulfilment status, see section 8 integrity issues).

## 13. Audit log, soft delete, reports/BI, documents, import/export

* Audit log (who/what/old/new): **MISSING**. Closest: `TeamMember.lastLogin`, `Message` history, `WalletTransaction`. No interceptor, no model.
* Soft delete / record locking / approval flows (63AB): MISSING.
* Reports/BI: vendor "Analytics Hub" (`dashboard/reports/page.tsx`) = real data but approximate: invoices fetched with `?limit=100` (:35) so revenue-by-month silently truncates; monthly series grouped by `createdAt` not `paidAt` (:~95); funnel from CRM statuses; wallet usage. Per-role dashboards (owner/sales/ops/finance/HR/inventory/marketing) MISSING. Per-industry summaries on Accounts overview = WORKING. Admin utilization/analytics (`analytics.service.ts`) = real counts.
* Documents: letterhead / visiting card / ID card stateless renderers (`business-documents/*`, escapes values via `esc`, `business-document.template.ts:34`) WORKING; invoice HTML (unescaped, see section 9), expense voucher HTML (unescaped `e.description`, `accounting.service.ts:~124`), proposal HTML. Quotation, receipt, PO, delivery note, payslip, certificates: MISSING.
* CSV/Excel import/export: only CRM lead import and CRM export (section 3). Customers, products, invoices, expenses, stock: MISSING.

## 14. Tenancy / IDOR review (item 16)

Pattern is good in most vendor controllers: `@CurrentUser() user` -> `user.sub` -> service filters `{ id, vendorId }` (domainapp contacts/catalog/records/invoices/summary, accounting, stationery, retail, restaurant, finance, crm `findOne` ownership check at `crm.service.ts:80-83`, team `findOne` `team.service.ts:50-52`, campaigns, campaign-pages, cms products via controller owner check). vendorId is never read from body/query for vendor-facing BOS controllers. Exceptions and defects:

| # | Endpoint | file:line | Problem | Severity |
|---|---|---|---|---|
| 1 | `POST /payments/verify` | `payments.controller.ts:22-26`, `payments.service.ts:79-98` | `invoiceId` from body; **no ownership check, no amount/order binding**: verifies only HMAC(order_id|payment_id), then `prisma.invoice.update({where:{id: dto.invoiceId}})` -> marks ANY vendor's platform invoice PAID, activates its subscription (`finalizePayment`) and grants wallet bonuses. Combined with #2 an attacker pays INR 1 and settles any invoice | Critical |
| 2 | `POST /payments/create-order` | `payments.controller.ts:15-19`, `payments.service.ts:61-67` | Any authenticated principal (vendor, team member, sandbox) can create a Razorpay order for any amount/receipt | High |
| 3 | `POST /demo/buy/confirm` (go-live) | `demo.service.ts:80-103` | Verifies only the signature (:84); never compares the paid order amount to the chosen plan price; with #2 a sandbox converts to a live BOS/Workspace vendor + subscription + AI credit for INR 1 | Critical |
| 4 | `engine.checkout.order/confirm` (public) | `public-checkout.service.ts:47-48,55,77,81-103` | Cart `price` is **client-supplied** (`CheckoutLine.price`, `engine.dto.ts:65`); order total and recorded sale both derive from it, so a buyer can set price 1. `confirm` recomputes `rupees` from the posted cart and never fetches/compares the Razorpay order amount, and has no idempotency (same `razorpay_payment_id` can be replayed -> unlimited `PosSale` 'completed' rows + CRM leads). Stock decrement is dead (section 5). Comment at :22 ("recomputed server-side ... never trusted") is not true for price | Critical |
| 5 | `GET /team/members` | `team.service.ts:45-46` | Returns `password` (bcrypt) and `inviteToken` of every member to any vendor-side principal incl. restricted team members -> a member can take over pending invitations | High |
| 6 | `PUT /vendor-payments` | `vendor-payments.controller.ts:18-21` | No owner/module guard: a team member can replace the vendor's Razorpay keys (redirects public-checkout funds) | High |
| 7 | `/domainapp/*`, `/retail/*`, `/restaurant/*`, all industry controllers, `/stationery`, `/finance`, `POST /customer/invite`, `POST /engine/actions/:intent` | (no `@RequireModule`) | Any team member (even with zero modules) has full read/write on customers, invoices, POS, stock via direct API despite hidden nav | High |
| 8 | Customer portal OTP | `customer.service.ts:49-66,24` | `contact.findFirst({where:{phone}})` is **not vendor-scoped** - if the same phone is a contact of 2 vendors the session binds to an arbitrary vendor; `devOtp` is returned in the API response whenever `NODE_ENV !== 'production'` (:62-63); OTP via `Math.random`; in-memory `Map` (lost on restart / not multi-instance); no attempt limit or throttling anywhere in the app (6-digit OTP, 5-min TTL); `Contact.portalAccess` flag is never checked at login | High |
| 9 | `PUT /notifications/:id/read` | `notifications.controller.ts:22-25`, `notifications.service.ts:74-76` | No recipient check - any user can mark any notification read | Low |
| 10 | `GET /vendors`, `GET /vendors/:id` (admin) | `vendors.service.ts:~14,28` | Returns full `Vendor` incl. `password` hash to every platform staff role | Low |
| 11 | CRM/Team/Campaign findOne | `crm.service.ts:82`, `team.service.ts:52` | 403 vs 404 reveals id existence across tenants | Info |
| 12 | Team login email not unique across vendors | `auth.service.ts:~150` `findFirst({email})` | Same email on two vendors' teams logs into whichever is found first | Low |
| 13 | Stored XSS in print views | `generic-invoice.template.ts:32,68,80`; `accounting.service.ts` voucher | see section 9; combined with #7 a low-privilege member can attack the owner | Medium |

Verified OK (sampled): CMS `PUT vendor/:vendorId` & product update/delete (owner/admin check), `/invoices/vendor/:vendorId` and `/subscriptions/vendor/:vendorId` (`assertOwnerOrAdmin`/inline check), CRM/campaign pages, `engine.dispatchPublic` (vendor from subdomain), domainapp `create` verifying `contactId`/`recordId`/`catalogItemId` belong to the vendor (`invoices.service.ts:36-44`, `records.service.ts:12-26`). Not exhaustively verified: the remaining ~15 industry services beyond the sampled ones.

## 15. Frontend structure of the generic Domain App

`app/dashboard/domain-app/[tab]/page.tsx` (263 lines): loads industry config, guards `cfg.modules.domainapp` (:75) and addon (:103-116) client-side only, dispatches per-industry dedicated views by `cfg.industry.key` + `tabKey` (:121-247), else `resolveView(tabKey)` (`tab-registry.ts`): billing/invoicing/fees -> `InvoicingView`; products/menu/services/plans/etc. -> `CatalogView`; customers/clients/patients/... -> `ContactsView`; addon-requirement keys or `doctors/stylists/kitchen/prescriptions/reports` -> `ComingSoon`; everything else -> `RecordsView`.
Tabs per industry (from `backend-api/src/config/industries/*.ts` `dashboardTabs`) and their resolution:
* agriculture: orders(dedicated) produce(Catalog) buyers(Contacts) inventory(dedicated)
* automobile: jobs customers inventory billing | clinic: appointments patients doctors prescriptions billing | coaching: students courses batches fees | construction: projects clients materials billing | diagnostics: bookings tests patients reports | education: students courses batches fees | events: bookings packages vendors billing | finance: cases clients documents billing | general: transactions customers catalog billing | gym: members classes plans **attendance(ComingSoon)** billing | hotel: reservations rooms housekeeping billing | logistics: shipments fleet drivers billing | photography: bookings packages gallery billing | professional: engagements clients documents billing | realestate: enquiries properties visits clients **documents(ComingSoon - no realestate branch)** | restaurant: orders tables menu(Catalog) kitchen billing | retail: orders(POS) products customers inventory | salon: appointments services stylists billing | technology: projects clients tasks billing | travel: bookings trip-sheets visa fleet drivers contracts invoicing.
* Stub label text in `ComingSoon.tsx` claims "enabled on your plan but the workspace is being finished". `STUB_TABS` (`tab-registry.ts:20`) contains `doctors/stylists/kitchen/prescriptions/reports` - stale (those are built for their industries via earlier branches).
Count: 2 reachable ComingSoon tabs (gym attendance, realestate documents).

---

## 16. MASTER FEATURE MATRIX

Columns: Area | Feature | Existing Route/Code | Status | Backend | DB | Permission | Tests | Notes. Tests = "none" for all rows (no test files exist).

| Area | Feature | Existing Route/Code | Status | Backend | DB | Permission | Tests | Notes |
|---|---|---|---|---|---|---|---|---|
| Business Setup | Business profile (name/contact/hours/social) | `cms/cms.controller.ts:57-66`; VendorCMS | PARTIAL | Yes | VendorCMS | owner/admin (+team 'website') | none | Marketing profile only |
| Business Setup | Legal name / GSTIN / PAN / tax / currency / TZ | - | MISSING | No | No | - | none | Only platform-company GSTIN in settings |
| Business Setup | Invoice prefix / numbering / FY | `domainapp/invoices.service.ts:28-31` | MISSING | hard-coded | - | - | none | Not configurable |
| Business Setup | Bank/UPI, T&C, signature, footer | - | MISSING | No | No | - | none | |
| Business Setup | Branches (+warehouse/POS/series) | - | MISSING | No | No | - | none | |
| Business Setup | Business Setup Wizard | - | MISSING | No | No | - | none | go-live is plan purchase |
| Business Setup | Account Settings page | `dashboard/settings/page.tsx:11-14` | MOCKED | No | No | - | none | setTimeout fake save, hard-coded "Muthukumar R" |
| Business Setup | Vendor Razorpay key config | `vendor-payments.controller.ts:18` | PARTIAL | Yes | VendorPaymentConfig (encrypted) | none (any member) | none | Team member can swap payout keys |
| Roles | Team invite/accept/login/remove | `team/*`, `auth.service.ts:148-190` | WORKING | Yes | TeamMember | owner-only on mutate | none | Invite send not try/caught |
| Roles | Module-level permission enforcement | `module.guard.ts`, `team-access.ts` | PARTIAL | 8 controllers only | TeamMember.modules | partial | none | Section 0/14 #7 |
| Roles | Configurable roles | `TeamMember.role` string | MISSING | No | free text | - | none | |
| Roles | Granular permissions (CRUD/approve/export...) | - | MISSING | No | No | - | none | |
| Roles | Departments | `dashboard/team/page.tsx:21-26` | PARTIAL | label only | TeamMember.department | - | none | 4 presets |
| Roles | Team list exposes hash/invite token | `team.service.ts:45` | BROKEN | Yes | TeamMember | any member | none | Data exposure |
| Roles | Platform staff roles | `admin.guard.ts` | PARTIAL | Yes | AdminTeamMember | SuperAdmin vs all-admin | none | MARKETING==OPERATIONS in API |
| HR | Employee master | - | MISSING | No | No | - | none | |
| HR | Attendance | gym `attendance` tab | UI-ONLY | No | No | - | none | ComingSoon stub |
| HR | Leave / payroll / payslip / shifts | - | MISSING | No | No | - | none | |
| CRM | Vendor lead CRUD + status + follow-up | `crm.controller.ts:17-63` | WORKING | Yes | CampaignLead | RequireModule telecrm | none | |
| CRM | Notes / activity timeline | `crm.service.ts:92` | PARTIAL | overwrite | CampaignLead.notes | telecrm | none | Only call logs retained |
| CRM | Call log + queue + follow-ups | `crm.service.ts:64-150`, TeleCrmBoard | WORKING | Yes | CallLog | telecrm | none | Browser timer duration |
| CRM | Click-to-call | `TeleCrmBoard.tsx:246` | PARTIAL | tel: link | - | - | none | No telephony |
| CRM | Lead assignment (field) | `crm.service.ts:93` | BACKEND-ONLY | Yes | assignedTo | telecrm | none | No UI |
| CRM | Round-robin / assignment rules | - | MISSING | No | No | - | none | |
| CRM | Score / tags / deal value | - | MISSING | No | No | - | none | |
| CRM | Pipeline per industry | `industry-experience.ts`, `crm/page.tsx:45` | PARTIAL | config static | free-text status | telecrm | none | Not editable; no validation |
| CRM | Lead -> customer conversion | - | MISSING | No | No | - | none | |
| CRM | CSV import / export | `crm.service.ts:51`, `crm/page.tsx:122` | PARTIAL | import yes / export client | CampaignLead | telecrm | none | No dedupe |
| CRM | CRM reporting | `reports/page.tsx`, TeleCRM | PARTIAL | Yes | derived | reports | none | |
| CRM | Platform lead TeleCRM (g4d_leads) | `admin-crm/*` | WORKING | Yes | Lead, LeadCallLog | AdminGuard | none | Platform scope |
| CRM | Public enquiry -> lead | `action-registry.ts:55-71` | PARTIAL | Yes | CampaignLead | public | none | No throttle/dedupe |
| Tasks | VendorTask engine | schema.prisma:1040 | MISSING | No code | model only | - | none | Orphan model |
| Tasks | Technology task board | `technology/*`, TasksView | PARTIAL | Yes | ProjectTask | none | none | 3 states, tech only |
| Tasks | Task automation (lead/quote/invoice triggers) | - | MISSING | No | No | - | none | |
| Product | Website products/services CRUD | `cms.service.ts:184-263` | WORKING | Yes | VendorProduct, Category | owner/admin | none | price is String |
| Product | DomainApp catalogue CRUD | `domainapp/catalog.*` | PARTIAL | Yes | CatalogItem | none | none | stock unsettable; no delete UI |
| Product | Retail products (SKU/price/stock) | `retail.service.ts:15-40` | PARTIAL | Yes | RetailProduct | none | none | hard delete |
| Product | Variants / HSN / GST rate / MRP / cost | - | MISSING | No | No | - | none | |
| Product | Barcode | - | MISSING | No | No | - | none | |
| Product | Bulk edit / CSV import-export | - | MISSING | No | No | - | none | |
| Inventory | Retail stock decrement | `retail.service.ts:49-80` | PARTIAL | Yes | RetailProduct | none | none | Race: negative stock |
| Inventory | Stock adjust | `retail.service.ts:37` | PARTIAL | Yes | RetailProduct | none | none | No reason/ledger |
| Inventory | Stock ledger / movements | - | MISSING | No | No | - | none | |
| Inventory | Warehouses / transfers | - | MISSING | No | No | - | none | |
| Inventory | Reorder alerts | `retail.service.ts:93` | PARTIAL | count only | RetailProduct | none | none | No notification |
| Inventory | Stationery tracker | `stationery/*` | WORKING | Yes | StationeryItem | none | none | Office list |
| Purchase | Supplier / PO / GRN / purchase invoice | - | MISSING | No | No | - | none | |
| POS | Retail POS sale | `retail.service.ts:49-80`, PosView | PARTIAL | Yes | PosSale | none | none | Tax client-supplied; no barcode/hold/split/print |
| POS | Refund/return | `retail.service.ts:84-96` | PARTIAL | full only | PosSale | none | none | Not atomic; no credit note |
| POS | POS -> accounting | `accounting.service.ts:106` | BROKEN | summary ignores PosSale | - | - | none | Revenue missing from P&L |
| POS | Restaurant tables/orders/kitchen/bill | `restaurant/*` | PARTIAL | Yes | RestaurantOrder(+Item), PosTable | none | none | Client price; no bill->sale |
| POS | KitchenTicket / Appointment models | schema.prisma:1077,1116 | MISSING | No code | orphan | - | none | |
| Quotes | Vendor quotation engine | - | MISSING | No | No | - | none | |
| Quotes | Admin proposal/quote (platform) | `quotes/*` | PARTIAL | Yes | Quote | AdminGuard | none | Not vendor-facing |
| Quotes | Versioning / quote->invoice | - | MISSING | No | No | - | none | |
| Billing | Vendor invoice create | `domainapp/invoices.service.ts:35-67` | PARTIAL | Yes | GenericInvoice | none | none | Deterministic totals; weak numbering |
| Billing | Invoice numbering safety | `invoices.service.ts:28-31` | BROKEN | race + global unique | invoiceNumber @unique | - | none | Collision/500 risk |
| Billing | CGST/SGST/IGST, place of supply, HSN | - | MISSING | No | No | - | none | |
| Billing | Vendor invoice PDF | `generic-invoice.template.ts` | PARTIAL | HTML | - | none | none | Unescaped; no GSTIN |
| Billing | Payment link | `invoices.service.ts:115-142` | BROKEN | platform keys; no webhook | razorpayLinkId | none | none | Never reconciles |
| Billing | Mark paid | `invoices.service.ts:144-150` | PARTIAL | Yes | GenericInvoice | none | none | Re-callable; no PaymentRecord |
| Billing | Partial payments / credit-debit notes / cancel | - | MISSING | No | No | - | none | |
| Billing | Recurring invoices | `travel/contracts.service.ts:137-190` | PARTIAL | cron, travel only | Contract | none | none | Idempotent |
| Billing | Overdue automation / reminders | - | MISSING | No | No | - | none | |
| Billing | Vendor invoice email/WhatsApp | - | MISSING | No | - | - | none | |
| Billing | Platform subscription invoice | `invoices/*` | PARTIAL | Yes | Invoice | AdminGuard / owner | none | Number race; swallow-all errors |
| Billing | Platform payment verify | `payments.service.ts:79-98` | BROKEN | Yes | Invoice | any user | none | IDOR + no amount check |
| Billing | Go-live plan purchase | `demo.service.ts:64-135` | BROKEN | Yes | Subscription | sandbox | none | Amount not verified |
| Billing | Public web checkout | `public-checkout.service.ts` | BROKEN | Yes | PosSale | public | none | Client price, replay |
| GST | Filing-status tracker | `accounting.service.ts` upsert; accounts GST tab | WORKING | Yes | GstFiling | accounts | none | Manual status |
| GST | GST summary (out/in) | `accounting.service.ts:106-130` | PARTIAL | Yes | derived | accounts | none | Excludes POS/ITC rules |
| GST | GSTR-1/3B/2B generation, ITC, e-invoice | - | MISSING | No | No | - | none | |
| Accounting | Expenses | `accounting.service.ts:37-101` | PARTIAL | Yes | Expense | accounts | none | No edit; hard delete |
| Accounting | Payments ledger | `accounting.service.ts:~170-190` | PARTIAL | Yes | PaymentRecord | accounts | none | Unlinked; hard delete |
| Accounting | P&L (vendor) | `accounting.service.ts:106-130` | PARTIAL | Yes | derived | accounts | none | Cash basis |
| Accounting | Receivables aging / payables | `summary.service.ts` | PARTIAL | totals only | derived | none | none | |
| Accounting | Ledgers / double-entry / TB / BS | - | MISSING | No | No | - | none | |
| Accounting | Admin accounting expenses | `admin/accounting/page.tsx:29-76` | MOCKED | No | localStorage | - | none | Not persisted server-side |
| Accounting | Travel accounts summary | `accounting.service.ts` travelSummary | WORKING | Yes | Trip, PaymentRecord | accounts | none | |
| Orders | Per-industry operation modules (22) | section 12 | PARTIAL | Yes | per-industry | none (not team-guarded) | none | No state machine/conflicts |
| Orders | Generic Record bookings/orders | `domainapp/records.*` | PARTIAL | Yes | Record | none | none | Free-text status |
| Orders | Unified Case/Job engine | - | MISSING | No | No | - | none | |
| Orders | Website orders list | `dashboard/orders/page.tsx` | PARTIAL | Yes | PosSale type web | none | none | Read-only |
| Audit | Audit log / soft delete / locking | - | MISSING | No | No | - | none | |
| Reports | Vendor Analytics Hub | `dashboard/reports/page.tsx` | PARTIAL | Yes | derived | reports | none | limit=100 truncation |
| Reports | Role dashboards (owner/sales/ops/finance/HR/inventory) | - | MISSING | No | No | - | none | |
| Reports | Per-industry summaries | `*/summary` + accounts overview | WORKING | Yes | derived | accounts (page) | none | |
| Documents | Letterhead/visiting/ID card | `business-documents/*` | WORKING | Yes | stateless | none | none | |
| Documents | Quotation/receipt/PO/DN/payslip | - | MISSING | No | No | - | none | |
| Import/Export | Customers/products/invoices/stock CSV | - | MISSING | No | No | - | none | |
| Customer portal | OTP login + records/invoices/catalog | `customer/*` | PARTIAL | Yes | Contact etc. | public | none | Section 14 #8 |
| Customer portal | Invite (WhatsApp+SMS) | `customer.service.ts:~205` | BLOCKED-EXTERNAL | mock until Fast2SMS key | portalAccess | none | none | UI alerts "mock" |
| Entitlements | Server-side plan/BOS gating | - | MISSING | No | No | - | none | Client-only gating |

## 17. DASHBOARD / UI ACTION MATRIX (clickable actions)

| # | Screen | Button / action | Expected | Actual | API | Status |
|---|---|---|---|---|---|---|
| 1 | Domain-app Contacts | Add contact (save) | Persist customer | Persists, list reloads | `POST /domainapp/contacts` | WORKING |
| 2 | Domain-app Contacts | Edit | Update | Persists | `PUT /domainapp/contacts/:id` | WORKING |
| 3 | Domain-app Contacts | Delete | Remove customer | No delete button anywhere (`daDeleteContact` unused) | `DELETE` exists (hard delete) | BACKEND-ONLY |
| 4 | Domain-app Catalog | Add/edit item + image | Persist item | Persists; cannot set stock/HSN/GST | `POST/PUT /domainapp/catalog`, `/uploads` | PARTIAL |
| 5 | Domain-app Catalog | Delete item | Remove | No UI | `DELETE` exists | BACKEND-ONLY |
| 6 | Records (bookings/orders/transactions) | New record | Persist | Persists | `POST /domainapp/records` | WORKING |
| 7 | Records | Change status | Move through lifecycle | Any string accepted; no transition rules | `PUT /domainapp/records/:id/status` | PARTIAL |
| 8 | Records | Generate Invoice | One invoice from record | Creates; second click -> unique error 500 surfaced via `alert` | `POST /domainapp/invoices` | PARTIAL |
| 9 | Billing/Invoicing tab | Generate Invoice | GST invoice | Server-computed totals; weak numbering; one GST rate | `POST /domainapp/invoices` | PARTIAL |
| 10 | Billing tab | View (file icon) | Printable invoice | HTML in new tab; unescaped fields; no GSTIN | `GET /domainapp/invoices/:id/pdf` | PARTIAL |
| 11 | Billing tab | Payment link | Collect via link | Link made with platform keys; paid event never updates invoice | `POST /domainapp/invoices/:id/send-link` | BROKEN |
| 12 | Billing tab | Mark paid | Record payment | Sets PAID/paidAt; no ledger, no confirmation, error unhandled | `PUT /domainapp/invoices/:id/mark-paid` | PARTIAL |
| 13 | Gym | Attendance tab | Attendance register | ComingSoon card | none | UI-ONLY |
| 14 | Real estate | Documents tab | Document store | ComingSoon card | none | UI-ONLY |
| 15 | Retail POS | Complete sale | Sale + stock decrement + receipt | Sale stored, stock decremented non-atomically, no receipt/tax | `POST /retail/sales` | PARTIAL |
| 16 | Retail POS | Refund | Return + restore stock | Whole-sale refund only | `POST /retail/sales/:id/refund` | PARTIAL |
| 17 | Retail Inventory | Restock / adjust | Stock +/- with record | Increments; no ledger/reason | `POST /retail/products/:id/restock` | PARTIAL |
| 18 | Retail Products | Add / delete | CRUD | Works; hard delete | `POST/DELETE /retail/products` | PARTIAL |
| 19 | Restaurant Orders | Create order / add item / bill | Order to bill | Persists; price client-supplied; bill creates no sale/invoice | `POST /restaurant/orders`, `/bill` | PARTIAL |
| 20 | Restaurant Kitchen | Advance item status | Kitchen flow | Persists | `PATCH /restaurant/items/:id` | WORKING |
| 21 | Clinic Appointments | Create / delete | Booking | Persists; no conflict check | `/clinic/appointments` | PARTIAL |
| 22 | Clinic Prescriptions | View list | Read-only list | Derived from appointments | `GET /clinic/appointments` | WORKING |
| 23 | Technology Tasks | Move task | Update status | Persists | `PATCH /technology/tasks/:id` | WORKING |
| 24 | CRM | Add Lead | Persist | Persists | `POST /crm/leads` | WORKING |
| 25 | CRM | Stage dropdown | Persist stage | Optimistic; on failure silently reloads (error not shown) | `PUT /crm/leads/:id` | WORKING |
| 26 | CRM | Save note | Append note | Overwrites previous note | `PUT /crm/leads/:id` | PARTIAL |
| 27 | CRM | Export CSV | Export leads | Client-side export of filtered in-memory list | none | PARTIAL |
| 28 | CRM | Phone icon | Call + log | `tel:` link only, no log | none | PARTIAL |
| 29 | TeleCRM | Call -> log outcome | Call log + stage + follow-up | Persists | `POST /crm/leads/:id/call` | WORKING |
| 30 | TeleCRM | Import contacts | Bulk lead import | `createMany`, no dedupe | `POST /crm/leads/import` | PARTIAL |
| 31 | TeleCRM | Assign owner | Assign lead | No control exists | `PUT` accepts `assignedTo` | BACKEND-ONLY |
| 32 | Accounts | Log expense | Persist | Persists, GST math server-side | `POST /accounting/expenses` | WORKING |
| 33 | Accounts | Delete expense | Remove | Hard delete; error swallowed | `DELETE /accounting/expenses/:id` | PARTIAL |
| 34 | Accounts | Print voucher | Voucher PDF | HTML in new window; unescaped | `GET /accounting/expenses/:id/voucher` | PARTIAL |
| 35 | Accounts | Record payment | Ledger entry | Persists, unlinked to invoices | `POST /accounting/payments` | PARTIAL |
| 36 | Accounts GST tab | Set filing status | Track return | Persists status only; no computation | `POST /accounting/gst-filings` | WORKING |
| 37 | Accounts Overview | Industry summary cards | KPIs | Real per-industry endpoints | `*/summary` | WORKING |
| 38 | Billing (platform) | Pay invoice | Pay subscription | Works functionally; verify endpoint has IDOR/amount hole | `/payments/create-order`, `/payments/verify` | BROKEN |
| 39 | Invoices (platform) | Email invoice | Email PDF | Sends via Resend if configured | `POST /invoices/:id/email` | BLOCKED-EXTERNAL |
| 40 | Team | Invite member | Invite email/WA | Row created; provider failure -> 500 after row exists | `POST /team/invite` | PARTIAL |
| 41 | Team | Edit modules / Remove | Update access | Persists; removal soft | `PUT/DELETE /team/members/:id` | WORKING |
| 42 | Stationery | Add / update qty / delete | Office stock list | Persists | `/stationery` | WORKING |
| 43 | Settings | Save profile / change password | Persist | setTimeout fake, nothing saved | none | MOCKED |
| 44 | Customer Hub | Send portal invite | WhatsApp+SMS invite | Provider mock-first; UI alerts "mock" | `POST /customer/invite` | BLOCKED-EXTERNAL |
| 45 | Website Orders | View orders | Order list + fulfilment | Read-only list | `GET /engine/orders` | PARTIAL |
| 46 | Payments | Save Razorpay keys | Enable vendor payments | Encrypted save; any member may change | `PUT /vendor-payments` | PARTIAL |
| 47 | My Products | Add/edit/delete | Website catalogue | Persists | `/cms/vendor/:id/products`, `/cms/products/:id` | WORKING |
| 48 | Analytics Hub | Load charts | Cross-module KPIs | Real data; 100-invoice cap; createdAt grouping | 6 endpoints | PARTIAL |
| 49 | Go-live | Buy plan | Convert sandbox | Converts after signature only; amount unchecked | `/demo/buy/order`, `/buy/confirm` | BROKEN |
| 50 | Admin Accounting | Add/delete expense | Persist | Writes to browser localStorage only | none | MOCKED |
| 51 | Admin Accounting | Export for Filing | GST export | `window.print()` of page | none | UI-ONLY |
| 52 | Website cart (public) | Pay | Order + payment | Client price accepted; replayable confirm | `engine.checkout.order/confirm` | BROKEN |

---

## 18. Prioritised findings (for the product owner)

1. **Payment integrity is broken in four places** (section 14 #1-#4): `/payments/verify` (any invoice, any amount), `/payments/create-order` (any amount), go-live conversion (no amount check), public web checkout (client-set price, replayable confirm). These allow free subscriptions and fake "paid" sales.
2. **Vendor invoice payment collection does not work**: payment links use the platform's Razorpay account and the webhook never reconciles `GenericInvoice` (`razorpayLinkId` has no reader); mark-paid is manual with no ledger.
3. **Business Master and GST compliance are absent**: no GSTIN/PAN/branches/numbering/FY/bank/T&C/signature, no CGST/SGST/IGST/HSN/place-of-supply, no GSTR reports - a vendor cannot issue a compliant GST invoice.
4. **Team permissions are an illusion**: 8 coarse areas on 8-9 controllers; everything else (invoices, customers, POS, stock, payment keys) is open to any team member via API; team listing leaks password hashes and invite tokens.
5. **Large PRD blocks have no code**: task engine (orphan model), HR/payroll, purchase/supplier/PO/GRN, stock ledger/warehouses, vendor quotation engine, credit notes, double-entry accounting, audit log, soft delete, CSV import/export, role dashboards - plus zero automated tests.
6. Smaller but real: admin accounting expenses in `localStorage`; account Settings page fake save; POS/restaurant/web revenue invisible to Accounts; invoice numbering collisions; stored-XSS in print views; customer-portal OTP weaknesses; no server-side plan gating.

## 19. Status counts (static-verified only)

Master Feature Matrix (93 rows): PARTIAL 36, MISSING 35, WORKING 10, BROKEN 7, MOCKED 2, UI-ONLY 1, BLOCKED-EXTERNAL 1, BACKEND-ONLY 1, DEFERRED-APPROVED 0.
Dashboard/UI Action Matrix (52 actions): PARTIAL 23, WORKING 15, BROKEN 4, UI-ONLY 3, BACKEND-ONLY 3, MOCKED 2, BLOCKED-EXTERNAL 2, MISSING 0, DEFERRED-APPROVED 0.
