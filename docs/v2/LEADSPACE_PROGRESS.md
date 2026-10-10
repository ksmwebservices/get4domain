# LeadSpace progress (resumable)

Dispatch: `GET4DOMAIN_DISPATCH_V2_LEADSPACE_10OCT2026.md` (repo root). Started 2026-10-10 from `8403c80`. Resume rule: read this file, then the dispatch, continue at the first phase not DONE. Dispatch A's shared services did **not** exist, so they were built here to the interfaces in Dispatch A section 6 (social publisher service, WhatsApp provider abstraction with sandbox). Full description: [LEADSPACE.md](LEADSPACE.md).

## Phases

| Phase | Status | Commit | Test ids / notes |
|---|---|---|---|
| 0 audit | DONE | e6c6d12 | `evidence/leadspace/AUDIT.md`: reused / wrapped / replaced table |
| 1 data model | DONE | 48a0725 | migration `20261010100000_leadspace` (21 tables, additive), RLS script comment updated and re-read (`DO $$` and `END $$;` intact). Rehearsal: `leadspace.migration` |
| 2 landing pages | DONE | 1a4d014 | `leadspace.templates`, `.goals`, `.pages`, `.funnel`, `.existing-page`, `.flows`, `.abuse`, `.regulated`, `.feed`, `.seo` (111 assertions). Migration `20261010110000_leadspace_page_stats` (1 table + 1 nullable column) |
| 3 capture engine, common WhatsApp, wallet rules | DONE | 40bfe40 | `leadspace.pricing`, `.otp`, `.capture`, `.hold-release`, `.atomic`, `.orders`, `.credits`, `.whatsapp`, `.privacy`, `.isolation` (115 assertions) |
| 4 vendor mobile dashboard | DONE | 342a12c, 22750e3 | `leadspace.app`, `.base-tier`, `.upgrade`, `.home`, `.team`; registry feature `marketing.leadspace` (plan key LEADSPACE = free base tier), add-ons `leadspace`, `leadspace_only`; browser walkthrough of the public page and the five tabs on a phone width |
| 5 wallet refill and invoice | DONE | 3184f3a | `leadspace.refill`, `.refill-pay`, `.refill-safety`, `.refill-custom`, `.refill-release`, `.refill-recover` (40 assertions); UI in the Wallet tab (22750e3) |
| 6 admin: prices, approval, promotion scheduler | DONE | b2cce5f, 22750e3 | `leadspace.social-publisher`, `.promotion`, `.promotion-rules`, `.cost-report`, `.funnel` (88 assertions); admin console `/admin/leadspace` |
| 7 merge Campaigns into LeadSpace | DONE | 342a12c, 22750e3 | `leadspace.campaign-merge`, `-apply`, `-twice`, `-vendor`, `-rollback`, `-registry` (38 assertions incl. the nav dry run "would lose access" = empty) |
| 8 pilot readiness and guards | DONE | see git log (last commits) | `leadspace.pilot`, `.test-kit`; `scripts/leadspace-guard.mjs` in `npm run bos:verify`; `LEADSPACE_COMPLIANCE.md`, `LEADSPACE_PILOT.md`, DEPLOYMENT section 9 |

## Decisions taken without asking KSM

1. The LEADS purse is a new pair of tables (purse + ledger with running balance and idempotency keys); the AI purse stays the existing `Wallet` untouched, so AI credit behaviour cannot change.
2. LeadSpace pages are served at `/ls/<slug>`; the `<slug>.<base domain>` host rewrite is added behind the environment switch `LEADSPACE_BASE_DOMAIN` (off by default, so no existing site changes). Turning it on needs DNS/nginx work by KSM.
3. Event dedupe window 12h (same phone, vendor and type is ONE lead, no second charge); a repeat between 12h and 48h is captured, not charged and recorded as an AUTO credit of 0; the vendor's own number is never charged. Cart orders are exempt from the repeat rules unless the basket is identical.
4. Price is quoted at capture and stored (`priceQuotedPaise`); a held lead is debited at that quoted price when released, oldest first, and the run stops at the first one the wallet cannot pay.
5. Cart orders are charged at the verified order request (capture), not at vendor confirmation; declining an order does not refund by itself (the vendor can dispute).
6. A refund request is limited to the balance and to what was refilled inside the refund window; approval debits the purse at once, the payout itself is made by KSM in Razorpay and marked PAID.
7. The REJECT mode throws inside the capture transaction, so the customer's code is not used up and nothing is stored.
8. The vendor's phone number is never published on a LeadSpace page or in its data: customers reach the vendor only through the verified form, so a lead cannot bypass the charge.
9. Regulated trades (advocate, clinic, real estate): the page may be published and verified, but stays noindex until an admin reviews it; promotion needs the admin switch (advocate, clinic) or a RERA number (real estate).
10. Page views, button taps and form starts are counted per page per day in `g4d_leadspace_daily_stats` (views are not lead events).
11. No starting prices are shipped (the dispatch says prices are data): until KSM sets a price an event type is delivered free; the admin tab says so.
12. A LeadSpace-only account is a dashboard MODE add-on (`leadspace_only`, like `nav_v2`) set at `/register?product=leadspace` and switched off by plan provisioning; the free base tier is the registry plan key `LEADSPACE` (rank 0) used for access only; billing, limits and overrides still use WORKSPACE and BOS.
13. Campaigns became the Promote tab and landing pages the Page tab; the old dashboard addresses and `/domain-campaign` redirect (Next.js permanent redirects, HTTP 308, kept in code, so they outlast the 180 days). API paths were not renamed. DomainCampaign managed ads stay as a paid service renamed "LeadSpace Managed Ads" inside the LeadSpace page; its billing records are never touched.
14. The old `/go/<slug>` page keeps serving until the vendor publishes the migrated LeadSpace page at the same slug, then redirects there; the migration makes only a DRAFT, so ads already running are never switched to the OTP flow without the vendor.
15. India-only mobile numbers; Merchant Centre feed is RSS with Google's namespace; MARKETING staff may work page review and promotion but not prices, credits, refunds, refills, cost reports or the WhatsApp number.
16. Privacy: a deletion request anonymises name, number and request but keeps the ledger and a one-way number hash; retention default 24 months (setting), swept by an admin action.
17. Unverified or unreviewed pages are never promoted; AI text that breaks the guardrails is discarded and replaced by template text, never edited silently.

18. Product direction (KSM, 2026-10-10): LeadSpace is a product of its own, not a part of BOS; only our own landing page for now (no embed into a customer's website); the public page hides phone, e-mail, address and map; the home page, pricing page and /leadspace lead with LeadSpace; the managed-ads service is called plain "Managed Ads" and is not LeadSpace.
19. The wallet report reads the ledger only (no separate totals table), so it cannot drift from the balance.
20. A lead is charged only after the WhatsApp code is confirmed; there is no charge for abandoned carts. The unfinished count is codes sent and never used. Cart and details are kept in the browser (6 hours) so leaving to read the code does not lose the order.
21. Plan credit is rupees (Essentials 200, Pro 600 a year), prorated for shorter terms, expires with the term, is used before refilled money, and is granted inside the settlement transaction as a plain function (no LeadSpace module import, so no module cycle). Nothing is back-filled for terms that started before this deploy.
22. "Buy online" links are counted and never charged (recommendation; billing per tap can be added later as a price rule).
23. Call-again is a reminder date on a lead, not a task system; closing a lead clears it.

## Resume notes

- Run everything: `npm run bos:verify -- --build` from the repo root. Never run `security-verify/run-all.js` (it boots the app against the database in `.env.local`).
- Shell edits strip backslashes, backticks and `$`: write files with the Write/Edit tools; re-read any `.sql` file or file with `$$` after editing.
- Local walkthrough: `node backend-api/scripts/leadspace/walkthrough-api.js` (API on 3090, seeded) and `.claude/launch.json` entry `leadspace-walkthrough` (production build on 3022, build it with `NEXT_PUBLIC_API_URL=http://127.0.0.1:3090 INTERNAL_API_URL=http://127.0.0.1:3090 npx next build`). The Next dev server reloads itself in a loop in this environment; use the production build.
- Push: if blocked by the permission check, say so; KSM runs `git push origin get4domain-site`.
