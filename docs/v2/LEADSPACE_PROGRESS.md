# LeadSpace progress (resumable)

Dispatch: `GET4DOMAIN_DISPATCH_V2_LEADSPACE_10OCT2026.md` (repo root). Started 2026-10-10 from `8403c80`. Resume rule: read this file, then the dispatch, continue at the first phase not DONE. Dispatch A's shared services did **not** exist, so they are built here to the interfaces in Dispatch A section 6 (social publisher service, WhatsApp provider abstraction with sandbox).

## Phases

| Phase | Status | Commit | Notes |
|---|---|---|---|
| 0 audit | DONE | (this commit) | `docs/v2/evidence/leadspace/AUDIT.md` |
| 1 data model | DONE | see git log | migration `20261010100000_leadspace` (21 new tables, additive), RLS script comment updated and re-read (`DO $$` and `END $$;` intact). Registry plan key LEADSPACE is added in phase 4 with the dashboard |
| 2 landing pages | DONE | see git log | Twelve trade templates, auto-generation from VendorCMS + catalogue, existing-page mode (purpose layer only; embed script `get4domain_mvp/public/ls-embed.js`), four goal flows, Merchant Centre feed, abuse controls, regulated-trade rules, SEO (schema.org, sitemap, canonical), public page `/ls/[slug]` + `/sitemap-leadspace.xml`, env-gated host rewrite `LEADSPACE_BASE_DOMAIN`. Migration `20261010110000_leadspace_page_stats` (1 table + 1 nullable column). Suite `backend-api/scripts/leadspace/verify-pages-pg.js` (111 assertions). Both builds 0 errors |
| 3 capture engine, common WhatsApp, wallet rules | DONE | see git log | OTP+consent, capture, hold/release, atomic purse, disputes, refunds, expiry sweep, WhatsApp provider abstraction + sandbox + cloud provider + gateway rules + webhook. Suite `backend-api/scripts/leadspace/verify-leadspace-pg.js` (103 assertions). Phase 3 was done before phase 2 because capture needs no page UI; `leadspace.profile` rows are created directly in tests until phase 2 adds the profile service |
| 4 vendor mobile dashboard | NOT STARTED | | |
| 5 wallet refill and invoice | NOT STARTED | | |
| 6 admin: prices, approval, promotion scheduler | NOT STARTED | | |
| 7 merge Campaigns into LeadSpace | NOT STARTED | | |
| 8 pilot readiness and guards | NOT STARTED | | |

## Decisions taken without asking KSM

1. The LEADS purse is a new pair of tables (purse + ledger with running balance and idempotency keys); the AI purse stays the existing `Wallet` untouched, so AI credit behaviour cannot change.
2. LeadSpace pages are served at `/ls/<slug>`; the `<slug>.<base domain>` host rewrite is added behind the environment switch `LEADSPACE_BASE_DOMAIN` (off by default, so no existing site changes). Turning it on needs DNS/nginx work by KSM.

3. Event dedupe window 12h (same phone, vendor and type is ONE lead, no second charge); a repeat between 12h and 48h is captured, not charged and recorded as an AUTO credit of 0; the vendor's own number is never charged. Cart orders are exempt from the repeat rules unless the basket is identical.
4. Price is quoted at capture and stored (`priceQuotedPaise`); a held lead is debited at that quoted price when released, oldest first, and the run stops at the first one the wallet cannot pay.
5. Cart orders are charged at the verified order request (capture), not at vendor confirmation; declining an order does not refund by itself (the vendor can dispute).
6. A refund request is limited to the balance and to what was refilled inside the refund window; approval debits the purse at once, the payout itself is made by KSM in Razorpay and marked PAID.
7. The 503 'REJECT' mode throws inside the capture transaction, so the customer's code is not used up and nothing is stored.

8. The vendor's phone number is never published on a LeadSpace page or in its data: customers reach the vendor only through the verified form, so a lead cannot bypass the charge.
9. Regulated trades (advocate, clinic, real estate): the page may be published and verified, but stays noindex until an admin reviews it; promotion needs the admin switch (advocate, clinic) or a RERA number (real estate).
10. Page views, button taps and form starts are counted per page per day in `g4d_leadspace_daily_stats` (views are not lead events).

## Resume notes

- Run everything: `npm run bos:verify -- --build` from the repo root. Never run `security-verify/run-all.js` (it boots the app against the database in `.env.local`).
- Shell edits strip backslashes, backticks and `$`: write files with the Write/Edit tools; re-read any `.sql` file or file with `$$` after editing.
- Push: if blocked by the permission check, say so; KSM runs `git push origin get4domain-site`.
