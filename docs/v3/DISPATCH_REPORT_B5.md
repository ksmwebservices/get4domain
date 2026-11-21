# Dispatch report B5 (backend asks from the A2 report)

Branch **`v3-lane-b5`**, cut from `v3-lane-b4`. Nothing pushed. No `.env` file or secret was read or printed by me (the staging check goes through the existing `scripts/staging/guard.js`). **No migration** (every change is code only), so `verify-migrations-additive` had nothing to check. **No flag was enabled** and no e-mail, SMS or payment call was made.

Source of the asks: `get4domain-ui/docs/v3/DISPATCH_REPORT_A2.md`, "Backend asks" (read only).

## What changed

| Task | Commit | Change |
|---|---|---|
| B5.1 | `3323588` | `POST /v3/me/domain-sales/quote`, `/transfer-quote` and `registered/:id/renew-quote` answer through `vendorQuoteView`: `costPaise` and `marginPaise` are removed at the top **and inside `taxSnapshot`**. The internal quote (used to create the order and hold the wallet) is unchanged. Duplicate refusals build `candidates` with one whitelist, `publicFacts()` (name, category, area, city, claimable, slug); the staff path used to send the raw listing rows including `businessId`. Tests (`b5-security.spec.ts`) fail if either field leaks, including a store that returns poisoned rows. |
| B5.2 | `6d502e3` | `HttpExceptionFilter` knows `DUPLICATE_CODES`. `code`, `claim` (`{ businessSlug, startPath }` or `null`) and `candidates` pass through for 409, and `code` passes for the 403 and 400 override refusals. The filter whitelists candidates a second time (six fields, at most 10), so a future service cannot leak through it. The staff-only `matches` (vendor and business ids) is still not sent. |
| B5.3 | `4c378b3` | `CreateVendorWithSiteDto` takes optional `address` (5 to 300) and `addressLine` (2 to 200). Stored in `VendorCMS.address` (the site address) **before** the site is made, so the first build uses it. Rule: full `address` wins (the line is put in front if missing); with only `addressLine` it is joined with area, city and pincode; with neither, nothing is stored. |
| B5.4 | `58d4bc4` | `GET /v3/admin/vendors/:id/site` adds `status` (vendor status), `subdomain`, `address`, `siteProvisionStatus`, `siteProvisionCode`, `siteProvisionFailedAt` next to the existing answer. New read service `SiteProvisionFacts`. |
| B5.5 | `8976f03` | `GET /v3/me/site` adds `siteProvisionStatus` and `siteProvisionCode` for the **owner only** (a team member's answer is unchanged). The app shell (`GET /v3/me/app-shell`, also inside `/v3/me/overview`) adds the same two keys for the owner; for a team member the keys are **absent** (the existing test pins the team member's exact key list, and it still passes). The failure time is not sent to the vendor. |
| B5.6 | `7f089ed` | `GET /v3/public/pricing` adds `paymentsOpen`. New `PaymentsGate.isOpen()`: false when mode is `off`; false for `live` without `PLAN_PAYMENTS_LIVE_ENABLED`; otherwise true only if the chosen gateway can be built from its keys (stored or environment). Never throws (an unreadable setting counts as closed); no key value is read out. Wired by a global token (`PAYMENTS_OPEN`, `PaymentsOpenModule`) so `plans` does not import `plan-billing`. |
| B5.7 | `d614faa` | `GET /v3/me/wallet` adds `validityDays` (same number as the existing `creditValidityDays`, which stays) and `nextExpiry: { expiresAt, amountPaise } \| null`: the soonest date an open credit runs out and the total expiring that UTC day. Null for a locked wallet or no open credit. |
| B5.8 | `8c8c3a5` | See below. |

### B5.8 identity codes: what was already true, what changed
- **E-mail delivery was already connected** in Block 4b (`ChannelIdentityOtpSender` sends through the guarded `EmailPort`, lane SYSTEM, kind `OTP`, behind `EMAIL_LIVE_SEND`). The A2 note (B11 D-2) was out of date. No new e-mail code path was added.
- The gap was the *message*: any refusal (flag off, no sender, no provider) came back as `OTP_DELIVERY_FAILED` "try again later". Now each sender has `channelReady(channel)` (e-mail: flag on, sender address and name set, `RESEND_API_KEY` present; SMS: a provider bound, DLT settings complete, `SMS_LIVE_SEND` on). `sendOtp` asks first and refuses with **`OTP_NOT_AVAILABLE`** and a plain sentence ("E-mail codes are not available yet." / "Text message codes are not available yet."), **before a code is made**. A lane switched off between the check and the send maps to the same answer; a real provider failure is still `OTP_DELIVERY_FAILED`.
- `GET /v3/me/identity` adds `codeChannels: { EMAIL: { available, text }, PHONE: { available, text } }` so the app can grey a channel instead of failing at "Send code".
- SMS stays off: no provider is bound (`UnboundSmsTransport`), so `PHONE` reports `available: false` whatever the flag says.

## Choices I made (you asked me to decide)
- Address stored in `VendorCMS.address` (there is no address column on `Vendor`); the field names are `address` and `addressLine`.
- Admin site facts are flat keys on the admin site answer (the A2 ask allowed "admin site answer or vendor record").
- `GET /vendors/:id` (the older admin vendor record) **already** returned the three `siteProvision*` fields (it sends the whole row minus the password), so A2 ask 3 was only true for the site read. Not changed.
- Owner-only is decided by `kind === 'team_member'` (the same test the shell already uses), not by a new guard, so team members keep reading `GET /v3/me/site`.
- `nextExpiry` groups by UTC day, not by instant, so two top-ups on one day show as one expiry.
- `paymentsOpen` rides on the existing public cache (`Cache-Control: public, max-age=300`): a mode change can take up to 5 minutes to show.
- A2 ask 10 (is `/v3/me/domains/custom` the intended path for a registrar-bought domain) is a product question; I made no change.

## Tests (affected only)
New: `b5-security`, `b5-site-facts`, `b5-payments-open`, `b5-wallet-validity`, `b5-identity-codes` (all pass). Neighbours re-run and green: `duplicate-check`, `duplicate-paths`, `registrar-service`, `registrar-identity`, `registrar-di`, `http-exception-filter`, `b2-admin-vendor-site`, `b2-registration-site`, `pack-part-b`, `pack-part-b-http`, `billing-gate`, `wave3-pricing`, `wave3-no-discounts`, `price-book`, `b3-price-withdraw`, `wallet-service`, `wallet-api`, `mail-lanes`, `mail-di`, `sms-port`, `claim-setup`. `tsc` clean for `src` and `test` (the `remotion/` folder has errors that were already there). ESLint: 0 errors on changed source files (4 old warnings). The full suite was not run.

## Staging check (staging only, read-only apart from one tagged fixture)
`node scripts/staging/b5-check.js` (new): **ALL B5 STAGING CHECKS PASSED**. A fixture vendor (failed site code, address) was made, read through the real `SiteProvisionFacts` and `AppShellService` against the staging database, and removed again ("fixture removed"). Also read: `VendorCMS.address` column, real billing settings (staging `paymentsMode` is `test`, gateway razorpay, `paymentsOpen` false because no test keys are set on this machine), wallet lots (staging has none, so only the shape check ran), SMS channel unavailable, e-mail ready false here. Nothing was sent.

## Not verified
- No HTTP request was made to a running server; controllers were tested by calling them with stubs, and services against the staging database.
- `nextExpiry` has no real data on staging (0 lots); it is proven by unit tests and the wallet service tests only.
- `paymentsOpen` true was proven with test doubles (test keys in an injected environment), not against a real gateway.
- E-mail codes were not sent for real (the live lane is off by design).

## Run on live
1. Deploy the branch when you approve it. **No migration to apply.**
2. Nothing to enable for B5.1 to B5.7; they are active on deploy. The vendor app should read `paymentsOpen`, `siteProvision*`, `validityDays`/`nextExpiry` and `codeChannels` (A2 can now drop its workarounds).
3. To make identity e-mail codes actually arrive (your decision, not done here): set `EMAIL_LIVE_SEND=true`, `RESEND_API_KEY`, and the sender address and name in the mail settings. Until then the identity step answers "E-mail codes are not available yet." and `codeChannels.EMAIL.available` is false.
4. SMS needs an SMS provider adapter (none exists), DLT settings and `SMS_LIVE_SEND`; leave off.
5. `paymentsOpen` becomes true only after `paymentsMode` is `test` or `live` and the gateway keys are present; a live switch also needs `PLAN_PAYMENTS_LIVE_ENABLED=true`.
6. Optional smoke after deploy: `GET /v3/public/pricing` (expect `paymentsOpen`), a vendor `POST /v3/me/domain-sales/quote` (expect no `costPaise` or `marginPaise` anywhere), and a staff duplicate refusal on `POST /v3/admin/vendor-sites` (expect `code`, `claim`, six-field `candidates`).
