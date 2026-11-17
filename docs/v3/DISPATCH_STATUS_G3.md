# Dispatch G3 status (frontend lane, public site)

Branch `v3-pub-fe8` (from `v3-pub-fe7`), folder `get4domain-pub/get4domain_mvp`. Nothing is pushed.

| Job | State | Commit | One line |
|---|---|---|---|
| S0 Plan | DONE | S1 commit | Plan and findings below. |
| S1 Marketing pages | DONE | see git log | Home, Product hub plus 8 capability pages, How it works, Partners, Guides (5), nav and footer, sitemap. Industries hub gets its category links in S2. |
| S2 Industry and category pages | DONE | see git log | `/industries/{pack}/{category}` for the 196 catalogue categories. |
| S3 Directory pages | DONE | see git log | The directory pages already existed (Slice 4); the mock set grew to 4 cities in 2 states, 5 categories and 15 businesses, every link resolves, tested and smoked. |
| S4 Vendor site viewing | TODO | | Dev-only `/_vendor/{subdomain}` switch. |
| S5 Open gaps | TODO | | G2, G31, termsAcceptanceRequired, themes. |
| S6 Quality | TODO | | Accessibility, structured data, forbidden words, link resolution, smoke in three modes. |
| S7 Report | TODO | | `SEE_IT_SITE.md`, `PUBLIC_SITE.md`, `PUBLIC_GAPS.md`, `DISPATCH_REPORT_G3.md`. |

## S0. The plan (ordered public-site job list)

Read: audit sections 4, 5, 7, 8, 9, the F1 report, the Wave 3 and 4 contracts, `PUBLIC_SITE.md`, `PUBLIC_GAPS.md`, `HOSTNAMES_PLAN.md`, `GO_LIVE_PUBLIC.md`.

### What exists (Next.js, behind `V3_PUBLIC_ENABLED`)

- Commercial pages under `src/app/(v3site)/v3-site/`: home, pricing, register, how-it-works, industries hub, industries/{pack} (12 published, 16 with `V3_REGULATED_PACKS_PUBLIC`), features, about, contact, the policy pages, referral. They reach a visitor only through the main-host rewrite in `host-routing.ts` (`MAIN_HOST` set).
- Directory: `/directory`, listing pages through the gate, `/business/{slug}`, claim, account, sitemaps, robots, click-out, vendor-site relay. Mock mode serves a small sample set.
- Header and footer navigation in `v3-site/layout.tsx`: Pricing, How it works, Industries, Directory, Sign in, Start free; footer Features, About, Contact and the policy pages.

### Placeholder and "being built" findings

- The Next.js V3 routes contain **no** "being built" page (audit 5.2 confirmed, re-checked by search of `src/app/(v3site)` and `src/lib/v3-public`).
- The "This page is being built" `PlaceholderPage` belongs to the Vite prototype (`get4domain-ui/apps/site`), which is not what ships. The Next.js site must replace what the prototype showed (blog, guides, themes gallery, tour, product pages): these are the jobs below.
- `/features` is a thin three-group page and is the only page that stood in for the product pages; it stays and links to the new product pages.

### Mock-only routes (real mode needs the backend)

- Everything under the directory, claim, account, register, referral and pricing is mock in dev (`V3_PUBLIC_USE_MOCKS` default on) and real when it is `false`.
- The vendor site relay (`/vendor-site`) is mock in mock mode (7 samples) and real otherwise.
- Pack and category lists: the registration list comes from `GET /v3/public/pack-categories` (real) or 19 samples (mock). The industry and category pages need a **static** list of the 196, because the pages must be statically known (real 404 for an unknown id, a sitemap). Decision below.

### Jobs

1. **S1 marketing pages.** New: `/product` hub, `/product/{website, search-visibility, enquiries, directory, reports, ai-studio, domains, business-tools}`, `/partners`, `/guides` and `/guides/{slug}` (five evergreen guides). Enriched: home (who it is for, how it works, the three business tracks, directory, partner programme, calls to action), how-it-works, industries hub. Confirmed unchanged: pricing, about, contact. Header and footer navigation list only real pages.
2. **S2.** `/industries/{pack}/{category}` for every category of a published pack. Data: the 196 catalogue categories (`catalogue-data.ts`, generated from the category master sheet). Real 404 from the middleware for an unknown or unpublished id. `/register?pack=&category=` preselects both. Sitemap lists them with the flag on.
3. **S3.** Directory pages already exist; add the missing realistic mock set (more cities, categories and businesses), link them from the marketing pages, document the viewing addresses.
4. **S4.** `/_vendor/{subdomain}`: dev only, behind `V3_PUBLIC_DEV_VENDOR_VIEW=true`, never in a production build, never with the flag off.
5. **S5.** G2, G31, `termsAcceptanceRequired`, G37 theme note, re-examined against the contracts.
6. **S6.** Tests and smoke.
7. **S7.** Reports.

## ASSUMPTIONS

1. **Category list source.** The app holds no copy of the 196 categories, and the public route needs a running backend (not allowed here). The categories are read, read-only, from the category master sheet `get4domain-site/docs/v3/catalog/CATEGORY_MASTER_V3_ADMIN_REGISTRATION.csv` and written into `src/lib/v3-public/catalogue-data.ts` (id, name, pack key, family only: no price, tier or note). The registration form still reads the live route. A test checks 196 unique ids, all packs known.
2. **Address names.** `/product`, `/partners`, `/guides` are new top-level segments (none equals a live route; `products` is the live redirect and is untouched).
3. **Where new pages are served.** Like every commercial page, only on the canonical main host with the flag on and `MAIN_HOST` set (the main-host rewrite). Typing `/v3-site/...` stays a 404. With the flag off nothing changes.
4. **"Three business tracks"** are the three paid plan tracks: Handyman, Professional, Ecommerce (the `track` of each plan in the pricing route). Descriptions come from the pricing route's wording ("one-person service businesses", "firms and practices", "businesses that sell online").
5. **Partner programme** pages describe the programme from the contract facts only: a partner link, a referral cookie, businesses that join through it, and commission that the admin team sets. No rate, slab or amount is written.
6. **Guides** are short evergreen explanations of how the product and the web work; no statistics, no claims, no timeframes.
7. **Directory home on the main site.** Links to the directory go to the directory host when `DIRECTORY_HOST` is set, as before.

## QUESTIONS FOR THE OWNER

(filled in as they come up; none block the queue)
