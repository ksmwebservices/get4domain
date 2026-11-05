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
| Follow-up 1: owner price list in the services seed | `f7e8757` | none | 0 |
| Follow-up 2: refill minimum loader, staff Pro grant test | `f43001e` | none | 0 |
| 5.16e GST on a refill, tax invoice per refill, usage statement | `06beef4` | `20261122100000_v3_wallet_refill_tax` | +2 |
| 5.16f a deduction has no GST and no invoice | `d829e30` | none | -1 |

Route baseline 978 to 1036 (+58, none removed); after the owner follow-up below 1037 (+2 new, 1 retired). Admin role-matrix oracle 205 to 242. Unit suite 99 suites / 2024 tests to 120 suites / 2504 tests, all passing. `lint:ci` 0 errors, build ok, `verify:migrations` 149/149, `verify-migrations-additive` 40/40, `verify:raw-sql` 929/929.

## Rules in one place

- Money is integer paise. Balance, held and available (balance minus held). The ledger is append-only (database trigger) with kinds TOPUP, HOLD, RELEASE, CHARGE, REVERSAL, EXPIRY, ADJUSTMENT, PACK_PURCHASE, PLAN_RENEWAL. Each top-up is a one-year lot, consumed oldest first; expiry writes off only the open remainder, never held money.
- The wallet opens only after a PAID Pro order or a Pro subscription a payment started. A suspended or frozen wallet refuses spending and says so before any price or tax message.
- Tax (CHANGED 5 November 2026): GST is added ON TOP of a refill and the credit is the amount before GST; the refill has the ONE tax invoice, from the shared gap-free series. Same state as the seller is CGST plus SGST, other state is IGST, rates only from `g4d_tax_rates` rows; a missing rate or state refuses the refill (`TAX_NOT_CONFIGURED`). A deduction (service, pack, theme switch, later messages and campaigns) takes exactly its price, with no tax and no invoice: a ledger line and a usage statement line.
- Prices are PROPOSED by staff and APPROVED by SUPER_ADMIN with an effective date; the price in force is the latest started APPROVED row. Funding order for a service: allowance, then pack, then wallet.
- Service requests: HOLD the price when asked, CHARGE only when the vendor approves, RELEASE on cancel or rejection; no invoice (the refill has it).
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
- (5 November 2026) The seed is no longer the single proposed price: it carries the owner price list as 13 PROPOSED rows (source `OWNER_DECISION_2026_11_05`), because the owner gave no effective date and the seed never approves a price. `REEL_PRODUCTION` was replaced by three reel kinds in the same pass (safe: the seed had not yet been applied anywhere).

## NOT RUN

Every `*.int.spec.ts` of this batch (wallet, services, requests, theme switch), the seed dry run and `--apply`, the migrations, drift and RLS checks. Reason: no `.env.staging` in the build session and production and staging access are stop-lines.

## Open questions

Top-up and advance tax treatment and receipt wording; IGST versus CGST plus SGST wording on invoices; whether plan invoices paid from the wallet must split taxes; `walletTopupMinPaise`, `walletTopupMaxPaise` and `walletSellerStateCode` values; `serviceMaxRevisions` and auto-approval days; included allowances per plan; whether pack purchases and theme-switch charges need tax invoices; which services need Pro state; whether a staff Pro grant with no payment should open the wallet; pack validity; the THEME_SWITCH price (PROPOSED 29900 paise, needs SUPER_ADMIN approval).

## Owner follow-up of 5 November 2026

Done as extra slices on `v3-b4`, tests first, no push. Full rules and the data change: the follow-up section of `docs/v3/V3_WALLET_AND_SERVICES.md`; the log: `docs/v3/B4_LOG.md`.

1. **Owner price list loaded** into the services seed (dry run by default): campaign 99900, reels 49900 / 99900 / 299900, logo 29900, single post 9900, SEO manager / content creator / blog creator 99900 each, and the three message rates 55 / 10 / 95 paise, all excluding GST, source `OWNER_DECISION_2026_11_05`, as PROPOSED rows (a SUPER_ADMIN approves each with a date). THEME_SWITCH 29900 is owner-approved and carries that note; it too waits for a SUPER_ADMIN date. Nothing marked TO CONFIRM is loaded (POS campaign, plan prices, term discounts).
2. **Refill minimum**: `scripts/seed-v3-wallet-settings.js` sets `walletTopupMinPaise = 99900` only. Everything else the owner has not decided stays unset, so refills stay refused until staff set the maximum and the seller state, and requests until staff set the revision limit.
3. **Invoices**: a tax invoice per refill (GST on top, credit before GST); none for a deduction; a usage statement instead. Migration `20261122100000_v3_wallet_refill_tax` (two columns and a check on the top-up).
4. **A staff Pro grant with no payment never opens the wallet** (already true; now pinned by a service test).
5. **THEME_SWITCH 29900 paise** approved by the owner (still a dated approval by a SUPER_ADMIN before it can be charged).

Results: unit suite 120 suites / 2504 tests before, **121 suites / 2538 tests after, all passing**; eslint (no --fix) 0 errors (14 warnings, none in files of this follow-up); `npm run build` ok (renderer built); `verify:migrations` 151/151; `verify-migrations-additive` 41/41 (the new folder passes); `verify:raw-sql` 931/931; route baseline 1036 to 1037 (reviewed diff: 2 added owner-only, 1 retired); secret scan over `59ec3ce..HEAD`: nothing found, no .env file in the range.

### New OPEN QUESTIONS (accountant and owner)

- *Accountant, from the owner:* time of supply and the wording of GST on a prepaid wallet refill (advance and voucher treatment); the treatment of expired credit; the expiry wording on the invoice. The refill invoice note is a plain placeholder (`Tax invoice for credit added to your wallet. GST is added to the amount of credit.`).
- *Plan renewal from the wallet* (built in 5.16a-2, not in the owner's list of deductions): it still charges the plan price WITH the plan billing quote's GST and issues a plan invoice, so GST on a plan paid from refilled credit would be counted twice (at the refill and again on the plan invoice). The owner's list says services, packs, theme switch, messages and campaigns; the plan is the open case. Left unchanged; owner to decide.
- *The owner gave no effective date* for any price: each PROPOSED row needs a SUPER_ADMIN approval with a date.
- *Mapping of the hire prices* (the addendum reads "per keyword, per content piece or per campaign"): built as SEO manager per keyword, content creator per content piece, blog creator per campaign. Confirm.
- *Unit economics of a message (owner asked for the note):* provider cost against price per message is NOT recorded here and nothing was invented. Check the current Meta India marketing rate for WhatsApp (price 95 paise), the SMS provider cost including DLT charges (price 55 paise) and the email provider cost (price 10 paise) before switching the messaging module on. The three message services are DRAFT until Batch 6.
- *Walletreceiptprefix* (`walletReceiptPrefix`) is now used only for refills made before this change; nothing new uses it.
- *`taxInclusive` on a price row* is ignored for a deduction (the owner's prices exclude GST and a deduction carries none); staff should leave it false.
- Still open from before: `walletTopupMaxPaise` and `walletSellerStateCode` values, `serviceMaxRevisions`, auto-approval days, included allowances per plan, pack validity, term discount percentages, which services need Pro state.

### Owner staging commands, in this order

`npm.cmd` from `C:\Get4Domain\get4domain-b4\backend-api` unless stated. The migration list is the whole batch: six folders (the new one is last).

1. Copy `.env.staging` into the worktree root `C:\Get4Domain\get4domain-b4\` (it is not in git).
2. `npm.cmd ci` then `npx.cmd prisma generate`.
3. `npm.cmd run db:staging:migrate-status` (expect these pending, in order: `20261117100000_v3_wallet`, `20261118100000_v3_wallet_lots`, `20261119100000_v3_services`, `20261120100000_v3_service_requests`, `20261121100000_v3_theme_switch`, `20261122100000_v3_wallet_refill_tax`), then `npm.cmd run db:staging:migrate-deploy`, then `npm.cmd run db:staging:migrate-status` (expect none pending).
4. `npm.cmd run db:staging:rls-off` (expect no table without RLS), then `npm.cmd run db:staging:drift` (expect the 2 documented allowed items only).
5. `npm.cmd run build`.
6. Services and the owner price list: `node scripts/seed-v3-services.js` (dry run: expect 23 services and 13 owner price rows to create, 18 allowance features), then `node scripts/seed-v3-services.js --apply`, then the dry run again (expect nothing to create).
7. Refill minimum: `node scripts/seed-v3-wallet-settings.js` (dry run: expect `walletTopupMinPaise = 99900`), then `node scripts/seed-v3-wallet-settings.js --apply`, then the dry run again (expect it already set).
8. Staff, in the admin tools, before any refill is tried: set `walletTopupMaxPaise`, `walletSellerStateCode`, and make sure the IGST, CGST and SGST rows exist in the tax rates; SUPER_ADMIN approves the prices (each with an effective date) that should go live; set `serviceMaxRevisions` to switch requests on.
9. `npm.cmd run test:int` (all suites; the wallet, services, requests and theme-switch specs were updated for GST on a refill and for no invoice on a deduction, and have NOT been run).
10. `npm.cmd run test:cleanup-staging -- --count` (must print 0).
11. Only after a clean run: `git push origin v3-b4` (the single push command; not run by the build session, and a push starts a Vercel preview deploy).
