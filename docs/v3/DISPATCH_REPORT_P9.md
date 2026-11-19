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
- `src/engine/themepack/site.tsx` and the theme pages still use the build-time address for theme package reads; not changed here (a Free or plain site does not use them). Worth the same fix.

## For the owner
- Check that the site container sets `INTERNAL_API_URL` at run time (it does, per the report) and then look in the logs for `vendor_not_found` after the next deploy; the reason code tells which branch fired.
- `/starter/generic/hero.svg` is **not in this app's `public/` folder** (`public/starter` has 25 industry folders, no `generic`), so the banner will be empty on the live site until that file is added here or served from another host.

## Verification
`test:v3-public`: 549 pass, 0 fail (new `p9.test.ts`: the live shape through a real fake server, address order, banner and half-empty answers, log lines, host reasons; the P8 tests were updated for the renamed helpers). `tsc --noEmit` clean. `next build` passes. `scripts/v3-public/p9-shots.mjs` (fake backend `fake-backend-p9.mjs`; app built with a wrong baked address and given only the runtime address; requests for `plumberboy.get4domain.com` through a local host mapping) ALL PASSED at 375, 768, 1280: 200 with a title, the Free page with services and phone text, no form, button, link, e-mail or chat, the generic design for a Pro unknown industry, "being set up" for a draft, not-found for an unknown address, and the `vendor_not_found` line in the server log. `p8-shots.mjs` also passes on this build. Screenshots: `docs/v3/p9-shots/free-information-page-*.png`.
