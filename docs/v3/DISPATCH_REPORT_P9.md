# Dispatch report P9: plumberboy answered 404 although the backend has the site

Branch `v3-pub-fe17` (from `v3-pub-fe16`). Not pushed. No .env read, no real service called (only a fake backend on 127.0.0.1), no server touched. Backend read only: `get4domain-w2/backend-api/src/cms` (`getSiteBySubdomain`, `siteState`).

## Exact cause
The vendor-site renderer (`src/app/site/[subdomain]/[[...rest]]/page.tsx`) read its API address from a **build-time constant**:
`const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://gapi.get4domain.com'` (line 30 before P9), used at line 61 (`${API_BASE}/cms/site/<sub>`) and line 73 (`fetchSiteState(API_BASE, ...)`). `NEXT_PUBLIC_*` is fixed when the app is built, and **`INTERNAL_API_URL`, the address that works from inside the container, was never read by this page** (the sibling pages `/go`, `/ls` and the LeadSpace sitemap already read `INTERNAL_API_URL` first). If the built-in address is not the API that has the vendor (an unreachable public name, or another environment), both calls fail, `fetchSite` returns null, the state call is null or NOT_FOUND, and the page ends in `notFound()`:
- `generateMetadata`: `if (!site) notFound();` (line 126 on `v3-pub-fe16`). It runs before the page streams, so the answer is a real 404 with no `<title>`, exactly as seen live. The middleware had already rewritten to `/site/plumberboy` (`x-middleware-rewrite`), so the host was parsed correctly; the page body (line 156, same pattern) is the same line of thought.

Proved locally, no guessing: two fake backends, the app built with a baked address (A) and started with `INTERNAL_API_URL` (B). A request with `Host: plumberboy-b.get4domain.com` gets the rewrite header `x-middleware-rewrite: /site/plumberboy-b` and then the not-found page, although B serves the site and its state (A does not). After the fix the same setup renders the site (the final run builds with a **wrong** baked address, nothing listening, and works from `INTERNAL_API_URL` alone).

## The other things checked (none was the cause on this data)
- **Host to subdomain:** the middleware (`vendorHostRewrite`) turns `plumberboy.get4domain.com` into `/site/plumberboy` correctly. It would leave a host alone only when the host is not under `NEXT_PUBLIC_SITE_BASE_DOMAIN`, the label is not a usable name or is reserved, or the path is `/site`, `/api`, `/_next`, `/uploads`; now each logs a reason (below).
- **Does the P8 Free check read `plan` at the right level?** Yes. The API wraps the answer as `{ success, statusCode, message, data, timestamp }`; `plan: 'FREE' | 'PRO'` sits at the top level of `data` (S3.1), the page unwraps with `json.data ?? json`, and `isFreeSite(site)` reads `site.plan`. Tested against the exact fake shape.
- **Theme or known industry needed?** No. Industry text and `themeId: null` do not end in `notFound` on the Free path (it returns before any design) nor on the generic path (`getEngineIndustry` returns nothing for 'Home repair and trades', `getCategory` is optional-chained, `catalog` falls back). A Pro site with that industry rendered the generic design in the browser run.
- **Missing logo, favicon, address, seo fields:** nothing depends on them; titles fall back (`Plumber Boy — Official Website`).
- **One real defect found on this data:** the Free page dropped the starter banner `/starter/generic/hero.svg` because only `http(s)` pictures were kept. Fixed (below).

## What changed
- `lib/v3-public/site-state.ts`: `siteApiBase()` (INTERNAL_API_URL, then API_BASE_URL, then NEXT_PUBLIC_API_URL, then the public default; read per request). The page uses it for the site data and the state. `API_BASE` stays only for the address handed to the browser (theme forms).
- Free page: keeps root-relative platform pictures (`/starter/...`, never `//`, `javascript:`, `data:` or odd paths); cannot throw on a half-empty answer (no products, no vendor); if building it fails the visitor sees "This site is being set up" and the failure is logged. Banner has empty alt text so a missing image shows nothing.
- **P9.3 log line** (one `console.warn` JSON line `{"evt":"vendor_not_found","subdomain":"...","reason":"..."}`; a subdomain that is not a plain name is logged as `invalid`; nothing else). Codes: `HOST_NOT_PARSED`, `HOST_BASE_MISMATCH` (middleware, before the plain 404), `API_NOT_FOUND`, `API_UNREACHABLE`, `FREE_RENDER_FAILED`, `NO_DESIGN`, `INNER_PAGE_NOT_FOUND`. Every `notFound()` of the renderer now goes through `missing()` or `noPage()`, which log.
- Not-Free sites with an unknown industry already rendered the generic design (see above); unfinished or unknown sites keep the P8 "being set up" and not-found pages (browser-checked).

## Choices
- Kept the public default address as the last fallback (existing deployments rely on it), as the other pages do.
- Log with `console.warn` (the renderer has no logger); one line per not-found.
- (Superseded by P9.5 below: the theme package read now uses the runtime address too.)

## For the owner
- Check that the site container sets `INTERNAL_API_URL` at run time (it does, per the report) and then look in the logs for `vendor_not_found` after the next deploy; the reason code tells which branch fired.
- `/starter/generic/hero.svg` was missing from this app; P9.6 below adds it. (Check that the public folder is copied into the site container image, as for the other `/starter/` pictures.)

## P9.5 Same fix everywhere on the server (addendum)
One helper, `siteApiBase()` (INTERNAL_API_URL, then API_BASE_URL, then NEXT_PUBLIC_API_URL, then the public default; read when the request runs). It uses static `process.env.X` reads, so it is also safe in a file that is bundled for the browser. The directory/vendor-host `apiBase()` (`lib/v3-public/config.ts`) got `INTERNAL_API_URL` first and `NEXT_PUBLIC_API_URL` last (still no default).
Every use of `NEXT_PUBLIC_API_URL` in `src` (25 files) and the decision for each:

| File | Kind | Decision |
|---|---|---|
| `engine/themepack/site.tsx` (`fetchThemePackage`, now in `engine/themepack/package-fetch.ts`) | server: theme package for a themed (Pro) site, also used by the site sitemap | **moved to `siteApiBase()`** |
| same file, `assetBase` for theme files | address the visitor's browser loads | **kept public** (a container address would not work in a browser) |
| `app/site/[subdomain]/[[...rest]]/page.tsx` | server reads moved in P9; the constant left is the address handed to the browser (theme form posts) | kept public for that use only |
| `lib/site-public.ts` (robots.txt, sitemap.xml of a vendor host) | server | **moved** |
| `app/theme-pack/[id]/[[...rest]]/page.tsx` (theme preview with sample content) | server | **moved** |
| `lib/pricing.ts` (`fetchLivePricing`) | runs on the server and in the browser | **moved** (safe in both) |
| `app/d/[token]/route.ts` (shared invoice page) | server | **moved** |
| `app/api/demo/start`, `tour-pass`, `verify` routes | server | **moved** |
| `app/go/[slug]/page.tsx`, `app/ls/[slug]/page.tsx`, `app/ls/[slug]/go/[n]/route.ts`, `app/sitemap-leadspace.xml/route.ts` | server; already read INTERNAL_API_URL first but skipped API_BASE_URL | **moved to the same helper** (one order everywhere) |
| `app/theme-local-test/[[...slug]]/page.tsx` | passes the address to the theme for the browser | kept public |
| `app/ls/[slug]/leadspace-client.ts` | browser beacons | kept public |
| `app/customer/page.tsx`, `app/d/[token]/pay/page.tsx`, `app/theme-preview/[id]/page.tsx`, `bos/ui.tsx`, `domainapp/shared/InvoicingView.tsx` | `'use client'` | kept public |
| `lib/api.ts`, `lib/auth.ts`, `lib/commerce.ts` | imported only by client pages (admin, dashboard) | kept public |
| `lib/v3-public/config.ts` `apiBase()` (directory pages, vendor-host check, domain search, register, suggest) | server | **INTERNAL_API_URL added first** |
Not touched: `scripts/` comments and `smoke.mjs` env (test setup only). No other variable names for the API address exist in `src`.
Tests (`__tests__/p9b.test.ts`) that fail on the old behaviour: a themed Pro site's theme package is read from `INTERNAL_API_URL` when the built-in address points nowhere (old code returned null), the site data and package of the themed fixture come from the runtime address and the Pro site never gets the Free page, the `apiBase` order, `siteApiBase()` reads the process environment per call, every moved file asks `siteApiBase()` and no longer reads the build-time variable, and the browser-facing files are exactly the documented ones.

## P9.6 Starter banner
The backend (read only, `get4domain-w2`) can send two kinds of `/starter/` path: `GENERATED_BANNER = '/starter/generic/hero.svg'` (any trial site whose category has no pictures) and `/starter/<key>/hero.webp`, `g1..g4.webp` for the 24 seeded industry keys. All 24 key folders already exist here with all five pictures (tested); only `generic/hero.svg` was missing.
Added `public/starter/generic/hero.svg` (1600x900, same size as the other heroes): a gradient in the brand blues `#1e3a8a`, `#1d4ed8`, `#3b82f6`, circles and two bars in white and the brand gold `#ffb420`. No text, no logo, no image, no script, no link; drawn by hand, no copied artwork; noted in `public/starter/LICENCE.md`. A test checks the file (shape, size, no text/image/script/link, only brand colours). The Free page shows it as a real image; the browser script confirms the image loads (not blank) at 375, 768 and 1280, and the server serves it as `image/svg+xml`.

## Verification
`test:v3-public`: 558 pass (after P9.5 and P9.6), 0 fail (new `p9.test.ts`: the live shape through a real fake server, address order, banner and half-empty answers, log lines, host reasons; the P8 tests were updated for the renamed helpers). `tsc --noEmit` clean. `next build` passes. `scripts/v3-public/p9-shots.mjs` (fake backend `fake-backend-p9.mjs`; app built with a wrong baked address and given only the runtime address; requests for `plumberboy.get4domain.com` through a local host mapping) ALL PASSED at 375, 768, 1280: 200 with a title, the Free page with services and phone text, no form, button, link, e-mail or chat, the generic design for a Pro unknown industry, "being set up" for a draft, not-found for an unknown address, and the `vendor_not_found` line in the server log. `p8-shots.mjs` also passes on this build. Screenshots: `docs/v3/p9-shots/free-information-page-*.png`.

**After the addendum:** `tsc --noEmit` clean, `next build` passes (built with a wrong baked address), `p9-shots.mjs` ALL PASSED (38 checks: adds the banner image really loading and a themed Pro site that renders and asks the runtime address for its theme package), `p8-shots.mjs` ALL PASSED on the same build.
