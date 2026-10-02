# CHECKLIST — Get4Domain V2

> Living checklist. `[x]` only with evidence; `[ ]` otherwise. State as of **2026-10-02** (audit baseline). Definitions: PRD §62 (definition of done), §63AE (full BOS end-to-end), §98 (final DoD), §96 (no-placeholder policy).

## A. Audit baseline (this dispatch — PRD §94/§99)
- [x] V2 PRD adopted as authoritative; older PRD/spec docs marked superseded
- [x] Repository + (static) application audit completed against the PRD
- [x] Master Feature, UI Action, Integration, Industry, Communication, Test matrices produced
- [x] Audit report, status, roadmap, release plan, tasks, checklist, permissions, migration plan, deployment, test plan produced
- [x] Git integrity verified against the live remote
- [ ] **Runtime** audit (running the app against a non-production DB) — not done; required before any "WORKING" claim is final
- [ ] Competitor review (PRD §53) — not done
- [ ] KSM review/approval of the audit and of the V2.0a stabilisation scope

## B. Pre-V2 stabilisation exit (V2.0a)
- [ ] S1–S3: payment/checkout verification bound to server orders, idempotent
- [ ] S4: no secret/hash/token in any API response
- [ ] S5: webhook fail-closed
- [ ] S6: rate limiting/lockout/helmet in place
- [ ] S7–S8: admin sub-roles and module permissions enforced on every route
- [ ] S9–S14 closed
- [ ] ESLint + CI + first test suites green
- [ ] Non-production database for tests exists

## C. PRD §62 — Definition of done (25 items)
- [ ] 1 Existing working features remain available
- [ ] 2 New navigation coherent
- [ ] 3 All major categories have working capability configurations
- [ ] 4 Main dashboard operational
- [ ] 5 Growth module functional
- [ ] 6 SEO Manager functional
- [ ] 7 Marketing Studio functional (Phase 1)
- [ ] 8 Business documents use real vendor data
- [ ] 9 Leads/tasks/CRM/communication connected
- [ ] 10 Commerce works with product/order/inventory data
- [ ] 11 Food capabilities represented
- [ ] 12 Sales Channels architecture present
- [ ] 13 Connector health/errors visible
- [ ] 14 Search Insights functional
- [ ] 15 Offers/loyalty/referrals functional
- [ ] 16 Social account connection secure
- [ ] 17 Reels clearly "Coming Soon"  *(currently shipped as live — decision pending)*
- [ ] 18 Demo data for all major categories *(partially: 685+ demo paths exist for 20 industries; separation from production paths to be verified)*
- [ ] 19 Mobile UI works
- [ ] 20 Tests pass *(none exist)*
- [ ] 21 No real customer data in demos *(Vendor Settings page pre-fills a real customer's name/email/phone — must go)*
- [ ] 22 No unsupported third-party behaviour faked *(Meta/Google/video mocks violate this today)*
- [ ] 23 Documentation updated
- [ ] 24 Deployment/build passes
- [ ] 25 Final feature-gap audit performed

## D. PRD §63AE — minimum end-to-end BOS test
Business setup → master data → sales (lead→quote→accept) → transaction (order/booking→invoice→GST→payment) → operations (task, status, inventory) → finance (receivable, ledger, reports) → communication → reporting → audit.
- [ ] Passes end to end for at least one industry (currently impossible: no vendor quotation engine, no GST engine, no ledger, no task engine, no audit log)

## E. PRD §97 — cross-channel acceptance flows
- [ ] Growth lead flow (enquiry → TeleCRM Lite → acknowledgement → report)
- [ ] BOS sales flow
- [ ] Social publishing flow
- [ ] WhatsApp automation flow
- [ ] Inventory/POS flow

## F. PRD §96 — no-placeholder policy sweep
- [ ] No fake API/payment/social/WhatsApp/SMS/email success
- [ ] No fake stock/invoice/payment state
- [ ] No hard-coded dashboard metrics presented as real (Notifications page, Settings pages, Admin Plans)
- [ ] No buttons without a functional action
- [ ] No static lists pretending to be DB records (admin expenses in localStorage)

## G. Per-release gate (copy for each release)
- [ ] Matrices updated (FEATURE_MATRIX / UI_ACTION_MATRIX / INTEGRATIONS / INDUSTRY / COMMUNICATION)
- [ ] STATUS.md updated
- [ ] Tests added for every module touched (unit + integration + permission + failure path)
- [ ] Build + lint + tests green in CI
- [ ] Migration plan reviewed; additive migration applied **before** dependent code is deployed
- [ ] Environment variables documented (DEPLOYMENT.md)
- [ ] Final report lists what works, what remains, what is externally blocked, what is next (PRD §99)
