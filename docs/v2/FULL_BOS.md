# Full BOS (2026-10-09)

Dispatch: `GET4DOMAIN_DISPATCH_V2_FULL_BOS_09OCT2026.md`. Branch `get4domain-site`. Built and tested locally; **nothing deployed** and no production database was changed. Progress and decisions: [FULL_BOS_PROGRESS.md](FULL_BOS_PROGRESS.md). Audit: [evidence/full-bos/AUDIT_2026-10-09.md](evidence/full-bos/AUDIT_2026-10-09.md). What stays Coming soon: [FULL_BOS_BACKLOG.md](FULL_BOS_BACKLOG.md).

## The idea in one paragraph

The whole BOS is built once. A plan only switches screens, reports and limits on or off. **Capturing** a business record (an invoice, a receipt, a stock movement, an expense, a journal entry) is never gated; **viewing, exporting and limits** are. So moving from Essentials to Pro needs no migration, no re-entry and no conversion: the Pro reports are just more views of records that were always there, for the whole history. A downgrade locks the Pro screens and deletes nothing; new Essentials activity still posts to the same books.

## The spine (one data model for every plan and industry)

| Business thing | Where it lives | Notes |
|---|---|---|
| Party (customer or supplier) | `Contact` (existing) + GSTIN, state, shipping address, opening balance | one customer list; the older industry editors keep working |
| Item | `VendorProduct` (the universal catalogue, existing) + HSN, GST rate, purchase price | the same item is on the website, in stock, on an invoice |
| Document | `g4d_bos_documents` + lines | quote, sales order, sales invoice, credit note, purchase bill; draft, issued, part paid, paid, cancelled |
| Numbering | `g4d_bos_doc_series` | gapless per vendor, per type, per financial year (`INV/26-27/0001`), assigned inside the issuing transaction |
| Payment | `g4d_bos_payments` + allocations | receipts, part payments, advances, payments to suppliers, gateway receipts |
| Stock | `StockMovement` (existing ledger) + variant and location | on-hand always equals the sum of movements (property-tested) |
| Books | `g4d_bos_journal_entries` + lines, `g4d_bos_accounts` | double entry, posted in the **same transaction** as the document; a cancel posts the exact opposite; nothing is deleted |
| Expenses | `g4d_bos_expenses` | post to the books |

Money is integer paise. The vendor-side GST engine (`backend-api/src/bos/gst.ts`) is separate from Get4Domain's own plan pricing (`commercial/pricing-math.ts`). Exclusive and inclusive prices, line and bill discounts shared before tax (largest remainder), CGST+SGST inside the state, IGST outside, bill of supply when the vendor is not GST registered, optional round-off. The posting rules (`posting-rules.ts`) are pure: every document type produces a balanced entry and a reversal nets every account to zero (tested).

## What a vendor can do (screens, all through the registry)

- **Customer invoices** (`/dashboard/finance/invoices`): invoices, quotes, money in (receipts, who owes you with 0-30 / 31-60 / 61-90 / 90+ ageing, customer statement, reminder by WhatsApp), credit notes. From scratch, from a quote, from a website order, from the counter, from a booking. Print or PDF, public link `/d/<token>`, WhatsApp, e-mail. "Pay now" appears only when the vendor has set up **their own** Razorpay.
- **Counter billing** (`/dashboard/commerce/pos`): type or scan, split payment, thermal print view, one transaction for invoice, receipt, stock and books; pressing Charge twice bills once.
- **Stock** (`/dashboard/commerce/stock`): items with on-hand, alert level, value, last movement; "Not tracked" for items that are not counted; sizes and colours; adjust with a reason; a low-stock message each morning (can be switched off). Pro: more than one place, transfers, stock value.
- **Purchases and suppliers** (Pro): purchase bills with GST input credit, stock in, cost price follows the latest purchase (setting), payables, payments out.
- **Accounts** (`/dashboard/finance/expenses`, named Accounts): summary (the same numbers as Home), expenses with bill photo, sales register. Pro adds ledger, day book, trial balance, profit and loss, balance sheet, item-wise profit.
- **Accounts for the CA** (Pro): GSTR-1 and GSTR-3B style tables, HSN summary, one-click CA pack (Excel workbook, printable summary, attachment list), period lock.
- **Recurring billing** (Pro): repeat an issued invoice; runs once per due date; a downgrade pauses it.
- **Collect payments**: the vendor's own Razorpay keys (encrypted, format checked, Test connection, never filled from another field), UPI ID and bank details printed on invoices.
- Get4Domain's own bills to the vendor live only under **Plan and billing**. The old sidebar "Invoices" address redirects to Customer invoices with a one-time note.

## Plans, switches and the one code path

`registry/capabilities.ts` lists what a plan switches on that is not a menu screen (purchases, multi-location, valuation, books, GST reports, CA pack, period lock, recurring, staff seats) with a minimum plan and named limits. `EntitlementsService.resolve(vendorId)` combines the registry default, KSM's edits (`g4d_plan_overrides`), the vendor's plan (billing term), special arrangement and per-vendor exception (`cap:<id>` rows). The server enforces it: **HTTP 403 `PLAN_REQUIRED` with `{feature, requiredPlan}`**, and the dashboard renders the Locked card from that answer. There is no `if (plan === ...)` in business code. Lapsed or no term resolves as Essentials for gated views; nothing is deleted.

KSM edits the split without a deploy: `GET/PUT /admin/bos/capabilities` and per-vendor `POST /admin/bos/vendors/:id/capability` (reason required, audited, MARKETING refused).

## Bugs fixed with their whole class

| Bug | Cause | Fix | Class audit and guard |
|---|---|---|---|
| B1 Website Manager save fails | the form sent the whole loaded record; the API refuses unknown keys; `businessHours` was missing from the DTO | `editable()` in forms, `EditTolerantValidationPipe` drops echoed read-only keys on edit bodies, DTO accepts `businessHours`, validation errors are plain sentences | 89 edit calls audited, 40 sent a loaded record (38 fixed, 2 reviewed safe); 37 update DTOs compared with their tables; `audit-update-payloads`, `dto-echo --strict`, `verify-payload-contract` |
| B2 Razorpay Key ID shows an e-mail | browser autofill (text box before a password box, no autocomplete), no format check | autocomplete off, format validated on screen and server, invalid saved value hidden and flagged, Test connection | 14 credential-like inputs audited, 11 missing a decision (fixed); `audit-credential-fields`; read-only vendor report `scripts/bos/razorpay-key-report.js` |
| B3 AI credit Rs 250 vs Rs 499 | numbers typed into pages | prices from `lib/pricing.ts` / live pricing, credit from the vendor's term | `audit-hardcoded-prices`: vendor dashboard code must have none; marketing copy may only shrink (606 lines baseline) |
| B4 plan list claims unproven things | typed lists | generated from registry state: built is listed, not built says Coming soon | `registry/verify-plan-lists.mjs` |
| B5 legacy plan name | `'DomainApp Startup'` typed at login | real plan name from the server | covered by tests of the entitlements endpoint |
| B6 labels | | Accounts, Customer invoices | menu snapshot + workspace menu test |
| B7 empty states | | Not tracked, real totals, "add your first" | profile test (five industries) |

Found on the way: the response wrapper turned every HTML page and file download into JSON (shared invoice pages, CA pack, payment proof). Fixed in `TransformInterceptor`.

## Guards (run `npm run bos:verify` from the repo root)

Registry (routes, ids, evidence, generated files current) · registry rules, menus per plan, retired-route redirects · plan lists honest · additive migrations (no DROP, no type narrowing, no NOT NULL without default; seeded violation proven) · migration SQL hygiene · DTO echo (server) · payload contract (client) · credential fields · hard-coded prices · offline security suites · all backend suites (rule book, real-Postgres chains A-D, stock-ledger property and concurrency, upgrade/downgrade, order bridge, backfill, migration rehearsal with drift check, five-profile proof, commercial engine) · every Open feature with a test id has a passing test.

## Decisions taken without asking KSM

See [FULL_BOS_PROGRESS.md](FULL_BOS_PROGRESS.md) (list at the top).

## Known limits (stated, not hidden)

- GST returns are tables for the CA, not a filing integration.
- Opening balances are posted by the backfill; no old invoices are invented.
- E-mail needs the mail key; WhatsApp sharing is a wa.me link (no paid API).
- The UPI QR image is not drawn; the UPI ID and a tap-to-pay `upi://` link are shown.
- Variants are free text per line, counted per variant once stock is entered for it.
- Legacy invoices and expenses (the older tables) stay and are added into the older Accounts page totals; they are not posted into the books.
