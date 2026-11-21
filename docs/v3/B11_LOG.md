# Batch 11 run log (Stage 15: own-domain automation 5.6c and domain sales 5.6d)

Branch `v3-b11`, worktree `C:\Get4Domain\get4domain-b11`, from `origin/v3-b9` (Stage 14 skipped in Release 1, owner override 1).

## Gate check
`origin/v3-b9` log shows the Stage 13 finish (`431d658` design document and trackers) and the staging fix (`6be5127`). Passed.

## ResellerClub documentation
The documentation pages (manage.resellerclub.com/kb, developer.resellerclub.com, httpapi.com) answered HTTP 403 to the fetch tool, so no endpoint could be read. Per owner override 3 the adapter is written from known names and EVERY path and parameter is marked TO VERIFY in the code and in the design document, covered by recorded-fixture tests (fixtures written from the names, not from live responses).

## B11.0 rules document
`docs/v3/V3_DOMAINS_AUTOMATION.md`.

## Owner addendum (Amendment 11 and the mid-run message)
Applied as new work, no finished commit redone: Pro only (Q2); GST on top with the exact total held and charged (Q1, Q8); slice 5.6e transfer-in (Q9); plan expiry redirects a custom domain to the subdomain and the canonical host returns (Q11), added to the connection state machine as LAPSED; per-vendor domain log with an admin route (Q12). Visit analytics are not in this run. The role "Support" does not exist: OPERATIONS and SUPER_ADMIN, MARKETING denied.

## Slice 5.6c: own-domain automation (`cbc0188`)
Migration `20261206100000_v3_domain_connection` (one table, RLS on). Code: `src/v3-domain-automation` (pure core, Cloudflare port with an "unavailable" product binding, store, service, settings, domain log, controllers, module, watcher). Behaviour: www first with the bare domain flagged; records shown as type, host and value; per-registrar steps; certificate watch; connect or forward; the canonical host is changed only through `CanonicalSwitchService.switchFor` (a static test forbids writing it here); retry of temporary provider failures (a technical limit of three tries); Pro only; plan lapse (Q11). `canonicalHostFor` gained `customServing` and `planRedirect` gained `temporaryHosts` (302).
Changed older assertions (owner answer Q11 replaces "keeps serving"): `domain-host.spec.ts` and `domain-api.spec.ts`, one test each.
Red first: core spec red (module missing) then green. The service spec was written against the code I had just written and found two mistakes of mine in tests (an attempt count and a rate-limit order), no code defect. The Q11 additions were written in the same step as their code.
Staging suite written, NOT RUN: `test/domain-connection.int.spec.ts`.

## Slice 5.6d: domain sales (`1c950bd`)
Migration `20261207100000_v3_registrar` (nine tables, RLS on, foreign keys cascade). Code: `src/v3-registrar` (pure core, registrar port with the gate, the ResellerClub adapter, identity service, registrar service, Prisma store, settings, controllers, module with the startup guard and the jobs). The ResellerClub documentation answered HTTP 403, so every path and parameter is TO VERIFY and covered by fixtures that were written from names, not recorded.
Findings by tests, fixed: an unexpected error from the registrar port released the hold (now unsure: the hold stays); `FetchHttp` and `AesGcmDocCrypto` had constructor arguments Nest cannot inject, which would have stopped the application starting (now built by factories; a DI test over the provider lists guards it). Mistakes of mine in tests: a margin date set before the test clock, a wrong expected total, an invoice-number assertion. `prisma format` rewrote the whole schema file once; the file was rebuilt from the committed text plus the additive block (schema diff: 211 added lines, none removed).
Red first: core, identity and adapter specs ran red or were written with their module; the service spec was written after the service because its world needs the module surface.
Staging suite written, NOT RUN: `test/registrar.int.spec.ts`.

## Slice 5.6e: transfer-in (`d632d10`)
No migration (kind `TRANSFER_IN` already exists). Port gained `transferEligibility`, `transferIn`, `transferStatus` and `CostRow.transferPaise`; the service gained `transferQuote`, `transferIn`, `settleTransfers` and the recovery branch; a transfer in progress stays SUBMITTED with its registrar order id. Red first: the core and service specs ran red (compile failure) then green on the first run. The authorisation code is never stored: tests scan every row, audit, event, ledger entry and log call. Staging case added to `test/registrar.int.spec.ts`, NOT RUN.

## FINISH
Design document `V3_DOMAIN_SALES.md`; `V3_API_DOCUMENTATION.md` extended (Batch 11, 42 routes); trackers updated (`V3_REQUIREMENTS_MATRIX.md`, `V3_IMPLEMENTATION_PLAN.md`).
Gates over the whole range: tsc, eslint (0 errors on every file of this run; one older warning in `site-domains.service.ts`), `npm run build` (with placeholder database variables only for `prisma generate`), verify:migrations 181/181, verify:migrations-additive 56/56, verify:raw-sql 1029/1029, legacy static checks (`b11-isolation`, tenant registry, role matrix oracle 300, route classification baseline 1170, DI metadata, activity actions) green. Final full unit run: 175 suites / 3,379 tests, all passed (before this run: 161 / 3,157). `verify:db-lock` needs DATABASE_URL (not run). Nothing pushed.

## STAGE 15 STAGING FIX (full `test:int` on staging: 2 suites failed, 9 tests failed, 450 passed; `registrar.int.spec.ts` and `domain-connection.int.spec.ts`)
Each failure was judged against `V3_DOMAIN_SALES.md`, `V3_DOMAINS_AUTOMATION.md` and Amendment 11, not against making the test pass. Result: **one real application defect, four fixture or spec defects**. No assertion was weakened, deleted or skipped.

**A. Application defect: error codes lost at the HTTP layer (3 tests directly, 37 codes in all).** The exception filter passes a body `code` through only when it is on a registered list. `REGISTRAR_ERROR_CODES`, `IDENTITY_ERROR_CODES` and `CONNECTION_ERROR_CODES` were exported by their services but never added to that list, so the status was right and the code was `undefined` (the same class as the Stage 13 website codes). Fix: the three lists are now spread into the filter's list (`http-exception.filter.ts`). Guard: `test/domain-wire.spec.ts` reads every code that `err(`, `planError(` and `walletError(` put in an error body in `v3-registrar` and `v3-domain-automation` and sends each one through the REAL filter; it fails if any is dropped. Proved: with the three lists removed it fails (37 codes dropped); with them it passes. A second test proves the filter does drop an unregistered code, so the guard can fail.

**B. Fixture defect: "a Free vendor" was still Pro (LOCKED_PREVIEW expected, ACTIVE received).** The application is right. Amendment 11 Q2 (register, renew and transfer-in are Pro only) is enforced by `proState` (level PRO and an ACTIVE subscription), and the entitlement engine works the subscription status out from the DATES (`effectiveStatus`), not from the stored `status` column. The fixture set only `status: 'EXPIRED'` and left `endsAt` three months ahead, so the vendor was still on a running Pro term. The fixture now moves `endsAt` 30 days and `graceEndsAt` 20 days into the past and calls `EntitlementsService.invalidate` (the same way `plans-entitlements.int.spec.ts` lapses a plan). Assertions unchanged.

**C. Knock-on and independent causes in the same two suites (read the response bodies, not assumed):**
1. `domain-connection.int.spec.ts` `TypeError ... 'certStatus'` and the later 404 and `false` results: knock-on of test 1 failing before the connection was started (`cf.hostnames` empty). Cleared by A and by 2 and 3 below.
2. Fixture defect: the suite's host was `shop-<run>.example.in`, a SUBDOMAIN, while every assertion describes a BARE domain (`www.` connect host, the Cloudflare option, TXT + CNAME). The application is right and documented (`connectHostFor('shop.example.in')` connects as itself with `bareDomain: false`, pinned in `domain-connection-core.spec.ts`). The host is now `v3test-<run>.in`.
3. Fixture defect: the connection vendor had no ACTIVE subdomain row. Forward mode redirects to it, and `makeSiteVendor` only fills the vendor's column. The suite now reserves one through `PUT /v3/me/domains/subdomain`, as a vendor does (rule 1: every vendor has a mandatory Get4Domain subdomain).
4. `registrar.int.spec.ts` two `Expected 200, received 409`: body was `INSUFFICIENT_WALLET` (available 96,440 against 103,840 for the transfer and 99,120 for the staff purchase). The application is right to refuse the hold. The fixture credited vendor A 500,000 paise but the suite spends about 606,000 on A. Credit is now 800,000.
5. **Spec expectation changed, with reason:** `registrar.int.spec.ts`, the staff-on-behalf count used `requestedById: expect.any(String)` inside a Prisma `where`. A Jest asymmetric matcher cannot be serialised by Prisma (`PrismaClientValidationError`), so this assertion could never run. It is now `requestedById: { not: null }`, which asserts the same fact (staff placed it AND a staff id was recorded) and is no weaker.

**Noted, not changed (needs an owner decision):** in Forward mode with no ACTIVE Get4Domain subdomain, `applyMode` plans no redirect and the connection still goes ACTIVE without a redirect, with no warning. Rule 1 says that state should not exist, so it was left alone; say if you want it to land in NEEDS_ATTENTION instead.

**Results (one suite at a time, never the full `test:int`):** `registrar.int.spec.ts` 8/8; `domain-connection.int.spec.ts` 4/4; `domain-wire.spec.ts` 2/2. Gates: unit 176 suites / 3,381 tests passed (a first run showed 12 failures in `website-review.spec.ts` only because `npm run build` rewrote `dist/renderer` while the unit run was reading it; rerun alone, all green), eslint 0 errors, tsc clean outside `remotion/`, build, verify:migrations 181/181, verify:migrations-additive 56/56, verify:raw-sql 1029/1029, secret scan clean; `verify:db-lock` not run (needs DATABASE_URL). `test:cleanup-staging -- --count` printed 0. Nothing pushed.
