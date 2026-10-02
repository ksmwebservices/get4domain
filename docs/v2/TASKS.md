# TASKS — Get4Domain V2 (single-developer ordered backlog)

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
