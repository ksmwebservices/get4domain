# ROADMAP — Get4Domain V2

> Future execution only. Reality is in [STATUS.md](STATUS.md); evidence in [AUDIT_REPORT.md](AUDIT_REPORT.md). Sequence follows PRD §91 priorities: **(1) security/data integrity → (2) tenant/auth foundation → (3) shared engines → (4) highest-value complete workflows → (5) external connectors → (6) industry extensions → (7) polish**, and PRD §90's release structure, with a new V2.0a stabilisation step inserted because the audit found live money/credential defects.

Effort sizes are **estimates for planning, not commitments**: S ≤ 3 days · M ≈ 1–2 weeks · L ≈ 3–5 weeks · XL ≈ 6+ weeks (one developer). Re-estimate after V2.0a, once tests exist.

```
V2.0a Stabilise ─▶ V2.0b Foundation ─▶ V2.1 Client WebApp ─▶ V2.2 Growth ─▶ V2.3 Comms Hub
                                                                    │              │
                                                                    ▼              ▼
                                                              V2.4 Standard BOS ─▶ V2.5 Industry Ops ─▶ V2.6 Hardening ─▶ V2.x Custom BOS
```

## V2.0a — Stabilise the live system *(new; precedes PRD §90's V2.0)*
**Why:** audit findings S1–S7, S10, S12–S14 are exploitable today; zero tests exist.
**Scope:** bind every Razorpay verify (platform invoice, wallet top-up, go-live, theme unlock, vendor-direct checkout) to a server-created order {vendor, purpose, amount} + unique payment id; lock down `create-order`; recompute checkout totals from DB prices; strip `password`/`inviteToken` from every response; fail-closed webhook secrets (define `webhook_secret_key`); global rate limiting + helmet + OTP attempt caps (customer OTP, crypto RNG, hashed store); enforce `adminRole` and extend `@RequireModule`/owner guards to every vendor controller; check Resend `error` results; atomic wallet debit; password reset/change; fix the missing `/team/accept-invite` route; persist uploads (volume) and tighten MIME/SVG; add ESLint config; stand up Jest + supertest against a **non-production** database and a minimal CI; first tests = payments, wallet, tenancy, DomainCampaign brackets.
**Size:** L. **Exit:** S1–S7 closed with regression tests; CI green; `npm run lint`/build/test pass; no secret-bearing field in any API response.

## V2.0b — Foundation and audit closure (PRD §90 V2.0)
**Scope:** migration baseline (reproducible `migrate deploy` from empty), decide id/soft-delete/money-type policy; **Business Master** + branches + numbering/FY + tax settings (§35/63J); real roles/permissions model and server-side enforcement (§47/63K); **audit log** (§49/63AB); server-side entitlement gating by plan/tier and add-on; **capability/industry profile engine** wired to server (registry tables currently write-only); remove or relabel every mock/fake-success path (Meta/Google/video/notifications/settings pages) per PRD §96; unify API-base/config; delete dead code.
**Size:** XL. **Exit:** audited matrix has no BROKEN; every button works or says Coming Soon; no fake success; regression tests cover core paths (PRD §90 exit criteria).

## V2.1 — Client WebApp Engine
**Scope:** subdomain + custom-domain serving (host→site rewrite, wildcard TLS, TXT ownership proof); per-vendor PWA (manifest, scoped service worker); **remove invented content** (honest empty states); real booking/order records instead of lead-only (Salon/Clinic/Hotel/Gym/Restaurant first); the three distinct webapp modes + "enable commerce" toggle (§63A–G); safe checkout with order lifecycle, address, tax, confirmation, vendor webhook reconciliation; per-vendor sitemap/robots/JSON-LD/GA injection (§67 SEO/AEO/GEO); customer portal on durable OTP.
**Size:** XL. **Dependencies:** V2.0a (checkout safety), V2.0b (capability engine, business master). **External:** wildcard DNS/TLS.

## V2.2 — Growth System
**Scope:** SEO Manager + score + issues + Fix Now; Search Insights; Share Links/UTM/QR; Growth Analytics from real records; Content Studio on business-master data + document/template engine (versioning, history, PDF/PNG); **social account OAuth + vendor-initiated publishing** via official APIs (Meta Page/IG first), publication entity, error/retry; coupons/loyalty/referrals as scoped. TeleCRM Lite parity (assignment UI, tags, timeline).
**Size:** XL. **External:** Meta App Review, Google Search Console/GBP OAuth, LinkedIn/YouTube approvals.

## V2.3 — Communication Hub
**Scope:** provider abstraction; **template model + lifecycle** (name/language/category/approval/sync); consent/opt-out; message queue + retry + DLR/read status; inbound thread inbox (unlock Hub tabs); vendor-own WABA (Meta Cloud API / BSP) vs central account decision; email campaigns/bounces/unsubscribe; **automation engine** (trigger→condition→action→log, loop protection, rate limits) and migrate the hard-coded hooks onto it.
**Size:** XL. **External:** WABA verification, DLT, template approvals, sender-domain verification.

## V2.4 — Standard BOS Core
**Scope:** Advanced TeleCRM (assignment rules, round-robin, scoring, lead→customer conversion, pipeline per industry, activities timeline); **task engine** (activate `VendorTask`; 8-state lifecycle; automation); HR (employee master, attendance, leave, payroll, payslip); product/service master (variants, SKU/barcode, HSN/GST, import/export); inventory (warehouses, stock ledger, adjustments); purchasing (supplier→PO→GRN→purchase invoice→payment); POS completion (barcode, hold/resume, split, returns, receipts); quotation→invoice; billing/GST engine (CGST/SGST/IGST, HSN/SAC, credit/debit notes, GSTR exports); accounting (ledgers, double-entry with immutable history, P&L/TB/BS fed by POS/web/restaurant); reports per role; CSV import/export.
**Size:** XL (split into 3–4 sub-releases). **Dependencies:** V2.0b (business master, roles, audit), V2.3 (automation).

## V2.5 — Industry Operations
**Scope:** complete the §63X workflow chain for the 20 configured industries in priority order (Retail, Restaurant, Salon, Clinic, Real Estate, Travel first), state machines, availability/conflict detection, booking→invoice link; add missing industries (Grocery, Vehicle Dealer, Wholesale, Pharmacy, News…) as capability profiles; industry dashboards/reports/documents.
**Size:** XL.

## V2.6 — Hardening and production readiness
Security review/pen-test; performance; accessibility; responsive (§58 breakpoints) + PWA verification; migration verification; observability (health, Sentry, structured logs, backups); full E2E regression (§97 flows); production checklist.
**Size:** L.

## V2.x+ — Custom BOS / enterprise extensions
Scoped per project (custom workflows, portals, AI/voice agents, dedicated infra). Must not block the standard release (PRD §71, §90).

## Not scheduled / out of scope for the standard release
AI Reels production (PRD §39 "Coming Soon"); marketplace connectors beyond the connector framework; Domain Campaign automation of ad-platform reporting (blocked on Meta/Google app review); competitor review (PRD §53 — recommend doing before V2.2 scoping).
