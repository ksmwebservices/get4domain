# RELEASE_PLAN — Get4Domain V2 (PRD §91 schedule requirement)

> No calendar dates are given: PRD §91 prohibits inventing dates before team capacity is known. Sequence, effort sizes (S ≤ 3d · M ≈ 1–2w · L ≈ 3–5w · XL ≈ 6+w, one developer) and acceptance criteria are given instead. Reality: [STATUS.md](STATUS.md). Phases: [ROADMAP.md](ROADMAP.md). Task-level list: [TASKS.md](TASKS.md).

## Single-developer recommendation (PRD §91: "avoid opening too many incomplete modules")
Work **one release at a time, in order**, and do not start a release until the previous one's exit criteria pass. Inside a release, finish a module fully (UI + API + DB + validation + permissions + business rules + workflow + reports + audit + tests + error handling, PRD §63AD) before opening the next. Do **not** run Growth, Comms and BOS in parallel.

## Schedule table (PRD §91 fields)

| Release | Milestone | Workstream | Feature / module | Depends on | Current → target | Migration impact | External dependency | Risk | Effort | Seq |
|---|---|---|---|---|---|---|---|---|---|---|
| **V2.0a** | M0.1 Money integrity | Payments | Order-bound verify, idempotency, amount checks (invoice, wallet, go-live, theme, vendor checkout) | — | BROKEN → WORKING | unique index on payment ids; order→purpose table | Razorpay (test keys) | **High** — touches live payments | M | 1 |
| | M0.2 Credentials & access | Auth/permissions | Strip secrets from responses; admin-role + module guards on all controllers; fail-closed webhooks; invite-token expiry | — | BROKEN/PARTIAL → WORKING | none | — | Med | M | 2 |
| | M0.3 Abuse controls | Platform | Throttler, helmet, OTP attempt caps, input length caps, captcha/OTP on public writes | — | MISSING → WORKING | none | — | Low | S–M | 3 |
| | M0.4 Quality gates | Engineering | ESLint, Jest+supertest on non-prod DB, CI, first suites | M0.1–0.3 | MISSING → PARTIAL | test DB | non-prod Postgres | Low | M | 4 |
| | M0.5 Honesty fixes | UX/integrations | Resend result checks; relabel mocks; fix fake Settings/Notifications/Plans pages; `/team/accept-invite`; wallet race | M0.4 | MOCKED → WORKING/labelled | none | — | Low | M | 5 |
| **V2.0b** | M1.1 Migration baseline | Data | Reproducible `migrate deploy`; reconcile drift; id/soft-delete/money policy | V2.0a | PARTIAL → WORKING | **baseline + type changes** | — | **High** (prod DB) | L | 6 |
| | M1.2 Business Master + branches | Core | Legal/GST/PAN/bank/T&C/numbering/FY; Branch model | M1.1 | MISSING → WORKING | new tables/fields | — | Med | L | 7 |
| | M1.3 Roles/permissions + audit log | Core | Roles table, granular perms, server enforcement, audit writer/viewer | M1.1 | MISSING → WORKING | new tables | — | Med | L | 8 |
| | M1.4 Entitlements + capability engine | Core | Plan/tier/add-on gating server-side; registry tables read by backend | M1.3 | MISSING → WORKING | minimal | — | Med | M | 9 |
| **V2.1** | M2.1 Subdomain/custom domain serving | Client WebApp | Host rewrite, wildcard TLS, ownership proof | V2.0b | MISSING → WORKING | domain fields | wildcard DNS/TLS | **High** (infra) | L | 10 |
| | M2.2 Honest content + real bookings | Client WebApp | Remove invented content; booking/order records for 6 priority industries | M1.4 | PARTIAL → WORKING | booking tables | — | Med | L | 11 |
| | M2.3 Safe commerce + order lifecycle | Commerce | Address/tax/status/confirmation, vendor webhook, enable-commerce toggle | M0.1, M2.2 | BROKEN → WORKING | order model | Razorpay | Med | L | 12 |
| | M2.4 Per-vendor PWA + SEO/AEO/GEO | Client WebApp | Manifest/SW scope; sitemap/robots/JSON-LD/GA | M2.1 | MISSING → WORKING | none | — | Low | M | 13 |
| **V2.2** | M3.1 SEO Manager + Search Insights + Share Links | Growth | Score/issues/Fix Now; internal search capture; UTM/QR | M2.4 | MISSING → WORKING | new tables | — | Low | L | 14 |
| | M3.2 Content/Document engine | Growth | Data-aware studio, templates, versioning, PDF/PNG, history | M1.2 | PARTIAL → WORKING | doc tables | — | Med | L | 15 |
| | M3.3 Social connect + vendor-initiated publish | Social | OAuth, accounts, publications, capability discovery, retry | M1.3 | MISSING → BLOCKED-EXTERNAL→WORKING | encrypted token store | **Meta App Review**, Google/LinkedIn | **High** (approvals) | XL | 16 |
| **V2.3** | M4.1 Templates/consent/queue/DLR | Comms | Template lifecycle, opt-out, queue/retry, delivery status | V2.0b | MISSING → WORKING | comms tables | WABA, DLT, template approval | Med | L | 17 |
| | M4.2 Inbox + vendor WABA + email campaigns | Comms | Threaded inbox, vendor-own number, bounces/unsubscribe | M4.1 | PARTIAL → WORKING | thread tables | Meta/BSP | Med | L | 18 |
| | M4.3 Automation engine | Automation | Trigger→condition→action→log; migrate hooks | M4.1 | MISSING → WORKING | rule/run tables | — | Med | L | 19 |
| **V2.4** | M5.1 Advanced TeleCRM + tasks | BOS | Assignment, scoring, conversion, task engine | M4.3 | PARTIAL/MISSING → WORKING | lead/task fields | — | Med | L | 20 |
| | M5.2 Products/inventory/purchasing | BOS | Variants, SKU/barcode, HSN, ledger, warehouses, PO/GRN | M1.2 | PARTIAL/MISSING → WORKING | many tables | — | Med | XL | 21 |
| | M5.3 Quotation → billing → GST → accounting | BOS | Vendor quote engine, GST split, credit notes, ledgers, P&L fed by POS/web | M5.2 | MISSING → WORKING | many tables | GSP (optional) | **High** (financial correctness) | XL | 22 |
| | M5.4 HR/payroll | BOS | Employee master, attendance, leave, payroll, payslip | M1.3 | MISSING → WORKING | HR tables | — | Med | L | 23 |
| **V2.5** | M6.x Industry ops | Industry | §63X chains, state machines, conflicts, industry reports/docs (priority: Retail, Restaurant, Salon, Clinic, Real Estate, Travel) | V2.4 | PARTIAL → WORKING | per-industry | — | Med | XL | 24 |
| **V2.6** | M7.x Hardening | All | Pen-test, perf, a11y, responsive, observability, backups, E2E §97 flows | all | PARTIAL → WORKING | none | — | Low | L | 25 |

## Acceptance criteria by release (summary — full DoD in [CHECKLIST.md](CHECKLIST.md))
- **V2.0a:** an attacker with a ₹1 payment cannot change any invoice/wallet/plan/theme/order state; no API response contains `password`/`inviteToken`/secret; unauthenticated webhook is rejected; public endpoints are rate-limited; CI runs lint + build + tests; tenancy test matrix passes for every controller.
- **V2.0b:** fresh DB builds via `migrate deploy`; Business Master drives invoices/documents; every API route enforces role+entitlement server-side; audit log records money and permission events; zero mock-success paths.
- **V2.1:** a vendor site is served on its subdomain and a custom domain; real booking/order records are created (not just leads) for priority industries; no invented content; checkout reconciles with a webhook.
- **V2.2:** SEO score/issues computed from real pages; connected Meta Page can receive a vendor-initiated post (or the UI truthfully shows "Approval Required"); every metric traces to real records.
- **V2.3:** every automated message uses an approved template with consent; delivery status stored; an automation rule fires, logs, retries, and is loop-safe.
- **V2.4:** the PRD §63AE minimum end-to-end test (setup → lead → quote → order → invoice+GST → payment → fulfilment → ledger → reports → audit) passes.
- **V2.5/2.6:** §97 cross-channel flows pass in E2E; responsive at 1440/1280/tablet/390/360 px; production checklist signed.

## Re-planning triggers
Re-estimate after V2.0a (tests give a real baseline); if Meta/WABA/DLT approvals slip, V2.2/V2.3 external-dependent items continue as BLOCKED-EXTERNAL with truthful UI states and the rest of the release ships (PRD §98).
