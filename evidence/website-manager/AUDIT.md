# Website Manager: Phase 0 audit (14 Oct 2026)

Read-only. Evidence comes from (a) reading the code, (b) `scripts/website-manager/prod-readonly-audit.js` (SELECT only, inside a READ ONLY transaction, prints yes/no, never values; raw output in `prod-readonly-raw.json`), (c) public HTTP GETs of the live API and the live Allwin host, and (d) a reproduction on TEST data only (`scripts/website-manager/repro-public-html.js`, an in-memory database, results in `REPRO.md`). Nothing in production was written.

## 1. Root causes (plain sentences; every later phase refers to these as RC1 to RC6)

**RC1. The public site of Allwin Tours is not the Website Manager site at all.** `allwintours.get4domain.com` is served by a separate hand-written app, `allwin-tours/` (port 3010). Its name, phone, address, packages, fleet, hero photo (a stock mountain picture hard-coded in `Hero.tsx`) and logo (`public/logo.png`) are typed into the code (`src/lib/constants.ts`, `src/components/*`). It never calls our API except for its chat box. So the logo the vendor uploads in Website Manager (stored in `VendorCMS.logo`, a JPG) can never appear there, an empty banner in the dashboard still shows the mountain photo on the site, and the vendor's saved text goes nowhere. The same is true in a milder form for Step N Rock (`stepnrock/`, port 3015: reads only products and categories from the API, every other detail is typed into the code) and Deebi Photography (`deebiphotography/`, port 3016: reads some CMS fields). Product edits reach Step N Rock because that is the one thing it reads; page content does not because it reads none.

**RC2. The readiness check and the public page of Allwin read different data.** The readiness screen (`/dashboard/website-engine`) computes its 9 checks from `VendorCMS` plus the vendor's products (the same data the shared renderer uses). Allwin's `VendorCMS` row is empty except for the logo (production: name, tagline, about, phone, WhatsApp, e-mail, address, SEO all empty; 0 products), so it correctly says 1 of 9. The public page shows a full site only because RC1 types all of it into the code. There is no bug in the readiness arithmetic; there are two sources.

**RC3. About half of what the editor lets a vendor save never reaches the shared public site.** Measured on test data for every rendering path (table in section 3 and in `REPRO.md`): e-mail, Instagram, Facebook, Google Maps link, favicon and portfolio images never appear in any industry's page; the logo does not appear on the 14 engine-kit industries (clinic, salon, travel and the other 12) although it does on retail, real estate and the generic page; opening hours do not appear on the generic page. LinkedIn, YouTube, SEO keywords and the analytics ID are saved and are not rendered by any path either (read from code; the page, metadata and JSON-LD do not use them). The editor shows these fields, so they are buttons that do nothing (the principle in the dispatch forbids this).

**RC4. Stock content is shown when a field is empty.** The generic page falls back to the industry's stock cover photo; the 14 kit builders show invented seed items, seed testimonials, seed team members, seed statistics and a stock hero photo when the vendor has none (`engine/kit/content.ts`, `engine/industries/kit/*`); the retail and real-estate sites fall back to a stock hero (`IMG.retail[0]`, `IMG.hero`). A new vendor therefore looks finished and a vendor who clears a field sees stock content come back.

**RC5. Saving is immediate and there is no draft, preview, publish or history.** `PUT /cms/vendor/:id` writes the live row. A half-finished edit is public at once, there is no way back, and there is no version list. The shared renderer is `force-dynamic` with `cache: 'no-store'`, so it is always fresh (no cache bug there); the stale-page symptoms KSM sees come from RC1, not from a cache. The moment the renderer is made cacheable (needed for speed) a purge-on-publish step is required, which does not exist yet.

**RC6. Uploads fail silently and are not processed.** The one image endpoint (`POST /uploads`) accepts png, jpg, webp, gif and script-free svg up to 5 MB (verified by reading the bytes, so a PNG is NOT refused by our code). It does no resizing, keeps location data in photos, and produces no favicon or social-share image. The Website Manager swallows every upload error (`catch { /* optional */ }` in `uploadFor` and `uploadPortfolioImage`), so a failed upload looks like nothing happened. The most likely real cause of "PNG refused" is the proxy in front of the API: nginx rejects bodies over 1 MB by default and a PNG logo is usually larger than a JPG; we could not confirm this from the repository (the API vhost is not in git), so it is a VM check (Phase 7 lists it) and the fix does not depend on it (images are shrunk in the browser before upload and every failure is shown in plain words).

Working theory from the dispatch, judged: "page content is stored in two or more places" is **partly true**: there is one store (`VendorCMS`), but four hand-written apps ignore it (RC1). "Renderer reads hard-coded defaults" is **true** (RC1, RC4). "Nothing refreshes the cache on save" is **not the cause today** (RC5) but becomes the problem as soon as pages are cached.

## 2. Vendors today (production, read-only)

Six vendors have a subdomain. Flags show which CMS fields are filled (n name, t tagline, a about, l logo, b banner, p phone, w whatsapp, e e-mail, a address, s SEO title, s SEO description):

| Subdomain | Industry | Public site served by | CMS filled | Theme | Products | LeadSpace page |
|---|---|---|---|---|---|---|
| allwintours | travel | standalone app `allwin-tours` | `l` only | none | 0 | no |
| stepnrock | retail | standalone app `stepnrock` | all but banner | none | 15 | yes |
| deebiphotography | photography | standalone app `deebiphotography` | n t a p w e a (no logo, banner, SEO) | none | 7 | no |
| mrtravels | travel | legacy MR Travels stack | nearly all | "MR Travels Heritage Gold" | 7 | no |
| ksm-webtech-services | retail | shared renderer | nothing (no CMS row) | none | 0 | no |
| new-media | general | shared renderer | nothing (no CMS row) | none | 0 | yes |

Plans: one current billing term (Workspace, payment due). Website themes in the database: 2 (one raw-HTML theme used by mrtravels, one kit layout with no vendors). Note: Allwin's subdomain is `allwintours` (no hyphen); the earlier deployment text that says `allwin-tours` for the campaign merge script should be read as `allwintours` (the script matches on subdomain).

## 3. Field by field: what the vendor saves and what the public page shows

Editor tabs (code: `get4domain_mvp/src/app/dashboard/my-website/page.tsx`). Every field below is saved with `PUT /cms/vendor/:vendorId` into one `VendorCMS` row (table `"VendorCMS"`, column of the same name); portfolio is saved on every change, all other fields on the Save button. Public data comes from `GET /cms/site/:subdomain`, which returns the same row. The shared renderer (`/site/[subdomain]`) is `force-dynamic` and fetches with `cache: 'no-store'`, so there is no cache between save and page on that path. "Reaches page" is the measured result of the reproduction on test data (`yes` on all five paths unless a column says otherwise).

| Tab | Field | API field | Column | Reaches the shared page? | Cache |
|---|---|---|---|---|---|
| Basic Info | Business Name | `businessName` | `VendorCMS.businessName` | yes, all paths | none |
| Basic Info | Tagline | `tagline` | `tagline` | yes, all paths | none |
| Basic Info | Phone | `phone` | `phone` | yes, all paths | none |
| Basic Info | WhatsApp | `whatsapp` | `whatsapp` | yes, all paths | none |
| Basic Info | Email | `email` | `email` | **NO on every path** | none |
| Basic Info | Address | `address` | `address` | yes, all paths | none |
| (no editor field) | Opening hours | `businessHours` | `businessHours` | yes on engine, retail, real estate; **NO on generic** | none |
| Logo & Banner | Banner | `banner` | `banner` | yes, all paths (but the stock photo returns when empty: RC4) | none |
| Logo & Banner | Logo | `logo` | `logo` | **NO on the 14 kit industries**; yes on retail, real estate, generic | none |
| About & Social | About | `about` | `about` | yes, all paths | none |
| About & Social | Facebook, Instagram | `facebook`, `instagram` | same | **NO on every path** | none |
| About & Social | LinkedIn, YouTube | `linkedin`, `youtube` | same | **NO** (not read by any renderer) | none |
| About & Social | Google Maps link | `googleMaps` | `googleMaps` | **NO on every path** | none |
| Portfolio | Images, titles, categories | `portfolio` | `portfolio` (Json) | **NO on every path** | none |
| SEO | SEO title | `seoTitle` | `seoTitle` | yes (`<title>`) | none |
| SEO | Meta description | `seoDesc` | `seoDesc` | yes (meta) | none |
| SEO | Keywords | `seoKeywords` | `seoKeywords` | metadata keywords tag only, no visible effect | none |
| SEO | Google Analytics ID | `googleAnalyticsId` | `googleAnalyticsId` | **NO** (no script is emitted) | none |
| Template | Template | `themeId` | `themeId` | yes, when the theme has a kit layout or raw HTML; colours-only themes are ignored | none |
| (no editor field) | Favicon | `favicon` | `favicon` | **NO** | none |

Standalone apps (RC1): none of the fields above reach `allwintours` (it never reads the API); `stepnrock` reads none of them (only products and categories, plus a 60-second cache on its home page); `deebiphotography` reads `cms` for part of its content.

Cache layers between save and page on the shared path: Next.js ISR none (`force-dynamic`), fetch cache none (`no-store`), Docker none, Cloudflare unknown (the repository does not hold it; static pages are not cached by default, HTML is not cached unless a page rule says so; a VM/Cloudflare check is listed in Phase 7).

## 4. Website Engine readiness and "Edit content"

- Readiness (`/dashboard/website-engine`, `engine/readiness.ts`): reads `getVendorCMS(user.id)` and `getVendorProducts(user.id)`, i.e. `VendorCMS` plus `VendorProduct`: the same source as the shared public page. Two industries (real estate, retail) have their own check list in their config; all others use `genericReadiness`. The checks are: name, tagline, about, phone, WhatsApp (or phone), at least one catalogue item, photos (a product image or the banner), address, SEO title and description.
- "Edit content" links to the same Website Manager page.
- For vendors on a standalone app the readiness page describes `VendorCMS`, which the public site ignores (RC1, RC2).

## 5. Every upload endpoint in the repository

| Endpoint | Used by | Types | Limit | Processing | Storage | Error message |
|---|---|---|---|---|---|---|
| `POST /uploads` (`uploads.controller.ts`) | logo, banner, portfolio, product images and gallery, About image, AI Studio images, accounting receipts and bill photos, design editor, admin settings logo, payee QR, LeadSpace item pictures | png, jpg, webp, gif, script-free svg (bytes checked, not the name) | 5 MB | none: no resize, no EXIF strip, no favicon, original kept as is | `<cwd>/uploads/<time>_<random>.<ext>` on the API disk volume, served at `/uploads/*` with `nosniff` | plain sentences in the API; the Website Manager swallows them (RC6) |
| `POST /commercial/pay/:token/proof` and `POST /commercial/invoices/:id/proof` (`commercial.controllers.ts`) | "I have paid" screenshot on a payment link or invoice | image (checked in the service) | 3 MB | none | private uploads volume (not public) | API message |
| Theme marketplace ingest (admin library) | admin uploads html/css/js of a theme | text files read in the browser and sent as JSON | request body limit | HTML to kit sections | database | API message |
| favicon, OG image, avatars, documents | no endpoint exists | n/a | n/a | n/a | n/a | n/a |

All 8 image upload inputs in the dashboard use `api.uploadImage` (one function); the two payment-proof inputs post to the commercial endpoints. There is no second public image endpoint.

## 6. Reproduction on test data (summary; full table in `REPRO.md`)

Run on 5 test vendors (one per rendering path): saving the field through the real API with a unique marker, then fetching the public HTML. Result:

- Reaches the page everywhere: business name, tagline, about, banner, SEO title, SEO description, phone, WhatsApp, address.
- Does **not** reach the page anywhere: e-mail, Instagram, Facebook, Google Maps, favicon, portfolio.
- Logo missing on the clinic and travel engine pages; opening hours missing on the generic page.
- No cache effect on any path (every change showed on the next request).

## 7. Live evidence for Allwin Tours (public GETs, 14 Oct 2026)

`GET https://gapi.get4domain.com/cms/site/allwintours` returns `logo: .../uploads/1791877016321_44be049d9062.jpg` and empty name, tagline, about, phone, WhatsApp, e-mail, address, SEO, banner, 0 products. `GET https://allwintours.get4domain.com/` returns a page whose logo is `/logo.png`, whose title is "Allwin Tours & Travels — Cuddalore", with 8 tour packages and 4 fleet photos from stock sites and a Vercel host: none of it from the database.
