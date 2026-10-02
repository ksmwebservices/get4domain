# Security patch — 2026-10-02 (audit findings S1–S6)

Focused patch for the six exploitable-now findings in [AUDIT_REPORT.md](AUDIT_REPORT.md). **Code only — not yet deployed.** One additive migration is written and **not applied**. Everything below was verified by `backend-api/scripts/security-verify/` (135 assertions, 9 suites, all passing; `node scripts/security-verify/run-all.js` after `npx nest build`).

## What changed

| # | Finding | Fix | Key files |
|---|---|---|---|
| 1 | `POST /payments/verify` marked any invoice paid on an HMAC alone | The HMAC was already correct but proved nothing about *what* was paid. Verification now asks **Razorpay itself** (`orders.fetch` + `payments.fetch`): order amount == server-expected amount, order notes (`purpose`, `invoiceId`, `vendorId`) were stamped by our server, payment belongs to that order, is **captured**, same amount. The invoice must belong to the caller. Atomic claim (`updateMany … status ≠ PAID`) so concurrent submits finalise once; same payment is idempotent, a different payment on a paid invoice is rejected; constant-time HMAC compare; gateway unreachable ⇒ **503 (fails closed)**. Same checks added to **wallet top-up, go-live conversion and premium-theme unlock** (same root cause). | `payments/payment-verification.ts` (new), `payments.service.ts`, `wallet.service.ts`, `demo.service.ts`, `website-themes.service.ts` |
| 2 | `POST /payments/create-order` accepted any amount | Body is now `{invoiceId}` only (extra fields rejected). The server loads the caller's own invoice, rejects paid/cancelled/foreign invoices, and creates the order for the stored `totalAmount` with purpose notes. `PaymentsService.createOrder` is internal-only; go-live and theme orders were already server-priced and now carry notes. | `payments.controller.ts`, `dto/create-invoice-order.dto.ts` |
| 3 | Public checkout trusted client prices and was replayable | Every cart line is resolved against **this vendor's active products/catalogue** (by `productId` / `catalogItemId`, else by exact product name) and priced from the database; the client `price` is ignored. Non-purchasable listings ("from ₹500", ranges), unknown, ambiguous or out-of-stock lines reject the cart. The Razorpay order is stamped with a hash of the cart; `confirm` requires a **captured** payment on an order our server created for this vendor *and this cart*, records the amount actually paid, and is **idempotent per payment id** (advisory lock + unique `razorpayPaymentId`): a replayed request returns the original sale and does nothing else (no second sale, stock decrement or CRM lead). | `engine/public-checkout.service.ts`, `engine/checkout-pricing.ts` (new), `engine.dto.ts` |
| 4 | `GET /team/members` returned password hashes + invite tokens | `TeamService` returns safe objects (`name, email, role, status, modules…`) for list/invite/update/remove; `VendorsController` strips `password` from all vendor rows. **Pattern audit:** the same leak also existed on every endpoint returning `include: { vendor: true }` (invoices, subscriptions, support tickets, payments) and on admin vendor lists — so `TransformInterceptor` now redacts `password`, `passwordHash`, `inviteToken`, `resetToken`, `refreshToken`, `razorpayKeySecret`, `keySecret` from **every** response. | `common/utils/redact-secrets.ts` (new), `transform.interceptor.ts`, `team.service.ts`, `vendors.controller.ts` |
| 5 | WhatsApp webhook unauthenticated | `webhook_secret_key` is now defined in the settings catalogue (Admin → Integrations → Fast2SMS, or env `FAST2SMS_WEBHOOK_SECRET`). The handler **fails closed**: no secret configured ⇒ 401; missing/wrong header ⇒ 401 (constant-time compare). Razorpay webhook was already HMAC-checked; its compare is now constant-time. | `whatsapp-bot.controller.ts`, `platform-settings.constants.ts`, `payments.service.ts` |
| 6 | No rate limiting | `@nestjs/throttler` registered **before** the JWT guard (floods get 429 before any work). Global default: 300 writes/min and 1,500 reads/min per IP (reads are generous because the Next.js server renders vendor sites from one IP). Per-route limits: login 10/min, register 5, refresh 120, OTP request 3, OTP verify 10, payment/order/verify/top-up/go-live/theme-unlock 20, public storefront actions 30, Razorpay webhook 120, WhatsApp webhook 300. `trust proxy` set so the key is the real client IP. | `common/throttling.ts` (new), `app.module.ts`, `main.ts`, 9 controllers |

## Migration (written, NOT applied)

`backend-api/prisma/migrations/20261002130000_payment_idempotency/migration.sql` — adds `g4d_pos_sales.razorpayOrderId` / `razorpayPaymentId` (unique) and a unique index on `g4d_wallet_transactions.razorpayId`. Pre-checked read-only: 0 duplicate wallet payment ids and 0 web sales exist, so it cannot fail on current data.

```bash
cd backend-api && npx prisma migrate deploy
```

**Order matters:** apply the migration **before** deploying the new backend, otherwise public checkout `confirm` fails ("column does not exist"). No live vendor has online payments enabled yet (0 web sales), so nothing is in flight.

## Deploy checklist (KSM)

1. Apply the migration (above), then deploy `backend-api` **and** `get4domain_mvp` **together** — the new billing page sends `{invoiceId}`; an old frontend sending an amount to the new API gets 400.
2. **Set the WhatsApp webhook secret** — Admin → Integrations → Fast2SMS → "WhatsApp inbound webhook secret" (or `FAST2SMS_WEBHOOK_SECRET`) — and configure the same value in Fast2SMS as the `webhook_secret_key` header. **Until you do, the WhatsApp bot receives nothing (by design).**
3. Confirm nginx forwards the client address (`proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`) and set `TRUST_PROXY_HOPS` (1 for nginx only; 2 if Cloudflare also proxies and nginx trusts it). If the proxy header is missing, every visitor shares one rate-limit bucket. If the API port is ever exposed directly (bypassing nginx), `X-Forwarded-For` becomes spoofable — keep 3008 bound to the proxy only.
4. Optionally add the web server's IP to `THROTTLE_TRUSTED_IPS`; `THROTTLE_DISABLED=true` is the emergency off-switch.
5. Smoke test after deploy: pay a small test invoice end-to-end from `/dashboard/billing`; hit `GET /team/members` and confirm no `password`/`inviteToken`; send an unsigned webhook (expect 401).
6. **Treat previously exposed credentials as compromised:** bcrypt hashes and invite tokens were returned to any logged-in vendor session. Invite tokens still never expire (S7-adjacent, not fixed here) — re-issue any pending team invites; there is no password-reset flow yet (S13), so plan one before forcing resets.

## Behaviour changes to be aware of
- `POST /payments/create-order` contract changed (invoice id, not amount).
- Checkout ignores the client `price`; lines must match a real, purchasable product. Standalone sites that send only a display name (stepnrock) keep working through exact-name matching; sending `productId` is more robust (follow-up for the stepnrock/kit carts). Listings without a plain numeric price cannot be bought online.
- Payments whose Razorpay status is `authorized` (not `captured`) are rejected. Orders use Razorpay's default auto-capture; if the account was switched to manual capture, change this deliberately.
- Orders created before the deploy lack the new notes and will fail verification if paid after it (users simply retry).
- Webhook / rate limits as above.

## Not covered by this patch (still open — see AUDIT_REPORT.md)
S7 admin sub-roles unenforced · S8 team-member module guards (incl. `PUT /vendor-payments`) · S9 vendor-invoice payment links use platform keys and are never reconciled · S10 Resend errors ignored / plaintext password email · S12 wallet debit race · S13 no password reset / refresh tokens · S14 uploads · customer-portal OTP has only rate limiting (no per-code attempt counter, `Math.random`, logged OTP) · the real-estate "token payment" CTA still creates a platform-account order from a client-chosen amount and has no confirm step · the Razorpay payment-link webhook update is non-atomic · invite tokens do not expire.

## How this was verified (and its limits)
- Scripts run the **real compiled services/controllers** with the database and Razorpay replaced by in-memory fakes, so nothing touches production data or the gateway. HTTP-level checks use real signed JWTs through the production `JwtAuthGuard`/`JwtStrategy`. Fixes 5–6 were also run against the **real application booted locally**, sending only non-writing requests (invalid signatures, malformed bodies, a non-existent subdomain).
- **Before/after:** the pre-patch code (commit `f7ad328`, transpiled from git) was run against the same attacks: a valid ₹1 payment settled a ₹14,145.84 invoice and was replayable; 9 of 9 team/vendor/invoice/subscription routes leaked password hashes/invite tokens.
- Limits: not run against real Razorpay (field names follow the SDK); true database-level concurrency (advisory lock, unique index) is not exercised by in-memory fakes; the DB migration is unapplied so the unique indexes are unproven until applied.
