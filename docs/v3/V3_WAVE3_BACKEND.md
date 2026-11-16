# V3 Wave 3 backend: pricing, checkout, gateways, auto invoice, cash, trial, themes, referrals

Branch `v3-w3` (from `v3-w2`). Code only: nothing here was applied to any database and nothing was pushed.
Source of requirements: `WAVE3_BACKEND_PROMPT.md` (owner decisions of 17 Nov 2026).

## 0. Investigation: what exists, what is missing

Reuse rule: build only what is missing. The payment machinery of slice 5.1b already exists in `src/plan-billing` (Razorpay TEST adapter only), so Wave 3 extends it rather than adding a second order system.

| Area | Status | What exists (route, table, service) | What Wave 3 adds |
|---|---|---|---|
| Roles | PARTLY | `AdminRole` enum (SUPER_ADMIN, MARKETING = SALES, OPERATIONS, SUPPORT, ADMIN) on `g4d_admin_team_members.role`; matrix as data in `src/auth/guards/admin-role-matrix.ts`; `staffRoleOf` in `staff-access.ts`; `JwtStrategy` builds the principal | Enum values FIELD_EXECUTIVE, TELECALLER (normalised to SALES in `staffRoleOf`, so they hold exactly SALES rights) and REFERRAL_PARTNER (own principal kind, partner routes only) |
| Partner table | MISSING | nothing | `g4d_referral_partners` |
| Public pricing | PARTLY | `GET /v3/plans` (`PublicPlansService`, `shapePublicPlans`): plans by term, tax rate, features. No GST line as amount, no add-ons, no Free entry, no cache header | `GET /v3/public/pricing` |
| Price book | EXISTS | `V3Plan`, `V3PlanPrice` (term 3, 6, 12, `amountPaise`, APPROVED, `effectiveFrom`), `V3TaxRate`, `V3AddonPackPrice`, `V3ServicePrice`. Totals are stored per term, so no "monthly x months" fallback is needed | none |
| Orders and checkout | EXISTS (Razorpay) | `V3PlanOrder`, `PlanOrderService.create/confirm`, `POST /v3/me/billing/orders`, `.../orders/:id/confirm`, `buildQuote` from price tables only, integer paise | gateway port with Cashfree, admin gateway setting, gateway column, hold-for-review wiring; removal of the promo code input |
| Payment port | EXISTS (one gateway) | `RazorpayPort`, `RazorpayTestAdapter`, `PaymentsGate` (`paymentsMode` off/test/live) | `PaymentGatewayPort` over both, `CashfreeAdapter`, in-memory fake |
| Webhook | EXISTS (Razorpay) | `POST /v3/payments/razorpay/webhook`, `PaymentSettlementService.handleWebhook`, `V3PaymentEvent` inbox (event id unique), `verifyPaidAmount`, REVIEW state on mismatch | `POST /v3/payments/cashfree/webhook` |
| Settlement | EXISTS | `PaymentSettlementService.settleWithin`: one transaction, per-vendor lock, amount and currency check, assign subscription, invoice, audit | reused unchanged for both gateways |
| Auto invoice | EXISTS | `V3PlanInvoice`, `V3InvoiceCounter`, `financialYearOf`, `formatInvoiceNumber`, `renderInvoiceHtml`, `GET /v3/me/billing/invoices(/:id/download)`, `GET /v3/admin/invoices` | firm profile as seller (today the seller comes from billing settings), gateway or cash reference line, mail delivery recorded as pending behind a flag |
| Offline settle | EXISTS, too wide | `POST /v3/admin/billing/orders/:id/mark-paid` (matrix: SUPER_ADMIN by default), reference, received date, amount check | restrict to CASH, ADMIN and SUPER_ADMIN, required fields, special-case note |
| Discounts | EXISTS (must go) | `buildQuote` accepts `promoCode` and reads discount rules (`resolveApplicableDiscounts`) | the owner says no coupon or discount in version 3: the input is ignored and rejected, guard tests added |
| Subscription and activation | EXISTS | `SubscriptionsService`, `tx.assign`, `EntitlementsService.invalidate` | none |
| Self registration | PARTLY | `POST /auth/register` (`AuthService.register`, `RegistrationHook.afterRegister` gives the Free plan, subdomain derived from the business name) | reserved-name refusal, availability check route, referral code, idempotency, first-touch attribution |
| Create on behalf and go live | EXISTS | `seeded-admin.controller` (`POST .../:id/go-live`), listings and drafts by SALES (Part B of Wave 1), `act-on-behalf` | record the creating staff member and attribute the referral source |
| Themes | PARTLY | `src/themes` (catalogue, `ThemePackage`, `ThemeEntitlement`, purchase service, yearly price), `v3-theme-switch` (`GET /v3/me/site/theme/fee`, preview, switch, history) | catalogue per pack, apply, fee from the price book, paid theme only on a paid plan, through the one checkout |
| GST rate and firm identity | EXISTS | `V3TaxRate` (rate data), `FirmProfile` in `v3-firm` (legal name, address, GSTIN optional) | none, only used |
| Referral, affiliate, commission | MISSING | no V3 or legacy code (only unrelated word matches) | five tables, routes, partner portal |
| Wallet top-up | EXISTS (Razorpay) | `v3-wallet` top-ups, `TopupSettlementHook` called from the webhook | Cashfree top-up path through the same port |
| Staff role storage | EXISTS | `AdminTeamMember.role` (enum), JWT claims `kind: admin_member`, `adminRole` | see roles |
| Route baseline and oracle | EXISTS | `test/baselines`, `test/admin-role-matrix.spec.ts`, route scanner in `test/support/route-scan.ts` | regenerate, diff must be only the new routes |

## Assumptions, open questions

Written in `DISPATCH_STATUS_A.md` (ASSUMPTIONS and QUESTIONS FOR THE OWNER) and repeated in section "Open questions" at the end of this file when Part K completes.

(The remaining sections of this document are filled in job by job: routes, tables, role matrix, error codes, environment variable names, staging commands.)
