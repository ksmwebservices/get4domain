# Dispatch G3 report (frontend lane, public site)

Branch `v3-pub-fe8` from `v3-pub-fe7`, folder `get4domain-pub/get4domain_mvp`. Nothing pushed. No backend, database, `.env` or real provider was touched. A `next dev` server was started once on port 3090 to check the developer vendor view, then stopped.

## Done

| Job | Result |
|---|---|
| S0 Plan | `DISPATCH_STATUS_G3.md`: findings (no "being built" page exists in the Next.js routes; the placeholder belongs to the Vite prototype), mock-only list, assumptions. |
| S1 Marketing | Home (who it is for, how it works, three business tracks, product, directory, partners, guides, FAQ), `/product` plus 8 product pages, How it works enriched, `/partners`, `/guides` plus 5 guides, new header and footer. Pricing, About, Contact confirmed unchanged and real. |
| S2 Industry and category | `/industries/{pack}/{category}` for the 196 catalogue categories (140 published by default, 56 behind `V3_REGULATED_PACKS_PUBLIC`); hub and pack pages link every category; `/register?pack=&category=` preselects both; sitemap lists them. |
| S3 Directory | Pages already existed. Sample set grown to 4 cities, 2 states, 5 categories, 15 businesses; every link resolves (unit test and smoke crawl). |
| S4 Vendor viewing | `/_vendor/{subdomain}[/path]`, dev only, behind `V3_PUBLIC_DEV_VENDOR_VIEW`, never in a production build. Verified on a real dev server (pages, sitemap, robots, redirect, takedown, 503, bad label) and as 404 on every production smoke server. |
| S5 Gaps | Re-checked against the Wave 4 contract; documented in `PUBLIC_GAPS.md` (G2, G28 narrowed or closed, G31 exact shape, termsAcceptanceRequired is a vendor-app job, G37 unchanged), new G45 to G48. No code change was needed: register already sends only contract fields. |
| S6 Quality | Covered by the checks below: one H1, landmarks, skip link, heading order, named navs, link text, title length, canonical, JSON-LD parse, forbidden words, link crawl, three server modes plus regulated-on and all-contacts-set. Nothing failed that was not fixed. |
| S7 | `SEE_IT_SITE.md`, `PUBLIC_SITE.md` section 16, `PUBLIC_GAPS.md`, this report. |

## Blocked

Nothing blocked.

## Commits (oldest first)

- `cbeaf26` marketing pages, home, how it works, navigation, plan
- `6a77160` category landing pages
- `8f8eee2` directory sample set and tests
- `3c39386` developer vendor view
- the final commit: reports, `SEE_IT_SITE.md`, docs, env example name

## Pages added

Product hub, 8 product pages, partners, guides hub, 5 guides, 140 category pages by default (196 with regulated packs on). About 156 new addresses.

## Tests and smoke (last full run, on the final code)

- `npx tsc --noEmit` clean; `npm run build` compiled.
- `npm run test:v3-public`: 342 of 342.
- `npm run smoke:v3-public`: 3829 of 3829, across servers: flag off with host names set, flag on without host names, flag on with host names, regulated packs on, every contact value set (this one also has the dev switch name set to prove it does nothing in a production build).
- Lint was not run (the app has no ESLint config, gap G19). No browser click-through was done (G20).

## Skipped or left to the owner

- Pages are rendered on request, not statically generated (G48).
- Product copy for Reports, AI Studio and Enquiries is general because the vendor screens are not complete (G46).
- No partner application form (G47). The backend should reserve the new segments (G45).
- G31 and G37 still need backend routes; shapes are written in `PUBLIC_GAPS.md`.
- The 196-category list is read from the category master sheet (assumption 1), not from a running backend; regenerate it if the sheet changes.

## Questions for the owner

1. Confirm or hold back the Reports, AI Studio and Enquiries product pages (G46).
2. Confirm the partner page sends people to Contact (G47).
3. Confirm the three "business tracks" are Handyman, Professional, Ecommerce.
