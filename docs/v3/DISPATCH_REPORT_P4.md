# Dispatch report P4: growth services, pricing, directory pages, positioning

Branch `v3-pub-fe12` (from `v3-pub-fe11`). Not pushed. No backend, no .env. Commits: `840e2cd` (growth, pricing, home, footer, positioning, guards), `6c0e8c1` (area pages), plus the final commit with this report and screenshots.

## What was built
- **Config:** `src/lib/v3-public/growth-config.ts` is the one file for every feature row, its group, status and plan. Statuses: Included; Included, done by our team; Included, with an allowance by plan; Launching soon; Add-on pack (price not set yet). Defaults are exactly as the owner listed (directory listing and category-in-area pages Included; SEO, AEO and GEO on subdomain and directory pages, meta, local-area keywords, Business Profile, Analytics and Search Console, Merchant (Ecommerce only) done by our team; spotlight, reels, poster, posts, blogs, writing allowance; directory ads, e-mail, SMS, WhatsApp, social posting soon; custom-domain SEO and paid ads add-on). Words are in `growth-strings.ts`. No number anywhere.
- **P4.1 Pricing:** annual default; large monthly price with "billed annually {total} + GST"; term dropdown (real `select`) Annual (save N%), Half-yearly, Quarterly; Offer data (`offersLd`, ItemList of Product + Offer) only from the price route, net of GST; "Compare Free and paid" now has the growth rows with Free column (Included/Locked) and paid status labels; promotion note (subdomain and directory pages, custom-domain add-on). No price in code; none from the route shows "Prices are being set".
- **P4.2 Home:** hero line "Website, business tools and promotion in one plan", section "Get found and get enquiries" (icon grid with status chips), plan intro says every paid plan includes promotion.
- **P4.3 Footer:** "Growth services" column (all six sections) and "Plans" links (Free plan, Paid plans, Compare), in the shared shell, so on every page including the directory.
- **P4.4 /growth:** sections Directory and local search, Your subdomain site, Google presence, Content and reels, Campaigns and social, Custom domain add-on; where promotion runs; you request, our team delivers, you track it in the app; status label legend; Free plan note; Start free and See plans; FAQ. Routed as a fixed marketing path, in the sitemap, in the header, drawer and phone More sheet.
- **P4.5 Directory area pages** (see below). **P4.6 guards.** **P4.8 positioning.**

## P4.5 audit: category in area pages
Exists (unchanged): route `directory-pages/[...path]` renders the backend page model for city-category, locality-category and pincode-category pages; the title, description, canonical, robots, hreflang and prev/next come from the model through `modelToMetadata` (nothing computed, so indexing stays under the existing backend flags; I switched nothing on); breadcrumbs with BreadcrumbList data; cards, pagination, related links, FAQ; sitemaps are the backend sitemap files relayed by `sitemaps/[file]`; robots follows the backend robots text.
Added (`area-page.ts`, `ModelPage.tsx`): an ItemList of LocalBusiness entries (name, business page URL, locality only; no phone, rating or review) when the model has none of its own; the honest empty state whenever an area page has no business (before, it hid if the page had links); a "Is your business missing? List your business / Claim a listing" block on every area page; an intro fallback when the model has none. Gap to know: the page title, description and sitemap membership are decided by the backend, so their quality depends on the backend model (the sample pages are fine).

## P4.8 Positioning
Hero eyebrow and lead, home meta and lead, About intro and meta, Product lead and meta, pricing meta, footer blurb and tagline now say: a local business directory and search engine (find a business by keyword and place, or a website name on the Get4Domain subdomain directory) with a web app: website, business tools, enquiry capture, and promotion through SEO keywords, directory pages and the subdomain. No other company is named or compared; "enquiry capture", never "lead capture". Tests added.

## Choices made
- Header: "Growth" is a link next to "Product" (Product is a plain link, not a menu).
- The dropdown names the smallest real saving across plans; each card shows its own saving. The monthly price is the term price divided by its months, rounded to a whole rupee, from the same route price.
- Allowed words: promotion, campaign, SEO, AEO, GEO in the site copy tests (promotion removed from the ban lists); the phrase "monthly or yearly allowance" is the one time phrase in growth copy; reels and poster carry the note "On the annual plan".
- Added ranking-promise guard over all public strings (rank first, guaranteed, #1, first page, more traffic and similar).
- Prices on the screenshots are the sample (mock) price route, not real prices.

## Verification
`npm.cmd run test:v3-public`: all pass (area-page, growth and guard suites added). `tsc` clean, `next build` passes. `scripts/v3-public/p4-shots.mjs` against `next start` (flag on, sample data, main and directory hosts): all checks pass at 375, 768 and 1280 (no sideways scroll, no page errors, no trial or "leads" wording, select present and annual default, footer column, area page ItemList and claim block). Screenshots in `docs/v3/p4-shots/`.
