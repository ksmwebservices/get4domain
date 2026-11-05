# V3 Wallet and Services: owner rules and data dictionary

Branch `v3-b4` (worktree `C:\Get4Domain\get4domain-b4`), from `origin/v3-b3` `d056f93`. Dispatch: `docs/v3/stages/V3_DISPATCH/STAGE_07_WALLET_SERVICES_BATCH_4.md`. Working log: `docs/v3/B4_LOG.md`. The reference for what was built (API contract, decisions, differences) is `docs/v3/V3_S7_BATCH4.md`, written at the end of the batch.

This file has two parts. Part 1 is the owner's rules, frozen on 4 November 2026, copied word for word from the dispatch. They are the specification: code, tests and texts follow them, and nothing in this file may weaken them. Part 2 is the data dictionary, filled in slice by slice as each migration lands.

---

## Part 1. OWNER RULES (frozen 4 November 2026)

1. Everything our team does for a vendor is a paid SERVICE, done only on request, charged to the vendor's wallet (or covered by a plan allowance or a prepaid pack). Self-service in the dashboard stays free within the plan. Vendors must be able to see what a service includes, who does it, how approval works and its price before they confirm.
2. The wallet is V3's own wallet and ledger. It does not read or write any legacy wallet table or constant (decision D1). It becomes ACTIVE for a vendor only after the vendor's first Pro plan term (quarterly, half-yearly or annual) is PAID. Free vendors have no wallet (locked preview). Vendors top up the wallet to buy add-on packs and services. The balance is kept when a plan expires; spending follows each service's plan-state rule (default: a service that needs Pro features can be bought only while Pro is ACTIVE or in grace; the balance is never deleted).
3. Money rules: integer paise end to end; append-only ledger; the balance never goes negative; no cash-out; NO refunds of any kind (plan, service and top-up money is never returned; a hold released on cancel or rejection, and a charge reversed after a system failure, are not refunds); unused credit expires one year after its top-up (consumed oldest first; an EXPIRY entry writes it off); credit pays services, packs, message sending and plan renewals; staff adjustments need a reason and SUPER_ADMIN. Get4Domain's own revenue only: this wallet never holds or moves a customer's payment for a vendor's goods or services.
4. THEME SWITCH SERVICE (the product term): one theme is included in the Pro subscription (the first Pro theme when a vendor upgrades from Free). A renewal does NOT give another free theme. Every later theme switch, at any time, is charged by the Theme Switch Service fee from the price book. The fee covers applying the chosen theme and migrating the vendor's content; it is a licence to use the theme while the vendor has the plan, not ownership of the theme. A vendor can switch themselves or ask our team (same fee; staff can also do it for the vendor, charging the wallet or marking it complimentary with a reason). Previewing a theme with the vendor's own content is free. If a plan expires and Pro returns, the stored theme is restored without a charge.
5. Prices: all prices come from the price book (admin-set, effective-dated, approved). The ONLY seeded price is a row for THEME_SWITCH of 29900 paise stated by the owner as the intended fee, seeded with status PROPOSED (never APPROVED by seed) so staff approve it. No other price is invented. No timeframes or prices in generated or seeded text.

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
| `g4d_wallet_receipts` | one numbered RECEIPT per paid top-up (`documentType` RECEIPT, never a tax invoice; its own series `RCT/<financial year>/<number>`, gap-free). |
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

- **Same price as online.** Both paths use one quote (`PlanOrderService.buildQuote`): the amount comes from the plan tables, never from the request. A cheaper plan mid-term, a plan that cannot be bought and a term that is not offered are refused with the same codes as an online order.
- **One unit of work** (the plan billing transaction, with the vendor's turn awaited in the in-process queue first): create the order, charge the wallet (ledger kind PLAN_RENEWAL, key `renew:<order id>`), then run the settlement body (`PaymentSettlementService.settleWithin`): order PAID with source WALLET, the term started through the existing subscription service, the plan invoice from the shared gap-free series, the audit row. All together or none of it.
- **A short wallet** is 409 `INSUFFICIENT_WALLET` with `shortfallPaise`, `availablePaise`, `requiredPaise` and, when the limits are set, `suggestedTopupPaise`, `minTopupPaise`, `maxTopupPaise`. The unit is abandoned: no order, no ledger entry, no change. The same request key works after a top-up.
- **A term that cannot start after the charge** gives the charge back with a REVERSAL entry (the money never left the wallet: not a refund), closes the order (CANCELLED) and answers 409 `WALLET_RENEWAL_INVALID` ("nothing was charged"). That request key then reports the same failure; a new key starts a new attempt. If the database itself fails the whole transaction rolls back, wallet and plan together.
- **Exactly once.** The same key returns the first result (`replay: true`); twelve parallel submits charge once; a key used for a different plan, or by an online order, is `IDEMPOTENCY_CONFLICT`.
- It works while online payments are switched off, and after the plan has run out (the balance is kept; the renewal is then a NEW term).
- A subscription started this way has source SELF, so the wallet-activation rule treats it like any paid term.

**The tax rule** (`core/tax-core.ts`, pure): a buyer in the SAME state as Get4Domain is taxed with CGST plus SGST; a buyer in ANOTHER state with IGST. The rows are recognised by name (IGST, CGST, SGST) in `g4d_tax_rates`, honouring active, the start date and the category (`appliesTo`, the exact category before ALL); nothing in code knows a rate. Without a seller state (`walletSellerStateCode`), a buyer state (the wallet's billing profile) or the needed rows the answer is a plain reason and the caller refuses to sell ("tax not set up"). Integer paise, half up per line; an inclusive price keeps its total and the last line absorbs the rounding, so the lines always add up. The services slices use it for the tax invoice of each charge. Plan renewals from the wallet use the plan quote's own tax (exactly the online amount); whether plan invoices must also be split into IGST or CGST plus SGST is an accountant question (OPEN QUESTIONS).

(Later slices add their sections below.)
