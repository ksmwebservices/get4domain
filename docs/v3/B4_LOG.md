# B4 log: Wallet, services, service requests, theme switch (Stage 07)

Worktree `C:\Get4Domain\get4domain-b4`, branch `v3-b4`, from `origin/v3-b3` (`d056f93`). Dispatch: `docs/v3/stages/V3_DISPATCH/STAGE_07_WALLET_SERVICES_BATCH_4.md`. No push. No `.env.staging` in this worktree, so every staging step is written and marked NOT RUN. Dependencies installed with `npm ci` in `backend-api`.

## Gate check (5 November 2026)
`git fetch` ran. `origin/v3-b3` exists and equals the local `v3-b3` (`d056f93`). Its log carries the Batch 3 FINISH section of `docs/v3/B3_LOG.md` and the staging follow-up commits (`c0a1022`, `f98bb96`, `d056f93`). The owner's note of 5 November 2026 states: Batch 3 verified on staging by the owner and pushed as `v3-b3`; 7 migrations and both seeds applied; drift shows only the 2 allowed items; RLS-off 0; full `test:int` 34 of 34 suites and 373 of 373 tests; cleanup count 0. The gate is satisfied.

The same note answers the open questions: Free loses the 20 AI credits and the basic reports (accepted); a suspended vendor's sign-in stays blocked while the site stays listed as a Free listing-only site; the tax rate per item goes to Batch 13; the directory SUSPENDED fix and the set-password claim guard are the first tasks of Batch 4b (Stage 8). Neither of those two is part of this batch.

Branch note: the new branch was created from `origin/v3-b3` and its upstream was removed (`git branch --unset-upstream`) so a bare `git push` can never write to `v3-b3`.

## Baseline (before any change)
Unit suite (`npm run test:ci`) on `origin/v3-b3`: **99 suites, 2024 tests, all passing**. Route baseline: 978 routes (public 100, admin 330, authenticated 548). Admin role matrix oracle: 205 routes. Migration guards: `verify:migrations` 141 files; `verify-migrations-additive` 35 passed.

## Decisions that differ from the dispatch text (found while building; all recorded for the owner)
1. **The legacy wallet owns the name `g4d_wallets` and the folder `src/wallet/`.** The dispatch names the V3 table `g4d_wallets`, but that table, the Prisma model `Wallet`, and a whole module (`src/wallet/`, with its own `WalletService`) already exist and are live. Decision D1 says V3 must not read or write them. So the V3 wallet table is **`g4d_v3_wallets`** (model `V3Wallet`), the V3 code lives in **`src/v3-wallet/`**, and the service class is `V3WalletService`. The other table names are as in the dispatch (`g4d_wallet_ledger`, `g4d_wallet_topups`, `g4d_wallet_lots`; the receipts table is `g4d_wallet_receipts`). A tool that refused my first file write into `src/wallet/` because a file already existed there is what exposed the clash; I moved the files before anything was overwritten, and `git status` shows the legacy folder untouched. The static legacy check (`test/support/legacy-scan.ts`) now also lists `wallet` as a legacy top-level folder for every batch.
2. **Lots and the wallet are one data design, two migration folders.** The lot-aware core was written once (spending takes the oldest lot first from the very first charge), so slice 5.16a's code needs the lots table. The two folders exist in order (`..._v3_wallet`, then `..._v3_wallet_lots`) and the schema file carries all five models; both land in the commit of 5.16a. Slice 5.16a-2's remaining work (plan renewal from the wallet) is its own commit.
3. **Extra columns beyond the dispatch list** (all additive): ledger `balanceDeltaPaise`, `heldDeltaPaise`, `entryNo`, `holdId` (unique), `reversesId` (unique), `lotUsesJson`; wallet `entryCount`, `version`, `frozenReason`, `billingStateCode`, `billingGstin`; lot `source`. They make "a hold is settled once", "a charge is reversed once", gap-free replay by reconcile, and the tax profile possible. The vendor's tax profile lives on the wallet because the vendor record has no state.
4. **Activation reads data, not only events.** The dispatch asks for a listener on the PAID event and the subscription events; both exist (a small typed event bus, `src/common/activity-bus.ts`, which slice 5.20 will also listen to). Because an event can be lost between a commit and a listener, `syncActivation` also derives the answer from the plan order and subscription tables whenever a vendor looks at the wallet or starts a top-up. Both paths end in one compare-and-set, so activation happens exactly once (tested with 25 racing callers).
5. **A staff grant of Pro with no payment behind it does not open the wallet.** The dispatch says a Pro subscription "started with source SELF or STAFF-offline". Staff-offline is read as: the subscription's reason names a plan order (the settlement writes `plan order <id>`). A plain staff assignment, a registration, a migration or a promotion does not. OPEN QUESTION below.
6. **A top-up paid after its order expired is still credited.** The vendor paid; refusing would leave us holding their money with no credit and no refund (owner rule 3). The top-up moves to PAID, the receipt is numbered, and the audit row names it. A payment of the wrong amount or currency is never credited: it is audited as `wallet.topup.review` for staff.
7. **Receipts have their own series** (`RCT/<financial year>/<number>`, prefix editable) in the existing counter table (row key `RECEIPT:<financial year>`), so tax invoices for services (5.16c) can share the plan invoice series without gaps.
8. **The pool lesson, applied.** Every unit of work waits in the in-process `walletQueue` BEFORE the transaction opens; settings are read before a unit opens, never inside one (a static test scans for it). The in-memory twin simulates a pool of three connections and a test proves five vendors in parallel never use more than three.

## Slice 5.16a and 5.16a-2 (part 1): wallet, ledger, top-ups, receipts, lots, expiry
Built: `src/v3-wallet/` (pure core, store port, Prisma store, in-memory twin in `test/support`, engine, service, controllers, listener, cron), migrations `20261117100000_v3_wallet` and `20261118100000_v3_wallet_lots`, the top-up hook in the payment webhook, the `plan.order.paid` and `subscription.assigned` events, settings registered with the plan-settings API, the exception filter now passes the wallet codes and the shortfall numbers (the Batch 3 filter bug, avoided on purpose), the role matrix and the route baseline (14 routes: baseline 978 to 992, matrix oracle 205 to 213).

Red first: `wallet-core.spec.ts` failed with `Cannot find module '../src/wallet/core/wallet-core'` before the core existed; the route, role-matrix and tenant-registry guards failed on exactly the 14 new routes and 5 new models before they were classified.

Tests added: `wallet-core.spec.ts` (45, including a 6000-step seeded random walk of the invariants), `wallet-service.spec.ts` (42: activation exactly once, top-ups, replays, races, expiry, held money, oldest lot first, concurrency with a simulated pool, cross-tenant), `wallet-api.spec.ts` (15: owner only, team member refused, DTOs, MARKETING/OPERATIONS/SUPER_ADMIN, the shortfall reaching a client), `wallet-webhook.spec.ts` (10: top-up and plan payments through one webhook, plan behaviour unchanged), `wallet-schema.spec.ts` and `b4-isolation.spec.ts` (27), and `staging-harness-compile.spec.ts` gained the wallet option sets. `wallet.int.spec.ts` (staging: the trigger, the checks, the real pool, cleanup) is written and type-checked, **NOT RUN** (no `.env.staging`).

Checks run before the commit: `lint:ci` 0 errors; `npm run build` ok; unit suite **105 suites, 2174 tests, all passing** (was 99 and 2024: +6 suites, +150 tests); `verify:migrations` 143 files ok; `verify-migrations-additive` 37 passed; `verify:raw-sql` ok.

## Slice 5.16a-2 (rest): plan renewal from the wallet, the tax rule
Built: `PlanRenewalService` and `POST /v3/me/plan/renew-with-wallet`; `PlanOrderService.buildQuote` and `PaymentSettlementService.settleWithin` / `afterPaid` extracted from `create` and `settle` so the wallet path runs the SAME code as the online path (no copy of the quote or the settlement); `BillingTx.createOrder` and `BillingTx.walletTx` (the wallet's side of the billing transaction); `core/tax-core.ts`.

Red first: `wallet-tax.spec.ts` and `wallet-renewal.spec.ts` failed with `Cannot find module` before the code existed. The refactor was checked against the existing suites BEFORE the new code used it: billing settlement, orders, API, core, gate, reminders and flow, 186 tests, all unchanged and passing.

Decisions:
1. **The unit of work.** The dispatch says the charge and the term start happen "in the same unit of work" and that a failed term start is reversed with a REVERSAL entry. Both are built: one transaction; an application-level failure after the charge writes the REVERSAL inside the same transaction and closes the order; a database-level failure rolls everything back (a REVERSAL cannot be written into an aborted transaction, and none is needed: nothing was committed).
2. **No order is left behind by a short wallet.** The order is created inside the transaction (`BillingTx.createOrder`), so an INSUFFICIENT_WALLET refusal leaves nothing and the same key works after the top-up. After a failed term start a CANCELLED order remains (it records what happened) and its key reports the failure; a new key starts again.
3. **Plan renewal tax.** The wallet charges exactly the online amount (one quote). The new IGST / CGST plus SGST rule is used by the services slices; it is not retrofitted to plan invoices, which keep the single-rate breakdown they have today. OPEN QUESTION below.
4. **Activity events.** The typed bus now carries `plan.order.paid`, `subscription.assigned`, `wallet.activated`, `wallet.topup.credited`, `wallet.adjusted`, `wallet.frozen`, `wallet.unfrozen` and `wallet.expired`; later slices add the service and theme-switch events. No consumer exists yet (slice 5.20), which the dispatch accepts.

OPEN QUESTIONS from slice 5.16a (also in the final report):
- Whether a staff-granted Pro with no payment (a goodwill grant) should open the wallet. Built: it does not.
- The tax treatment of an advance (a top-up) and the wording of the receipt are for counsel. The receipt says it is a receipt for credit and not a tax invoice.
- `walletTopupMinPaise`, `walletTopupMaxPaise` (no defaults), and `walletSellerStateCode` (needed by the tax rule in the services slices) are for staff and the owner to set.
- **IGST versus CGST plus SGST wording, and the advance-receipt treatment** (accountant): the rule is built and tested; the invoice wording, whether a plan invoice paid from the wallet must be split into the same components, and how an advance (a top-up) is treated for tax are not decided here.

## Slice 5.16b: service catalogue, price book, add-on packs
Built: `src/v3-services/` (pure core, store port, Prisma store, in-memory twin in `test/support`, service, controllers, seed), migration `20261119100000_v3_services`, `scripts/seed-v3-services.js`, the harness option `services`, 20 routes (route baseline 993 to 1013; role-matrix oracle 213 to 229).

Red first: `services-core.spec.ts` failed with `Cannot find module '../src/v3-services/core/services-core'` before the core existed.

Tests added: `services-core.spec.ts` (30), `services-service.spec.ts` (29: price book, funding order, tax, plan state, packs, 40 parallel buyers, crash rollback, cross-tenant), `services-api.spec.ts` (11: public, owner only, MARKETING without money fields, only SUPER_ADMIN approves), `services-seed.spec.ts` (14: words only, one PROPOSED price, no APPROVED row, idempotent), `services-schema.spec.ts` (21). `services.int.spec.ts` (staging) is written and type-checked, **NOT RUN**.

Decisions:
1. **Enum name.** `V3PriceStatus` already exists for plan prices, so the service price status enum is `V3ServicePriceStatus`.
2. **"At most one approved effective price at a time"** is enforced by resolution plus a rule at approval, not by a partial unique index. A partial index is not something Prisma can describe, so it would show up as drift against the schema (the owner expects only the 2 allowed drift items). What is enforced: one row per service and start date (a real unique index), the price in force is always exactly one row (the latest started APPROVED), and approval refuses a date that is not later than the price in force.
3. **`effectiveFrom` is empty on a PROPOSED row** (a proposal has no date until it is approved). The seeded THEME_SWITCH proposal therefore has no date; approval requires one.
4. **Public catalogue lists only services that have a price in force.** The dispatch says the catalogue shows approved prices only; a marketing page that says "price not set" looks wrong, so unpriced services are left out of the public list (they still appear to a signed-in vendor as "Price not set").
5. **MARKETING reads the catalogue** (the dispatch: "read-only on non-money fields") through the same routes as other staff; the controller strips prices, proposals and amounts for that role (tested).
6. **Vendor routes are owner only.** The list shows the wallet and prices, and a pack purchase spends money.
7. **Features for allowances** are created by the loader as `services.included.<KEY>` (kind LIMIT) for the eleven non-theme services, with NO plan cell, so every plan resolves them as hidden (nothing included) until staff set values. THEME_SWITCH has none: its one included switch is a rule (5.16d), not a count. The allowance "used" count is read through `ServiceUsagePort`; slice 5.16c provides the real one (until then nothing is used).
8. **A pack tax invoice** is not issued in this slice. The charge is in the ledger with the tax snapshot on the purchase; 5.16c adds tax invoices for service charges and extends them to pack purchases if the accountant wants one (OPEN QUESTION).
9. **The filter** now also forwards a `problem` string (for example `EFFECTIVE_DATE_IN_PAST`, `RATES_MISSING`) so a client can tell why a price or a tax refusal happened.

OPEN QUESTIONS from this slice: whether a pack purchase needs its own tax invoice; which plans include how many of which services (staff set the `services.included.*` cells; none are seeded); whether the public catalogue should also list services with no price (built: it does not); the pack validity (`validityDays`) is null (no expiry) until staff set it per pack.

## Slice 5.16c: service requests with wallet holds and charges
Built: `src/v3-service-requests/` (pure state machine, store port, Prisma store, in-memory twin in `test/support`, service, controllers, cron, the promotion port), migration `20261120100000_v3_service_requests`, three new settings (`serviceMaxRevisions`, `serviceAutoApproveEnabled`, `serviceAutoApproveAfterDays`; none has a default that enables anything), 17 routes (route baseline 1013 to 1030; role-matrix oracle 229 to 239), the harness option `requests`.

Honest note on the red-first rule: `request-core.spec.ts` and the core were written in one step and run together (32 tests passed at first run); there is no separate red run for that file. For the rest of the slice the tests and code were written together and the failures below were found by running them.

What running the tests found (and what changed because of it):
1. **A production wiring bug**, caught by `staging-harness-compile.spec.ts` before any staging run: the requests module did not import the services module (for `ServicesStore`) or plan billing (for the billing settings). Both imports added.
2. **An error-order flaw in the funding rule**: a vendor with no open wallet who asked for a service was told "tax is not set up". The wallet's own state now comes before price and tax (`fundingChoice`), so such a vendor is told their wallet is not open. The 5.16b test that encoded the old order was changed to the new one, and a core test for the precedence was added.

Decisions:
1. **Hold, charge, release** are the wallet engine's HOLD, CHARGE (with `holdId`) and RELEASE entries; the hold is named by the request id (chosen before the insert), a hold is settled once (unique `holdId`), and the CHECK refuses a wallet request without its amount and hold.
2. **A pack unit or an allowance unit is reserved by counting open requests**, and consumed at approval; a cancelled or rejected request gives the unit back. The allowance count is per plan term (since the current subscription started), so a renewal starts a fresh count.
3. **A pack unit promised at request time is honoured at approval even if the pack has expired since.**
4. **The tax invoice is issued per CHARGE** (wallet-funded approvals). An allowance or pack approval charges nothing now, so it has no invoice; the pack's own purchase is the paid event (OPEN QUESTION whether it needs one, carried from 5.16b).
5. **Staff on behalf** goes through the same `create` as the vendor, with the vendor's wallet, funding and tax; the only differences are the creator type, the required reason, the history note and the audit action.
6. **The grant claim.** Creating the add-on override happens outside the database transaction (it uses the existing override service), so it is guarded by a claim on the request row (`grantOverrideId` set to PENDING by a compare-and-set) and healed by retry; the end date is the one staff set on the request. The code never chooses a length of time.
7. **Vendor routes are owner only**, like the wallet: a request holds and charges the vendor's money and carries the work product.
8. **`serviceMaxRevisions` is nullable with no default** and 0 is a valid answer; requests are refused while it is unset (the dispatch: "the loader requires staff to set it before enabling requests").

OPEN QUESTIONS from this slice: which plans include how many of which services (staff set the `services.included.*` cells); how many changes (`serviceMaxRevisions`) and whether to switch auto-approval on and after how many days; whether a vendor's team members may see requests (built: owner only); whether a service done by VENDOR only (none seeded) needs any request flow.

## 5.16d theme switch

Tests first: the core, service, API and schema specs were written before the code they exercise and failed on missing modules first. The staging spec `test/theme-switch.int.spec.ts` is written and NOT RUN (no `.env.staging` in this session).

What running the tests found: recovery could overwrite a newer switch (fixed with a conditional revert and per-vendor queueing); the wallet's state must come before price and tax in the error order; the filter now also forwards the `problem` field.

Decisions: preview renders the home page directly and stores nothing; a heuristic hidden-field record replaces the missing editable-fields map (content is never changed; deviation from the dispatch); self-service is wallet only; the first Pro switch is free; gifts and restores do not count as switches.

Protocol results: `lint:ci` 0 errors; `npm run build` ok; `test:ci` 120 suites, 2504 tests passed; `verify:migrations` 149/149; `verify-migrations-additive` 40/40; `verify:raw-sql` 929/929; route baseline 1036; role-matrix oracle 242.

OPEN QUESTIONS: whether a theme switch charge needs its own tax invoice; whether more than the first switch should be included on higher plans; the price (PROPOSED 29900 paise, staff approve it).

## Owner follow-up of 5 November 2026 (extra slices on v3-b4, tests first, no push)

Source: the OWNER PRICE DECISION ADDENDUM and the OWNER WALLET AND INVOICE ADDENDUM at the end of `STAGE_07_WALLET_SERVICES_BATCH_4.md` (found in the shared folder `C:\Get4Domain\get4domain-site\docs\v3\`, because the dispatch file is not in this worktree), plus the owner's note of the same day.

**Slice F1, owner price list (`f7e8757`).** Red first: the seed spec expected 23 services, the `OWNER_PRICE_SEED` export and 13 PROPOSED rows and failed on the missing export. The seed now holds the owner list (campaign, three reels, logo, single post, three hires, THEME_SWITCH, three message rates) as PROPOSED rows with `createdBy` and a note naming `OWNER_DECISION_2026_11_05`; it never writes an APPROVED row (the test still scans the code for the word). Decisions: (a) no effective date was given, so nothing is approved; (b) the campaign and the three messages are DRAFT services with no allowance feature, because their modules do not exist yet; (c) `REEL_PRODUCTION` became three reel kinds; (d) a service that already has any price row gets none; (e) the seed text contains no digit, time word, "lead" or promise of results (the campaign text says "no guarantee"). Plan prices and the POS campaign are not loaded (owner: TO CONFIRM).

**Slice F2, settings loader and the Pro-grant pin (`f43001e`).** `scripts/seed-v3-wallet-settings.js` with `src/v3-wallet/settings/wallet-settings-seed.ts`: sets `walletTopupMinPaise` = 99900 and nothing else, dry run by default, never over a staff value, audit row `setting.create`. The owner wrote `walletTopupMinPaise`; the addendum text says `walletMinTopupPaise`; the code key is `walletTopupMinPaise`, so that is what is set. A new service test proves a staff Pro grant with no payment does not open the wallet even when anything looks again.

**Slice 5.16e, GST on a refill and the tax invoice (`06beef4`).** Red first: the new refill tests failed on `creditPaise`, the tax lines and the invoice. The amount a vendor chooses is the credit; the provider order is for the credit plus GST; the lot and ledger take the credit; one TAX_INVOICE per refill from the shared series replaces the receipt; the minimum is on the credit. Migration `20261122100000_v3_wallet_refill_tax` adds `payablePaise` and `taxSnapshotJson` to `g4d_wallet_topups` (additive; `verify-migrations-additive` passes). Refills with no `payablePaise` (made before) keep their receipt. Routes: `GET /v3/me/wallet/topups/:id/invoice`, `GET /v3/me/wallet/usage-statement`.

**Slice 5.16f, deductions carry no tax and no invoice (`d829e30`).** `deductionOutcome` in the tax core; the services catalogue, the request hold and charge, the pack purchase and the theme switch quote use it. The request invoice, its insert, its view field and `GET /v3/me/service-requests/invoices` are removed (the table stays as history). Tests moved from "price plus tax" to "exactly the price" (poster 50000, pack 120000, theme switch 29900), and new tests prove no invoice and no document appear for a charge, twelve at once, and that the usage statement lists them.

**What running the tests found.** The first pack test of "sold with no seller state" wrote a purchase that broke a later assertion (moved into its own test). The campaign text said "Get4Domain" and the no-digit rule caught the 4 (reworded). The route baseline and the owner-only route list needed the three route changes (reviewed: 1036 to 1037, both new routes owner only).

**Protocol results.** unit suite 120 suites / 2504 tests before, **121 suites / 2538 tests after, all passing**; eslint (no --fix) 0 errors (14 warnings, none in files of this follow-up); `npm run build` ok (renderer built); `verify:migrations` 151/151; `verify-migrations-additive` 41/41 (the new folder passes); `verify:raw-sql` 931/931; route baseline 1036 to 1037 (reviewed diff: 2 added owner-only, 1 retired); secret scan over `59ec3ce..HEAD`: nothing found, no .env file in the range.

**Not run (and why).** All four `*.int.spec.ts` files touched here (wallet, services, requests, theme switch) were edited for the new money rules and are NOT RUN (no `.env.staging` in this session); the migration SQL, both loaders (`seed-v3-services.js`, `seed-v3-wallet-settings.js`) and `verify:db-lock` (needs a database URL) are NOT RUN. `verify:commercial` printed two FAILs, both in suites that run scripts of the separate Next.js app `get4domain_mvp` (admin nav config, workspace menu); nothing outside `backend-api` and `docs` was changed, and they were not investigated or compared with a clean baseline.

**Merge risk against the 72 modified files in the shared folder.** Compared with `git status` of `C:\Get4Domain\get4domain-site`: none of the 37 files this follow-up changes is among them (0 overlap). `prisma/schema.prisma` and the route baseline are the files most likely to conflict with other branches; both changes are small and additive.

OPEN QUESTIONS and the owner's staging commands for this follow-up are at the end of `docs/v3/V3_S7_BATCH4.md`.
