# SEO Audit — As Built (`get4domain_mvp`)

> Date: 2026-11-02 · Branch `v3-step0` · Scope: the public Next.js app `get4domain_mvp/` only.
> **Read-only static audit.** I read source, `next.config.ts`, `middleware.ts` and the nginx configs tracked in the repo. I did **not** open any `.env*` file, start a server, render a page, or call any external service.
> Consequently every statement about what the *browser/crawler receives* is derived from code and Next.js metadata rules, not from fetched HTML. Items that depend on Cloudflare or the live VM are listed in section 9 as "not verifiable from the repo".
> Not an implementation: nothing here has been changed. V3 plan decisions D1/D3/D4 still apply; the legacy Workspace/BOS prices that appear in structured data below are reported as facts, not as something to extend.

## 0. Top findings (read these first)

| # | Finding | Severity |
|---|---|---|
| 1 | **~678 demo URLs are in the sitemap but are unreachable for crawlers.** `src/middleware.ts` answers every `/demo/*` request that lacks a signed pass cookie with a **307 to `/visit-demo?to=…`**. Googlebot has no cookie. | High |
| 2 | **Vendor sites are reachable on the main host** as `get4domain.com/site/<sub>/…` (and `www.`), not blocked by `robots.ts`, not redirected. For vendors on the legacy renderer (the default, flag `site_doc_v2` off) the page has **no canonical**, so it duplicates `<sub>.get4domain.com`. | High |
| 3 | **The root layout injects three Get4Domain JSON-LD blocks on every page**, including vendor sites and LeadSpace pages, with legacy Workspace/BOS prices and a `SearchAction` whose `?q=` target the page ignores. | High |
| 4 | **No www/apex and no http/https canonicalisation in code or nginx.** `get4domain.com` and `www.get4domain.com` are served identically on port 80. Canonical tags (apex, `https`) are the only protection, and several pages have none. | High |
| 5 | **`robots.ts` blocks `/_next/` for all non-AI crawlers**, including Googlebot, which stops it fetching the JS/CSS it needs to render pages. | Medium |
| 6 | **AI-crawler rules have no `Disallow`**; robots groups do not merge, so GPTBot, ClaudeBot and ten others are allowed on `/admin/`, `/dashboard/`, `/api/`, `/login`. | Medium |
| 7 | **Home title is `…| Free LeadSpace page | Get4Domain`** (75 chars): the root `%s | Get4Domain` template appends the brand a second time. Root default title/OG/Twitter still say "Online **Identity** Partner" while the home page says "Online **Visible** Partner". | Medium |
| 8 | **`/how-it-works`, `/portfolio`, `/templates` have no inbound internal link at all** (sitemap only). The 20 industry links in the header exist only after a click (client-side dropdown). | Medium |
| 9 | **There are no category, city, brand-hub or directory routes.** Industry pages exist; everything below industry (sub-categories) lives only behind the gated `/demo` routes. | Gap (V3.2/V3.9 scope) |

---

## 1. robots.txt, sitemaps, canonicals, noindex, metadata, middleware

### 1.1 robots.txt — `src/app/robots.ts` (generated; there is no static `public/robots.txt`)
- **Twelve named AI crawlers** (Amazonbot, Applebot-Extended, Bytespider, CCBot, ClaudeBot, Claude-SearchBot, ChatGPT-User, CloudflareBrowserRenderingCrawler, Google-Extended, GPTBot, meta-externalagent, PerplexityBot): `Allow: /` and **nothing else**.
- **`User-agent: *`** (incl. Googlebot): `Allow: /`; `Disallow: /dashboard/ /admin/ /customer/ /api/ /login /register /_next/`.
- `Sitemap:` `https://get4domain.com/sitemap.xml` and `https://get4domain.com/sitemap-leadspace.xml`. `Host: get4domain.com` (a Yandex-only directive; Google ignores it).
- A code comment says Cloudflare injects a `Content-Signal` / "Managed content" block on the live file. **Not verifiable here.**
- **Issues**
  - A crawler that matches a named group ignores the `*` group, so the 12 AI bots are allowed on the private paths too (intended "full access" per the comment, but it includes `/admin/`, `/dashboard/`, `/api/`).
  - `Disallow: /_next/` stops Googlebot fetching JS/CSS chunks it uses to render.
  - **Not disallowed anywhere:** `/admin-team/` (invite-accept page), `/d/` (shared documents), `/visit-demo`, `/theme-preview`, `/theme-local-test`, `/offline`, `/order-success`, `/cart`, `/site/` (see §2), `/ls/` (intentional, indexable), `/go/`.
  - Private app areas (`/dashboard` 35 pages, `/admin` 35, `/customer`, `/login`, `/register`) rely on robots.txt **only**; none carries a `noindex` meta (robots.txt blocks crawling, but a blocked URL can still be indexed from external links).

### 1.2 Sitemaps
| Sitemap | Source | Content |
|---|---|---|
| `/sitemap.xml` | `src/app/sitemap.ts` (one file, no index) | 17 static pages + 20 `/industries/<id>` + **every `allDemoPaths()` URL** (category homes, sub-category homes, section pages). The root-layout comment says Search Console "discovered 715 URLs", so the demo share is ≈ 678. Every entry has `lastModified: new Date()` (build/request time, not real change dates) and priority/changefreq (ignored by Google). |
| `/sitemap-leadspace.xml` | `src/app/sitemap-leadspace.xml/route.ts` | Proxied from the API (`/leadspace/public/sitemap.xml`), ISR 3600 s; returns an **empty** `<urlset>` if the API call fails. |
| `<sub>.get4domain.com/sitemap.xml` | `src/app/site/[subdomain]/sitemap.xml/route.ts` | One per vendor host; empty unless `mayIndex()` (see §2). Not referenced from the main sitemap or any sitemap index. |
- Absent from `sitemap.ts` (correctly): cart, checkout, order-success, talk-to-sales, login, dashboards.

### 1.3 Canonical tags (how each page gets one)
- **Root layout sets none by design** (comment: an inherited site-wide canonical once made every page look like a duplicate of the home page). `metadataBase` is `https://get4domain.com`.
- **Via `createPageMetadata()` (`src/lib/metadata.ts`)** — 11 pages, all pass a correct `path`: `/about /cart /contact /how-it-works /portfolio /privacy-policy /refund-policy /support /templates /terms /order-success`. The helper sets `title.absolute = "<title> | Get4Domain"`, canonical, OG, Twitter and **`robots: { index: true }`**. Its `path` defaults to `''`, i.e. a future page that forgets `path` would canonicalise to the home page.
- **Inline `alternates.canonical`** — home, `/domain-app`, `/features`, `/pricing`, `/industries`, `/leadspace`, `/managed-services`, and `/industries/[id]` (20 pages, from `generateMetadata`). `/book-demo` and `/checkout` get theirs from their segment `layout.tsx`.
- **No canonical:** `/visit-demo`, `/quote/[token]`, `/offline`, `/d/[token]`, `/theme-preview/*`, `/theme-local-test`, the redirect-only pages, and the private areas.
- **API-driven:** `/ls/[slug]` takes `canonical` and `robots` from the API's `seo` object; `/site/[subdomain]` as §2.

### 1.4 `noindex` inventory
| Where | How |
|---|---|
| `/talk-to-sales` | `robots: { index: false }` in the page |
| `/checkout` | `robots: { index:false, follow:false }` in `checkout/layout.tsx` |
| `/pay/*` | `noindex` in `pay/layout.tsx` |
| `/engine/preview/[industry]`, `/theme-pack/[id]` | `noindex` in the page |
| `/ls/[slug]` | `index:false` unless the API says `index…`; "Page not available" is `noindex` |
| `/site/[subdomain]` | `noindex` for preview, or `docV2 && indexable === false` only |
| **Everything else** | inherits the root `robots: { index: true, follow: true }` |
- **Transactional pages that are explicitly `index: true`:** `/cart` and `/order-success` (the helper hard-codes it).
- **`X-Robots-Tag`:** none anywhere (`next.config.ts`, `middleware.ts`, nginx).

### 1.5 Default metadata (root `layout.tsx`)
- `title.default`: *"Get4Domain — Your Online Identity Partner | From ₹999/month"* (59 chars), `template: "%s | Get4Domain"`.
- Default description 285 chars, mentions Workspace ₹999 / BOS ₹1,999 (legacy plan names). OG/Twitter title *"Get4Domain — Your Online Identity Partner"*, `og:url` fixed to `https://get4domain.com`, `lang="en-IN"`, `keywords` meta (ignored by Google), `themeColor`, manifest, icons. No `hreflang` (single language) although the JSON-LD advertises Tamil support.

### 1.6 `src/middleware.ts` — exactly what it does
- **Matcher:** `/((?!_next/|api/|.*\..*).*)` plus `/robots.txt` and `/sitemap.xml` (so a vendor host's robots/sitemap are rewritten; other files with a dot are skipped).
- **Host rewrite (`vendorHostRewrite`):** if the host ends with `.<SITE_BASE>` (`NEXT_PUBLIC_SITE_BASE_DOMAIN`, default `get4domain.com`), is a valid label and is **not** reserved (`www app api gapi admin mail cdn static staging demo`), the request is **rewritten** (not redirected) to `/site/<sub><path>`. Paths already starting `/site/`, `/_next`, `/api`, `/uploads` pass through.
- **Not handled:** custom (vendor-owned) domains — only `*.get4domain.com` is mapped; no www→apex; no http→https; no trailing-slash or case normalisation.
- **Dashboard:** with cookie `g4d_nav_v2=1`, old `/dashboard/*` addresses 308 to the new ones.
- **Demo gate:** any `/demo/<category>/…` without a valid signed `g4d_demo_pass` cookie for that category is **307-redirected to `/visit-demo?to=<path>`**; bare sub-category keywords are 307-redirected to the canonical demo path first. There is **no crawler/user-agent exception**.

### 1.7 Route groups and whether they are indexable
| Group | Pages | Indexable today? | Evidence |
|---|---:|---|---|
| Marketing (`(marketing)/…`) | 24 | **Yes**, except `/talk-to-sales`, `/checkout` (noindex); `/digital-growth` and `/products` are 307 redirects; `/quote/[token]` has no metadata (inherits index) | §3 |
| `/industries`, `/industries/[id]` | 1 + 20 | **Yes** | static params from `industryContent` |
| `/demo/[category]/[[...rest]]` | 1 route, ≈ 678 URLs | **No for crawlers** (307 gate) though listed in the sitemap | §1.6 |
| `/visit-demo` | 1 | Indexable by default (no metadata, not disallowed); receives every demo redirect | |
| `/site/[subdomain]/…` on vendor hosts | 1 route | Only if `docV2 && indexable` (robots.txt and sitemap), see §2 | |
| `/site/[subdomain]/…` on the **main** host | same route | **Reachable and crawlable** | §2 |
| `/ls/[slug]`, `/go/[slug]` | 1 + 1 | `/ls` conditional (API); `/go` is a **308** to `/ls/<slug>` | |
| `/dashboard/*`, `/admin/*`, `/customer`, `/login`, `/register` | 35 + 35 + 3 | Blocked by robots.txt only | §1.1 |
| `/pay/*` | 1 | `noindex` | |
| `/d/[token]`, `/admin-team/accept-invite`, `/quote/[token]`, `/theme-preview/[id]`, `/theme-local-test`, `/offline`, `/order-success`, `/cart` | 8 | No protection (or explicit `index:true`) | §1.4 |
| `/engine/preview/*`, `/theme-pack/*` | 2 | `noindex` | |
| `/api/*` | — | Disallowed for `*` | |

---

## 2. Vendor sites under `/site/[subdomain]`

**Reachable on the main host? Yes.** `middleware.ts` only rewrites hosts ending in `.get4domain.com`. On `get4domain.com` and `www.get4domain.com` (www is "reserved", so it is not treated as a vendor) a request to `/site/<sub>` or `/site/<sub>/<page>` is passed straight through and the vendor site renders. `robots.ts` does not disallow `/site/`. The same route also answers on the vendor's own host under `/site/<sub>/…` (the rewrite skips paths that already start with `/site/`).

**Canonical output** (`src/app/site/[subdomain]/[[...rest]]/page.tsx`, `src/engine/themepack/site.tsx`):
| Vendor state | Canonical | Robots meta |
|---|---|---|
| `docV2` + theme package (`themeRef`) — `themeMetadata()` | `https://<sub>.<SITE_BASE><route path>` (correct per page) | `noindex` per route kind/preview |
| `docV2`, no theme package | `https://<sub>.<SITE_BASE>` for every path **except** `/p/<slug>` — **inner pages canonicalise to the home page** | `noindex` if `preview` or `indexable === false` |
| **Not `docV2` (the default; flag `site_doc_v2` is per-vendor and off)** | **none** | inherits root `index, follow` |
- `og:url` is always the vendor host root.
- **Result:** for non-`docV2` vendors, `get4domain.com/site/<sub>` is an indexable page with no canonical that duplicates `<sub>.get4domain.com`. The per-host `robots.txt` route returns `Disallow: /` for those vendors (`mayIndex()` requires `docV2 === true && indexable === true`), so the **vendor host is closed while the main-host copy is open** — the opposite of the intent.
- **Root-layout leakage:** the three Get4Domain JSON-LD blocks (Organization with Get4Domain's address, SoftwareApplication with Workspace/BOS offers, WebSite) are emitted on vendor pages too.
- **Iframe path:** a vendor with an uploaded static-HTML theme (the older marketplace, `themePages(site.theme).length > 0`) is rendered by `RawThemeFrame` as an `<iframe srcDoc>`. Page content lives inside the iframe, so the host page's own HTML has little indexable text. The newer theme-package path (`docV2 && themeRef`) is server-rendered HTML.
- **404 safety:** unknown or draft sites call `notFound()` (a real 404), so they cannot be indexed.

---

## 3. Titles, descriptions, H1 and structured data

**Home page title (current):** source `(marketing)/page.tsx` → `"Get4Domain — Your Online Visible Partner | Free LeadSpace page"` (61 chars). Because it is a plain string, the root template `"%s | Get4Domain"` is applied (Next.js metadata rule; not verified in rendered HTML), giving **`Get4Domain — Your Online Visible Partner | Free LeadSpace page | Get4Domain` (75 chars, brand twice)**. Home description is **319 chars** (Google shows ~155). Home H1: *"Get found online. Pay only for real customers."* (`components/marketing/home/LeadSpaceHero.tsx`). The home page's own FAQPage JSON-LD is emitted in addition to the root blocks.

| Route | Final `<title>` length | Description length | H1 | JSON-LD (page-level) |
|---|---:|---:|---|---|
| `/` | 75 ⚠ | 319 ⚠ | Get found online. Pay only for real customers. | FAQPage |
| `/leadspace` | **96** ⚠ | 187 | A free page for your business. Pay only for customers who verify. | FAQPage |
| `/domain-app` | 74 ⚠ | 204 | DomainApp — Your Business Workspace | FAQPage |
| `/pricing` | 75 ⚠ | **315** ⚠ | Start free. Grow when you are ready. | FAQPage |
| `/features` | 87 ⚠ | 223 | Everything DomainApp does, in one platform. | FAQPage |
| `/industries` | 71 ⚠ | 178 | Built for every industry. | — |
| `/managed-services` | 74 ⚠ | 197 | When your business needs more than a subscription. | FAQPage |
| `/industries/[id]` ×20 | `<Name> Business Website & Software \| Get4Domain` | `fullDesc` | `content.tagline` (eyebrow = name) | Service + Offer(₹999) + BreadcrumbList |
| `/about` | 21 | 151 | Building India's Digital Business Platform | FAQPage |
| `/contact` | 53 | 175 | Get in Touch | — |
| `/how-it-works` | 25 | 116 | From Idea to Live Website in 24 Hours | — |
| `/portfolio` | 22 ⚠ thin | 90 | Websites We've Launched | — |
| `/templates` | 22 ⚠ thin | 112 | Professional Niche Templates | — |
| `/support` | 20 ⚠ thin | 100 | We're Here to Help | — |
| `/terms`, `/privacy-policy`, `/refund-policy` | 31 / 27 / 26 | 64 / 72 / 56 | (PageHero title; one H1) | — |
| `/book-demo` | long (layout title) | set in layout | two H1s (one is a post-verification state) | — |
| `/checkout`, `/cart` | "Checkout" / "Cart \| Get4Domain" | — | one H1 each | — |
| `/digital-growth`, `/products` | none (redirect-only) | — | — | — |
- **Sitewide JSON-LD (root layout, every route):** `Organization` (legal name KSM Quantum Technologies, Chennai address, support email, `sameAs: []` empty, `foundingDate: 2026`), `SoftwareApplication` (two offers: DomainApp Workspace ₹11,988 and BOS ₹23,988 — **legacy plans per D1**), and `WebSite` with a **`SearchAction` targeting `/industries?q={search_term_string}` — the `/industries` page does not read `q`**, so the advertised search does not exist. (`foundingDate: 2026` also differs from the About page's 2015 founding of the parent company.)
- Titles marked ⚠ exceed ~60 characters and will be truncated in results. Every page has exactly one H1 in the code I could resolve; the H1s are descriptive but mostly lack the target keywords in the titles (e.g. "business website", "India") that the root `keywords` list names.
- **OG/Twitter:** the helper sets both; the home page and inline pages inherit the root OG title *"…Online **Identity** Partner"*, which no longer matches the home title or the V3 tagline ("Your Business **Online Visible** Partner").

---

## 4. Client-rendered vs server-rendered on public pages

Static analysis of each public page and the components it imports (3 levels deep):
- **All marketing pages are server components**, rendered statically by default; `/pricing` uses `revalidate = 300`. Exceptions that are *page files* marked `'use client'`: `/book-demo`, `/checkout`, `/quote/[token]`. In the App Router a client component is still server-rendered on first load, so their text is in the initial HTML; metadata for `/book-demo` and `/checkout` is supplied by their `layout.tsx`, and `/quote/[token]` has none.
- **No public page tree uses `dynamic(…, { ssr: false })`**, and I found no `mounted`-gated rendering in `Header`, `Footer`, the home sections, `Faq` or `DemoGate`.
- **Content that depends on JavaScript or the browser:**
  - `components/Header.tsx`: the **Industries dropdown links** (`/industries/<id>`, all 20) are rendered only when `industriesOpen` is true — absent from the initial HTML.
  - `components/marketing/home/HomePricing.tsx`: `useEffect → fetchLivePricing()` swaps the displayed prices after hydration; the server HTML contains the static defaults.
  - `/quote/[token]` (private) fetches everything in the browser.
  - `HeroMockup` and other animated home sections are client components (7 of 16 files in the home tree) but render markup on the server.
- **FAQ:** `components/marketing/Faq.tsx` uses native `<details>`, so every answer is in the HTML even when collapsed, and it matches the `FAQPage` JSON-LD it emits (good).
- **Vendor sites:** server-rendered except the uploaded-HTML theme path, which renders inside an iframe (§2).
- **Demo pages:** `generateMetadata` and the full engine render exist, but crawlers receive the 307 gate instead (§1.6).
- *Not verified by rendering.* Treat "in the initial HTML" as a code-level conclusion.

---

## 5. Internal linking, and what is missing

**Global navigation**
- Header: Features, Pricing, Managed Services, Contact, an Industries dropdown (client-side only), Login. **LeadSpace, DomainApp, About, How it works, Portfolio, Templates are not in the header.**
- Footer: DomainApp, Industries, Pricing, LeadSpace, "AI Studio" (→ `/pricing`), About, Contact, Support, Managed Services, Privacy, Terms, Refund. **No Features link in the footer; no How it works / Portfolio / Templates.**
- Breadcrumbs: `PageHero` renders a visual breadcrumb `<nav>` on every hero page, but **`BreadcrumbList` JSON-LD exists only on `/industries/[id]`**.

**Inbound internal links (from `app/` and `components/`, excluding admin/dashboard)**
`/pricing` 11 · `/book-demo` 23 · `/industries` 22 · `/managed-services` 4 · `/contact` 4 · `/privacy-policy` 4 · `/leadspace` 3 · `/features` 2 · `/support` 2 · `/terms` 2 · `/domain-app` **1** · `/about` **1** · `/refund-policy` **1** · **`/how-it-works` 0 · `/portfolio` 0 · `/templates` 0** (orphans: in the sitemap only).

**Industry linking:** the home page links 8 of the 20 industries; `/industries` lists all 20; each industry page links to its demo pages and to related industries; the header dropdown holds all 20 but only after a click.

**Missing for the page types you asked about**
| Type | State |
|---|---|
| **Brand** | No brand hub: no `sameAs` profiles (empty array), no press/brand page, no `/brand` entity page; the home, About and Contact pages are the only brand signals. |
| **Industry** | 20 pages exist with strong structure (Service + BreadcrumbList). Missing: links from the header/footer in plain HTML, industry↔feature cross-links, and any sub-industry pages (sub-categories exist only under the gated `/demo/<cat>/<sub>` routes). |
| **Category** | **No category routes.** Vendor categories exist as admin data (category packs, vendor taxonomy) but have no public pages. |
| **City / location** | **No city or location routes or data model.** "Chennai" appears only in the Contact title and the Organization address. |
| **Directory / business pages** | None (`/businesses/…`, `/business/<slug>`); this is the V3.2 deliverable. |

---

## 6. www / non-www, http / https

| Layer | What the repo does |
|---|---|
| `get4domain_mvp/nginx-get4domain.conf` | `server { listen 80; server_name get4domain.com www.get4domain.com; … proxy_pass http://localhost:3006; }` — **both hostnames served identically, no redirect either way.** A second server block `server_name *.get4domain.com` proxies to the same app. No `listen 443`, no certificate, no `return 301`, **no HSTS**; headers: `X-Frame-Options`, `X-Content-Type-Options` only. `X-Forwarded-Proto` is forwarded but nothing in the app reads it. |
| `src/middleware.ts`, `next.config.ts` | No host or scheme redirects. `www` is only listed as a *reserved* host so it is not treated as a vendor. |
| Canonical host in code | **Apex + https**, hard-coded: `layout.tsx` (`metadataBase`, OG, JSON-LD), `sitemap.ts`, `robots.ts` (`sitemap`, `host`), `constants/site.ts`, `lib/metadata.ts`. |
| Other nginx configs tracked | `deployment/nginx/indianambulance.conf`, `deebiphotography/`, `ksm-quantum/`, `stepnrock/` follow the same plain-`:80` pattern. Their comments and `docs/v2/CUSTOM_DOMAIN_RUNBOOK.md` state the zone uses **Cloudflare "Flexible" SSL**: Cloudflare terminates HTTPS and talks HTTP to the VM, and the VM must **not** redirect to HTTPS or run certbot (it would loop). |
- **Consequence:** `http://`, `https://`, apex and `www` can all answer 200 with the same content unless Cloudflare rules redirect them. The code gives no such rule. Canonical tags (apex/https) are the only in-repo defence, and §1.3 lists pages without one.
- **Safe redirect under Flexible SSL:** a `www`→apex `301` that keeps `https` is safe in nginx (do **not** add `return 301 https://…` for http→https; use Cloudflare "Always Use HTTPS" or test `X-Forwarded-Proto`).

---

## 7. Prioritised fix list

Paths are relative to `get4domain_mvp/` unless noted. **P0** = indexing/duplication correctness, **P1** = ranking/CTR hygiene, **P2** = polish and V3 groundwork.

| # | Pri | Fix | Files |
|---|---|---|---|
| 1 | P0 | **Stop submitting gated demo URLs.** Remove `allDemoPaths()` from the sitemap *or* give verified crawlers a public, indexable demo summary. Decide the product question (OTP gate vs discoverability) first. Add `noindex` and a `robots.ts` Disallow for `/visit-demo`. | `src/app/sitemap.ts`, `src/data/demo-site.ts` (`allDemoPaths`), `src/middleware.ts`, `src/app/visit-demo/page.tsx`, `src/app/robots.ts` |
| 2 | P0 | **Close the main-host copy of vendor sites.** Disallow `/site/` in robots; on the main host 308-redirect `/site/<sub>[/path]` to `https://<sub>.get4domain.com[/path]` (or 404); always emit a canonical to the vendor host (also for non-`docV2` vendors), and make inner paths of the `docV2` non-theme branch canonicalise to themselves. | `src/middleware.ts`, `src/app/robots.ts`, `src/app/site/[subdomain]/[[...rest]]/page.tsx` |
| 3 | P0 | **Scope the Get4Domain JSON-LD** to the marketing layout (or home only) instead of the root layout; remove or version the legacy Workspace/BOS `Offer` prices; remove the `SearchAction` or implement `?q=` on `/industries`; fill `sameAs`; fix `foundingDate`. | `src/app/layout.tsx`, `src/app/(marketing)/layout.tsx`, `src/app/(marketing)/industries/page.tsx` |
| 4 | P0 | **Canonicalise host and scheme.** nginx `www`→apex 301 (keeping https); enable HSTS and "Always Use HTTPS" at Cloudflare; optionally a middleware guard on `x-forwarded-host`/`x-forwarded-proto`. Add the missing self-canonicals (`/visit-demo`, `/offline`, `/quote/[token]`). | `nginx-get4domain.conf`, `src/middleware.ts` (Cloudflare settings are outside the repo) |
| 5 | P1 | **Stop blocking `/_next/` for Googlebot**; keep AI crawlers' rules but add the same private-path `Disallow` list to their group (or one shared group); add `/admin-team/`, `/d/`, `/visit-demo`, `/site/`, `/offline`, `/theme-*` to the Disallow list. | `src/app/robots.ts` |
| 6 | P1 | **Fix the home title and align positioning.** Use `title: { absolute: … }` (≤ 60 chars) on the home page; align root default title/OG/Twitter and JSON-LD descriptions with "Online Visible Partner"; shorten the home (319), pricing (315) and root (285) descriptions to ~155; shorten the `/leadspace`, `/features`, `/pricing`, `/domain-app` titles. | `src/app/(marketing)/page.tsx`, `src/app/layout.tsx`, `…/leadspace/page.tsx`, `…/features/page.tsx`, `…/pricing/page.tsx`, `…/domain-app/page.tsx` |
| 7 | P1 | **Keep transactional and token pages out of the index**: add a `noIndex` option to the helper (cart, order-success), and `noindex` metadata for `/quote/[token]`, `/d/[token]`, `/visit-demo`, `/theme-preview`, `/theme-local-test`, `/offline`, `/admin-team/accept-invite`, plus `noindex` for `/dashboard`, `/admin`, `/customer`, `/login`, `/register`. | `src/lib/metadata.ts`, the pages listed, `src/app/(marketing)/layout.tsx` |
| 8 | P1 | **Permanent redirects**: replace `redirect()` (307) with `permanentRedirect()` (308) on `/digital-growth` and `/products`. | `src/app/(marketing)/digital-growth/page.tsx`, `src/app/(marketing)/products/page.tsx` |
| 9 | P1 | **Link the orphans and make navigation crawlable**: add How it works, Portfolio, Templates, Features to the footer/header; render the 20 industry links in server HTML (e.g. footer industry column) instead of only inside the click-open dropdown; link all 20 industries from the home page. | `src/components/Footer.tsx`, `src/components/Header.tsx`, `src/app/(marketing)/page.tsx` |
| 10 | P2 | **Sitemap hygiene**: real `lastModified` dates (or omit), drop priority/changefreq, split into a sitemap index (static / industries / leadspace / per-vendor), and keep gated URLs out. | `src/app/sitemap.ts` |
| 11 | P2 | **Prefer server HTML for vendor sites**: retire the iframe `RawThemeFrame` path in favour of the theme-package renderer (D3 keeps HTML/CSS themes, which render server-side). | `src/app/site/[subdomain]/[[...rest]]/page.tsx`, `src/engine/themepack/site.tsx` |
| 12 | P2 | **Add breadcrumb JSON-LD** to the other hero pages and thin-title pages (Portfolio, Templates, Support → descriptive titles). | `src/components/PageHero.tsx`, the pages |
| 13 | P2 | **Server-render live prices** (or use the same defaults as the live values) so the HTML and the hydrated page agree. | `src/components/marketing/home/HomePricing.tsx` |
| 14 | P2 (V3) | **Directory, category, city and brand pages** with a sitemap index, breadcrumbs and internal-link mesh — planned in V3.2/V3.9, not fixable as-built. | new routes (`/businesses/…`), `src/app/sitemap.ts` |

---

## 8. What already works well
Self-canonicals on all 11 helper pages, the 7 inline marketing pages, the 20 industry pages, `/book-demo` and `/checkout`; `metadataBase` and absolute OG image; per-page `generateMetadata` and `generateStaticParams` for the 20 industry pages with `Service` and `BreadcrumbList` JSON-LD; native `<details>` FAQ with matching `FAQPage` JSON-LD on seven pages; a deliberate "vendor host canonical" design for new-renderer sites with draft/unclaimed/starter-content sites held out of the index (robots.txt, sitemap and meta); a real 404 for missing or draft vendor sites; `lang="en-IN"`; `/go/[slug]` uses a permanent redirect; no `ssr:false` or hydration-gated content on the public marketing tree; `llms.txt` is published.

## 9. Not verifiable from the repo (check on the live site before acting)
- Whether Cloudflare redirects `www`→apex or `http`→`https`, and whether HSTS is set.
- The live `robots.txt` (Cloudflare injects a managed block that this file cannot show).
- Which vendors have `site_doc_v2` on (decides which §2 branch applies today).
- What the rendered HTML, headers and status codes actually are (no page was fetched), and what Search Console shows for the demo and `/visit-demo` URLs.
- The API-generated `seo` object for `/ls/[slug]` and the `/leadspace/public/sitemap.xml` content.
