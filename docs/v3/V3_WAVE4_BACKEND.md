# V3 Wave 4 backend: directory host, held payments, retired discount routes, commission adjustment, partner state

Branch `v3-w4` (from `v3-w3`), worktree `C:\Get4Domain\get4domain-w4`. Code only: **nothing here was applied to any database and nothing was pushed.** Requirements: `DISPATCH_A2_WAVE4_BACKEND.md` (owner decisions of 17 Nov 2026). The route contract for the front end is `API_CONTRACT_WAVE4.md`; the job log is `DISPATCH_STATUS_A2.md`, the morning report `DISPATCH_REPORT_A2.md`.

## 0. What existed, what is missing (W0, no code)

| Job | Exists already (Wave 3) | Missing, built in Wave 4 |
|---|---|---|
| W1 Directory host | `DIRECTORY_PUBLIC_BASE_URL` (env) read by `directoryBase()`; with it set the page model, canonical, breadcrumb urls, pagination, JSON-LD urls, sitemap index and chunks, robots `Sitemap:` line, llms links, badge and backlink urls use that origin and the home is `/`; unset = origin is `publicAppUrl` and the home is `/directory`. `HOSTNAMES_PLAN.md` exists (in `get4domain-pub`), read only. | HOSTNAMES_PLAN items C and F: the brand (first breadcrumb "Get4Domain", home `WebSite` JSON-LD, the `publisher` Organization, the backlink-block brand link) stays on the MAIN origin (`publicAppUrl`) while listing and business links use the directory origin; a test with two different origins. |
| W2 Held payments | A mismatch or money for a closed order puts the order in `REVIEW` with `paymentId` and `paidAmountPaise` stored and an audit row `billing.order.review`; `REVIEW -> PAID \| CANCELLED` is allowed by the state machine; `GET /v3/admin/billing/orders?status=REVIEW` lists them. | Dedicated routes (list with filters and paging, detail, resolve), `ACCEPT` (only when the verified amount equals the order total incl GST; one transaction: activate plan + invoice + audit) and `REJECT` (status FAILED... see W2 note, vendor message queued through the mail port, flag OFF), idempotency, role matrix entries, registered error codes. |
| W3 Discount routes | Four `/v3/admin/discount-rules` routes (GET, POST, PUT, DELETE) in `RulesAdminController`, matrix entries, baseline lines; tables `v3DiscountRule` and migrations; `repo.discountRules()` is still declared on the billing repository but no checkout reads it; the seed applier still seeds the table. | Remove the four routes, their service methods and DTOs, matrix and baseline lines; stop the unused repository read; keep tables, migrations and the seed file; update the tests that named them. |
| W4 Commission adjustment | Ledger `g4d_commission_ledger` with `vendorId` UNIQUE (one line per vendor); a reversal marks the line `REVERSED` and flags it (a PAID line only gets a note). Month close approves ACCRUED lines by slab; payout sums APPROVED lines. | `kind` (`COMMISSION` / `ADJUSTMENT`) and `adjustsLineId` on the ledger, uniqueness moved to `(vendorId, kind)` (migration, written not applied), a negative ADJUSTMENT line when a PAID line is reversed, netting and carry-forward at month close, kind shown in the admin ledger, CSV and partner routes. |
| W5 Partner state | `vendorFacts()` takes `addressJson.state` of the vendor's directory business, trimmed; empty otherwise. | The business address state also from the place tree (the STATE above the business's location) when the address text has none, normalised and capped; empty when unknown. |
| W6 Gateway credentials | `PlatformSettingsService` and its AES-GCM util (`platform-settings/crypto.util.ts`, master key `PLATFORM_SETTINGS_KEY`); the legacy gate reads keys from the environment only. | Write-only SUPER_ADMIN routes, stored encrypted in the existing `g4d_platform_settings` table, the gate reads them first. |
| W7 GST rate | `g4d_tax_rates` with `validFrom`, `selectTaxRate`, an order snapshot of the rate, generic tax-rate routes (SUPER_ADMIN). | A purpose-built setting: new row per change, never back-dated, history, idempotent, audited. |
| W8 TDS | Payout record (`g4d_commission_payouts`) with a total only; no PAN. | gross, TDS, net on the payout; `tdsPercent` setting (empty); preview; partner PAN; payouts CSV. |
| W9 | Wave 3 test files, role-matrix oracle, route baseline. | Unit tests per job, three integration files written NOT run, regenerated baseline and oracle, two docs. |

Reuse rule: nothing is duplicated. Wave 4 extends `PaymentSettlementService`, `SeoPageService`, `ReferralsService`.

## 1. W1 Directory host

`directoryBase()` (`seo-directory/core/url-scheme.ts`) already chose the directory origin from `DIRECTORY_PUBLIC_BASE_URL`. W1 made the brand follow HOSTNAMES_PLAN.md items C and F: the first breadcrumb, the home `WebSite` JSON-LD, the `publisher` and the backlink-block brand link use the **main** origin; every listing, business, sitemap, robots, click-out and badge url uses the directory origin with no `/directory` prefix. Unset = old behaviour. Files: `core/page-model.ts`, `core/backlink-block.ts`, `pages/seo-page.service.ts`, `backlinks/seo-backlink.service.ts`. Tests: `wave4-directory-host.spec.ts` (both modes, two different origins), `seo-pages.spec.ts`.

## 2. W2 Held payments

`HeldPaymentsService` (`plan-billing/held-payments.service.ts`), pure rules in `core/held-core.ts`, routes in `HeldPaymentsAdminController`. ACCEPT goes through `PaymentSettlementService.settle` (the one settlement path), so the plan, the invoice, the paid order and the audit row are one transaction, and only when the verified amount equals the order total. REJECT moves `REVIEW` to `FAILED` (a new allowed edge) with the note, and the vendor message goes through the mail port (flag OFF: pending). A `FAILED` order with a gateway payment id means "rejected held payment". Both are idempotent. The note is kept in the order `reason`, the admin name and day in `settledByName` and `settledOn` (no migration). `listOrders` gained `gateway`, `from`, `to` filters. Tests: `wave4-held-payments.spec.ts`.

## 3. W3 Retired discount routes

The controller routes, service methods, DTOs, validator, role-matrix and baseline lines, and `repo.discountRules()` are gone. Tables, migrations and the seed file are untouched; the memory test repository keeps an inert `discounts` array so the existing tests still prove a planted rule changes no amount. `wave3-no-discounts.spec.ts` now asserts the four routes and the repository read do not exist.

## 4. W4 Commission adjustment

Schema: `kind` and `adjustsLineId` on the ledger, uniqueness `(vendorId, kind)`, the amount check allows a negative amount for an ADJUSTMENT only. Migration `20261230100000_v3_wave4_commission_adjustment` (**not applied**). Rules in `v3-referrals/core/referral-core.ts` (`closeMonth` with adjustments), actions in `ReferralsService` (`onPaymentReversed`, `closeMonth`). Netting: oldest first, only while the partner is left with more than nothing; the first that does not fit and all later ones wait; a partner with a payout for the month is skipped; a netted adjustment moves to the closing month. Tests: `wave4-commission-adjustment.spec.ts`.

## 5. W5 Partner state

`stateOfBusiness` and `normaliseState` in `referral-core.ts`; `PrismaReferralsStore.vendorFacts` reads the address state, then the STATE above the place (at most three steps up). Tests: `wave4-partner-state.spec.ts`.

## 6. W6 Gateway credentials

`GatewayCredentialsService` stores the sets under the platform-settings category `v3_gateway_credentials` (not visible to the older settings screen), encrypted with `encryptSecret`. `PaymentsGate.buildGateway` reads stored keys first (kept at most 30 seconds, dropped at once on a set or clear on the same server), then the environment; stored live keys need `PLAN_PAYMENTS_LIVE_ENABLED`. `PaymentGatewaySettingsService` counts stored keys as present. Redaction tests prove no value reaches a response, an audit row or a log. Tests: `wave4-gateway-credentials.spec.ts`.

## 7. W7 GST rate

`RulesAdminService.gstRate / setGstRate` with `plans/pricing/gst-rate-core.ts`. See the contract. The older generic tax-rate `PUT` and `DELETE` are unchanged (see the questions in the status file). Tests: `wave4-gst-rate.spec.ts`, including an end-to-end check that an order made before a rate change is settled and invoiced at its own rate.

## 8. W8 TDS on payouts

Schema: `grossMinor`, `tdsMinor`, `netMinor`, `tdsPercentBp`, `tdsEdited`, `tdsReason` on the payout, `pan` on the partner. Migration `20261230110000_v3_wave4_tds_payouts` (**not applied**; existing payouts become gross = total, TDS 0, net = total). Setting `tdsPercent` via `v3-referrals/settings/commission-settings.ts`, registered in `plans/admin/extra-settings.ts`. Rules `defaultTds` and `checkTds` in `referral-core.ts`. Tests: `wave4-tds-payouts.spec.ts`.

## 9. W9 Tests and docs

Unit tests: `wave4-directory-host`, `wave4-held-payments`, `wave4-commission-adjustment`, `wave4-partner-state`, `wave4-gateway-credentials`, `wave4-gst-rate`, `wave4-tds-payouts`. Integration files (written, **not run**): `test/held-payments.int.spec.ts`, `test/directory-host.int.spec.ts`, `test/commission-adjustment.int.spec.ts` (it also covers the TDS record). The route baseline and the role-matrix oracle were regenerated after each job; the diff against Wave 3 is only the routes in `API_CONTRACT_WAVE4.md` (1433 to 1439 routes; the oracle 411 to 417 staff routes).
