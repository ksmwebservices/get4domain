# V3 Stage 7, Batch 4: wallet and services

Branch `v3-b4` (worktree `..\get4domain-b4`), from `origin/v3-b3` (`d056f93`). Full data dictionary, owner rules (verbatim) and per-slice API tables: `docs/v3/V3_WALLET_AND_SERVICES.md`. Per-task log: `docs/v3/B4_LOG.md`.

## Slices and commits

| Slice | Commit | Migration folder | New routes |
|---|---|---|---|
| B4.0 owner rules | `0acbda4` | none | 0 |
| 5.16a wallet and ledger | `9f3ceca` | `20261117100000_v3_wallet`, `20261118100000_v3_wallet_lots` | 14 |
| 5.16a-2 renewal from wallet, tax rule | `7fff059` | none | 1 |
| 5.16b catalogue, price book, packs | `eb92517` | `20261119100000_v3_services` | 20 |
| 5.16c service requests | `f45b1c9` | `20261120100000_v3_service_requests` | 17 |
| 5.16d theme switch | `5b9b6f9` | `20261121100000_v3_theme_switch` | 6 |

Route baseline 978 to 1036 (+58, none removed). Admin role-matrix oracle 205 to 242. Unit suite 99 suites / 2024 tests to 120 suites / 2504 tests, all passing. `lint:ci` 0 errors, build ok, `verify:migrations` 149/149, `verify-migrations-additive` 40/40, `verify:raw-sql` 929/929.

## Rules in one place

- Money is integer paise. Balance, held and available (balance minus held). The ledger is append-only (database trigger) with kinds TOPUP, HOLD, RELEASE, CHARGE, REVERSAL, EXPIRY, ADJUSTMENT, PACK_PURCHASE, PLAN_RENEWAL. Each top-up is a one-year lot, consumed oldest first; expiry writes off only the open remainder, never held money.
- The wallet opens only after a PAID Pro order or a Pro subscription a payment started. A suspended or frozen wallet refuses spending and says so before any price or tax message.
- Tax: same state as the seller is CGST plus SGST, other state is IGST, rates only from `g4d_tax_rates` rows. A missing rate or state refuses the charge; nothing is assumed.
- Prices are PROPOSED by staff and APPROVED by SUPER_ADMIN with an effective date; the price in force is the latest started APPROVED row. Funding order for a service: allowance, then pack, then wallet.
- Service requests: HOLD when asked, CHARGE only when the vendor approves, RELEASE on cancel or rejection; the tax invoice comes from the shared gap-free series.
- Theme switch: first Pro switch included; later ones charged from the wallet; staff gifts and restores charge nothing. It is a saga with a reversal if the publish fails.
- Locks wait in the in-process per-vendor queue BEFORE a transaction opens. No Redis, no BullMQ.

## Decision log

1. The legacy `g4d_wallets` table and `src/wallet/` exist and are out of scope, so the V3 module is `src/v3-wallet/`, the table `g4d_v3_wallets`, the service `V3WalletService`.
2. `postEntry` is the only ledger writer; other modules write their rows in the same transaction through `WalletTx.db`.
3. Plan renewal reuses the plan billing quote and settlement code in one transaction rather than a second implementation.
4. "At most one APPROVED effective price" is enforced by resolution and approval rules and a unique (service, effectiveFrom), not a partial index (avoids schema drift).
5. A pack unit or allowance unit is reserved by counting open requests, and given back on cancel or rejection.
6. The custom-domain promotion grant happens outside the database transaction, so it is guarded by a claim on the request row with retry.
7. Wallet, request and theme-switch vendor routes are owner only; staff routes are OPERATIONS and SUPER_ADMIN (price approval SUPER_ADMIN only).
8. Theme preview renders the home page directly and stores nothing.

## Differences from the dispatch

- Module and table names carry the V3 prefix (decision 1).
- No editable-fields map exists, so hidden fields are a heuristic record; content is never changed.
- `request-core.spec.ts` was written together with its core, so there is no separate red run for that file (stated in the log).
- The seed dry run could not be run (no staging access in this session); it is an owner step below.

## NOT RUN

Every `*.int.spec.ts` of this batch (wallet, services, requests, theme switch), the seed dry run and `--apply`, the migrations, drift and RLS checks. Reason: no `.env.staging` in the build session and production and staging access are stop-lines.

## Open questions

Top-up and advance tax treatment and receipt wording; IGST versus CGST plus SGST wording on invoices; whether plan invoices paid from the wallet must split taxes; `walletTopupMinPaise`, `walletTopupMaxPaise` and `walletSellerStateCode` values; `serviceMaxRevisions` and auto-approval days; included allowances per plan; whether pack purchases and theme-switch charges need tax invoices; which services need Pro state; whether a staff Pro grant with no payment should open the wallet; pack validity; the THEME_SWITCH price (PROPOSED 29900 paise, needs SUPER_ADMIN approval).
