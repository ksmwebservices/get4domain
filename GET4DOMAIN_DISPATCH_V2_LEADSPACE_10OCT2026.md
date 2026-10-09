# GET4DOMAIN V2 — DISPATCH B: LEADSPACE
Date: 10 Oct 2026 · From: KSM (via Claude) · To: Claude Code · Branch: `get4domain-site`

ONE self-contained document. Execute every phase in order, autonomously, to the end. Do not stop to ask KSM questions; decide, proceed, record each decision. Report in the checklist format in section 13.

Run this AFTER Dispatch A (`GET4DOMAIN_DISPATCH_V2_BOS_V1_COMPLETE_10OCT2026.md`) is reported good and deployed; it reuses A's social publisher service and WhatsApp provider abstraction. If A's shared services do not exist yet, build them here to the interfaces described in A section 6 and say so.

The ground rules in `GET4DOMAIN_DISPATCH_V2_FULL_BOS_09OCT2026.md` section 2 apply in full (additive migrations only, never touch live vendor data, dry-run defaults, redirects kept 180 days, MARKETING role 403 on money routes, plain-sentence errors, Open only with a test id). Prisma stays pinned 6.19.3. Both builds 0 errors before every commit. Never run `security-verify/run-all.js`; use `run-offline.js`. After any shell edit of a `.sql` file or a file with `$$`, re-read it.

---

## 0. HOW TO RUN THIS (KSM reads this part)

| Step | Paste into | Command |
|---|---|---|
| 1 | **Windows PowerShell** | `cd C:\Get4Domain\get4domain-site` then `git status` (clean) then `git pull origin get4domain-site` |
| 2 | Save this file in `C:\Get4Domain\get4domain-site\` | in **PowerShell**: `git add .` and `git commit -m "docs: dispatch B LeadSpace"` |
| 3 | **Windows PowerShell** | `claude` |
| 4 | **Claude Code** | `Read C:\Get4Domain\get4domain-site\GET4DOMAIN_DISPATCH_V2_LEADSPACE_10OCT2026.md completely and execute every phase end to end without stopping to ask questions. Keep docs/v2/LEADSPACE_PROGRESS.md updated after every phase so a restart can resume. Report in the checklist format at the end. Push to origin as the last step.` |
| 5 | If it stops early | **Claude Code**, new session: `Read docs/v2/LEADSPACE_PROGRESS.md and GET4DOMAIN_DISPATCH_V2_LEADSPACE_10OCT2026.md, resume from the first unfinished phase, same rules. Push to origin as the last step.` |
| 6 | Paste the final checklist back to Claude as plain text | |
| 7 | **VM terminal** only after Claude says the report is good | Section 14 |

If the push is blocked, say so; KSM pushes: `git push origin get4domain-site`.

---

## 1. WHAT LEADSPACE IS (KSM's definition)

LeadSpace is a growth product that works on its own or as an add-on to BOS. It replaces Campaigns and DomainCampaign.

- A vendor gets a **free single landing page** on a Get4Domain subdomain, chosen from an industry template, built automatically from their company details and products or services. An existing single-page mobile-responsive site can instead be used as the landing page and restyled for the purpose. Custom domain and Website Manager are included.
- The page has **one primary goal**: enquiry, booking, appointment, site visit, or cart order (an order request, no payment collected by us).
- Customers verify with a WhatsApp OTP sent from **one common Get4Domain WhatsApp number**. Verified events land in the vendor's dashboard as a simple **Leads and bookings** list (not TeleCRM).
- **Get4Domain promotes the vendors** through an automated, admin-controlled promotion scheduler: AI Studio content, posted to Get4Domain's own Meta pages, Telegram channels and other networks; the vendor's own Google Business Profile with their permission; Merchant Centre feed for product vendors.
- The vendor pays through a **prepaid wallet**. Each verified event deducts automatically at a fixed price by event type. Our only invoice is the GST tax invoice for each wallet refill. LeadSpace has no billing, stock or accounts for the vendor; those are BOS.
- Target trades: handyman and home services, builders and interiors, real estate agents, freelancers, small startups, photographers and events, tutors; advocates and clinics under the restrictions in section 8.

## 2. PHASE 0 — AUDIT, REUSE FIRST

Before writing anything, audit and write `docs/v2/evidence/leadspace/AUDIT.md` covering what already exists: Growth Hub controller and ads, Campaigns and `DomainCampaign` code and data (Allwin Tours holds campaign data), the public widget lead endpoint, public checkout service, bookings and appointment engine, wallet and ledger, AI Studio, landing page templates and the subdomain router, domain handling, `social` code, and the OTP code paths. For each: reuse, wrap, or replace, and why. List every place a vendor wallet balance can pause a site (it must not, see 5.5).

## 3. PHASE 1 — DATA MODEL (additive)

Names are intent. Reuse existing models where the audit says they fit.

1. `LeadspaceProfile`: vendorId, category, subcategory, city, service area, goal (ENQUIRY, BOOKING, APPOINTMENT, SITE_VISIT, CART_ORDER), mode (TEMPLATE or EXISTING_PAGE), template id, verification status, noindex flag, regulated-trade flags, RERA number, status.
2. `LeadEvent`: vendorId, type (same five), customer name and phone, payload (JSON: items, date and time, message, property, budget), source and UTM, consent record id, OTP verified at, status (NEW, HELD, DELIVERED, CONTACTED, WON, LOST, DISPUTED, CREDITED), price charged, wallet ledger id, idempotency key, created at. Index on vendor and date.
3. `LeadPriceRule`: category, city (or all), event type, price, effective from and to, admin editable, versioned. Resolution order: city and category, then category, then global.
4. `WalletPurse` typing on the existing wallet: purse kinds LEADS and AI (keep AI credit behaviour unchanged), running balance on every ledger row, idempotency keys on debits and credits. Closed-loop: usable only for Get4Domain services.
5. `ConsentRecord`: customer phone hash, text version shown, purpose, vendor shown, timestamp, IP hash.
6. `InvalidLeadCredit`: lead id, reason (WRONG_NUMBER, DUPLICATE, SPAM, VENDOR_OWN, OTHER), decided by (AUTO or ADMIN), amount, time.
7. `PromotionPlan` and `PostJob`: vendor, channels, schedule, theme, status (DRAFT, AWAITING_APPROVAL, APPROVED, SCHEDULED, POSTED, FAILED, SKIPPED), content, asset, link, results (impressions, clicks), approval log.
8. `AdSpendEntry`: date, channel, category, city, amount, note (our own boosts), so cost per verified lead can be measured.
9. Registry: add plan key **LEADSPACE** as a free base tier every vendor has, and an add-on `leadspace` for BOS vendors. BOS vendors keep all BOS features; LeadSpace features appear under Marketing and Growth. LeadSpace-only vendors get the short mobile menu in Phase 4.

## 4. PHASE 2 — LANDING PAGES

1. Industry template catalogue (start with 10 to 12 categories from section 1) with goal-specific blocks: hero with one primary button, offer, services or products with prices, gallery, trust (reviews, years, areas), map, FAQ, sticky mobile call-to-action. Generated automatically from company details, services and products; vendor edits in Website Manager.
2. **Existing page mode**: take the vendor's current single-page site and add only the purpose layer (primary button, form, sticky CTA, tracking); never rewrite their content.
3. Goal flows: Enquiry (name, phone, message), Booking and Appointment (date, time slot, service), Site visit (date, property or project), Cart order (items, quantity, delivery details, notes, no payment).
4. Every flow ends in the verified event path of Phase 3.
5. **Merchant Centre feed** for product vendors, generated from the item master (reuses Dispatch A S3 item 4 if present).
6. **Abuse controls**: phone OTP for the vendor, business name and category check, blocklist words, report-abuse link on every page, unverified pages are `noindex` and carry no promotion, rate limits on page creation, admin suspend.
7. Pages are fast, mobile first, SEO-ready (title, description, schema.org LocalBusiness, sitemap, canonical).
8. Never rely on the wallet to keep the page up (5.5).

## 5. PHASE 3 — CAPTURE ENGINE, COMMON WHATSAPP, WALLET RULES

1. One public API (`/leadspace/event`) multi-tenant by host or vendor id; vendors need no keys or backend. Validates, rate limits, dedupes (same phone, vendor and event type within a window), checks consent.
2. **OTP** through the WhatsApp provider abstraction from Dispatch A S3, using the common Get4Domain number. Authentication template only. Sandbox implementation until KSM's Meta approval; email or SMS fallback only where configured. Rate limits per phone, device and hour; CAPTCHA-free abuse heuristics; no OTP to numbers already blocked.
3. **Common number rules** (enforced in code): only transactional and authentication templates; never promotional blasts; consent text on every form; the vendor alert carries the customer's number and a tap-to-chat link, and the conversation continues on the vendor's own WhatsApp; no chat relay through our number; per-vendor spam-rate monitoring.
4. **Charging**: on OTP success, in one database transaction, create the event and debit the LEADS purse at the resolved price, idempotently. Fixed price per event type, never a percentage of order value.
5. **Never pause the page.** If the balance is too low, the page stays up, the event is still captured and saved as HELD; the vendor sees a count and masked contact ("2 new customers waiting"). A refill releases held events oldest first, debiting at release. Admin switch per vendor to change this to "reject with a polite message". Default: hold and unlock.
6. Vendor alert on delivery: WhatsApp (when approved) and email and push; wallet low-balance alerts at configurable thresholds.
7. **Invalid-lead credit** within 48 hours: automatic for failed-OTP duplicates and vendor's own number; vendor can raise a dispute with a reason; admin decides in a queue; every decision is in the ledger.
8. **Refund and expiry** rules configurable in admin (default: unused balance is refundable on request less payment fee within 12 months; expiry 24 months). Mark for CA and lawyer review.
9. Cart orders: vendor confirms or declines in the dashboard; both outcomes are kept; the charge is at verified order request.

## 6. PHASE 4 — VENDOR MOBILE DASHBOARD (bottom navigation)

A mobile-first shell with a five-tab bottom bar, used by LeadSpace-only vendors and reachable from BOS vendors as Marketing and Growth → LeadSpace.

| Tab | Content |
|---|---|
| Home | Wallet balance, new and held leads, today's bookings and orders, promotion status, one next action |
| Leads | One list with chips: Enquiries, Bookings, Appointments, Site visits, Orders. Status New, Contacted, Won, Lost; notes; call and WhatsApp buttons; export CSV; held leads masked until refill |
| Page | Goal, template, services and products, Website Manager, domain, preview, publish |
| Promote | Plan on or off, offer to promote, schedule view, posts and results (read-only), request a change |
| Wallet | Refill (Razorpay), tax invoices and receipts for refills, ledger with every deduction and credit, price list, disputes |

No customer invoices, stock, accounts or TeleCRM in LeadSpace-only. BOS vendors who already have them keep them in their own departments. Upgrade card on Leads and Home: when a vendor has enough leads, offer BOS Essentials (lead to customer to invoice).

## 7. PHASE 5 — WALLET REFILL AND OUR INVOICE

Refill packs (admin editable; start at 1,999 and 2,999 and a custom amount). Payment through Get4Domain's Razorpay. On success: credit the LEADS purse and issue a GST tax invoice from the existing commercial Invoice engine with a clear line "LeadSpace wallet refill". GST treatment is a CA decision pending; make GST inclusive or exclusive and the credited amount configurable. Receipts emailed and listed under Wallet.

## 8. PHASE 6 — ADMIN: PRICES, APPROVAL, PROMOTION SCHEDULER

1. **Price table** screen (Phase 1 item 3) with history, plus a measured **cost per verified lead** report from `AdSpendEntry` and events by category and city, with a margin alert below a configurable floor (default 50 percent after GST).
2. **Vendor queue**: verification, page review, suspend, regulated-trade review.
3. **Regulated trades** (KSM to confirm with a lawyer; build the switches now):
   - Advocates: information and enquiry page only; no promotion posts by default; admin must explicitly enable.
   - Clinics and doctors: information and enquiry page; promotion posts blocked unless admin enables; no medical claims in generated copy.
   - Real estate: RERA number mandatory to enable promotion; shown on page and every post.
   - AI Studio generation uses per-category guardrails (no guaranteed outcomes, no price promises not on the page, no before and after claims).
4. **Promotion scheduler**: per vendor, category and city plans; AI Studio generates a monthly content calendar from the vendor profile and offer; **approval queue** (first two weeks of a vendor are manual approval, then optional auto); posts through the shared publisher service to Get4Domain's own Facebook Pages, Instagram and Telegram channels, themed by city and trade (for example "Chennai Home Services Deals"); results pulled back where the API allows; kill switch per vendor and global; per-channel daily caps. Facebook Groups are not posted by API (Meta ended it); give ops a **manual task list** for groups and other networks with ready copy and a done button.
5. **Google**: Business Profile posts for a vendor only after the vendor connects and grants access; otherwise a guided task for our team. Page indexing for SEO via sitemap submission.
6. **Ads we pay for**: record spend as `AdSpendEntry` manually first (our team boosts posts in Ads Manager) and compute cost per verified lead. API-driven boosting is later and not in this dispatch.

## 9. PHASE 7 — MERGE CAMPAIGNS INTO LEADSPACE

Rename Campaigns and DomainCampaign to LeadSpace in vendor, admin and marketing UI and routes with 301 redirects kept at least 180 days. Migrate existing campaign data (Allwin Tours has some) into the new tables without loss, with a dry-run script and a rollback note. Update the registry so Campaigns is replaced by LeadSpace features, re-run the nav dry-run and make sure the "would lose access" list is empty. The existing wallet (AI credit) behaviour is unchanged.

## 10. PHASE 8 — PILOT READINESS

1. Funnel analytics per vendor: views, clicks, verified events by type, held, delivered, won, credited, with cost per verified event.
2. Onboarding script for ten pilot vendors: create vendor, pick category and goal, auto-generate page, verify, connect WhatsApp number for alerts, first-refill, first promotion plan.
3. **Test-campaign kit** for KSM's manual Phase 0 ads: a landing page per trade, UTM conventions, and a sheet that lists spend, verified leads and cost per verified lead per trade.
4. Compliance pack in `docs/v2/LEADSPACE_COMPLIANCE.md`: DPDP consent text, data retention and deletion request flow, privacy notice, vendor terms (including lead dispute rules), WhatsApp template list with sample text, regulated-trade rules, open questions for the CA and the lawyer.
5. Guards in `npm run bos:verify`: atomic debit and idempotency under concurrent events, held-event release order, price rule resolution, wallet low never pauses a page, consent required, common number rules enforced, redirects, registry parity.

## 11. DEFAULTS CHOSEN FOR KSM (record any change in the report)

- Hold and unlock when the wallet is low; the page never goes down.
- Fixed price per event by type; starting prices are admin data, not code. Suggested starts for KSM to edit: enquiry 100 to 250, booking and appointment 150 to 300, site visit 300 to 700, cart order 100 to 300 (measure first; do not hard-code).
- Cart is an order request with no payment collected by us.
- Common WhatsApp number for OTP and alerts; vendors chat on their own WhatsApp.
- Name: LeadSpace.

## 12. NOT IN THIS DISPATCH

Per-vendor ad accounts or automatic Meta and Google ad buying, vendor billing or accounting inside LeadSpace, paid checkout on LeadSpace pages, AI agents, auto-calling, Facebook Groups API posting.

## 13. FINAL REPORT (checklist; each line ☐, ◐ or ☑ with one line of evidence)

- Phase 0 audit: what is reused, wrapped, replaced
- Phases 1 to 8 each: status, commit hash, test ids
- Merge of Campaigns: dry-run result, Allwin data safe yes or no, nav dry-run "would lose access" list empty yes or no
- Common WhatsApp: sandbox working; live status Awaiting approval
- `npm run bos:verify` pasted; both builds 0 errors
- Migrations created; RLS script updated and re-read for `$$`
- Decisions made without asking KSM
- Not done and why
- Push to origin: commit hash

## 14. VM DEPLOY STEPS (KSM, only after Claude confirms the report)

All into the **VM terminal** (`ssh ksmwebtechservices@34.14.130.68`).

1. Supabase dashboard, Database, Backups: confirm a backup from today exists.
2. `cd /srv/get4domain-site && git pull origin get4domain-site && cd backend-api && npx prisma migrate deploy && npx prisma generate`
3. **Supabase SQL editor**: run `enable_rls_public.sql` (print with `cat` first; check `DO $$`).
4. Rebuild both containers (`docker compose build --no-cache && docker compose up -d --force-recreate` in `backend-api` then `get4domain_mvp`).
5. Campaign merge: run its dry-run script, paste the output to Claude, then `--apply`.
6. Create the first LeadSpace test vendor under **ksm-webtech-services** style test account; run the onboarding script; do a full test: page, OTP in sandbox, held lead, refill, release, deduction, ledger, tax invoice.
7. Start the manual test campaigns (about ₹5,000 each for three trades) only after step 6 passes.
