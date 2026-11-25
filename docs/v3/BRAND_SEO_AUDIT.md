# Brand search audit: why "get4domain" does not find us

Date: 2026-11-25. Branch v3-pub-a1. Read-only audit of `get4domain_mvp` (the V3 public app), the host routing and the deploy config in this repo.

**The cause is not proven.** This file only lists what the code says about brand signals. Rankings depend on things no code here can show: links from other sites, the age and authority of the other site that wins the search, and what Google has indexed. Anything that needs the running site or Search Console is marked **needs live check**.

Scope note: the V3 pages (the `(v3site)` group, rewritten onto the main host) only render when `V3_PUBLIC_ENABLED` is on and `MAIN_HOST` is set. With the flag off, the older `(marketing)` pages answer instead. Which of the two is live is **needs live check**.

## Totals

**24 PASS, 7 FAIL, 7 MISSING** (38 checks). Seven checks also need a live look; they are marked in the table.

## Results table

| # | Check | Result | Evidence (file) |
|---|---|---|---|
| 1.1 | Home `<title>` carries "Get4Domain" | PASS | `lib/v3-public/site-strings.ts:252` ("Get4Domain \| Local business and domain directory, domain search and web app"); flag-off: `constants/site.ts` `BRAND_TITLE` |
| 1.2 | The single `<h1>` carries "Get4Domain" | **FAIL** | `lib/v3-public/portal-strings.ts:110`: "Get your business online, found and getting enquiries." The brand is only in the eyebrow `<p>` above it |
| 1.3 | Meta description names the brand | PASS | `site-strings.ts:253` |
| 1.4 | Canonical is `https://get4domain.com/` | PASS, needs live check | `lib/v3-public/site-metadata.ts:19-28`. It is written only when `MAIN_HOST` is set; unset means no canonical at all. The flag-off root layout sets no canonical on purpose (`app/layout.tsx:71-74`) |
| 1.5 | Home page is not noindex | PASS | `app/layout.tsx:75-85`, `siteMetadata()` |
| 2.1 | Organization JSON-LD has name and url on the main host | PASS | `lib/v3-public/site-jsonld.ts:9-12` |
| 2.2 | Organization has a logo | **FAIL** | `organizationLd()` has no logo. The richer Organization in `app/layout.tsx:112-141` (logo, legalName, address) is switched off on every V3 route (`layout.tsx:103-110`, `skipSiteJsonLd`), so the home page gets the bare one |
| 2.3 | Organization has sameAs | **MISSING** | `constants/site.ts:35-41`: every social URL is `'#'`, so `organizationSameAs()` returns `[]`. `organizationLd()` never reads it |
| 2.4 | WebSite with SearchAction | PASS, needs live check | `site-jsonld.ts:32-43`. SearchAction is written only when `DIRECTORY_HOST` is set. Flag-off WebSite block has none (`layout.tsx:171`, removed on purpose) |
| 2.5 | No conflicting Organization on vendor pages | PASS | Vendor pages emit one `LocalBusiness` only: `app/site/[subdomain]/[[...rest]]/page.tsx:222` and `engine/sitedoc/build.ts:167` |
| 2.6 | One consistent Organization across the main host | **FAIL** | Home emits Organization without logo or address; About and Contact emit a second, different one (`firmOrganizationLd`, with legalName and address, no logo) and neither has an `@id`, so Google sees two partial entities |
| 3.1 | `sitemap.xml` exists on the main host | PASS | `app/sitemap.ts` lists the 17 routes in `config/seo-routes.ts` plus `/industries/{id}` |
| 3.2 | `robots.txt` exists | PASS | `app/robots.ts`; flag on: `app/(directory)/directory-robots/route.ts` |
| 3.3 | Sitemap declared in robots.txt | PASS | `robots.ts:50` names `sitemap.xml` and `sitemap-leadspace.xml`; flag on adds `sitemap-industries.xml` (`directory-robots/route.ts:29`). Disallows `/dashboard/ /admin/ /customer/ /api/ /login /register /_next/` |
| 4.1 | admin / dashboard / customer pages are noindex by meta or header | **FAIL** | No `noindex` anywhere under `app/admin`, `app/dashboard`, `app/customer`. They inherit `index: true` from the root layout. Only the robots.txt `Disallow` covers them, and Disallow does not stop a URL being indexed |
| 4.2 | Hosts app, partner, api and admin send noindex (meta or `X-Robots-Tag`) | **MISSING** | This app answers those hosts with a plain 404 plus `x-robots-tag: noindex` (`middleware.ts` `plainNotFound`, `host-routing.ts` "reserved"), but they are served by other apps. The repo has no nginx file for them (`get4domain_mvp/nginx-get4domain.conf` covers only `get4domain.com`, `www` and `*.get4domain.com`). **needs live check** |
| 4.3 | Those pages keep the brand in the title | PASS (in-app) | They inherit `BRAND_TITLE` from the root layout |
| 5.1 | Vendor pages canonical to themselves | PASS | `lib/v3-public/site-kit/head.ts:100-119` (`<name>.<base>`, one canonical) |
| 5.2 | "Powered by Get4Domain" mark present | PASS for V2 and engine renderers | `components/site-kit/SiteApp.tsx:173`, `engine/kit/KitRenderer.tsx:49`, `engine/kit/design-sections.tsx:313,326`, `engine/shell/ShellFooter.tsx:43,56`, `engine/industries/retail/RetailSite.tsx:146`, `engine/industries/real-estate/sections/blocks.tsx:221` |
| 5.2b | Same mark on V3 vendor pages (backend-stored HTML relayed by `lib/v3-public/vendor-site.ts`) | **MISSING** from this repo | `git grep "powered by"` in `backend-api/src` finds nothing, and the relay injects nothing. **needs live check** of a V3 vendor page |
| 5.3 | The mark links back to the main site with a branded anchor | **FAIL** | Every instance above is plain text in a `<p>` or `<small>`. None is an `<a>`. SiteApp also spells it "Get4Domain.com" |
| 6.1 | Header logo link has branded anchor text | PASS | `components/portal/Header.tsx:67-69`: the home link text is "Get4Domain" |
| 6.2 | Other internal links use the brand | **FAIL** | Footer brand is a `<p>` and not a link (`Footer.tsx:21`); the "G" logo tile is `aria-hidden` and no `<img alt="Get4Domain">` exists on V3 pages; nav and footer links are descriptive but contain no brand, and the home page body has none |
| 7.1 | About page, with brand and company | PASS | `(v3site)/v3-site/about/page.tsx`; `company-strings.ts:10,44` names KSM QUANTUM TECHNOLOGIES, Tidel Park, Chennai |
| 7.2 | Contact page | PASS | `contact/page.tsx`; `company-strings.ts:56-58` (h1 text not checked) |
| 7.3 | Privacy page | PASS | `lib/v3-public/legal-text/privacy.ts:9` |
| 7.4 | Terms page | PASS | `legal-text/terms.ts:9,16` (also refund, payments, cookies, acceptable use, disclaimer, delivery, listing and partner terms) |
| 8.1 | Industry landing pages | PASS | `/industries`, `/industries/{pack}`, `/industries/{pack}/{category}` |
| 8.2 | Guides and product pages | PASS | `/guides`, `/guides/{slug}`, `/product/{slug}`, `/partners`, `/growth` |
| 8.3 | Directory | PASS, needs live check | Separate host (`DIRECTORY_HOST`); its page titles come from the backend page model (`lib/v3-public/metadata.ts:6`), so the brand in them is unverified |
| 8.4 | Blog | **MISSING** | No `/blog` route. "blog" is a reserved subdomain label only. No press page or "What is Get4Domain" page either |
| 9.1 | One spelling of the brand and the firm | **FAIL** | In the V3 strings, constants and root layout: "Get4Domain" 74, "get4domain" 16 (all URLs or emails), "Get 4 Domain" 0, "Get4 Domain" 1 (`app/layout.tsx:125` `alternateName`). Also "Get4Domain.com" (SiteApp footer, `layout.tsx:125`), and the firm as "KSM Quantum Technologies" in `layout.tsx` but "KSM QUANTUM TECHNOLOGIES" in the V3 pages |
| 10.1 | Open Graph tags | PASS | `layout.tsx:96-103`, `siteMetadata()`, `public/og-banner.jpg` (1200x630) |
| 10.2 | Twitter card | PASS | `summary_large_image` with image |
| 10.3 | `twitter:site` handle | **MISSING** | None set (no handle exists in `siteConfig.social`) |
| 10.4 | Favicon | PASS | `layout.tsx:56-67`; `public/favicon.ico`, 16/32/48/96 px, apple-touch-icon |
| 10.5 | Search Console verification tag | **MISSING** from code | Removed (`layout.tsx:90-93`); the comment says the property is already verified. **needs live check** in Search Console |
| 10.6 | Bing verification tag | **MISSING** | No `msvalidate.01` anywhere |

## Top 10 gaps, ranked by likely impact on brand search

1. **The V3 home page has the weakest Organization data on the pages that matter most.** No logo, no legalName, no alternateName, no sameAs, no `@id`; the full block is suppressed on V3 routes. Google builds the "Get4Domain" entity from this data.
2. **No sameAs and no social or profile URLs at all** (`constants/site.ts` is all `'#'`). A brand query is usually settled by links between the site and profiles of the same name. Needs owner-created profiles (LinkedIn, X, Facebook, YouTube, Google Business Profile).
3. **The home h1 does not contain the brand.** Title and description do, the one h1 does not.
4. **Every vendor site shows the brand as plain text, not a link.** Each live vendor site is a natural branded backlink and none gives one. On V3 vendor pages the mark may not exist at all (needs live check).
5. **Private pages are indexable by meta.** Admin, dashboard, customer and account pages carry the brand title and `index: true`, relying on a robots.txt `Disallow`. The hosts app, partner, api and admin are unverified.
6. **No Search Console or Bing proof in code.** If the main host has no verified property for the `get4domain.com` domain (including `www`), or Bing has none, there is nothing to inspect or fix. Needs live check.
7. **Weak branded anchors inside the site.** Footer brand is not a link, the logo has no `alt`, no body link says "Get4Domain".
8. **Name variants and two Organization shapes** ("Get4Domain.com", "Get4 Domain", "KSM Quantum Technologies" against "KSM QUANTUM TECHNOLOGIES", home against About and Contact).
9. **No blog, press or "What is Get4Domain" page.** Only guides exist, so there is no page that answers the brand query itself. Medium effort and the lowest certainty.
10. **Canonical, JSON-LD urls and SearchAction depend on two runtime env values** (`MAIN_HOST`, `DIRECTORY_HOST`). Unset, they are silently left out (`site-metadata.ts:28`, `site-jsonld.ts`). Needs live check of the page source.

## Smallest change list

| # | File | Change | Size |
|---|---|---|---|
| 1 | `lib/v3-public/site-jsonld.ts` | `organizationLd()` and `firmOrganizationLd()`: share one `@id` (`<origin>/#organization`); add `legalName` "KSM QUANTUM TECHNOLOGIES", `logo` (`/logo.png`), `alternateName` "Get4Domain.com", and `sameAs` | S, about 15 lines |
| 2 | `constants/site.ts:35-41` | Real profile URLs in `social` (owner input; empty entries stay skipped) | XS, owner action |
| 3 | `lib/v3-public/portal-strings.ts:110` | h1 with the brand, for example "Get4Domain: get your business online, found and getting enquiries." (owner chooses the copy) | XS |
| 4 | New server `layout.tsx` for `app/admin`, `app/dashboard`, `app/customer`, `app/(directory)/account` | `export const metadata = { robots: { index: false, follow: false } }` (the existing admin layout is a client component, so a wrapper is needed). Hosts app, partner, api, admin: `X-Robots-Tag: noindex` in their own nginx or app config | S in-app; nginx is owner action (not edited here) |
| 5 | One `PoweredBy` component used by `SiteApp.tsx:173`, `KitRenderer.tsx:49`, `design-sections.tsx:313,326`, `ShellFooter.tsx:43,56`, `RetailSite.tsx:146`, `real-estate/blocks.tsx:221` | `<a href="https://get4domain.com/">Get4Domain</a>`; owner decides the `rel` value. Same mark in the backend template for V3 vendor pages if the live check shows none | M, 7 files and a shared component |
| 6 | `components/portal/Header.tsx:68`, `Footer.tsx:21` | Footer brand as a link home; real `<img alt="Get4Domain">` logo or a text label on the "G" tile | XS |
| 7 | `app/layout.tsx:125,128-130`, `SiteApp.tsx:173` | One spelling: drop "Get4 Domain"; one firm spelling | XS |
| 8 | `app/layout.tsx` metadata | Restore the Search Console tag from `NEXT_PUBLIC_GSC_VERIFICATION` and add `other: { 'msvalidate.01': ... }` from an env value (no token in code) | XS |
| 9 | New `/blog` or "What is Get4Domain" page | One branded explainer page, linked from the footer and listed in the sitemap | M, defer |

## Needs live check (not decidable from code)

1. Is `V3_PUBLIC_ENABLED` on, and are `MAIN_HOST`, `DIRECTORY_HOST` set? View source of `https://get4domain.com/`: title, h1, canonical, the three JSON-LD blocks.
2. The headers and robots.txt of admin, app, partner and api hosts.
3. A V3 vendor page: does the "Powered by" mark exist, is it linked, and what canonical and JSON-LD does the backend HTML carry?
4. Search Console: verified property type (domain or URL prefix), whether `www` and apex are merged, indexed pages, and what Google shows for `site:get4domain.com`.
5. Which site wins "get4domain", and what the Google result for it shows (title and URL), to see whether Google treats it as a brand or a navigational query.
6. Directory host page titles (brand present?).
7. Bing Webmaster Tools: whether the site is added.
