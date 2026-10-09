# GET4DOMAIN V2 — FULL BOS DISPATCH: BUILD ONCE, PLAN DECIDES WHAT IS SWITCHED ON
Date: 9 Oct 2026 · From: KSM (via Claude) · To: Claude Code · Branch: `get4domain-site`

This is ONE complete, self-contained document. Execute every phase in order, autonomously, to the end. Do not stop to ask KSM questions mid-task; decide, proceed, and record each decision in the final report. Report at the end in the checklist format in section 13.

It follows Release 1A (Dashboard v2 shell, registry, special arrangements — already built, pushed and deployed to the VM up to the dry run). Do not redo 1A. This dispatch builds the real product underneath it.

---

## 0. HOW TO RUN THIS (KSM reads this part)

| Step | Paste into | Command |
|---|---|---|
| 1 | **Windows PowerShell** on your PC | `cd C:\Get4Domain\get4domain-site` then `git status` (must be clean) then `git pull origin get4domain-site` |
| 2 | Save this file into the repo | Put it at `C:\Get4Domain\get4domain-site\docs\GET4DOMAIN_DISPATCH_V2_FULL_BOS_09OCT2026.md`, then in **PowerShell**: `git add docs` and `git commit -m "docs: full BOS dispatch"` |
| 3 | **Windows PowerShell** | `claude` (starts Claude Code in the repo) |
| 4 | **Claude Code** (the chat that just opened) | `Read docs/GET4DOMAIN_DISPATCH_V2_FULL_BOS_09OCT2026.md completely, then execute every phase in it end to end without stopping to ask questions. Keep docs/v2/FULL_BOS_PROGRESS.md updated after every slice so a restart can resume. Report in the checklist format at the end. Push to origin as the last step.` |
| 5 | If Claude Code stops early (context full) | **Claude Code**, new session: `Read docs/v2/FULL_BOS_PROGRESS.md and docs/GET4DOMAIN_DISPATCH_V2_FULL_BOS_09OCT2026.md, resume from the first unfinished slice, same rules.` |
| 6 | Wait. It works alone and ends with a checklist report. | |
| 7 | **Paste the checklist report back to Claude (this chat) as plain text.** | |
| 8 | **VM terminal** (SSH `ksmwebtechservices@34.14.130.68`), ONLY after Claude says the report is good | Deploy steps in section 14 |

If the push is blocked by the permission check, say so in the report. KSM will push from PowerShell: `git push origin get4domain-site`.

Claude Code never touches the server or the production database. Migrations are written and validated on the isolated test database only; KSM runs them on the VM.

---

## 1. GOAL AND THE ONE PRINCIPLE

KSM's decision: **do not build an "Essentials product" and a "Pro product". Build the complete BOS once.** The plan then switches features on or off automatically. Upgrading Essentials → Pro must need **no migration, no re-entry, no data conversion** — the data was always captured in full; the upgrade only switches more screens, reports and limits on.

Therefore:

1. **Capture is never gated; views, exports and limits are.** Every invoice, receipt, stock movement and expense is stored and posted to the books exactly the same way for every plan. Essentials sees simple totals; Pro sees the full books on the same data.
2. **One code path.** No `if (plan === 'ESSENTIALS')` branches in business logic. Plan access comes only from the entitlement layer (Phase 5), resolved on the server from the registry + plan + special arrangements + admin exceptions.
3. **Downgrade or lapse locks, never deletes.** Locked features show the upgrade card; data is kept and reappears on upgrade.
4. **Plan limits live in admin-editable configuration, not in code** (existing `admin/commerce/plan-access`). The split in section 8 is a starting default for KSM to change in admin later.

Scope of "full BOS": the ten departments already defined in `docs/v2/DASHBOARD_V2.md` and the 55 features in `registry/features.ts`. Audit first (Phase 0), then build the missing core spine (Phases 1–4), then connect everything else to it (Phase 7). Anything the audit finds "Not built" outside the spine is listed in the backlog with an effort estimate — not silently built, not hidden.

---

## 2. GROUND RULES (all apply)

1. Prisma stays pinned 6.19.3 — never upgrade. Supabase pooler URL only. Table prefix `g4d_`. Every query is `vendorId`-scoped.
2. `npm run build` must finish with 0 errors in BOTH `backend-api/` and `get4domain_mvp/` before every commit. Commit after each slice. Run `node registry/check.mjs` too.
3. **All migrations are additive.** No DROP, no column type narrowing, no NOT NULL without default on existing tables. A guard script (Phase 9) fails the build otherwise. After any schema change update `backend-api/prisma/sql/enable_rls_public.sql` and say so in the report.
4. **Never touch live vendor data.** Step N Rock and every real vendor: no edits to terms, invoices, payments, products, orders. Backfill scripts default to **dry-run**, print exactly what they would create, and write only with `--apply` (KSM runs that on the VM).
5. **Never delete posted financial documents.** After issue: cancel = reversing entry, correction = credit note. Soft-void only. No hard delete of anything that has posted to the books.
6. Move and wire existing screens before writing new ones. Check `docs/v2/COUNTER_BILLING_DESIGN.md` and any existing order / invoice / stock / product code first and **reuse** it where it works. Do not create a second model for something that already exists.
7. Old routes keep working: every moved or renamed route gets a redirect (query strings and dynamic segments kept, at least 180 days).
8. MARKETING role stays 403 on all commerce, pricing, billing and accounts routes.
9. A feature may be shown "Open" only with evidence it works (test id). Otherwise Coming soon. Locked only if built and not in plan (existing registry rule).
10. Vendors use their own payment gateways. Get4Domain's Razorpay is only for what the vendor pays Get4Domain.
11. KSM is the product owner, not a programmer: every user-facing error must be a plain sentence with what to do next. No raw validation dumps (see Bug B1).

---

## 3. PHASE 0 — AUDIT: DID IT WORK OR NOT (evidence first)

KSM's question: "products — did work or not?" Answer it with proof before building anything.

Method: using the isolated test database, seed one COMMERCE vendor (clone the shape of Step N Rock: products with sizes/colours, stock, a website, a customer, a website order) and run **every feature in `registry/features.ts`** end to end through the real API and, where UI-only, through the built frontend (Playwright is available).

Write `docs/v2/evidence/full-bos/AUDIT_2026-10-09.md` with one row per feature:

`feature id | department | what was tested | result: WORKS / PARTIAL / BROKEN / NOT BUILT | evidence (test id, response, screenshot) | fix size S/M/L`

Mandatory chains to test and report separately, step by step, stating the exact step where each breaks:

- **Chain A — Sell:** product → add to website cart → order placed → payment recorded → order status → customer record created/updated.
- **Chain B — Bill:** order or counter sale → customer invoice → share by WhatsApp/email link → receipt → outstanding amount.
- **Chain C — Stock:** product with stock tracking → sale reduces stock → low-stock alert → manual adjustment → stock history.
- **Chain D — Books:** every document above → ledger/day book → sales total, received, outstanding, GST collected.
- **Chain E — Product stores:** the three product stores (list them by table/module name) — which one does the website, the dashboard "My Products", orders and stock each read? Report every place two of them disagree.

Also test and record: Website Manager save (Bug B1), Payments screen save (Bug B2), the AI credit amount shown in three places (Bug B3).

Rules for the audit: do not fix while auditing, except to unblock a test. Commit the report first (`docs: full BOS audit`), then continue. The report decides the size of Phases 1–4: if a chain already works, wire and relabel; if not, build.

---

## 4. PHASE 1 — THE BUSINESS SPINE (one data model for the whole BOS)

Goal: one set of core records that every department reads and writes. Use existing models where the audit says they work; add only what is missing. Names below are intent, not mandatory.

1. **Party** (customer / supplier / both): name, phone, email, GSTIN optional, billing and shipping address, state (for GST place of supply), opening balance. Existing leads, CRM contacts and order customers link to a Party; they are not duplicated.
2. **Item** (product or service) — **the single item master**: name, SKU, HSN/SAC, unit, sale price, purchase price, GST rate, `trackStock` boolean, optional variants (size/colour). Phase 0 Chain E decides which existing store is canonical; the others become thin adapters or are migrated by a dry-run-first backfill. The website, "My Products", billing and stock all read Item. No second copy of price or quantity anywhere.
3. **Documents** with one numbering service (gapless series per vendor per financial year, configurable prefix, e.g. `SNR/26-27/0001`): Quote, Sales Order, Sales Invoice (name it so it can never be confused with Get4Domain's own `Invoice`/BillingDeal — e.g. `SalesInvoice`), Receipt (money in), Credit Note, Purchase Bill, Payment Out, Expense.
4. **StockMovement** — append-only ledger (item, variant, location, qty ±, reason, source document, who, when). On-hand = sum of movements. Never an editable "quantity" column as the source of truth (a cached on-hand column is fine if rebuilt from movements and covered by a test).
5. **Journal** — a simple double-entry posting layer: `JournalEntry` + `JournalLine` (account, debit, credit, source document). Chart of accounts seeded per vendor (Sales, Sales returns, Output GST CGST/SGST/IGST, Receivables, Cash, Bank/UPI, Gateway clearing, Purchases, Input GST, Payables, Stock, Expenses by category, Owner capital). One **posting service** creates balanced entries from documents inside the same database transaction as the document; idempotent (document id + version); cancellation posts a reversal.
6. **GST engine**: CGST+SGST vs IGST from vendor state vs customer/place-of-supply state; per-line rate; inclusive or exclusive prices; invoice-level rounding; HSN summary. Reuse `pricing-math.ts` ideas where they fit, but vendor-side tax math is its own module (Get4Domain's own GstMode logic is a different thing — do not mix them). e-Invoice / e-Way bill: out of scope for V2; list as "Not in V2" in the registry.
7. **Backfill script** `backend-api/scripts/bos-spine-backfill.js` — dry-run default: for each existing vendor derive Parties from orders/leads/CRM, Items from the canonical product store, opening StockMovements from current quantities, and **opening balances only**; never fabricate historic invoices or journal entries. Output a per-vendor table of what it would create. `--vendor <slug>` to limit, `--apply` to write.

Acceptance: a unit test suite for the posting service proves every document type produces a balanced entry and a reversal nets to zero; a property test proves on-hand stock equals the sum of movements after random sequences of sales, purchases, adjustments and cancellations.

---

## 5. PHASE 2 — SELL AND BILL (what Step N Rock actually needs first)

All of this ships complete; plans only gate parts (section 8).

1. **Customer invoices** (department Finance and Accounts → *Customer invoices*): create from scratch, from a Quote, from a website order, or from the counter (see 3). GST invoice and non-GST bill of supply, vendor logo/GSTIN/bank/UPI on the PDF, terms, notes, due date, discount, shipping. Draft → Issued → Part-paid → Paid → Cancelled(void).
2. **Share**: PDF download, public view link, one-tap WhatsApp share (wa.me deep link with the link prefilled — no paid API needed), email send via the existing email service. Shared link shows a clear "Pay now" only if the vendor has configured their own gateway.
3. **Receipts and outstanding**: record cash / UPI / bank / card / gateway payment against one or several invoices, part payments, advance receipts; outstanding list with ageing buckets (0–30, 31–60, 61–90, 90+); customer statement PDF; payment reminder message (copy/WhatsApp link).
4. **Counter billing** (use `COUNTER_BILLING_DESIGN.md`): fast item search/barcode field, quantity, discount, payment split, thermal-print-friendly view, issues a normal SalesInvoice + receipt + stock movement in one transaction.
5. **Website order → invoice**: an order that is paid or confirmed (vendor setting) automatically creates the SalesInvoice and receipt and reduces stock, once, idempotently (re-delivered webhooks must not double-post).
6. **Credit notes / returns**: against an invoice, optional restock, reverses tax and receivables.
7. **Vendor's own payment gateway** (Payments screen): Razorpay Key ID/Secret stored encrypted, validated format (`rzp_test_…` / `rzp_live_…`), "Test connection" button, never prefilled from any other field (Bug B2). UPI QR/ID for manual collection stored as a plain payment instruction. The vendor's gateway is used only for the vendor's customers.
8. **Navigation**: Get4Domain's own invoices to the vendor appear **only** under Your Get4Domain account → *Plan and billing*. The old sidebar "Invoices" entry is retired for vendors (redirect to *Customer invoices* with a one-time note "Your Get4Domain bills are now under Plan and billing"). Update old-dashboard labels too if nav_v2 is off for that vendor.

---

## 6. PHASE 3 — STOCK AND PURCHASES

1. Stock screen = Items with `trackStock` on: on-hand, reorder level, value, last movement. Items with tracking off say "Not tracked" (never "0 tracked").
2. Movements: sale (from invoice/POS/order), sale return, purchase receipt, manual adjustment (with reason: damaged, lost, opening, correction), transfer between locations. Every screen quantity comes from the movement ledger.
3. Low-stock alert on Home → Today panel and as an optional daily message.
4. Negative-stock policy per vendor: block / warn / allow (default warn).
5. **Purchases and suppliers**: supplier Party, purchase bill with GST input credit, payment out, payables list. Purchase receipt increases stock and updates Item purchase price (setting).
6. Variants (size/colour) work in sale, stock and website for COMMERCE vendors (Step N Rock sells footwear — this is the first real test).
7. Atomicity: reduce stock with a conditional update inside the transaction; two simultaneous sales of the last unit must not both succeed under the "block" policy. Cover with a concurrency test.

---

## 7. PHASE 4 — ACCOUNTS AND THE CA PACK

Built on the Journal; no separate data entry.

1. Expenses: category, vendor/supplier, GST, payment mode, attachment photo, recurring option.
2. Cash and bank book, day book, ledger by account, trial balance.
3. Reports: sales register, purchase register, receivables and payables ageing, **profit and loss**, balance sheet (simple), GST summary (GSTR-1 and GSTR-3B style tables, CSV/Excel), HSN summary, stock valuation, item-wise profit.
4. **CA pack**: one export per month/quarter/financial year — Excel workbook with all registers + PDF summary + attachments zip link. Not a filing integration.
5. Period lock: lock a month so posted documents in it cannot change (credit note/adjustment dated later instead).
6. Home → Today panel and the Accounts page use these same numbers (replace the current all-₹0 screen).
7. Label fix: the old nav item "Expenses" containing Accounts becomes **Accounts**; Expenses is a tab inside it.

---

## 8. PHASE 5 — PLAN-DRIVEN ENTITLEMENTS (the automatic switch)

1. Extend the registry so each feature carries: `minPlan` (ESSENTIALS|PRO|CUSTOM), optional named **limits** (e.g. `invoicesPerMonth`, `users`, `stockLocations`), and `capture: always | gated`. Capture-type features (posting, stock movement) are always on.
2. One server function `resolveEntitlements(vendorId)` combines: registry defaults ← plan (admin-editable `plan-access` config) ← active special arrangement ← admin per-vendor exception. Returns features + limits + reasons. Cache briefly; recompute on plan, term or arrangement change.
3. Enforce on the **API** (guard / decorator → HTTP 403 with code `PLAN_REQUIRED` and `{feature, requiredPlan}`), not only by hiding menus. The frontend renders Locked + UpgradeCard from that response.
4. Limit hits show friendly messages with upgrade action; they never lose or block already captured data.
5. **Starting default split (editable by KSM in admin; do not hard-code):**

| | BOS Essentials | BOS Pro |
|---|---|---|
| Customers, items, quotes | yes | yes |
| Sales invoices, receipts, share (WhatsApp/email), outstanding | yes | yes |
| Counter billing, website order → invoice | yes | yes |
| Stock tracking, single location, low-stock alert | yes | yes |
| Accounts page: sales, received, outstanding, simple expense list | yes (totals) | yes |
| Credit notes | yes | yes |
| Purchases, suppliers, payables, input GST | – | yes |
| Multi-location stock, transfers, stock valuation | – | yes |
| Ledger, day book, trial balance, P&L, balance sheet | – | yes |
| GST summary, HSN summary, CA pack export, period lock | – | yes |
| Recurring invoices, payment reminders on schedule | – | yes |
| Extra staff users and roles | 1 | up to plan limit |

6. **Upgrade/downgrade proof (automated):** an integration test that (a) creates a vendor on Essentials, (b) runs 30 days of sales, purchases-attempts (must be refused with PLAN_REQUIRED), stock moves, (c) upgrades to Pro through the real term/arrangement path, (d) asserts every earlier invoice, receipt, movement and journal entry is present and unchanged, Pro reports now return correct figures for the *whole* history, and nothing was re-entered or migrated, (e) downgrades, asserts Pro screens are Locked, data retained, new Essentials activity still posts, (f) upgrades again and asserts the Pro reports include activity from the downgraded period. This test is the guarantee KSM asked for.
7. Custom plan: unchanged (quote only, separate). Entitlements allow per-vendor extra features for Custom through the same function.

---

## 9. PHASE 6 — KNOWN BUG FIXES AND CLASS-WIDE AUDITS

Fix each reported bug AND audit its whole class across the codebase, adding a permanent guard (KSM's standing rule: one full audit, not incident patching).

- **B1 Website Manager save fails** with "property id / vendorId / businessHours / createdAt / updatedAt should not exist". Cause: the form sends back read-only fields and the API uses a strict whitelist. Fix at the source: update DTOs to be explicit for update payloads, and make shared form code send only editable fields. **Class audit:** every update (PATCH/PUT/POST-edit) endpoint with `forbidNonWhitelisted` against the frontend payload that calls it; fix all mismatches. **Guard:** a contract test that loads each edit form's payload shape against its DTO. Validation messages shown to the user are plain sentences (rule 11).
- **B2 Razorpay Key ID shows an email address.** Find why (autofill, wrong binding, or stored data). Fix binding, add `autocomplete="off"`, format validation. **Dry-run report** (read-only, no edits) of any vendor row where the key field is not `rzp_…`; list in the report for KSM to decide. **Class audit:** every credential/secret field in the dashboard.
- **B3 AI credit shows ₹250 in the term and ₹499 in the feature list.** One source of truth (term/plan config); every display reads it. **Class audit:** every price, credit, limit and plan name rendered in the vendor and marketing UI must come from config or the registry. **Guard:** a grep check that fails the build on hard-coded rupee amounts or plan names in frontend components (allow-list for marketing copy files that are generated).
- **B4 Plan feature list claims unproven things** (social posting, WhatsApp/SMS/email hub, backlinks, Google Analytics/Search Console, mobile apps). The vendor-facing feature list is generated only from registry state: Open → listed; Coming soon → listed as "Coming soon"; others → not listed.
- **B5 Legacy names** "DomainApp Startup/Essentials" in vendor UI → `planDisplayName` everywhere. Routes keep their old paths; renaming routes is Release 1B.
- **B6 Navigation labels**: Invoices / Accounts as in sections 5.8 and 7.7.
- **B7 Empty states**: Stock "0 tracked", Accounts all ₹0 — replaced by real numbers or a clear "Add your first …" empty state.

---

## 10. PHASE 7 — CONNECT THE REST OF THE BOS TO THE SPINE

Using Phase 0 results, for every other registry feature:

- **WORKS** → leave, keep its smoke test.
- **PARTIAL / BROKEN** → fix if size S or M; connect to Party/Item/Documents where relevant (e.g. CRM lead → Party → Quote → Invoice; appointment/booking → Invoice; website form → lead → Party; campaign results ← customer list).
- **NOT BUILT, part of the spine** (quotes, receipts, returns, purchases, expenses) → built in Phases 2–4.
- **NOT BUILT, outside the spine** (e.g. payroll, HR depth, AI agents, auto-calling, reels/video) → stay Coming soon, listed in `docs/v2/FULL_BOS_BACKLOG.md` with effort, dependency and suggested release. Do not silently build; do not hide.
- **Campaigns** (Allwin Tours holds campaign data, which blocked its switch): decide in the report — make Campaigns Open for vendors that have campaign data, or build the vendor screen if it is size S/M.
- Home → Today panel must show real numbers from the spine (sales today, collected, outstanding, low-stock, orders waiting).

---

## 11. PHASE 8 — INDUSTRY PROFILES ON THE SAME SPINE

Profiles (COMMERCE, SERVICES, APPOINTMENTS, LISTINGS, PACKAGES) only choose which items/screens are the default front door. The spine is shared: a salon invoice, a clinic bill, a tour package invoice and a footwear sale all go through the same SalesInvoice, receipt, journal. Verify with one seeded vendor per profile that invoice creation, receipt and the Accounts totals work. Profile differences are configuration, not forks.

---

## 12. PHASE 9 — PERMANENT GUARDS (added to CI / `npm run check`)

1. `registry/check.mjs` extended: every Open feature has a smoke-test id that exists and passes.
2. Migration guard: fails on DROP / destructive ALTER / NOT NULL-without-default in any new migration (allow-list needs a written reason).
3. DTO ↔ form payload contract test (Bug B1 class).
4. Hard-coded price/plan-name grep guard (Bug B3 class).
5. BOS chain end-to-end test (Chains A–D) and the upgrade/downgrade test (section 8.6) in the default test run.
6. Posting-service balance test, stock-ledger property test, stock concurrency test.
7. Route redirect test: every retired route returns a redirect.
8. A one-command `npm run bos:verify` at repo root that runs all of the above and prints PASS/FAIL per guard.

---

## 13. SLICES, COMMITS AND THE FINAL REPORT

Work in these slices; commit at the end of each, update `docs/v2/FULL_BOS_PROGRESS.md` (status per slice, decisions made, anything resumable), keep going without waiting for approval.

| Slice | Contents |
|---|---|
| S0 | Phase 0 audit report |
| S1 | Phase 1 spine, migrations, RLS script update, backfill script (dry-run) |
| S2 | Phase 2 sell and bill, Phase 6 B2/B5/B6 for those screens |
| S3 | Phase 3 stock and purchases |
| S4 | Phase 4 accounts and CA pack |
| S5 | Phase 5 entitlements and the upgrade/downgrade test |
| S6 | Phase 6 B1/B3/B4/B7 and class audits |
| S7 | Phases 7–8 sweep, backlog file |
| S8 | Phase 9 guards, docs (`docs/v2/FULL_BOS.md`, update STATUS, TASKS, FEATURE_MATRIX, PERMISSIONS, DEPLOYMENT), push to origin |

**Final report — reply in exactly this checklist form (each line: ☐ not started / ◐ in progress / ☑ complete, plus one line of evidence):**

- Audit: features tested, counts WORKS / PARTIAL / BROKEN / NOT BUILT; answer to "did products work?" in plain words; the exact step where Chains A–E break
- S1–S8 each: status, commit hash, test ids
- Upgrade/downgrade test: pass/fail
- `npm run bos:verify` output (pasted)
- Both builds: 0 errors (paste last lines)
- Migrations created (names), RLS script updated yes/no
- Bugs B1–B7: fixed yes/no, class-audit count of instances found/fixed
- Vendors with a wrong Razorpay key value (list, no edits made)
- Decisions made without asking KSM (list)
- Backlog: items left Coming soon, with effort
- Campaigns decision
- Anything not done and why
- Push to origin: commit hash on origin

---

## 14. VM DEPLOY STEPS (KSM — only after Claude confirms the report)

All of these go into the **VM terminal** (`ssh ksmwebtechservices@34.14.130.68`).

1. **Backup first.** In the Supabase dashboard open the project → Database → Backups and confirm a backup from today exists (or take one). Do not continue without it.
2. Pull and migrate:
   `cd /srv/get4domain-site && git pull origin get4domain-site`
   `cd backend-api && npx prisma migrate deploy && npx prisma generate`
3. **Supabase SQL editor** (browser): run the updated `backend-api/prisma/sql/enable_rls_public.sql`.
4. Rebuild both apps (long; wait for each):
   `cd /srv/get4domain-site/backend-api && docker compose build --no-cache && docker compose up -d --force-recreate`
   `cd /srv/get4domain-site/get4domain_mvp && docker compose build --no-cache && docker compose up -d --force-recreate`
5. Backfill dry-run, read it, paste it back to Claude:
   `cd /srv/get4domain-site/backend-api && mkdir -p dist && docker cp get4domain_backend:/app/dist/. ./dist/ && node scripts/bos-spine-backfill.js`
6. Only after Claude says the dry-run is right: `node scripts/bos-spine-backfill.js --apply` (start with `--vendor ksm-webtech-services`, then `--vendor stepnrock`).
7. Switch **ksm-webtech-services** to Dashboard v2 first (`node scripts/set-vendor-access.js --nav-v2` as in the 1A deploy notes), run the 7-point checklist plus: create an invoice, record a receipt, sell a tracked item, see stock fall, see Accounts totals move. Step N Rock follows only after that passes. Allwin Tours stays on the old dashboard until the Campaigns decision is deployed.
