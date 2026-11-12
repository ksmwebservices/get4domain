# V3 business modules: rules and design (Batch 13, Stage 17 core run, Block 4a)

Sources: `docs/v3/stages/STAGE_17_BUSINESS_MODULES_BATCH_13.md` (with Amendment 06), `VENDOR_NAVIGATION_FINAL.md`, Amendments 09, 10 and 11 (context), and the **owner overrides of this run**, which win over the stage file. This file is extended at FINISH with the data dictionary, API contract and decision log.

## Owner overrides of this run (in force)
1. **Gate.** Release 1 skips Stages 10, 11, 12, 14 and 16, so `origin/v3-b12` does not exist. The base is `origin/v3-b11` (Stage 15, pushed, 53 of 53 integration suites green; its log shows the Stage 15 finish `7676aad` and the staging fix `f1403f2`). Branch `v3-b13`, worktree `C:\Get4Domain\get4domain-b13`.
2. **Slice 5.23 is reduced.** NO TeleCRM, call queues, scripts, callers, CRM pipeline, tasks or segments (Release 2). Only (a) one customer list on `g4d_customers` with source attribution (search, directory, bot, campaign, payment, manual) and the Free LOCKED_PREVIEW gate; V3 code never reads a legacy contact table, so legacy import is Release 2; and (b) Accounts: sales records auto-posted from the Stage 9 5.17d vendor documents (idempotent), expenses, items and services, a GST report that uses the vendor tax profile, Free locked, Items and Services only for Handyman and Professional.
3. **Slices 5.24 (Jobs, Appointments, Store) and 5.25 (retire per-industry modules) are in scope as written.** Store checkout is UPI only (Stage 9): a vendor with no active UPI method gets an order request, not online checkout.
4. **Not built (Block 4b):** Stage 17B (team, tasks, documents, notifications), support tickets, cash and offline payment recording, held enquiries, email and SMS sending. Where a feature needs sending or a team member, this run leaves an extension point and a fake.
5. **Untouched:** frontend, the themes repo, Stage 9, 13 and 15 code except additive wiring. Nothing is pushed.

## Owner rules (frozen 4 November 2026) that this run touches
2 (Free is informational: no requests, bookings or orders; Pro features LOCKED_PREVIEW), 4 (bridge: we never hold customer money; the vendor's own UPI; receipts in the vendor's name after the vendor confirms), 6 (never hide or delete a site; stored data is kept and returns with Pro), 7 (self-service free within the plan), 9 (promotional messages only to opted-in contacts), 12 (tax: one rule, rates from tables never code; wording and advance receipts go to the accountant), 13 (no timeframes in text; the names Workspace, BOS and LeadSpace never appear in generated product text).

## Module rules (this run)
- **One customer record per person per business.** Identity is the normalised phone, else the lower-cased email. A second capture of the same person adds an attribution row, never a second customer. The database enforces it (unique on the vendor and the phone key, and on the vendor and the email key).
- **Source attribution.** `SEARCH, DIRECTORY, BOT, CAMPAIGN, PAYMENT, MANUAL`. The first source is kept on the customer; every capture adds one idempotent attribution row (vendor, customer, source, reference).
- **Consent is a fact about a customer, not a default.** A new customer is `UNKNOWN`; only an explicit opt-in sets `OPTED_IN`, and an opt-out sets `OPTED_OUT` and always wins. The consent attestation that an import needs (5.18a) does not exist, so import is not built.
- **No hard delete.** A customer, expense, item, quote, job or appointment is archived (`archivedAt`), never removed; numbers and history stay.
- **Sales records are a projection of 5.17d documents.** One record per document (unique on the vendor and the document); posting twice stores one row. The record keeps the amounts and the tax split the document carries; nothing is recomputed. Credit documents post as negative records so the books balance.
- **GST report.** Built only from sales records and expenses, grouped by rate, with the vendor tax profile deciding the heading: not registered gives no GST report, composition scheme says so, registered gives IGST or CGST plus SGST as the documents recorded them. Rates are never in code. It is a summary, not tax advice.
- **Items and services (the V3 catalogue).** One table, `g4d_catalog_items`, with a kind (`ITEM`, `SERVICE`, `PRODUCT`), a price in whole paise, an HSN or SAC code and a tax rate **reference** to the tax-rate table (never a number in code). Handyman and Professional use `ITEM` and `SERVICE`; Ecommerce uses `PRODUCT`, with variants and stock added in 5.24c. The Stage 9 order path reads it through the existing `Catalogue` port and carries the rate onto order lines.
- **Jobs (Handyman).** Quote lines; quote states `DRAFT, SENT, ACCEPTED, DECLINED, EXPIRED`; job states `REQUESTED, QUOTED, BOOKED, IN_PROGRESS, DONE, PAID, CANCELLED`. Accepting a quote creates the job once. `PAID` is only ever reached from a payment the vendor confirmed (Stage 9); this module never marks money received.
- **Appointments (Professional).** Services, providers, working hours, slots; the customer asks, the vendor confirms. Nothing is ever auto-confirmed. Reminders go through a `ReminderPort` (fake here; sending is Block 4b).
- **Store (Ecommerce).** Checkout is decided by one table: an ACTIVE UPI method gives online checkout (a pay request on the vendor's own UPI); anything else gives an order request. Stock never goes below zero, under concurrency, because the decrement is one conditional statement. Returns and refunds are recorded facts only.
- **Retired industry modules (5.25).** For a V3 vendor the per-industry module routes answer 404 and the entitlement state is HIDDEN; data is kept; a legacy vendor is untouched until the switch.
- **Static checks.** `b13-isolation.spec.ts` covers every new module: no legacy table or constant, every store query names the vendor, pure cores have no clock, randomness or database, no console or raw SQL, no timeframe, rupee price or retired product name in any text.

## OPEN QUESTIONS (owner and accountant; none block building)
1. **The Batch 6 decision (adapter or import of legacy contacts) does not exist.** Release 1 skips Stage 10, so no decision was recorded. This run builds the V3 list only; legacy import is Release 2.
2. **The 5.18a consent attestation does not exist** (Stage 10 skipped). Because of that, no import, no bulk add and no marketing send is built; manual add and attribution only.
3. Which GST rates, HSN and SAC codes apply to which items goes to the accountant. No rate is invented: an item without a tax rate reference carries rate 0 and the order line says so.
4. Quote and job wording that may count as a tax document, and the treatment of advance receipts, go to the accountant (owner rule 12).
5. The unit of the listed plan prices is still PENDING (Amendment 11 Q1); nothing here prices a plan.


---

# AS BUILT (Batch 13 finish)

This part records what was built, on branch `v3-b13`, base `origin/v3-b11`. Where it differs from the plan above, **this part wins** and the difference is listed under "Differences".

## Data dictionary (all additive; every table has RLS on with no policy and a `vendorId` the tenant guard scopes; nothing is hard deleted)

| Table | Slice | Holds | Keys and rules |
|---|---|---|---|
| `g4d_customers` | 5.23a | One person of one business: name, phone and e-mail as given, the normalised phone and e-mail keys, first source, consent, notes, tags | unique (vendor, phone key) and (vendor, e-mail key); archived, never deleted |
| `g4d_customer_sources` | 5.23a | Where a customer came from, one row per source and reference | unique (customer, source, ref type, ref id) |
| `g4d_sale_records` | 5.23b | One sale copied from a vendor document (5.17d): number, kind, date, customer name, taxable, tax split, total | unique (vendor, source type, source id): posting twice stores one row |
| `g4d_acct_expenses` | 5.23b | A cost: day, category, description, amount paid, GST inside it | archived, never deleted |
| `g4d_items` | 5.23b | An item or a service with HSN or SAC, unit, price and a tax rate that is in the rate table | archived, never deleted |
| `g4d_jobs` | 5.24a | A piece of work: number, title, customer, schedule, assignee label, status, accepted-quote total, the payment request that made it PAID | unique (vendor, number) |
| `g4d_job_quotes` | 5.24a | A quote with lines (JSON), totals, last day, status | unique (vendor, number); lines editable only while DRAFT |
| `g4d_appt_services` | 5.24b | A service with its length | archived |
| `g4d_appt_providers` | 5.24b | A person who takes appointments, weekly hours (JSON, India time) | archived |
| `g4d_appt_bookings` | 5.24b | A request or booking with a start, an end and a status | REQUESTED and CONFIRMED hold the time |
| `g4d_store_products` | 5.24c | A product: price, HSN or SAC, tax rate from the table, track-stock flag | unique (vendor, SKU) |
| `g4d_store_variants` | 5.24c | A size, colour or pack of a product; no price means the product price | unique (vendor, SKU) |
| `g4d_store_stock_moves` | 5.24c | The stock ledger: change, reason, balance after, key | unique (vendor, key); append only |
| `g4d_order_returns` | 5.24c | A return the business recorded for an order (a recorded fact) | |

Reused from earlier stages, not changed: `g4d_stock_levels` and `g4d_stock_reservations` (Stage 9; a level's product reference is a product id, or a variant id when the product has variants), `g4d_vendor_documents` and `g4d_vendor_tax_profiles` (5.17d), `g4d_tax_rates`, `g4d_orders`, `g4d_payment_requests`.

Migration folders, in order: `20261208100000_v3_customers`, `20261209100000_v3_accounts`, `20261210100000_v3_jobs`, `20261211100000_v3_appointments`, `20261212100000_v3_store`. 5.25 has no migration.

Entitlement features added to the plan seed (additive): `crm.customers`, `accounts.books`, `accounts.items`, `jobs.manage`, `appointments.manage`, `store.manage` (Free LOCKED_PREVIEW on the track that has the module, HIDDEN elsewhere; Pro ACTIVE on its own track), and, for 5.25, `industry.<module>` for the twenty-one retired modules (HIDDEN on every plan).

## Rules as built

- **State machines are tables in pure cores**, one test per edge: quote (DRAFT, SENT, ACCEPTED, DECLINED, EXPIRED), job (REQUESTED, QUOTED, BOOKED, IN_PROGRESS, DONE, PAID, CANCELLED), appointment (REQUESTED, CONFIRMED, DECLINED, CANCELLED, COMPLETED, NO_SHOW). Every move is one conditional UPDATE (`from` must still be current), so parallel taps leave one winner.
- **PAID has no manual route.** A job is PAID only from a payment request of the business that is PAID in Stage 9, for the accepted quote total.
- **Nothing confirms itself.** An appointment request is REQUESTED and holds its slot; only the business's own confirm call sets CONFIRMED.
- **Stock cannot go below zero.** One transaction: ensure the level row, one conditional UPDATE, then the ledger row. A refused decrease leaves no row. No lock is taken.
- **Tax rates are never in code.** Items, products and quote lines accept only a rate that is in the effective rate table; with an empty table no rate can be set.
- **Idempotent posting.** Sale records, ledger rows, imports and customer sources are keyed so a repeat changes nothing.
- **Free is locked, other tracks do not see the module.** Every route is behind `@RequiresFeature` and the owner guard; MARKETING and staff are not principals of these routes.

## API contract

The route table is in `V3_API_DOCUMENTATION.md` (Batch 13 section, 72 routes, generated from the controllers by `scripts/b13-route-table.js`). Paged lists answer `{ items, total, page, pageSize }` inside the standard envelope. Examples:

```json
// POST /v3/me/quotes   (Handyman Pro)
{ "jobId": "ckx...", "validUntil": "2026-12-31", "lines": [ { "name": "Visit", "qty": 1, "unitPaise": 50000, "taxPercent": 18 } ] }
// 200
{ "id": "...", "number": 1, "status": "DRAFT", "taxablePaise": 50000, "taxPaise": 9000, "totalPaise": 59000, "lines": [ { "name": "Visit", "qty": 1, "unitPaise": 50000, "taxPercent": 18, "taxablePaise": 50000, "taxPaise": 9000, "amountPaise": 59000 } ] }
// a rate that is not in the rate table: 400 { "code": "JOBS_INVALID", "message": "line 1: taxPercent is not a rate in the rate table" }
```

```json
// POST /v3/me/store/stock/<productRef>   (Ecommerce Pro)
{ "delta": -3, "reason": "ADJUSTMENT", "idempotencyKey": "count-2026-12-01" }
// 200
{ "applied": true, "onHand": 7, "reserved": 2, "available": 5 }
// not enough stock: 409 { "code": "STORE_STOCK_INSUFFICIENT" }
```

```json
// POST /v3/me/store/stock/import   (dry run unless apply is true)
{ "rows": [ { "sourceId": "L-1001", "sku": "CP-1", "kind": "OPENING", "qty": 40 }, { "sourceId": "L-1002", "sku": "CP-1", "kind": "MOVEMENT", "qty": -3 } ], "apply": true }
// 200
{ "mode": "APPLIED", "read": 2, "rejected": [], "alreadyApplied": 0, "toApply": 2, "applied": 2, "sourceTotals": { "rows": 2, "quantity": 37, "skus": 1 }, "databaseTotals": { "rows": 2, "quantity": 37, "skus": 1 }, "comparison": { "rowsMatch": true, "quantityMatch": true, "skusMatch": true, "ok": true } }
```

```json
// GET /v3/me/accounts/gst-summary?from=2026-04-01&to=2026-04-30   (a registered business)
{ "from": "2026-04-01", "to": "2026-04-30", "registered": true, "composition": false, "note": null, "invoiceCount": 12, "salesTotalPaise": 354000, "taxablePaise": 300000, "notTaxablePaise": 0,
  "cgstPaise": 27000, "sgstPaise": 27000, "igstPaise": 0, "outputTaxPaise": 54000, "inputTaxPaise": 9000, "netTaxPaise": 45000, "expenseTotalPaise": 59000, "profitPaise": 295000, "truncated": false }
```

Stable error codes (all passed through by the exception filter, which `b13-wire.spec.ts` proves): `CUSTOMER_INVALID, CUSTOMER_NOT_FOUND, CUSTOMER_EXISTS, CUSTOMER_CONSENT_LOCKED`; `ACCOUNTS_INVALID, ACCOUNTS_NOT_FOUND`; `JOBS_INVALID, JOBS_NOT_FOUND, JOBS_STATE, JOBS_PAYMENT_ONLY, JOBS_QUOTE_EXPIRED, JOBS_NOT_PAID`; `APPT_INVALID, APPT_NOT_FOUND, APPT_STATE, APPT_SLOT_UNAVAILABLE`; `STORE_INVALID, STORE_NOT_FOUND, STORE_SKU_TAKEN, STORE_NOT_TRACKED, STORE_STOCK_INSUFFICIENT`.

## Slice 5.25: retiring the per-industry modules

For a V3 vendor (entitlement mode `V3`, or flagged for V3 with no plan yet) the routes of the twenty-one Version 2 industry modules answer a plain 404. The decision is the entitlement `industry.<module>`, which the plan seed sets to HIDDEN on every plan, so staff can switch a single vendor back on with an override. A vendor on `LEGACY` mode never reaches the entitlement check. The guard (`RetiredModuleGuard`, registered after the JWT and module guards) reads no table and writes nothing: **all data is kept**. A static scan proves no legacy controller outside the industry folders shares a retired prefix and every industry controller prefix is on the list.

## Decision log

1. One customer list, V3 only; legacy contacts are not imported (no Batch 6 decision exists because Stage 10 is skipped). Release 2.
2. Accounts posts by idempotent sync before every read instead of hooking 5.17d, so Stage 9 code is untouched and a missed post heals on the next read.
3. Items and services (`g4d_items`) and store products (`g4d_store_products`) are separate tables (see Differences).
4. Job numbers, quote numbers: max plus one per business, serialised per business in the process, unique index plus retry for a second instance.
5. Appointments are request-and-confirm only; no public booking page and no reminder sending (a fake `ReminderPort`; Stage 17B).
6. Stock reuses the Stage 9 level rows so reservations and the ledger agree; the ledger is append only.
7. The catalogue bridge is additive wiring in `requests-orders` (shop catalogue first, content items after); content sites behave as before.
8. Retiring is a route 404 decided by an entitlement, not a table change, so it is reversible per vendor and loses no data.
9. Where a table name was taken by the old models (`g4d_expenses`, `g4d_quotes`, `g4d_appointments`, `g4d_stock_movements`), the new table has a distinct name and the old mapping is untouched (checked: no removed line in the schema diff).

## Differences from this file (above) and from the stage file

1. **Catalogue**: the plan above described one `g4d_catalog_items` table with kinds ITEM, SERVICE, PRODUCT. As built there are two: `g4d_items` (items and services for Handyman and Professional) and `g4d_store_products` plus variants (Ecommerce), because stock, variants and SKU rules belong only to products.
2. **Credit documents** were planned to post as negative sale records. There is no credit document in 5.17d, so none is posted; add it when one exists.
3. **GST report** was planned "grouped by rate". As built it totals by kind and by CGST, SGST and IGST (the 5.17d document carries the tax split, not a per-line rate in its totals). Grouping by rate needs the line rates; OPEN QUESTION for the accountant.
4. **Checkout decision**: the decision table and an owner endpoint are built. The Stage 9 public cart still refuses an order when a business has no active payment method. The follow-up is below.
5. **Customer capture from vendor documents** is not done: a document keeps only the customer name, so there is nothing to recognise a person by.
6. **Customer-facing pages** (accept a quote, book an appointment) are not built: the business records what the customer said. Sending is Block 4b.
7. **Fractional tax rates**: the Stage 9 cart prices whole percents only; a product with a fractional rate is `orderable: false`.
8. **Red-first for 5.25**: the core and guard tests were written together with the implementation and were not run red separately; they were run green and the guard test includes the negative cases (legacy vendor, non-industry route, staff).
9. TeleCRM, the CRM pipeline, tasks, segments, Stage 17B, support tickets, cash recording, held enquiries and sending were NOT built, per the owner overrides of this run.

## OPEN QUESTIONS added by this run

6. **Order request with no payment method.** The owner override says a business with no payment method gets an order request. Stage 9's public cart refuses it today (`ENQUIRY_ONLY`) and only takes an order request when an active pay-on-delivery, pay-at-visit or bank-transfer method exists. Doing it needs a new order payment mode (an additive enum value) and a change to the public endpoint. Decide, then it is a small follow-up.
7. **Fractional GST rates** (for example 0.25 or 1.5 percent) in the online cart: the cart needs fractional support, or those products stay enquiry only. Accountant to say which slabs are needed.
8. **GST summary mapping** to the return lines, and grouping by rate, go to the accountant (owner rule 12).
9. **Reminder lead time** for appointments is a setting the automations engine (Stage 17B) will own; no value is invented here.
10. **Job assignment** is a free label until the team module (Stage 17B) gives it a person.
11. **Stock import comparison** covers every import-keyed row of the business, so use it for a whole-file load (Stage 19, Step N Rock).
