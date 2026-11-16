# V3 Wave 3 backend: pricing, checkout, gateways, auto invoice, cash, trial, themes, referrals

Branch `v3-w3` (from `v3-w2`). Code only: **nothing here was applied to any database and nothing was pushed.** Source of requirements: `WAVE3_BACKEND_PROMPT.md` (owner decisions of 17 Nov 2026). The frontend contract is `API_CONTRACT_WAVE3.md`; the job log is `DISPATCH_STATUS_A.md`, the morning report `DISPATCH_REPORT_A.md`.

## 0. What existed, what was built

Reuse rule: build only what is missing. The payment machinery of slice 5.1b (`src/plan-billing`) was extended, not duplicated.

| Area | Before Wave 3 | Wave 3 |
|---|---|---|
| Roles | `AdminRole` SUPER_ADMIN, MARKETING (= SALES), OPERATIONS, SUPPORT, ADMIN | + FIELD_EXECUTIVE, TELECALLER (folded into SALES when the principal is built, so they hold exactly SALES rights) and REFERRAL_PARTNER (a separate principal, `/v3/partner/*` only) |
| Partners | none | `g4d_referral_partners`, admin CRUD, partner portal |
| Public pricing | `GET /v3/plans` (no GST amounts, no add-ons) | `GET /v3/public/pricing` |
| Payment port | `RazorpayPort`, Razorpay TEST adapter only | `PaymentGatewayPort` over Razorpay (test and live) and Cashfree (test and live), in-memory fake for tests; admin setting; both OFF by default |
| Webhooks | Razorpay | + Cashfree; one generic signed, idempotent handler through the port |
| Invoice | made on payment | + lines, gateway payment id or cash reference on the page, mail recorded as pending |
| Offline settle | SUPER_ADMIN, any reason | CASH only, ADMIN and SUPER_ADMIN, every detail required, on an admin-made cash order |
| Discounts | promo code and discount rules in the quote | none: the quote is price book plus GST, the promo input is gone, price writes are SUPER_ADMIN only |
| Trial signup | register + optional Free plan | chosen subdomain, mandatory reserved names, availability check, replay safe, live Free trial site, paid-plan next step, SALES (and labels) may put a business live |
| Themes | plan feature `site.themes`, switch fee from the wallet | catalogue per pack and the owner's choice view (read only) |
| Referrals, commission | none | links, attribution, slabs, ledger, month close, payouts, partner portal |
| Wallet top-up | Razorpay only | through the payment port, either gateway |

## 1. Migrations (written, verified by `verify:migrations`, NOT applied)

| Folder | What it does |
|---|---|
| `20261220100000_v3_wave3_roles_partners` | enum values FIELD_EXECUTIVE, TELECALLER, REFERRAL_PARTNER; table `g4d_referral_partners` (RLS on) |
| `20261220110000_v3_wave3_gateways` | `g4d_plan_orders.gateway` (razorpay, cashfree, cash), `gatewayClientToken` |
| `20261220120000_v3_wave3_referrals_commission` | `g4d_referral_links`, `g4d_referral_attributions`, `g4d_commission_slabs` (empty), `g4d_commission_ledger`, `g4d_commission_payouts` (all RLS on, no policy) |
| `20261220130000_v3_wave3_wallet_gateway` | `g4d_wallet_topups.gateway`, `gatewayClientToken` |

All additive. No seed value for the slabs.

## 2. Routes

Full request and response shapes: `API_CONTRACT_WAVE3.md`. New or changed:

| Route | Who |
|---|---|
| `GET /v3/public/pricing` | public, cached 5 min |
| `GET /v3/public/subdomain-availability?name=` | public, never cached |
| `GET /v3/public/referral/:code` | public |
| `GET /v3/public/themes?pack=KEY` | public, cached 5 min |
| `GET /v3/me/site/themes` | owner |
| `POST /v3/me/billing/orders` (changed: gateway, clientToken; no promo field) | owner |
| `POST /v3/me/billing/orders/:id/confirm` (body optional for Cashfree) | owner |
| `POST /v3/me/billing/orders/:id/cancel` | owner |
| `POST /v3/payments/cashfree/webhook` | signature only |
| `GET`, `PUT /v3/admin/payment-gateway` | read OPERATIONS, ADMIN, SUPER_ADMIN; write ADMIN, SUPER_ADMIN |
| `POST /v3/admin/billing/vendors/:vendorId/cash-orders` | ADMIN, SUPER_ADMIN |
| `POST /v3/admin/billing/orders/:id/mark-paid` (changed: cash only) | ADMIN, SUPER_ADMIN |
| `GET`, `POST /v3/admin/partners`, `GET`, `PUT /v3/admin/partners/:id` | read OPERATIONS+; write ADMIN, SUPER_ADMIN |
| `GET`, `POST /v3/admin/partners/:id/links`, `POST /v3/admin/referral-links/:id/disable` | read OPERATIONS+; write ADMIN, SUPER_ADMIN |
| `GET`, `POST /v3/admin/commission/slabs`, `PUT .../slabs/:id` | read OPERATIONS+; write ADMIN, SUPER_ADMIN |
| `POST /v3/admin/commission/months/:month/close` | ADMIN, SUPER_ADMIN |
| `GET /v3/admin/commission/ledger`, `.../ledger/export.csv`, `GET`, `POST /v3/admin/commission/payouts` | read OPERATIONS+; payout write ADMIN, SUPER_ADMIN |
| `GET`, `PUT /v3/admin/vendors/:id/referral`, `POST .../referral/change` | read OPERATIONS+; set ADMIN, SUPER_ADMIN; change SUPER_ADMIN only |
| `GET /v3/partner/me`, `/link`, `/vendors`, `/commission`, `/payouts` | referral partner only |
| `GET /auth/me` (changed: name, role for every principal) | any signed-in |

`POST /auth/register` also accepts `subdomain` and `referralCode`.

## 3. Role matrix (as data, `src/auth/guards/admin-role-matrix.ts`)

- SALES labels: `staffRoleOf`/`JwtStrategy` fold FIELD_EXECUTIVE and TELECALLER into MARKETING; the label travels as `staffLabel`. Tests prove a label gets the same answer as SALES on every admin route.
- Price writes (service and pack prices, domain margins, plans, tax rates, discount rules, plan settings) are SUPER_ADMIN only.
- Cash order and confirmation, gateway setting, partners, links, slabs, month close, payouts: ADMIN and SUPER_ADMIN. OPERATIONS reads. SALES, SUPPORT, labels refused.
- Changing an existing referrer: SUPER_ADMIN only (its own route).
- Go-live of a seeded or created business: opened to SALES (and so the labels) as well as OPERATIONS, ADMIN, SUPER_ADMIN.
- The route baseline (`test/baselines/route-classification.json`) and the matrix oracle (`test/admin-role-matrix.spec.ts`, 411 routes) were regenerated; each diff was only the new routes.

## 4. Error codes (all registered with the exception filter)

Billing: `GATEWAY_SETTING_INVALID`, `GATEWAY_NOT_READY`, `LIVE_NOT_ENABLED`, `CASH_ONLY`, `CASH_DETAILS_INVALID`, `CASH_ORDER_INVALID`, plus the existing `PAYMENTS_DISABLED`, `PAYMENTS_NOT_CONFIGURED`, `PAYMENT_SIGNATURE_INVALID`, `PAYMENT_NOT_CAPTURED`, `PAYMENT_PROVIDER_ERROR`, `ORDER_STATE_INVALID`, `OFFLINE_AMOUNT_MISMATCH`.
Partners: `PARTNER_INVALID`, `PARTNER_NOT_FOUND`, `PARTNER_EMAIL_TAKEN`, `PARTNER_STAFF_LINK_INVALID`, `PARTNER_ONLY`, `PARTNER_SCOPE_REFUSED`.
Referrals and commission: `REFERRAL_SELF_REFERRAL`, `REFERRAL_ATTRIBUTION_EXISTS`, `REFERRAL_ATTRIBUTION_INVALID`, `REFERRAL_VENDOR_NOT_FOUND`, `REFERRAL_PARTNER_INACTIVE`, `REFERRAL_LINK_NOT_FOUND`, `REFERRAL_CODE_FAILED`, `COMMISSION_SLAB_INVALID`, `COMMISSION_SLAB_NOT_FOUND`, `COMMISSION_MONTH_INVALID`, `COMMISSION_MONTH_NOT_CLOSED`, `COMMISSION_NOTHING_TO_PAY`, `COMMISSION_PAYOUT_EXISTS`, `COMMISSION_PAYOUT_INVALID`.
Themes: `THEME_PACK_NOT_FOUND`. Signup reuses `SUBDOMAIN_INVALID`, `SUBDOMAIN_RESERVED`, `HOST_UNAVAILABLE`.

## 5. Settings and flags

| Setting or flag | Default | Effect |
|---|---|---|
| plan setting `paymentsMode` | off | off, test or live (set with the gateway) |
| plan setting `paymentGateway` | razorpay | which gateway checkout uses (via `PUT /v3/admin/payment-gateway`) |
| plan setting `registrationProvisioning` | false | the Free plan AND the live Free trial site at self registration |
| `EMAIL_LIVE_SEND` (existing) | off | the invoice mail; off records it as pending |
| `DIRECTORY_PUBLIC_BASE_URL` | unset | directory on its own host, no `/directory` prefix |

## 6. Environment variable NAMES (never values; all listed in `.env.live.example`)

`PLAN_PAYMENTS_LIVE_ENABLED`; Razorpay `RAZORPAY_TEST_KEY_ID`, `RAZORPAY_TEST_KEY_SECRET`, `RAZORPAY_TEST_WEBHOOK_SECRET` (existing), `RAZORPAY_LIVE_KEY_ID`, `RAZORPAY_LIVE_KEY_SECRET`, `RAZORPAY_LIVE_WEBHOOK_SECRET`; Cashfree `CASHFREE_TEST_APP_ID`, `CASHFREE_TEST_SECRET_KEY`, `CASHFREE_LIVE_APP_ID`, `CASHFREE_LIVE_SECRET_KEY` (the Cashfree secret key also signs its webhooks); `DIRECTORY_PUBLIC_BASE_URL`. Live needs the setting live AND `PLAN_PAYMENTS_LIVE_ENABLED=true` AND that gateway's live keys.

## 7. Choices to check

1. Live mode exists only on the new port; the old `PaymentsGate.port()` (used by older wallet code paths) still has no live branch and its test is unchanged.
2. Held payments (amount or currency mismatch, money for a cancelled or expired order) go to REVIEW and nothing resolves them yet (question 5).
3. The four `/v3/admin/discount-rules` routes still exist (additive-only) but no checkout reads them (question 6).
4. Price writes were tightened to SUPER_ADMIN; the oracle and the tests that encoded the old rule were updated.
5. Go-live opened to SALES because the owner said field executives and telecallers make sites live.
6. Cash orders are admin-made (gateway `cash`); cash cannot settle an online order, a held one or a closed one.
7. A theme is not sold per theme through a gateway checkout in V3 (it is a plan feature plus a wallet-paid switch fee); see assumption 17.
8. The J3 migration was edited in place (to allow `cash`) before anything applied it.

## 8. Open questions (also in `DISPATCH_STATUS_A.md`)

Term totals: none needed, the price book holds a total per term. GST rate: the tax-rate table is the source; the owner confirms the value. OPERATIONS and cash: currently refused. Commission on a reversed payment already paid out: flagged for the owner, nothing taken back. Partner payout details: a bank or UPI reference only. Resolution of held gateway payments. Retiring the discount-rule routes. Where a vendor's state should come from for the partner portal.

## 9. Owner staging commands, in order (PowerShell, from `C:\Get4Domain\get4domain-w2\backend-api`, on branch `v3-w3`)

1. `npm.cmd run db:staging:migrate-status` (expect the four new folders `20261220100000`, `110000`, `120000`, `130000` pending).
2. `npm.cmd run db:staging:migrate-deploy`.
3. `npm.cmd run db:staging:rls-off` (expect `0` tables without row level security), then `npm.cmd run db:staging:drift` (expect the 2 documented allowed items only).
4. `npm.cmd run build`, then `npm.cmd run test:ci` (expect 276 suites green).
5. Seed scripts: **none are needed for Wave 3** (the commission slabs are deliberately empty). The existing plan seed is unchanged: if you want to re-check it, `node scripts/seed-v3-plans.js` as a dry run first, then `--apply` only if it reports something to create.
6. Each integration file alone, output saved, for example: `npx.cmd jest --ci --runInBand test/payments-gateways.int.spec.ts --selectProjects int 2>&1 | Tee-Object -FilePath .\payments-gateways.int.log`, then the same for `test/checkout-invoice.int.spec.ts`, `test/cash-confirmation.int.spec.ts`, `test/trial-signup.int.spec.ts`, `test/referrals-commission.int.spec.ts`, `test/partner-portal.int.spec.ts`.
7. `npm.cmd run test:cleanup-staging -- --count` (must print 0). The cleanup now also removes the Wave 3 partners, links, attributions, ledger, payouts and the slabs made by synthetic staff (proved by `test/wave3-cleanup.spec.ts`).
8. Push only after reading the logs: `git push -u origin v3-w3` (a push creates a Vercel preview).
9. Before turning anything on: set the gateway keys and `PLAN_PAYMENTS_LIVE_ENABLED` only on the VM, then `PUT /v3/admin/payment-gateway` as ADMIN or SUPER_ADMIN. Both gateways stay OFF until then.

## 10. Tests

Unit: `wave3-roles`, `wave3-pricing`, `wave3-gateways`, `wave3-invoice`, `wave3-cash`, `wave3-no-discounts`, `wave3-trial`, `wave3-themes`, `wave3-referrals`, `wave3-small`, `wave3-cleanup` (all in `test:ci`). Integration (written, NOT run): `payments-gateways`, `checkout-invoice`, `cash-confirmation`, `trial-signup`, `referrals-commission`, `partner-portal`.
