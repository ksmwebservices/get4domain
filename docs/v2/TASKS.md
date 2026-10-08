# TASKS — Get4Domain V2 (single-developer ordered backlog)DONE 2026-10-08 — notifications are real; Settings shows real details read-only (Support changes them) |DONE 2026-10-08 — StockService: conditional UPDATE, all-or-nothing, ledger (VendorProduct only; Retail/Catalog POS paths not covered) |DONE 2026-10-08 — status + availability bucket in the public API; storefront badge |PARTIAL 2026-10-08 — cancel/failure restores stock; auto-refund NOT built (shop is alerted with the payment id) |PARTIAL 2026-10-08 — address + order-request workflow (Mark paid / Cancel); no separate order detail page |PARTIAL 2026-10-08 — low-stock notification + restock banner + Stock list; no Overview widget |DONE 2026-10-08 — real errors, OpenAI⇄Claude fallback, wallet checked first; run ai-health.js on the VM |PARTIAL 2026-10-08 — generated images saved to our uploads; no server-side library yet |

> Status of every task: **NOT STARTED** (audit-only baseline, 2026-10-02). Do not start without KSM's go-ahead. IDs are stable; sizes S/M/L/XL per [RELEASE_PLAN.md](RELEASE_PLAN.md). "Evidence" points at the finding that motivates the task.

## V2.0a — Stabilise
| ID | Task | Size | Depends | Evidence | Acceptance |
|---|---|---|---|---|---|
| T-001 | Persist a server-side Razorpay order record `{orderId, vendorId, purpose, refId, amountPaise}` at creation; on verify, fetch order+payment from Razorpay, check `status`, amount, notes, and enforce `UNIQUE(razorpayPaymentId)` | M | — | S1/S2 | Replaying a payment, paying a lower amount, or using another vendor's invoice all fail with tests |
| T-002 | Remove/restrict `POST /payments/create-order` (derive amount from invoice/plan only) | S | T-001 | S1 | No endpoint accepts a client amount |
| T-003 | Apply T-001 to wallet top-up, go-live conversion, theme unlock | M | T-001 | S2 | Same test matrix per flow |
| T-004 | Public checkout: price lookup from DB, bind confirm to order amount, idempotent confirm, vendor webhook | M | T-001 | S3 | ₹1-price tamper and replay tests pass |
| T-005 | Strip `password`/`inviteToken`/hashes from all API responses (serializer/`select`); add invite-token expiry | S | — | S4 | Contract test asserts no secret fields |
| T-006 | Define `webhook_secret_key` in settings; fail closed when unset | S | — | S5 | Unsigned webhook → 401 |
| T-007 | `@nestjs/throttler` global + strict limits on auth/OTP/public writes; helmet; input length caps; crypto-random hashed OTP with attempt counter | M | — | S6 | Brute-force tests lock out |
| T-008 | Enforce `adminRole` in `AdminGuard`; add `@RequireModule`/owner guard to every vendor controller; guard `PUT /vendor-payments` | M | — | S7/S8 | Permission matrix tests per principal |
| T-009 | Vendor-invoice collection: use vendor keys or reconcile via webhook; atomic, vendor-scoped invoice numbering; escape HTML in templates | M | T-001 | S9 | Paid link flips invoice; numbering collision test; XSS test |
| T-010 | Check Resend `{error}`; stop emailing plaintext passwords; atomic wallet debit; campaign approve idempotency; refund-on-failure for alerts | M | — | S10/S12 | Failure-path tests |
| T-011 | Password reset/change flow; real refresh tokens; shorten access TTL | M | — | S13 | E2E reset flow |
| T-012 | Uploads on a volume/object storage; magic-byte sniffing; SVG sanitise/deny; quotas | S–M | — | S14 | Upload tests |
| T-013 | Add ESLint config + deps; Jest + supertest harness against a **non-production** DB; GitHub Actions (build, lint, test) | M | — | no tests/CI | CI green on PR |
| T-014 | Fix `/team/accept-invite` route; fake Settings/Notifications/Plans pages → real or removed; `/features` stale price; Analytics Hub paise bug; admin "View Invoice" | M | — | UI findings | UI action matrix rows move to WORKING |
| T-015 | DomainCampaign: server-side already-invoiced guard; switch raw SQL to typed client after `prisma generate` | S | — | S15 | Double-click test |

## V2.0b — Foundation
| ID | Task | Size | Depends |
|---|---|---|---|
| T-020 | Migration baseline (`migrate diff --from-empty`), reconcile `_prisma_migrations`, drop `db push` from runbook | L | T-013 |
| T-021 | Decide + apply id/soft-delete/money-type policy; fix `CLAUDE.md` accordingly | M | T-020 |
| T-022 | Business Master fields + Branch model + numbering/FY + tax settings; wire into invoices/documents | L | T-020 |
| T-023 | Role/permission tables + enforcement + audit log writer/viewer (money, permissions, integrations, deletes) | L | T-020 |
| T-024 | Server-side entitlement guard (plan/tier/add-on) + capability engine read by backend | M | T-023 |
| T-025 | Remove/label every mock success path (Meta, Google Ads, video, test-connection); honest "Not Connected/Approval Required" states | M | T-013 |

## V2.1 – V2.6 (headline tasks; expand at release start)
| ID | Task | Release |
|---|---|---|
| T-030 | Host-based routing for subdomains + custom domains, wildcard TLS, TXT ownership | V2.1 |
| T-031 | Booking/order records for Salon, Clinic, Hotel, Gym, Restaurant, Real Estate; remove invented content | V2.1 |
| T-032 | Enable-commerce toggle + order lifecycle + shipping/tax/confirmation | V2.1 |
| T-033 | Per-vendor PWA + sitemap/robots/JSON-LD/GA injection | V2.1 |
| T-040 | SEO Manager, Search Insights, Share Links/UTM/QR, Growth Analytics | V2.2 |
| T-041 | Document/template engine + data-aware Content Studio | V2.2 |
| T-042 | Social accounts OAuth + vendor-initiated publish (Meta first) | V2.2 |
| T-050 | Template lifecycle, consent/opt-out, queue/retry/DLR | V2.3 |
| T-051 | Threaded inbox, vendor WABA, email campaigns/bounces | V2.3 |
| T-052 | Automation engine; migrate hard-coded hooks | V2.3 |
| T-060 | Advanced TeleCRM + task engine | V2.4 |
| T-061 | Product master, inventory ledger, purchasing | V2.4 |
| T-062 | Quotation → GST billing → accounting | V2.4 |
| T-063 | HR & payroll | V2.4 |
| T-070 | Industry operation chains per PRD §63X (priority order in ROADMAP) | V2.5 |
| T-080 | Security review, perf, a11y, responsive, observability, backups, E2E | V2.6 |

## Test tasks (run alongside every release)
See [TEST_PLAN.md](TEST_PLAN.md). Every task above ships with unit + integration tests; permission and failure-path tests are mandatory for money, tenancy and communication code.


## Commercial Engine v1 (dispatch 07-Oct-2026)
Design, flows and policies: [COMMERCIAL_ENGINE.md](COMMERCIAL_ENGINE.md). Staff policy: [BILLING.md](BILLING.md). Code + tests are **COMPLETE and pushed**; the rows marked **KSM** need action on the VM ([DEPLOYMENT.md §3b](DEPLOYMENT.md)).

| ID | Task | State |
|---|---|---|
| C-001 | Audit of subscriptions/entitlements/invoices/payments/demo-vs-live/quotes/senders; write the map | **COMPLETE** (COMMERCIAL_ENGINE.md §A) |
| C-002 | Additive migration `20261007120000_commercial_engine` (PayeeSettings, BillingTerm, BillingDeal, ManualPaymentSubmission, PromoCode/Redemption, PlanChangeRequest, audit log, Invoice extension) | **COMPLETE** — written; **KSM: apply** |
| C-003 | Pricing math (GST modes on net-after-discount), entitlements from `planKey` only, term/renewal rules, promo rules, UPI/QR, tokens | **COMPLETE** (104 assertions) |
| C-004 | Deal builder, invoice issue, "activate now", prospect pre-sale vendor, ₹0 settle | **COMPLETE** |
| C-005 | Public `/pay/[token]` (Razorpay, UPI QR + proof, promo), hashed expiring throttled tokens | **COMPLETE** |
| C-006 | Admin: Payee & QR, invoices (copy/resend/void/PDF), Payments to confirm (+badge), promos, plan changes, vendor Billing-terms page | **COMPLETE** |
| C-007 | Activation / renewal (extend from periodEnd) / lapse (blocks publish·messaging·AI, deletes nothing) / daily advisory-locked job | **COMPLETE** |
| C-008 | Vendor Billing page (term, banner, invoices + Pay, plan-change request, hide self-serve upgrade for deals); `audit:vendor-dark` clean | **COMPLETE** |
| C-009 | Stepnrock: `scripts/activate-stepnrock.js` (dry-run default) + feature audit + fixes (CRM enquiry, SEO cap, theme counter) | **COMPLETE** — **KSM: run dry-run, then `--apply`; redeploy the stepnrock site** |
| C-010 | Tests: 284 assertions + earlier security suites | **COMPLETE** |
| C-011 | **KSM:** set Payee & QR (UPI ID) before sharing any pay link | OPEN |
| C-012 | Decide: platform widget vs scripted bot on stepnrock's site (website bot reply) | OPEN |
| C-013 | Decide: grant the ₹499 credit on *activate-now* (current) or only on payment | OPEN |
| C-014 | Persistent volume for public `/uploads` | **COMPLETE in code** (follow-up A: named volume + chown); **KSM: one-time backup/restore, DEPLOYMENT.md §3b.1/§3b.3**. Object storage/quotas/SVG rules stay under T-012 |
| C-015 | Browser E2E for the pay page + a Postgres-backed integration run of the migration SQL | OPEN |
| C-016 | MARKETING staff: no commerce UI, 403 on every commerce endpoint; nav as testable data | **COMPLETE** (follow-up A; test enumerates all routes + nav leak scan) |
| C-017 | Plan-change approval: editable net price (default list, reason, >20% CONFIRM, range check, audit log); renewal bills it; credit-leak fix | **COMPLETE** (follow-up A; migration `20261007130000_plan_change_price` **KSM: apply**) |
| C-018 | Reel rendering in the container: runner image does not copy `remotion/` (found while auditing uploads; not changed) | OPEN — check on the VM whether reels work |
| C-019 | Hotfix: void-returning advisory locks via `$queryRaw*` (Deal builder + live wallet/checkout locks) → `advisoryXactLock()`; raw-SQL guard; strict Prisma fake; `verify-db-lock.js` | **COMPLETE in code**; **KSM: deploy + run `verify-db-lock.js` (DEPLOYMENT.md §3b.7)** |
| C-020 | Stepnrock: resume the leftover unpaid invoice `INV-2026-0005` (no second invoice) | **KSM: dry run → `--apply`** |
| C-021 | AI Studio credit prorated by billing term (rule, per-deal override, grant-the-difference logic, vendor/admin display, stepnrock ₹250) | **COMPLETE in code**; **KSM: migrate deploy `20261008100000`, rebuild API + web, stepnrock dry run → `--apply` (DEPLOYMENT.md §3b.8)** |

## Vendor dashboard audit backlog (2026-10-08) — see VENDOR_DASHBOARD_AUDIT.md §7
Sizes S ≤ 1 day · M 2–5 days · L 1–3 weeks. **KSM** = needs KSM's accounts, keys or a decision.

| ID | Task | Size | Phase | Needs KSM | State |
|---|---|---|---|---|---|
| V-001 | Put Billing in the menu + payment-due banner on Overview (stepnrock due 2026-10-10) | S | 0 | — | OPEN |
| V-002 | Replace fake Notifications and fake Settings/Profile with real ones | S | 0 | — | OPEN |
| V-003 | Reword/remove the 32 claims (23 REWORD + 9 REMOVE) per CLAIMS_VS_REALITY.md | S | 0 | wording decision | OPEN |
| V-004 | Pull the AI error line from the VM log (`docker logs get4domain_backend … grep "OpenAI text error\|Anthropic API error\|DALL-E error"`) | S | 0 | KSM runs it; keys/credit | OPEN |
| V-010 | One product store: finish the Universal Catalogue cutover (My Products gains price/SKU/stock/status/variants; POS, Inventory, Catalog tabs and checkout read `VendorProduct`) | L | 1 | approve prod data migration | OPEN |
| V-011 | Atomic stock service (guarded UPDATE, reserve at order, `CHECK stock >= 0`) | M | 1 | — | OPEN |
| V-012 | Out-of-stock end to end (status, public `inStock`, storefront badge) | S | 1 | — | OPEN |
| V-013 | Cancel/failure restores stock; auto-refund if a captured payment cannot become an order | M | 1 | — | OPEN |
| V-014 | Checkout address + order status workflow + order detail page | M | 1 | — | OPEN |
| V-015 | Low-stock alert (notification + Overview widget) | S | 1 | — | OPEN |
| V-016 | Vendor Razorpay onboarding (test-mode check; cart enabled only when verified) | M | 1 | vendors' keys | OPEN |
| V-017 | Customer-invoice pay links on the vendor's keys + webhook marks paid; sequence numbering | M | 1 | confirm money flow | OPEN |
| V-020 | Feature registry + generators + CI guard (FEATURE_REGISTRY_DESIGN.md) | M | 2 | — | OPEN |
| V-021 | New navigation behind `nav_v2`, then flip (DASHBOARD_IA_PROPOSAL.md) | M | 2 | — | OPEN |
| V-022 | Plan → modules/addons provisioning at activation/renewal/override; upgrade cards | M | 2 | Workspace/BOS module map | OPEN |
| V-023 | Remove duplicates/orphans; replace `ComingSoon` with availability/upgrade cards | S | 2 | — | OPEN |
| V-030 | Website hub (Content · Pages · Design · Domain · Search & AI visibility) | L | 3 | — | OPEN |
| V-031 | Site-data contract for standalone apps (shared kit so stepnrock/deebi/allwin read CMS text, contact, SEO) | M | 3 | — | OPEN |
| V-032 | SEO/GEO/AEO: per-page meta, JSON-LD, sitemap/robots/llms.txt per vendor, GA injection, score | M | 3 | — | OPEN |
| V-033 | Add-a-page (section builder) for platform-rendered sites | L | 3 | — | OPEN |
| V-034 | Domain: vhost/SSL automation; finish ResellerClub configuration | M | 3 | ResellerClub customer/contact/NS ids | OPEN |
| V-040 | AI: surface real errors, OpenAI→Claude fallback, balance pre-check | S | 4 | valid funded keys | OPEN |
| V-041 | AI: persist generated images; server-side library | M | 4 | storage config | OPEN |
| V-042 | AI: reels rendering in the container; video provider | M | 4 | video provider key | OPEN |
| V-050 | Social OAuth + real publish + scheduler | L | 5 | developer apps / review | OPEN |
| V-051 | WhatsApp BSP per vendor; website bot embed for standalone sites | M | 5 | BSP account | OPEN |
| V-052 | Google Business / Analytics / Search Console connectors (or reword as a service) | M | 5 | Google OAuth app | OPEN |
| V-060 | HRM (staff, attendance, payroll) | L | 6 | — | OPEN |
| V-061 | Task board UI + API on `VendorTask` | M | 6 | — | OPEN |
| V-062 | Accounting depth: GSTR export, stock ledger | M | 6 | — | OPEN |
| V-070 | Fix and schedule sandbox cleanup (delete wallet rows; daily cron); clear the 39 expired demos | S | any | — | OPEN |

## Release 1A (2026-10-09) — status

| ID | Task | Status |
|---|---|---|
| R1A-1 | Feature registry, generator, CI guard | DONE (registry/, `npm run registry:check`) |
| R1A-2 | Dashboard v2 shell behind `nav_v2` | DONE, production-build walkthrough in evidence/dashboard-v2 |
| R1A-3 | Merge screens into ten departments | DONE as mounts (steps 1-8); the three product stores stay separate tabs (deferred) |
| R1A-4 | Plan-driven provisioning, dry run, switch script, Plan access | DONE; run the dry run on the VM before switching anyone |
| R1A-5 | Dashboard honesty fixes | DONE (dashboard text only; marketing-page claims are Release 1B) |
| R1A-6 | Reels and video Coming soon | DONE, no-debit test |
| R1A-7 | Special arrangements | DONE; migration written and rehearsed on PGlite, NOT applied |
| R1A-8 | Verification | DONE: suites green, registry guard green, browser walk with screenshots |
| R1A-9 | Docs and push | DONE |
| R1B-next | Move half-year percent and plan display names to admin settings; unify the three product stores; Reports, Campaigns, Quotes, Collect payments; marketing-page claim fixes; stepnrock arrangement from the admin page | NOT STARTED |
