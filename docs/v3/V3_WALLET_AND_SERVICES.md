# V3 Wallet and Services: owner rules and data dictionary

Branch `v3-b4` (worktree `C:\Get4Domain\get4domain-b4`), from `origin/v3-b3` `d056f93`. Dispatch: `docs/v3/stages/V3_DISPATCH/STAGE_07_WALLET_SERVICES_BATCH_4.md`. Working log: `docs/v3/B4_LOG.md`. The reference for what was built (API contract, decisions, differences) is `docs/v3/V3_S7_BATCH4.md`, written at the end of the batch.

This file has two parts. Part 1 is the owner's rules, frozen on 4 November 2026, copied word for word from the dispatch. They are the specification: code, tests and texts follow them, and nothing in this file may weaken them. Part 2 is the data dictionary, filled in slice by slice as each migration lands.

---

## Part 1. OWNER RULES (frozen 4 November 2026)

1. Everything our team does for a vendor is a paid SERVICE, done only on request, charged to the vendor's wallet (or covered by a plan allowance or a prepaid pack). Self-service in the dashboard stays free within the plan. Vendors must be able to see what a service includes, who does it, how approval works and its price before they confirm.
2. The wallet is V3's own wallet and ledger. It does not read or write any legacy wallet table or constant (decision D1). It becomes ACTIVE for a vendor only after the vendor's first Pro plan term (quarterly, half-yearly or annual) is PAID. Free vendors have no wallet (locked preview). Vendors top up the wallet to buy add-on packs and services. The balance is kept when a plan expires; spending follows each service's plan-state rule (default: a service that needs Pro features can be bought only while Pro is ACTIVE or in grace; the balance is never deleted).
3. Money rules: integer paise end to end; append-only ledger; the balance never goes negative; no cash-out; NO refunds of any kind (plan, service and top-up money is never returned; a hold released on cancel or rejection, and a charge reversed after a system failure, are not refunds); unused credit expires one year after its top-up (consumed oldest first; an EXPIRY entry writes it off); credit pays services, packs, message sending and plan renewals; staff adjustments need a reason and SUPER_ADMIN. Get4Domain's own revenue only: this wallet never holds or moves a customer's payment for a vendor's goods or services.
4. THEME SWITCH SERVICE (the product term): one theme is included in the Pro subscription (the first Pro theme when a vendor upgrades from Free). A renewal does NOT give another free theme. Every later theme switch, at any time, is charged by the Theme Switch Service fee from the price book. The fee covers applying the chosen theme and migrating the vendor's content; it is a licence to use the theme while the vendor has the plan, not ownership of the theme. A vendor can switch themselves or ask our team (same fee; staff can also do it for the vendor, charging the wallet or marking it complimentary with a reason). Previewing a theme with the vendor's own content is free. If a plan expires and Pro returns, the stored theme is restored without a charge.
5. (EXTENDED on 5 November 2026: the price list is now the owner's, see the follow-up section at the end.) Prices: all prices come from the price book (admin-set, effective-dated, approved). The ONLY seeded price is a row for THEME_SWITCH of 29900 paise stated by the owner as the intended fee, seeded with status PROPOSED (never APPROVED by seed) so staff approve it. No other price is invented. No timeframes or prices in generated or seeded text.

---

## Part 2. Data dictionary

Filled in as each slice is built. Every table is additive, has row level security on (no policy: the backend role bypasses it, the same rule as every other public table), and carries its own migration folder.

### 5.16a and 5.16a-2: the wallet, its ledger, top-ups, receipts and lots

Migration folders, in order: `20261117100000_v3_wallet` (wallet, ledger, top-ups, receipts) then `20261118100000_v3_wallet_lots` (lots). Code: `backend-api/src/v3-wallet/`. The legacy wallet (`src/wallet`, table `g4d_wallets`) is not touched, imported or read: a static test (`b4-isolation.spec.ts`) enforces that.

| Table | Purpose |
|---|---|
| `g4d_v3_wallets` | one row per vendor: `status` (INACTIVE, ACTIVE, FROZEN), `balancePaise`, `heldPaise` (a CACHE of the ledger; reconcile checks it), `entryCount`, `version` (last-resort guard against two writers), `activatedAt`, `activatedByEventId`, `frozenReason`, `billingStateCode` and `billingGstin` (the vendor's tax profile). The database itself refuses a negative balance, negative held money and held above balance (`CHECK`). Named `g4d_v3_wallets` because `g4d_wallets` is the legacy table. |
| `g4d_wallet_ledger` | APPEND-ONLY (a trigger refuses every update and delete; the only delete allowed is the cascade of a wallet already gone). `kind` is one of the nine kinds; `amountPaise` is the effect on AVAILABLE money; `balanceDeltaPaise` and `heldDeltaPaise` are the exact effect on the two stored numbers and are what reconcile replays; `balanceAfterPaise`, `heldAfterPaise`, `entryNo` (1, 2, 3 per wallet), `refType` and `refId`, `idempotencyKey` (unique per wallet), `holdId` (unique: a hold is settled once), `reversesId` (unique: a charge is reversed once), `reason`, `actorType`, `actorId`, `lotUsesJson`, `at`. |
| `g4d_wallet_topups` | one row per attempt to add credit: `amountPaise`, `status` (CREATED, PENDING, PAID, FAILED, EXPIRED), `providerOrderId` (unique), `idempotencyKey` (unique per vendor), `paymentId`, `paidAmountPaise`, `paidAt`, `ledgerId`, `receiptId`. |
| `g4d_wallet_receipts` | the numbered document of a paid refill. SUPERSEDED on 5 November 2026: a new refill gets a TAX_INVOICE from the shared invoice series (see the follow-up section); RECEIPT (`RCT/...`) is only on refills made before. |
| `g4d_wallet_lots` | one lot per top-up (or positive staff adjustment): `amountPaise`, `remainingPaise`, `expiresAt`, `status` (OPEN, SPENT, EXPIRED). The lots always add up to the balance. |

Ledger kinds and the sign of `amountPaise` (the effect on available money): TOPUP +, ADJUSTMENT + or -, HOLD -, RELEASE +, CHARGE -, PACK_PURCHASE -, PLAN_RENEWAL -, REVERSAL +, EXPIRY -. A CHARGE that settles a HOLD moves both stored numbers (`balanceDeltaPaise` and `heldDeltaPaise` both negative) and leaves available unchanged.

Rules built into the code (`core/wallet-core.ts`, pure and tested with a seeded random walk of 6000 steps):
- Integer paise only; no transition can produce a negative balance, a negative held amount, held above balance, or lots that do not add up to the balance.
- Spending takes from the lot that expires first, then the one created first, then by id. A reversal puts the money back into the same lots. An EXPIRY entry writes off exactly the open remainder of lots past their date, never money that is held; running it twice changes nothing.
- The wallet opens (ACTIVE) only after a Pro plan order is PAID or a Pro subscription that a payment started (source SELF, or STAFF with a reason that names a plan order). It is also derived from the data whenever a vendor looks at the wallet or starts a top-up, so a missed event cannot leave a paying vendor without a wallet. Free-only vendors stay without one (locked preview).
- A top-up is refused until staff set `walletTopupMinPaise` and `walletTopupMaxPaise` (no default). The browser is never trusted: the signature is checked and the payment provider is asked; the amount and currency must match; a payment that arrives after the order expired is still credited; the same payment credits once however it arrives (confirm, webhook, replay, race).
- `INSUFFICIENT_WALLET` (409) carries `shortfallPaise` and, when the limits are set, `suggestedTopupPaise` (the shortfall, raised to the minimum, never above the maximum), `minTopupPaise`, `maxTopupPaise`.
- Settings (all in `g4d_plan_settings`, edited by SUPER_ADMIN): `walletTopupMinPaise` and `walletTopupMaxPaise` (no default), `walletCreditValidityDays` (default 365; a change applies to new top-ups only), `walletReceiptPrefix` (default `RCT`), `walletSellerStateCode` (empty until the owner supplies it), `walletExpiryTickEnabled` (default false).

API (all under the `v3` prefix; the envelope is the platform's `{ success, statusCode, message, data, timestamp }`):

| Route | Who |
|---|---|
| `GET /v3/me/wallet`, `GET /v3/me/wallet/ledger`, `GET /v3/me/wallet/topups` | Owner (a team member is refused) |
| `POST /v3/me/wallet/topups` `{ amountPaise, idempotencyKey }`, `POST /v3/me/wallet/topups/:id/confirm` `{ paymentId, signature }`, `PUT /v3/me/wallet/billing-profile` `{ stateCode, gstin }` | Owner |
| `GET /v3/admin/wallets`, `GET /v3/admin/wallets/reconciliation`, `GET /v3/admin/wallets/:vendorId`, `.../ledger`, `.../reconcile`, `POST /v3/admin/wallets/expiry-run` | OPERATIONS and SUPER_ADMIN (MARKETING refused) |
| `POST /v3/admin/wallets/:vendorId/adjustments` `{ amountPaise, reason, idempotencyKey }`, `PUT /v3/admin/wallets/:vendorId/frozen` `{ frozen, reason }` | SUPER_ADMIN only |

Top-ups share the existing Razorpay webhook: the dispatch first looks for a plan order (unchanged); only when there is none does it ask the wallet whether the provider order is a top-up (`TopupSettlementHook`). Event results: `TOPUP_CREDITED`, `TOPUP_ALREADY_PAID`, `TOPUP_REVIEW`, `NO_ORDER`.

### 5.16a-2 (rest): plan renewal from the wallet, and the tax rule

`POST /v3/me/plan/renew-with-wallet` (Owner only) `{ planKey, termMonths (3, 6 or 12), idempotencyKey, promoCode? }` buys or renews a Pro plan with wallet credit. It extends the slice 5.1b order flow with a payment source WALLET; the online (Razorpay) path and its tests are unchanged.

- **Same plan rules as online, price without GST (CHANGED 6 November 2026).** Both paths use one quote function (`PlanOrderService.buildQuote`); the wallet path asks it for no tax (`withTax: false`), so a plan paid from the wallet takes exactly the plan price after discounts and upgrade credit, because the refill already carried the GST. A plan paid directly (UPI, card, gateway, staff offline) keeps GST and its plan invoice. The amount comes from the plan tables, never from the request. A cheaper plan mid-term, a plan that cannot be bought and a term that is not offered are refused with the same codes as an online order.
- **One unit of work** (the plan billing transaction, with the vendor's turn awaited in the in-process queue first): create the order, charge the wallet (ledger kind PLAN_RENEWAL, key `renew:<order id>`), then run the settlement body (`PaymentSettlementService.settleWithin`): order PAID with source WALLET, the term started through the existing subscription service, NO plan invoice (the refill has the one tax invoice, and the shared series gets no number from this path), the audit row. All together or none of it.
- **A short wallet** is 409 `INSUFFICIENT_WALLET` with `shortfallPaise`, `availablePaise`, `requiredPaise` and, when the limits are set, `suggestedTopupPaise`, `minTopupPaise`, `maxTopupPaise`. The unit is abandoned: no order, no ledger entry, no change. The same request key works after a top-up.
- **A term that cannot start after the charge** gives the charge back with a REVERSAL entry (the money never left the wallet: not a refund), closes the order (CANCELLED) and answers 409 `WALLET_RENEWAL_INVALID` ("nothing was charged"). That request key then reports the same failure; a new key starts a new attempt. If the database itself fails the whole transaction rolls back, wallet and plan together.
- **Exactly once.** The same key returns the first result (`replay: true`); twelve parallel submits charge once; a key used for a different plan, or by an online order, is `IDEMPOTENCY_CONFLICT`.
- It works while online payments are switched off, and after the plan has run out (the balance is kept; the renewal is then a NEW term).
- A subscription started this way has source SELF, so the wallet-activation rule treats it like any paid term.

**The tax rule** (`core/tax-core.ts`, pure): a buyer in the SAME state as Get4Domain is taxed with CGST plus SGST; a buyer in ANOTHER state with IGST. The rows are recognised by name (IGST, CGST, SGST) in `g4d_tax_rates`, honouring active, the start date and the category (`appliesTo`, the exact category before ALL); nothing in code knows a rate. Without a seller state (`walletSellerStateCode`), a buyer state (the wallet's billing profile) or the needed rows the answer is a plain reason and the caller refuses to sell ("tax not set up"). Integer paise, half up per line; an inclusive price keeps its total and the last line absorbs the rounding, so the lines always add up. The services slices use it for the tax invoice of each charge. Plan renewals from the wallet carry no tax (see above); whether plan invoices paid directly must be split into IGST or CGST plus SGST is an accountant question (OPEN QUESTIONS).

### 5.16b: the service catalogue, the price book and add-on packs

Migration folder `20261119100000_v3_services`. Code: `backend-api/src/v3-services/`. Seed: `node scripts/seed-v3-services.js` (dry run by default, `--apply`, staging guard).

| Table | Purpose |
|---|---|
| `g4d_services` | one row per service: `key` (unique), `name`, `shortDescription`, `includesText` (what it includes), `approvalText` (how approval works), `kind`, `doneBy` (VENDOR, TEAM, EITHER), `deliveryKind` (INSTANT, TEAM_REQUEST), `planStateRule` (PRO_ACTIVE_OR_GRACE, the default, or ANY; editable), `trackScope` (empty = every track), `publicVisible`, `sortOrder`, `status` (DRAFT, ACTIVE, RETIRED). |
| `g4d_service_prices` | the price book: `amountPaise` (a CHECK keeps it above zero), `currency`, `taxCategory`, `taxInclusive`, `effectiveFrom` (empty while PROPOSED), `status` (PROPOSED, APPROVED, RETIRED), `approvedBy`, `approvedAt`. A CHECK refuses an APPROVED row with no date or no approver. One row per service and start date. |
| `g4d_addon_packs` | `key`, `name`, `description`, `itemsJson` (`[{ serviceKey, count }]`), `validityDays` (null = does not expire; a number is set by staff), `status` (DRAFT by default). |
| `g4d_addon_pack_prices` | the same shape as the service prices. |
| `g4d_pack_purchases` | what a vendor bought: `remainingJson` (counts that run down), `priceSnapshotPaise` and `taxSnapshotJson` (copied, so a later price never changes what was paid), `purchasedAt`, `expiresAt`, `ledgerEntryId` (unique: one purchase per ledger entry), `idempotencyKey` (unique per vendor). |

Rules:
- **No price is invented.** A price is PROPOSED by staff (OPERATIONS or SUPER_ADMIN), APPROVED by a SUPER_ADMIN with an effective date, and only then in force. The price in force is the APPROVED row with the latest start date that has started. Approval needs a date that is not in the past (a minute of clock difference is forgiven), is later than the price in force, and is not the same instant as another row of that service. A service with no price in force shows "Price not set" and cannot be bought with money. Approving never changes the amount. Retiring the newest price brings the previous approved one back into force.
- **The seed** (extended on 5 November 2026, see the follow-up section: 23 services and 13 PROPOSED owner prices) created at first the twelve services (words only: no price and no length of time appears in any text) and ONE PROPOSED price: THEME_SWITCH, 29900 paise, no start date, `createdBy` "seed". It never writes an APPROVED row (the word is not in its code; a test checks that). It also creates the plan-allowance features `services.included.<KEY>` (kind LIMIT) for the eleven services other than THEME_SWITCH, with no value for any plan: staff set inclusions in the admin tools; until then nothing is included.
- **Funding order** (owner rule 1): an unused plan allowance, then a pack, then the wallet. An allowance or a pack needs no price and no wallet. The wallet pays only when ACTIVE and its AVAILABLE money covers the whole amount; otherwise the answer is the exact shortfall.
- **Tax** is worked out by the tax rule of 5.16a-2 from `g4d_tax_rates`, the wallet's billing profile (the vendor's state) and `walletSellerStateCode`; if it cannot be worked out the service says "tax not set up" and is not sold.
- **Plan state and track.** The default is that a service can be bought only while the Pro plan is ACTIVE or in grace; a service set to ANY can be bought in any plan state; a track scope limits who is offered it. A pack can be bought only if every service in it could be bought now.
- **Packs** are bought from the wallet in one unit of work with the ledger entry (kind PACK_PURCHASE); the same key returns the same purchase; use takes from the pack that expires first.

API:

| Route | Who |
|---|---|
| `GET /v3/public/services` | public, cacheable (`max-age=300`): visible, active services with an approved price in force; nothing internal |
| `GET /v3/me/services`, `GET /v3/me/packs`, `POST /v3/me/packs/:key/purchase` `{ idempotencyKey }` | Owner |
| `GET /v3/admin/services`, `GET /v3/admin/services/:key`, `GET /v3/admin/packs`, `GET /v3/admin/packs/:key` | all staff; MARKETING gets no money field |
| `POST /v3/admin/services`, `PUT /v3/admin/services/:key`, `POST /v3/admin/services/:key/prices`, `PUT /v3/admin/services/prices/:id`, and the same four for `/v3/admin/packs` | OPERATIONS and SUPER_ADMIN |
| `POST /v3/admin/services/prices/:id/approve` `{ effectiveFrom }`, `POST .../retire`, and the same two for `/v3/admin/packs/prices/:id` | SUPER_ADMIN only |

### 5.16c: service requests (team work paid by allowance, pack or wallet)

Migration folder `20261120100000_v3_service_requests`. Code: `backend-api/src/v3-service-requests/`.

| Table | Purpose |
|---|---|
| `g4d_service_requests` | `status` (REQUESTED, ACCEPTED, IN_PRODUCTION, READY_FOR_REVIEW, REVISION_REQUESTED, APPROVED, REJECTED_BY_TEAM, CANCELLED), `briefJson` (checked per service), `attachmentRefs`, `fundingKind` (INCLUDED_ALLOWANCE, PACK, WALLET), `priceSnapshotPaise` and `taxSnapshotJson` (price plus tax at the time of the request), `holdLedgerId` and `chargeLedgerId` (both unique), `packPurchaseId`, `assignedStaffId`, `slaDueAt`, `slaBreachedAt`, `readyAt`, `revisionsUsed`, `grantEndsAt` and `grantOverrideId` (the custom domain promotion only), `createdByType` (VENDOR, STAFF_ON_BEHALF), `idempotencyKey` (unique per vendor). CHECKs: a WALLET request always has its amount and its hold, the others have no hold; the amount is positive. |
| `g4d_service_request_events` | the history: APPEND-ONLY (a trigger refuses every update and every delete, except the cascade of a request already gone). |
| `g4d_service_deliverables` | the finished work: `kind` TEXT, FILE_REF or LINK. |
| `g4d_service_invoices` | RETIRED on 5 November 2026 (a deduction has no invoice; nothing writes here any more, the rows stay as history). It was one tax invoice per charge, numbered from the SAME gap-free series as plan invoices (`g4d_invoice_counters`, key = the financial year); APPEND-ONLY like the history. |

The money (owner rule 1; nothing is charged for work the vendor has not approved):
- **Make a request**: funding is chosen in the order allowance, pack, wallet. A WALLET request HOLDS price plus tax in the same unit of work that writes the request (so a short wallet writes nothing and answers `INSUFFICIENT_WALLET` with the shortfall and the top-up that covers it). An allowance or pack unit is set aside by counting the vendor's open requests, so one unit cannot be promised twice.
- **Approve** (the vendor, or the auto-approval timer): the hold becomes ONE `CHARGE` of exactly that amount (no invoice since 5 November 2026), or one pack unit is used (honoured even if the pack's date passed after the request was made), or an allowance unit stays used. Approving again, or twelve times at once, changes nothing.
- **Cancel** (vendor, before IN_PRODUCTION) and **reject** (the team, with a reason of at least five characters, at any open stage) release the hold. Nothing is charged.
- **Changes**: the vendor may ask for changes up to `serviceMaxRevisions`; until staff set that number (0 is allowed) no request can be made.
- **Staff on behalf**: a staff member can raise a request for a vendor with a reason; same funding rules; audited; the vendor sees it in their list ("our team"), its history (with the reason) and the hold in their ledger.
- **The custom domain promotion**: it cannot go to review without the end date staff set (`grantEndsAt`); on approval the add-on override is created ONCE through the existing audited path (`CanonicalSwitchService.grantAddon`) with that end date. If switching it on fails the request stays APPROVED and charged, the failure is recorded, and the grant is retried by `POST /v3/admin/service-requests/:id/retry-grant` or healed by an approve replay.
- **Timers**: an SLA breach is marked once per request (route and hourly tick); auto-approval is OFF unless `serviceAutoApproveEnabled` is on AND `serviceAutoApproveAfterDays` is set.

The state machine (pure, `core/request-core.ts`): REQUESTED to ACCEPTED, REJECTED_BY_TEAM (team) or CANCELLED (vendor); ACCEPTED to IN_PRODUCTION, REJECTED_BY_TEAM (team) or CANCELLED (vendor); IN_PRODUCTION to READY_FOR_REVIEW (team, needs a deliverable) or REJECTED_BY_TEAM; READY_FOR_REVIEW to APPROVED (vendor or the timer), REVISION_REQUESTED (vendor, under the limit) or REJECTED_BY_TEAM (team); REVISION_REQUESTED to IN_PRODUCTION or REJECTED_BY_TEAM (team). APPROVED, REJECTED_BY_TEAM and CANCELLED are final. Every other combination of status, target and actor is refused (a test enumerates all 192).

API:

| Route | Who |
|---|---|
| `POST /v3/me/service-requests` `{ serviceKey, brief, attachmentRefs?, idempotencyKey }`, `GET /v3/me/service-requests`, `GET /v3/me/service-requests/:id`, `POST .../:id/cancel`, `POST .../:id/approve`, `POST .../:id/revision` `{ note }` | Owner (another vendor's request answers exactly like one that does not exist) |
| `GET /v3/admin/service-requests` (filters: serviceKey, status, fundingKind, vendorId, slaBreached), `GET .../:id`, `POST .../:id/assign`, `POST .../:id/status` `{ to: ACCEPTED, IN_PRODUCTION or READY_FOR_REVIEW }`, `POST .../:id/deliverables`, `POST .../:id/reject` `{ reason }`, `POST .../:id/retry-grant`, `POST .../sla-sweep`, `POST .../auto-approve-run`, `POST /v3/admin/vendors/:vendorId/service-requests` (on behalf, with a `reason`) | OPERATIONS and SUPER_ADMIN (MARKETING refused) |

(Later slices add their sections below.)

## Slice 5.16d: theme switch

Data (`g4d_theme_switches`, model `V3ThemeSwitch`, migration `20261121100000_v3_theme_switch`): vendorId, siteId, fromThemeKey, toThemeKey, kind (`FREE_INCLUDED`, `PAID`, `COMPLIMENTARY_STAFF`, `RESTORE`), performedByType and performedById, serviceRequestId, ledgerEntryId (unique: one switch per charge), packPurchaseId, priceSnapshotPaise, taxSnapshotJson, publicationId (the publication the switch made), status (`PENDING`, `APPLIED`, `FAILED`), idempotencyKey (unique per vendor), reason, failureReason, hiddenFieldsJson. The database refuses: a PAID switch with nothing that paid, a free or restoring switch that carries a charge, a gift with no reason (5 characters or more), and a non-positive price.

Rules:
1. The first switch on Pro is included (`FREE_INCLUDED`). Later switches are `PAID` at the approved THEME_SWITCH price plus tax, charged from the wallet. A staff gift (`COMPLIMENTARY_STAFF`, reason required) and an automatic restore (`RESTORE`) charge nothing and do not count as a switch.
2. A preview draws the theme with the vendor's own content and stores nothing (no publication, no switch row, no ledger entry).
3. A switch is a saga: a PENDING row and the CHARGE are written in one unit, then the site pipeline applies the theme (settings, build, publish as a NEW publication; the previous one is kept so rollback works), then the row becomes APPLIED. If the pipeline fails, the theme setting is put back, the charge is reversed (REVERSAL) and the row becomes FAILED. A stale PENDING row is finished or reversed by recovery.
4. The wallet's own state (not open, frozen) is reported before a missing price or tax rate.
5. Content is never modified by a switch. Fields the new theme does not use are recorded in `hiddenFieldsJson` (heuristic) and come back if the vendor switches back.
6. Self-service is wallet only. Packs are used through a team service request.

API:

| Route | Who |
|---|---|
| `POST /v3/me/site/theme/preview` `{ themeId }`, `POST /v3/me/site/theme/switch` `{ themeId, idempotencyKey }`, `GET /v3/me/site/theme/history` | Vendor owner only |
| `POST /v3/admin/vendors/:vendorId/site/theme/switch` `{ themeId, idempotencyKey, funding: COMPLIMENTARY or WALLET, reason }`, `GET /v3/admin/vendors/:vendorId/site/theme/history`, `POST /v3/admin/theme-switches/recover` `{ olderThanMinutes }` | OPERATIONS and SUPER_ADMIN |

Stable codes: `THEME_ALREADY_ACTIVE`, `THEME_NOT_ALLOWED`, `THEME_SWITCH_PLAN_STATE`, `THEME_SWITCH_FAILED`, `THEME_SWITCH_INVALID`, `THEME_SWITCH_FREE_USE_DIRECT`, `THEME_SWITCH_NOT_FOUND`, plus the wallet codes (`INSUFFICIENT_WALLET` with `shortfallPaise` and `requiredPaise`).

## Owner follow-up of 5 November 2026 (slices 5.16e and 5.16f, and the two loaders)

These rules REPLACE the earlier wording above wherever they differ (the earlier lines are kept as history and marked).

### The money model, in one place
- **A refill adds GST on top.** The vendor chooses the credit (the amount before GST, at least the staff minimum). `POST /v3/me/wallet/topups` works out the GST (CGST plus SGST in the same state, IGST in another; rates only from `g4d_tax_rates`) and asks the payment provider for the credit plus GST. The credit added to the wallet and to the one-year lot is the amount **before** GST. If the seller state, the vendor's billing state or the rates are missing, the refill is refused with `409 TAX_NOT_CONFIGURED` and a `problem` (`SELLER_STATE_MISSING`, `BUYER_STATE_MISSING`, `RATES_MISSING`); no order is made. The minimum is measured on the amount before GST.
- **One tax invoice per refill, and only for a refill.** It is issued in the same unit of work as the credit, numbered from the SAME gap-free series as plan invoices (`g4d_invoice_counters`, key = the financial year), from the tax worked out when the refill was made (`g4d_wallet_topups.taxSnapshotJson`), stored in `g4d_wallet_receipts` with `documentType` TAX_INVOICE. Idempotent (a double confirm, a webhook replay and a race issue one). The vendor reads it at `GET /v3/me/wallet/topups/:id/invoice`. A refill made before this change keeps its RECEIPT (`payablePaise` is empty on those rows); nothing new takes that path.
- **A deduction carries no GST and no invoice.** A service request, a pack, a theme switch (and later a message or a campaign) takes exactly its price (`deductionOutcome`, `core/tax-core.ts`): a ledger line and a line of the usage statement. Prices exclude GST; GST was paid at the refill. The request invoice and `GET /v3/me/service-requests/invoices` are retired (the table `g4d_service_invoices` stays, append-only, as history; nothing writes to it).
- **Usage statement.** `GET /v3/me/wallet/usage-statement?from&to` (owner only): the lines where credit was used (CHARGE, PACK_PURCHASE, PLAN_RENEWAL, and REVERSAL against them), newest first, with totals (used, reversed, net, by kind) and a note that only a refill has a tax invoice. A plan paid from the wallet is a line like any other deduction and has no invoice (`hasInvoice` is always false). Holds, releases, refills, expiries and adjustments are not usage. Errors: `WALLET_STATEMENT_PERIOD_INVALID` (400).
- **No refunds, ever; credit lasts one year from each refill** (lots, oldest first, expiry job as before); the expiry date is on each lot.
- **A staff Pro grant with no payment does not open the wallet.** The wallet opens only after the first PAID Pro order or a Pro subscription a payment started (already so; now pinned by a service-level test).

### Data (additive, migration `20261122100000_v3_wallet_refill_tax`)
`g4d_wallet_topups`: `payablePaise` INTEGER null (credit plus GST; null on a pre-change refill) with a CHECK that it is not below `amountPaise`; `taxSnapshotJson` JSONB default `{}` (taxable, tax, total, lines, intraState, buyer and seller state codes, buyer GSTIN). No other table changes.

### The topup view
`amountPaise` and `creditPaise` are the credit (before GST); `taxPaise`; `payablePaise` (what the vendor pays); `tax: { intraState, lines }`. The wallet view carries `topup.gstAddedOnTop: true`.

### The owner price list (OWNER PRICE DECISION ADDENDUM) as seeded
Source `OWNER_DECISION_2026_11_05`, whole paise, excluding GST, written as **PROPOSED** rows with no date by `scripts/seed-v3-services.js` (dry run by default); a SUPER_ADMIN approves each with an effective date (the owner gave no date, and the seed never approves). A service that already has any price row is left alone.

| Service key | Paise | Per |
|---|---|---|
| THEME_SWITCH (owner-approved 5 November) | 29900 | switch |
| CAMPAIGN (draft service) | 99900 | campaign |
| REEL_SLIDESHOW / REEL_CORPORATE / REEL_CINEMATIC | 49900 / 99900 / 299900 | reel |
| LOGO_DESIGN / POST_DESIGN | 29900 / 9900 | logo / single post |
| SEO_MANAGER_HIRE / CONTENT_CREATOR_HIRE / BLOG_CREATOR_HIRE | 99900 each | keyword / content piece / campaign |
| MESSAGE_SMS / MESSAGE_EMAIL / MESSAGE_WHATSAPP_MARKETING (draft services) | 55 / 10 / 95 | message, charged on delivery |

The catalogue is now 23 services (was 12): `REEL_PRODUCTION` is replaced by the three reel kinds, and logo, post, the three hires, the campaign and the three messages are new. The campaign and the messages are **DRAFT** (priced for the record, never offered until their modules exist) and have no plan-allowance feature; 18 services get a `services.included.*` feature (was 11). Not loaded, by the owner's own mark TO CONFIRM or because the owner did not price them: the POS campaign (not built), the plan prices and the term discount percentages, and a price for the poster, the document design, the search task and the older help services.

### The settings loader
`scripts/seed-v3-wallet-settings.js` (dry run by default, `--apply` explicit, staging guard, audit row) sets only `walletTopupMinPaise = 99900`, never over a value staff already set. The maximum, `walletSellerStateCode`, `serviceMaxRevisions`, the auto-approval days, plan allowances, pack validity and the term discount percentages stay unset: refills stay refused (no maximum, no seller state) and requests stay off until staff set them.
