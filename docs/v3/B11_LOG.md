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
