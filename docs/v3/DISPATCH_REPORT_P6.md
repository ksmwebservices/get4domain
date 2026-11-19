# Dispatch report P6: Pro plan wording, metadata, hero, Pro services, tools

Branch `v3-pub-fe14` (from `v3-pub-fe13`). Not pushed. No backend change, no .env read, no server touched. Read only: `get4domain-ui/apps/vendor` (nav config, screen registry, A3 report, VENDOR_NAVIGATION_FINAL).
The addendum (no "soon" labels, remove unbuilt features) overrides P6.4(b) and P6.5 and is applied everywhere.

## Done
- **P6.1** "Paid plan(s)" became "Pro plan(s)" across the public copy (home, pricing, FAQ, footer, guides, product pages, About, portal, register, structured data). Comparison heading "Compare Free and Pro plans", columns "Free plan" and "Pro plans". Footer link says the same. `Pro means any paid plan` became `Pro means any of the Pro plans`. Copy guard bans "paid plan" (with a test that proves it catches it).
- **P6.2** Unique titles, descriptions, Open Graph and Twitter text (Twitter and OG image were missing on commercial pages; now both set). Manifest, site keywords, root layout keywords, brand title and description, OG image alt, Organization and WebSite JSON-LD (with a search action) updated.
- **P6.3** Hero kicker, headline and sub line exactly as proposed. Both search tabs kept. The old line under the sub ("Website, business tools and promotion in one plan") was removed because the sub now says it.
- **P6.4** Three groups with plain labels (below). **P6.5** "How you get found" (four steps) and "Business tools" on home and /growth. **P6.6** FAQ updated, two questions added to /growth and /pricing.
- **P6.7** New `__tests__/p6.test.ts` (guard, metadata, hero, labels, groups, FAQ) and `scripts/v3-public/p6-shots.mjs`.

## Titles (all unique; with the brand when it fits in 60 characters)
| Page | Title |
|---|---|
| Home (and site default) | Get4Domain \| Local business and domain directory, domain search and web app |
| Pricing | Pro plans: business website and web app |
| Growth | Pro plan: promotion and enquiries |
| Product | Business web app: website, enquiries and tools |
| Directory search (frontend page) | Local business directory search |
| Categories (industries) | Business categories and industry websites |
| How it works | How the directory and web app work |
| Guides | Guides: business website, domain and enquiries |
| Register | Create your business account and website |
| Features | Features of the business website and web app |
| Product pages | Local business directory by city and category; Domain search and your own domain name; Business web app tools for your business |
Descriptions are in the strings files and name the keywords. "domain directory" is in the home title and description and the site keywords.

## Label decisions
Labels: **Included in Pro**, **Included** (Free plan has it too: directory listing and pages), **Add-on pack, price on request**. The labels "Included, done by our team" and "Included, with an allowance by plan" are gone from every card. Group (a) says "with a monthly or yearly allowance by plan" (no numbers). Reels and poster carry the note "On the annual plan".

**(a) Run for you by Get4Domain, Included in Pro:** campaigns by SMS, e-mail and WhatsApp (run by our team to the vendor's opted-in customers); search-engine and Meta promotion; SEO, AEO and GEO (directory pages and subdomain merged into one row); subdomain spotlight presentation; Meta optimisation; Google Analytics and Search Console setup; Google Merchant profile (Ecommerce only); reels; poster; posts; blogs; content writing.

**(b) Self-serve tools, decided from the vendor app's screen registry (`REAL_SCREENS` plus the typed-record screens, i.e. screens that read a real backend; the rest show "not available yet" in real mode):**
| Feature | Label | Why |
|---|---|---|
| Website and subdomain | Included in Pro (Free has the site too) | Website manager and Domain screens read the backend |
| Business app (customers, jobs, quotes, bookings, orders, stock) | Included in Pro | Customers, jobs, quotes, bookings, orders and stock read the backend |
| Enquiry capture | Included in Pro | Enquiries inbox is a real screen |
| Invoices and payments (invoices, UPI payments, sales record) | Included in Pro | Invoices, Payments, Payment setup and the sales list are real. Named "Invoices and payments", not "Accounting and billing", because profit, expenses and GST summary are not on a real backend |
| Team and access | Included in Pro | Team screen is real |
**(c) Custom domain pack:** three rows (SEO, social media, communication hub on your own domain), label "Add-on pack, price on request", link "Ask about the custom domain pack" to `/contact` (the contact page that exists today; there is no separate enquiry page).

## Features removed (owner decides when each comes back; add one row in `growth-config.ts`)
Removed from every public page (cards, comparison, footer, FAQ, metadata):
1. Automated e-mail campaigns (self-serve, own accounts)
2. Automated SMS campaigns (self-serve)
3. Automated WhatsApp campaigns (self-serve)
4. Social posting to the vendor's own accounts
5. "Google and Meta ads for the directory pages" as a "launching soon" card. It returns as the owner's item "Search-engine and Meta promotion" under Included in Pro (group a), as the addendum says
6. Google Business Profile setup and management (not in the owner's list, and it is a competitor-adjacent name)
7. Local-area keywords (covered by "keyword directory pages" in the promotion row)
8. Separate "SEO for the directory pages" and "SEO on your subdomain" rows (merged into one)
9. Creative design studio (the vendor app's design is Marketplace orders from our team, not a self-serve studio)
10. Reports (screen is sample-data only in real mode)
11. Website chat, TeleCRM, Tasks, Segments, Deals, Reviews, Sell (POS), Analytics, Notifications: never listed as tools (not on a real backend today)
12. "What the labels mean" notes for the soon label, and the FAQ "Are the campaign services and ads live?"
13. Portal text "Registering new domain names opens soon" is now "is not open yet" (a soon-type label too)
Add-on rows "Paid ads for a custom domain" and "SEO for a custom domain" were replaced by the three custom domain pack rows.

## Other decisions
- The guide slug `from-free-to-paid-plan` became `from-free-to-pro-plan` with a 308 redirect in `next.config.ts`.
- Legal document texts (`legal-text/*`) still say "paid plan": counsel-owned, untouched as in P5. Their tests still check that wording. `paid ads` (a service type) is not the banned phrase.
- Manifest `short_name` stays "Get4Domain" (10 characters; the brand). `name` follows the new default title.
- The search action points at `{DIRECTORY_HOST}/search?q={search_term_string}`, written only when `DIRECTORY_HOST` is set.
- Copy guard (p6.test.ts) bans: paid plan, launching/coming/opens soon and a bare "Soon", automated campaign builder, competitor names (Justdial, IndiaMART and others), "leads", the two retired labels.
- Chat: no live chat assistant is mentioned in any new text.

## Needs the owner
- **Directory and category page titles come from the backend** (`meta.title`, `meta.description` of the page model). The new keywords need a backend change there; the frontend writes exactly what the model says.
- **`/og-banner.jpg`** is the old image (text on it still shows the old "WebApp ... leads, CRM" message). Needs a new 1200x630 image.
- **Legal wording** "paid plan" in the five legal documents and the plan-end terms: for counsel to change.
- **Old marketing app** (`(marketing)` pages, legacy "LeadSpace" and "leads" words) was not in scope and is untouched.
- Prices of the custom domain pack: "on request" until the owner sets one.

## Verification
`npm.cmd run test:v3-public`: 514 pass, 0 fail. `tsc --noEmit` clean. `next build` passes. `scripts/v3-public/p6-shots.mjs` against `next start` (sample data): ALL PASSED at 375, 768 and 1280 (title, hero, both tabs, four steps, three groups and labels, contact link, no banned words, no sideways scroll, no page errors). The existing `p5-shots.mjs` also still passes. Screenshots of home, pricing and growth in `docs/v3/p6-shots/`.
