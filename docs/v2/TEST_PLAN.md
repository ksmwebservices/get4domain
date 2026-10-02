# TEST_PLAN — Get4Domain V2 (includes PRD §92.6 Test Matrix)

> **Current coverage: 0%.** No `*.spec`/`*.test`/e2e file, no test script, no jest/vitest/playwright dependency in any package, no ESLint config in the two main apps, no CI (`.github/` absent). Verified by `git ls-files` search and package-manifest inspection (platform and BOS audits). Every "Status" below is therefore **NOT STARTED**.

## Test Matrix (PRD §92.6)

Legend: `—` = none exists. Target column = what V2 must reach before the module can be called complete (PRD §63AD/§98).

| Module | Unit | Integration | E2E | Permission | Failure path | Mobile/PWA | Status | Target |
|---|---|---|---|---|---|---|---|---|
| Auth (login/refresh/reset/OTP) | — | — | — | — | — | — | NOT STARTED | all columns |
| Tenancy / IDOR (every controller) | — | — | — | — | — | n/a | NOT STARTED | generated cross-tenant matrix |
| Platform payments (verify/webhook) | — | — | — | — | — | n/a | NOT STARTED | **first suite** |
| Wallet (top-up/debit/expiry) | — | — | — | — | — | n/a | NOT STARTED | **first suite** |
| Public checkout / vendor-direct Razorpay | — | — | — | — | — | — | NOT STARTED | **first suite** |
| Go-live / theme unlock | — | — | — | — | — | n/a | NOT STARTED | first suite |
| DomainCampaign fee brackets + invoice | ad-hoc scripts only (not in repo test suite) | — | — | — | — | — | NOT STARTED | port boundary cases below into Jest |
| Subscriptions / theme-change limits | — | — | — | — | — | n/a | NOT STARTED | |
| CRM / TeleCRM | — | — | — | — | — | — | NOT STARTED | |
| Campaign pages / widget / leads | — | — | — | — | — | — | NOT STARTED | |
| Industry modules (19) | — | — | — | — | — | — | NOT STARTED | state machines + conflict rules |
| POS / restaurant / retail stock | — | — | — | — | — | — | NOT STARTED | concurrency (stock, wallet) |
| Invoicing / GST / accounting | — | — | — | — | — | — | NOT STARTED | deterministic-calculation golden tests |
| Communication (SMS/WhatsApp/email) | — | — | — | — | — | n/a | NOT STARTED | provider fakes + webhook signature |
| Automation engine (new) | — | — | — | — | — | n/a | NOT STARTED | loop protection, retries |
| Social publishing (new) | — | — | — | — | — | n/a | NOT STARTED | connector fakes; never real publish in CI |
| CMS / engine / site rendering | — | — | — | — | — | — | NOT STARTED | smoke + visual |
| Admin tools (pricing, plans, managed services) | — | — | — | — | — | — | NOT STARTED | |
| Frontend dashboard pages (52) | — | — | — | — | — | — | NOT STARTED | Playwright smoke per route |
| Responsive (1440/1280/tablet/390/360) | — | — | — | — | — | — | NOT STARTED | PRD §58 |

## Strategy

1. **Never test against production.** Backend `.env.local` points at the production Supabase instance (`DATABASE_URL`/`DIRECT_URL`); every local write is a live write. First task is a dedicated test database (local Postgres container or a separate Supabase project) and a CI-only env.
2. **Backend:** Jest + ts-jest + supertest, Nest `Test.createTestingModule`; seeded fixtures per test (two tenants minimum, one team member, one admin, one customer). Providers (Razorpay, Resend, Fast2SMS, OpenAI, Meta) always replaced by recording fakes.
3. **Frontend:** Playwright for E2E (PRD §60 list: login, dashboard, lead, task, customer, product, order, payment, booking, campaign, document, integration mock, search insights, SEO, marketing asset) + responsive smoke at the §58 breakpoints.
4. **Generated tenancy test:** enumerate all 75 controllers/routes at test time; for every vendor-facing route with an id parameter, authenticate as tenant B against tenant A's data and assert 403/404; for every list route assert no foreign rows. This directly retires the audit's IDOR risk class.
5. **Deterministic-money golden tests:** GST/CGST/SGST/IGST, invoice totals, round-off, wallet balances, payroll — fixed inputs → fixed outputs (PRD §63AC: AI never decides financial values).
6. **Contract tests:** assert no API response ever contains `password`, `inviteToken`, `keySecret`, or other secret fields.
7. **Quality gates in CI:** `npm run lint` (needs ESLint config), `nest build`, `next build`, tests; block merge on failure (CLAUDE.md already mandates build/lint before commit but cannot be enforced today).

## First suites (V2.0a, in order)
1. Payments: verify rejects wrong-vendor invoice, wrong amount, replayed payment id, forged signature; `create-order` cannot accept a client amount.
2. Wallet: concurrent debits cannot overdraw; top-up replay credits once; expiry behaviour documented.
3. Checkout: price tamper, amount mismatch, replay, webhook reconciliation.
4. Tenancy generated matrix (above) + team-member module enforcement + admin sub-role enforcement.
5. Secrets-in-responses contract test; webhook fail-closed; throttling/lockout.
6. **DomainCampaign fee** — port these verified cases into Jest: ₹15,000→₹2,000; ₹20,000→₹2,000; ₹20,001→₹5,000; ₹50,000→₹5,000; ₹1,00,000→₹5,000; ₹1,00,001→₹10,000; ₹1,50,000→₹10,000; custom ON + ₹25,000 → ₹25,000 (bracket bypassed); custom ON with missing/zero/negative/fractional amount rejected; custom OFF ignores a stray custom amount. (These were verified this session by throw-away scripts against the compiled module and by a 12,050-value parity check of the admin preview — they are **not** in the repo.)

## Definition of "tested" per module (PRD §63AD, §98)
UI + API + DB + validation + permissions + business rules + workflow + reports + audit + tests + error handling all present, plus a failure-path and a permission test. A module with a page but no tests is **not** complete.
