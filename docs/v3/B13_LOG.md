# Batch 13 run log (Stage 17 core run, Block 4a)

Worktree `C:\Get4Domain\get4domain-b13`, branch `v3-b13`, base `origin/v3-b11` at `f1403f2` (Stage 15 finish `7676aad` plus the staging fix). Not pushed.

## GATE CHECK (owner override 1)
`git fetch` ok. `origin/v3-b12` does not exist (Release 1 skips Stages 10, 11, 12, 14 and 16), so the run starts from `origin/v3-b11`. Its log `docs/v3/B11_LOG.md` shows the Stage 15 FINISH and the Stage 15 staging fix section (`f1403f2`); owner note: 53 of 53 integration suites green on staging. PASSED.

## Reconnaissance (facts found, decided against)
- `V2_INVENTORY.md` is not on this branch (it is on `v3-inv`); read from there. V3 code does not read V2 tables (stop-line 5), so the inventory is used only for what NOT to carry over.
- `g4d_customers` does not exist anywhere yet: this run creates it.
- Stage 9 already built the public order path: `paymentReadiness`, `priceCart`, coupons (`V3Offer`), stock reservations (`V3StockLevel`, `V3StockReservation`), order statuses, shipping and tracking JSON, refund-as-record, vendor invoices. Slice 5.24c extends it through the `Catalogue` port and does not rebuild it.
- The entitlement seed has no feature for CRM, accounts, jobs, appointments or the store, and no LIMITED allowance for invoices or stock for Free, so Amendment 06 point 2 needs no replacement; new keys are added additively with Free `LOCKED_PREVIEW`.

## Resume after PC shutdown (Block 4a)
Log had only the gate check and reconnaissance; no slice commit existed. Uncommitted files from the shutdown were inspected: the customer-list slice (5.23a) was complete in code, migration, seed and tests. Kept as is, with three repairs made as new edits:
- `prisma-customers.store.ts`: `vendorId` named inside the list and summary queries, so the static tenant-scoping test can see it (the queries were already scoped through a shared `where`).
- `memory-customers-store.ts`: the test double's create now checks and inserts with no await between, like the unique index (the 20-parallel-capture test was red because of the double, not the service).
- `test/baselines/route-classification.json`: regenerated; the diff is only the seven `/v3/me/customers` routes.

## Slice 5.23a: one customer list with source attribution (customer core)
Migration `20261208100000_v3_customers` (additive: `g4d_customers`, `g4d_customer_sources`, unique per vendor on phone key and e-mail key, RLS on). Entitlement keys added additively with Free `LOCKED_PREVIEW`: `crm.customers`, `accounts.books`, `accounts.items`, `jobs.manage`, `appointments.manage`, `store.manage`. Routes: `/v3/me/customers` (owner only, Pro). Owner overrides keep TeleCRM, pipeline, tasks and segments out of this run.
Checks run: build, eslint on new files, verify:migrations (183 ok), verify:raw-sql (1037 ok), verify:migrations-additive (57 ok), route-classification, admin-role-matrix, b13 isolation/wire/entitlements, customers core and service. Staging integration tests: NOT RUN (staging is owner-run).

## Slice 5.23b: accounts (sales posted from vendor documents, expenses, items and services, GST summary)
Migration `20261209100000_v3_accounts` (additive: `g4d_sale_records` with a unique index on vendor + source type + source id, `g4d_acct_expenses`, `g4d_items`; RLS on). The table name `g4d_expenses` is taken by the old Expense model, so the new one is `g4d_acct_expenses`; the old model's mapping is untouched (checked in the schema diff: no removed line).
Routes (owner only): `/v3/me/accounts/{sales,sync,gst-summary,expenses...}` need `accounts.books`; `/v3/me/items...` need `accounts.items` (Handyman and Professional only, hidden on the store track, Free locked per the b13 entitlement table).
Decisions:
- Auto-post runs as an idempotent sync (`AccountsService.syncDocuments`) before every sales read and summary, plus an explicit `POST sync`. The 5.17d code is not touched, so there is no coupling and a missed post is caught on the next read. The database unique index makes parallel runs safe.
- Invoices are the 5.17d vendor documents (tax invoice, bill of supply, bill, fee receipt); no second invoice writer is built. Manual invoice entry is not in this slice.
- The GST summary reads the 5.17d tax profile; not registered reports no tax; composition claims no input credit; net tax can be negative. It is a working figure, not a return (OPEN QUESTION for the accountant: mapping to GSTR lines, advance receipts, wording).
- An item tax rate is accepted only when it is in the effective rate table (`g4d_tax_rates`); an empty table means no rate can be set (no invented rate). HSN or SAC code is stored with the item.
- Customer capture from documents is not done: the document keeps only the customer name, no phone or e-mail, so there is nothing to recognise a person by.
Staging integration tests added in `test/b13-stores.int.spec.ts`: NOT RUN (owner-run).
Gates: build, eslint, verify:migrations 185, verify:raw-sql 1044, verify:migrations-additive 58, route baseline regenerated (13 routes added across both slices), route-classification, role matrix, b13 isolation, wire, entitlement, accounts core, service and gates specs.

## Slice 5.24a: jobs and quotes (Handyman)
Migration `20261210100000_v3_jobs` (additive: `g4d_jobs`, `g4d_job_quotes` (the name `g4d_quotes` is the old Quote model's), unique per business on number, RLS on). Routes (owner only, plan feature `jobs.manage`: Free LOCKED_PREVIEW, Handyman Pro ACTIVE, hidden on the other tracks): `/v3/me/jobs` (list, calendar, create, update, status, paid, archive, restore), `/v3/me/quotes` (list, create, edit draft, send, accept, decline).
Decisions:
- Job states REQUESTED, QUOTED, BOOKED, IN_PROGRESS, DONE, PAID, CANCELLED; quote states DRAFT, SENT, ACCEPTED, DECLINED, EXPIRED; both are tables in the pure core with a test per edge. Every move is compare-and-set (one conditional UPDATE), so of ten parallel moves one wins.
- PAID has no manual route: `POST /jobs/:id/paid` takes a payment request id and succeeds only when that request belongs to the business, is PAID in Stage 9 and its amount equals the accepted quote total. This module never marks money received.
- Accepting a quote runs one at a time per quote (KeyedQueue, before any query) and creates the job once; the quote is linked to it; ten parallel accepts leave one job.
- A quote past its last day becomes EXPIRED lazily on every read and on accept (no timer); accept then answers JOBS_QUOTE_EXPIRED.
- "Send" only marks the quote as given to the customer; nothing is sent (sending is Block 4b). The customer accepts through the business: a customer-facing accept page is not built here.
- Assignment is a free label (`assignedTo`); real team members arrive with Stage 17B (extension point).
- Customer link: a job or accepted quote with a readable phone puts the person on the customer list with source MANUAL (refType job); an unreadable phone leaves the job without a link and does not fail it.
- Job and quote numbers are per business (max plus one, serialised per business in this process, unique index plus retry for a second instance).
Staging integration tests extended in `test/b13-stores.int.spec.ts`: NOT RUN (owner-run). Gates: build, eslint, verify:migrations 187, verify:raw-sql 1052, verify:migrations-additive 59, route baseline (1206 routes), route-classification, role matrix, b13 isolation, wire, gates, entitlement, jobs core (40) and service (18).

## Slice 5.24b: appointments (Professional)
Migration `20261211100000_v3_appointments` (additive: `g4d_appt_services`, `g4d_appt_providers`, `g4d_appt_bookings` (`g4d_appointments` is the old model's name); RLS on). Routes (owner only, plan feature `appointments.manage`: Free LOCKED_PREVIEW, Professional Pro ACTIVE, hidden on the other tracks): `/v3/me/appointments` services, providers, slots, list, request, confirm, decline, cancel, complete, no-show.
Decisions:
- Request and confirm: a request is REQUESTED and holds its slot; the only code path that sets CONFIRMED is the business's own `confirm` call. There is no timer, no auto path and no public route; tested (a request never confirms, no reminder is scheduled until confirm, CONFIRMED is reachable only from REQUESTED).
- Slots: weekly working hours per provider in India time, length grid from each window start, fully inside the window, in the future, not overlapping any REQUESTED or CONFIRMED booking of the provider. Taking a slot runs one at a time per provider (KeyedQueue, before any query); ten parallel requests for one time leave one.
- Confirm is compare-and-set (one conditional UPDATE) so ten parallel confirms leave one winner and one reminder.
- Reminders go to a `ReminderPort`; the module binds a FAKE that sends nothing (the automations engine and sending are Stage 17B). The reminder lead time is not decided here (no invented value).
- A customer-facing request page is not built: the business records the request (phone, walk-in or from an enquiry; `requestId` keeps the link). Every provider can do every service in this version.
- A readable phone puts the person on the customer list (source MANUAL, refType appointment).
Gates: build, eslint, verify:migrations 189, verify:raw-sql 1060, verify:migrations-additive 60, route baseline 1225 routes, full unit project 3602 of 3602 green. Staging integration tests extended: NOT RUN (owner-run).
