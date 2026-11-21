# V3 Hostnames Plan (Frontend Slice 6, Step 0)

Owner requirement, 17 Nov 2026: one domain, single-level subdomains. Branch `v3-pub-host` (from `v3-pub`). Everything new is behind `V3_PUBLIC_ENABLED`; with it off nothing changes. Nothing is pushed or deployed. Findings below were read from `get4domain_mvp` (this branch) and `get4domain-w2/backend-api` (branch `v3-w2`, read only, never edited, no `.env` read).

| Host | What | Served by |
|---|---|---|
| `get4domain.com` | marketing site (`www` is non-canonical) | this Next app |
| `directory.get4domain.com` | public directory | this Next app |
| `<vendor>.get4domain.com` | vendor website | this Next app (see (b)) |
| `app.get4domain.com` | vendor dashboard (Vite SPA, noindex) | `get4domain-ui/apps/vendor` |
| `admin.get4domain.com` | admin app (Vite SPA, noindex) | `get4domain-ui/apps/admin` |
| `api.get4domain.com` | V3 API | `backend-api` |
| `media.get4domain.com` | public pictures (R2 `get4domain-v3-media`) | Cloudflare R2 custom domain |

---

## (a) Backend: how URLs are built today, and the change needed

### Findings

1. **One origin for everything.** `SeoPageService`, `SeoSitemapService` and `SeoBacklinkService` all call `canonicalOrigin(await settings.readPublicAppUrl())`. `readPublicAppUrl()` reads the plan-setting key `publicAppUrl` (table `v3PlanSetting`; falls back to `DEFAULT_PROVISIONING_SETTINGS.publicAppUrl`). `canonicalOrigin()` (`seo-directory/core/url-scheme.ts`) strips `www.`. So canonical URLs, breadcrumb URLs, JSON-LD urls, sitemap `<loc>` values, the robots `Sitemap:` line, the llms.txt links, the badge profile URL and the backlink-block links all share the single value `publicAppUrl`. It is a setting, not a constant, but there is only one of it.
2. **The path is baked in, in two places.**
   - `DIRECTORY_HOME_PATH = '/directory'` (`core/url-scheme.ts`). The home model is built with `path: DIRECTORY_HOME_PATH`, so the home canonical is `origin + '/directory'`. `parsePath` also accepts `/directory` as a home alias, and `RESERVED_SEGMENTS` contains `directory`.
   - `buildPath()` returns `/` for the home and `/{city}`, `/state/..`, `/category/..`, `/business/{slug}` for the rest, with no prefix. Those are already the right shapes for a host of their own.
3. **The brand crumb and brand links point at the same origin.** `crumbsOf()` emits `{ name: 'Get4Domain', path: '/' }` as the first breadcrumb with `url = origin + '/'`. The home's `WebSite` JSON-LD uses `url: ctx.origin`. `buildBacklinkBlock()` uses `href: origin + '/'` for the brand link. Today `origin` is the marketing host, so that is correct. Once `origin` is the directory host, these three would point at the directory root instead of the marketing home. **This is the part that is easy to miss.**
4. **Robots and sitemap lines.** `robots()` writes `Sitemap: {origin}/sitemap.xml`, but the index is served at `GET /v3/directory/sitemaps/index.xml`, and the Next site serves it at `/sitemaps/directory-index.xml`. The sitemap index lists `{origin}/sitemaps/directory-{n}.xml`. So the robots line and the index URL disagree today (the existing `/sitemap.xml` of the marketing host is a different file). On a directory host the front end should answer `/sitemap.xml` with the directory index so the line is correct; see the spec.
5. **Vendor site host is separate and already single-level.** `SITE_BASE_DOMAIN` (default `get4domain.com`) builds `https://{sub}.{base}` for `siteUrlOf`, click-out validation (`safeSubdomainUrl`), the vendor-sites monitor list and the site build (`siteBase`). No change needed for vendor hosts.
6. **Click-out** lives on the API host (`clickOutUrl(PUBLIC_API_URL, id)`, `/v3/go/{id}`), and the site rewrites `/go/{id}` to it. It does not depend on the directory path.

### Backend change needed (spec only; the backend folder was not edited)

A. **New setting `directoryOrigin`** (plan setting, same validation as `publicAppUrl`: https URL, no path, no `www.`), read through a new `DirectorySettingsService.readDirectoryOrigin()` (same 60 s cache). Keep `publicAppUrl` as the **main** origin (marketing host, used for emails and brand links).
   - Rollout safety: `readDirectoryOrigin()` returns `publicAppUrl` when `directoryOrigin` is unset, so nothing changes until the owner sets the new value.

B. **Use `directoryOrigin` for every directory URL:** in `SeoPageService` (`ctx.origin` for canonical, `crumbsOf`, `paginate`, `collectionJsonLd`, `localBusinessJsonLd`, `prev`/`next`), `SeoSitemapService.origin()` (index `<loc>`, chunk `<loc>`, robots `Sitemap:` line, llms links), and the badge `profileUrl`/`badgeEmbedHtml`/`badgeTextLink` (`origin + '/business/' + slug`) in `SeoBacklinkService`/`core/badge.ts`.

C. **Keep the brand on the main origin:** add `mainOrigin = canonicalOrigin(publicAppUrl)` to the context and use it for (i) the first breadcrumb `Get4Domain` (`url = mainOrigin + '/'`), (ii) the home `WebSite`/`Organization` JSON-LD `url`, (iii) `buildBacklinkBlock({ brand href })`. Listing and business links in the backlink block use `directoryOrigin`. Change `buildBacklinkBlock` to take `{ mainOrigin, directoryOrigin }` instead of `{ origin }`.

D. **Home path:** `DIRECTORY_HOME_PATH` becomes `'/'`. The home model carries `path: '/'`, so its canonical is `directoryOrigin + '/'`. Remove the `/directory` alias from `parsePath` (or keep it only as an input alias that redirects: the front end 308s `/directory` on the main host, see Step 2). Keep `directory` in `RESERVED_SEGMENTS` so no city can take that slug.

E. **robots/sitemap line:** `robots()` writes `Sitemap: {directoryOrigin}/sitemap.xml` (the front end answers that path on the directory host with the index) **or** change the line to `/sitemaps/directory-index.xml`. Either is fine; the front end will serve both.

F. **Tests to update on the backend:** the home canonical/path (`/directory` to `/`), every crumb, every sitemap/robots/llms/badge test that asserted one origin, and add one test with two different origins to prove the brand crumb stays on the main origin.

G. **Reserved vendor names** (`site-domains/settings/domain-settings.ts` `reservedSubdomains`): has `www admin api app mail media directory` but **not** `gapi` or `send`; and other lists (`provisioning/steps/business-input.ts`, `site-doc/starter.service.ts`, `commercial/deals.service.ts`) are shorter and separate (they lack `media`, `directory`, `send`). Add `gapi` and `send` to the domain setting, and make the other three use that one list. The existing V2 client names are protected by the transition rule in the owner decisions file; they are also listed in `src/lib/v3-public/hostnames.ts` on the front end (Step 1).

Until A to D are done the model still emits `/directory` and the main origin. Step 3 records this as **blocking** and the front end renders whatever the model gives.

---

## (b) Vendor websites: what the Next app serves by host today

### What exists

- `src/middleware.ts` `vendorHostRewrite`: any host ending `.{SITE_BASE}` whose label is not in a small reserved set (`www app api gapi admin mail cdn static staging demo`) is rewritten to `/site/<sub>/...`.
- `src/app/site/[subdomain]/[[...rest]]/page.tsx`, `robots.txt/route.ts`, `sitemap.xml/route.ts`: the **V2** renderer. It reads the **V2** API `GET {NEXT_PUBLIC_API_URL || gapi}/cms/site/{sub}` (the V2 `cms` model: products, theme row, `docV2`, `indexable`) and renders it with the V2 engine (`engine/sitedoc`, theme packs, kits).
- `next.config.ts` also has a LeadSpace host rewrite (`/` on `*.{leadspaceDomain}` to `/ls/:slug`), only when `leadspaceDomain` is set.
- `lib/site-public.ts`: `fetchSiteLite` also uses `/cms/site/{sub}`.

### Does it read the V3 content model, themes and SEO output?

**No.** Nothing in the Next app calls `GET /v3/public/site/by-host`. V2 hosts and V3 hosts are not distinguished. There is no V3 vendor site renderer in the Next app, **but** it does not need to be a content renderer, because of how V3 works:

### How V3 publishes a vendor site (backend)

`site-publish` renders **complete pages on the backend at publish time** (`ThemeRenderService`, `site-build.service.ts`) and stores them per publication and language (`/`, `/services`, `/about`, `/contact`, `/ta/...`). Stored per page: full HTML including the SEO head (title, description, canonical on the vendor's own host, `robots`), the JSON-LD (Organization, WebSite, FAQPage, areaServed), the backlink block, plus the **platform files** `/sitemap.xml`, `/robots.txt`, `/llms.txt` (`isPlatformFile`). Read endpoint:

`GET /v3/public/site/by-host?host=&path=&lang=` (public, rate limited, `ETag`, `If-None-Match`):
- 200 with HTML or a platform file, headers `ETag`, `Cache-Control`, `Content-Language`, `X-Robots-Tag` (the publication's `indexHeader`; not set for platform files), `X-Canonical-Host`, `Content-Type`.
- 301/302 with `Location` when the host is a non-primary host of the site (custom domain rules).
- 304 on a matching ETag.
- 451 plus a plain notice HTML (legal takedown, `no-store`, noindex).
- A single uniform plain 404 for an unknown host, a suspended vendor, nothing published, an unknown path or bad input.
- It also serves the page as **listing-only** (calls to action stripped: no buttons, forms, tel, mailto, wa.me) whenever the vendor's current entitlements lack `site.cta` (Free, lapsed, suspended).
- noindex while the site is a draft, unclaimed, seeded without the setting, or missing mandatory facts (`indexing-rule.ts`); the sitemap of a non-indexable site is an empty urlset.

### So the gap is smaller than "no renderer" but still the biggest one

The Next app has **no host-to-V3-site path**. What is missing is a **thin server-side proxy renderer** in this app (not a content renderer):

1. Host to site: for a vendor host (not main, directory or reserved), ask `by-host` for the requested path and relay it.
2. Serve the HTML exactly as stored (do not re-render, do not edit), relaying `Content-Type`, `ETag`, `Cache-Control`, `Content-Language`, `X-Robots-Tag`, and answering `304`.
3. Relay `301/302` (Location is already `https://{host}{path}`), the `451` notice, and one plain 404 for a miss.
4. Platform files `/sitemap.xml`, `/robots.txt`, `/llms.txt` are fetched by the same call and relayed (per-site, never the marketing ones).
5. Safety net in this app: never serve a page without a noindex signal when the API gives none for an unpublished state (the API already answers 404 for unpublished, so this is only defence in depth: a 404 from the API is a plain 404 with `noindex`).
6. Free rules are enforced by the backend. The front end tests that the proxy does not add anything and that its own fallback pages (not-available, 404) carry no `tel:`, `mailto:`, `wa.me`, form or button.
7. Because V2 and V3 share the wildcard, the proxy must **not** take V2 clients: V2 names go to V2 through nginx and the middleware's existing `/site/<sub>` rewrite. With the flag on, a vendor host is first resolved by V3 `by-host`; **a 404 from V3 falls through to the existing V2 `/site/<sub>` renderer** so a V2 vendor that is not yet on V3 keeps working until cutover. With the flag off nothing changes.

Everything else a "V3 vendor renderer" would need (themes, sections, SEO head, JSON-LD escaping, areaServed, FAQPage, per-site sitemap/robots/llms, noindex rules, backlink block, Free listing-only, Tamil pages) already exists on the backend and is delivered inside the stored HTML. The front end must **not** rebuild any of it. Step 4 is therefore the proxy renderer above, tested with the mock layer and recorded as a gap where the route needs backend work (see G22 to G26 in `PUBLIC_GAPS.md`).

---

## (c) Environment values

### This Next app (`get4domain_mvp`)
New names (values only in `.env.local`, listed in `.env.local.example`; no production default anywhere in code):

| Name | Meaning |
|---|---|
| `MAIN_HOST` | e.g. the marketing host. `www.` of it is treated as the same site, non-canonical. |
| `DIRECTORY_HOST` | the directory host |
| `APP_HOST` | the vendor dashboard host (never handled by this app) |
| `ADMIN_HOST` | the admin host (never handled) |
| `API_HOST` | the API host (never handled) |
| `MEDIA_HOST` | the media host (never handled) |

Existing names kept: `V3_PUBLIC_ENABLED`, `V3_PUBLIC_USE_MOCKS`, `API_BASE_URL`, `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_VENDOR_APP_URL`, `V3_PUBLIC_SITE_ORIGIN`, `NEXT_PUBLIC_SITE_BASE_DOMAIN` (the V2 vendor host base; the vendor-site base for classification when set).

Vendor hosts need no name of their own: a vendor host is `<label>.<base>` where `<base>` is `MAIN_HOST` with any `www.` removed, and the label is not reserved.

### Vite apps (`get4domain-ui/apps/vendor`, `apps/admin`)
Both read only `VITE_API_BASE_URL` (the API origin, `https://<API_HOST>`) and `VITE_USE_MOCKS` (apps/vendor also `VITE_DEMO`, `VITE_MOCK_ROLE`). They need **no** host name of their own, but at deploy time:
- `VITE_API_BASE_URL=https://<API_HOST>` for both builds. It is read at build time, so each host's build is made with it.
- The vendor app is served at `<APP_HOST>`, the admin app at `<ADMIN_HOST>`; each needs the SPA fallback and the noindex header (`X-Robots-Tag: noindex, nofollow`) in its nginx server block (`deploy/nginx/default.conf` currently has `server_name _;`).
- Nothing in either app hard-codes the public site host. The public site passes the vendor app address in `NEXT_PUBLIC_VENDOR_APP_URL` (`https://<APP_HOST>`).

### API (`backend-api`)
No new names are needed beyond what is already read: `SITE_BASE_DOMAIN` (vendor host base, the main domain), `PUBLIC_API_URL` (click-out base, `https://<API_HOST>`), CORS origins for `https://<APP_HOST>` and `https://<ADMIN_HOST>` (existing CORS config), plus the plan settings `publicAppUrl` (main origin) and the new `directoryOrigin` (section (a), A).

---

## Decisions I am making (flagging for review)

1. **The vendor renderer is a proxy, not a re-render** (b). Rebuilding themes and SEO in Next would duplicate and drift from the backend.
2. **Fallthrough to V2** (b, item 7): a V3 404 on a vendor host reaches the existing V2 `/site/<sub>` path while the flag is on, so no V2 vendor goes dark at the wildcard switch. Owner may prefer an explicit V3 allow-list; this is easy to change.
3. The first two hosts the front end can classify without environment: none. With any of the six names unset the module treats that host class as not configured (never a production fallback).

---

## Status after Step 3: BLOCKING backend item

The page model still emits the old path form until the backend change in (a) is made: the directory home model carries `path: '/directory'` and a canonical of `{origin}/directory`, and every canonical, breadcrumb url, JSON-LD url, sitemap `<loc>`, llms link, badge and backlink url is built from the single `publicAppUrl` origin (the main host). The front end does **not** patch any of it (frozen rule: render the model as given).

**BLOCKING for turning the directory host on in production: backend items A, B, C, D (directory origin separate from the main origin, brand crumb and brand links kept on the main origin, home path `/`) and E (robots Sitemap line).** Until they ship, a page on the directory host would carry canonicals pointing at the main host.

What the front end already does so the backend change needs no front-end change:
- renders canonical, robots, title, description, H1, breadcrumbs, JSON-LD and prev/next exactly as the model gives them (no origin or path is computed from the host);
- the directory host's `robots.txt` is the backend text with the `Sitemap:` line rewritten to the directory host's own `/sitemaps/directory-index.xml` (a backend text that has no Sitemap line, because the pages are not indexable, gets none); `/sitemap.xml` on the directory host is the directory sitemap index;
- the main host's `robots.txt` is the existing rules and the existing main sitemaps only, with no directory lines; the directory sitemaps (`/sitemaps/...`) are a 404 on the main host;
- sitemap chunks are relayed as the backend writes them (their `<loc>` values are the backend's; they become directory-host addresses when item B ships);
- the "browse the directory" link on empty and error states is `/` on the directory host.
