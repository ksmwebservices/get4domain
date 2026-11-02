# SEO-0 — Plan (no code yet)

> Date: 2026-11-03 · Branch `v3-step0` · Builds on `docs/v3/SEO_AUDIT_AS_BUILT.md` (commit 58a51ac, left unchanged) and adds the live evidence.
> **Plan only.** Nothing in `get4domain_mvp/` has been changed. Paths are relative to `get4domain_mvp/`.
> No "SEO-0" existed in `docs/` before this file; this is its first definition.

## 0. Live evidence (owner-supplied) and what it changes

- Googlebot UA and a normal UA both get `307 → /visit-demo?to=<path>` for `/demo/*`. This confirms audit §1.6 (no crawler exception).
- Google's live test of `/demo/clinic` rendered `/visit-demo`: the **home** title and description (with legacy Workspace/BOS prices), `index,follow`, and client-side-only content ("Loading…").
  - Cause in code: `src/app/visit-demo/page.tsx` is `'use client'`, so it cannot export `metadata` and inherits the root layout's. Its only server HTML is the `Suspense` fallback "Loading…" because `useSearchParams` sits below it.
- Consequence: every one of the ~678 sitemap demo URLs currently resolves to one indexable, thin page carrying legacy pricing.

**Two corrections to the audit fix list** (the audit text stays as committed; this plan overrides it):

1. Audit fix #1 and #5 add `/visit-demo` to the `robots.txt` Disallow list. **Do not.** A crawler blocked by robots.txt cannot fetch the page and never sees its `noindex`. Per instruction (5), no `Disallow: /demo/` or `/visit-demo` yet. Revisit only after Search Console shows them dropped.
2. Audit fix #4 asks for a self-canonical on `/visit-demo`. **Drop it.** A noindex page needs no canonical, and a canonical on a noindex URL sends mixed signals.

## 1. Positioning rule (V3) — remove legacy text

Rule: Workspace, BOS, LeadSpace and the ₹999 / ₹1,999 prices do not exist in V3. Tagline: **"Your Online Visible Partner"**. No prices in meta or schema until V3 prices exist in one source of truth.

| # | Where | File | Change |
|---|---|---|---|
| P1 | Root title default | `src/app/layout.tsx` | New default: `Get4Domain — Your Online Visible Partner` (≤ 60 chars, no price). Keep `template: '%s \| Get4Domain'`. |
| P2 | Root description | `src/app/layout.tsx` | One sentence, ≈ 155 chars, no plan names or prices. |
| P3 | Root OG + Twitter title/description | `src/app/layout.tsx` | Same tagline and description as P1/P2 (today: "Online **Identity** Partner", "Starting ₹999"). |
| P4 | Root `keywords` meta | `src/app/layout.tsx`, `src/constants/site.ts`, `src/lib/metadata.ts` | Delete the root `keywords` array, `siteConfig.keywords`, and the `keywords ?? siteConfig.keywords` fallback in the helper. Google ignores the tag; it currently carries "domain app", "domain campaign", "business operating system". |
| P5 | Home title and description | `src/app/(marketing)/page.tsx` | Use `title: { absolute: 'Get4Domain — Your Online Visible Partner' }` (removes "Free LeadSpace page" and the doubled brand). New ≈ 155-char description with no plan names or prices. |
| P6 | `SoftwareApplication` JSON-LD offers | `src/app/layout.tsx` | Remove the `offers` array. Keep the type only if the block is retained (see S1); otherwise drop the block. |
| P7 | Industry page JSON-LD `Offer(₹999)` | `src/app/(marketing)/industries/[id]/page.tsx` | Remove `Offer` and price from the `Service` block. Keep `Service` and `BreadcrumbList`. |
| P8 | OG image alt text | `src/constants/site.ts` (`ogImage.alt`) | Remove "From ₹999/mo". **Open:** `public/og-banner.jpg` may have the price baked into the picture. I cannot read the image text here; check by eye and, if so, replace the asset. |
| P9 | `llms.txt` | `public/llms.txt` | Rewrite lines 3, 13, 14 (DomainApp Workspace/BOS prices). It is a public AI-facing document, so the same rule applies. |
| P10 | Page copy (**moved out of SEO-0, see §5 queue**) | 14 files from `grep`: `(marketing)/{page,about,domain-app,features,how-it-works,leadspace,managed-services,pricing,industries/[id]}`, `components/marketing/{HeroMockup,WhyGet4Domain,ManagedServicesForm}`, `…/home/{AIStudio,DashboardPreview,FeatureGrid,HomePricing,LeadSpaceHero}`, `…/pricing/{CampaignPricing,PlanComparison,ProductComparison}`, `components/Footer.tsx`, `data/` FAQs | Copy rewrite, not only metadata. **Needs an owner decision (see §5, Q1).** |

**Test (P1–P9):** a script fetches `/`, `/pricing`, `/industries/clinic`, `/llms.txt`, and fails if the HTML, JSON-LD or text contains `Workspace`, `BOS`, `LeadSpace`, `₹999`, `₹1,999`, `11988`, `23988`, `Identity Partner`, or a `<meta name="keywords">`. Also asserts the home `<title>` equals the P5 string exactly (length ≤ 60).

## 2. Demo handling (instructions 1–5)

| # | Instruction | File | Change | Test |
|---|---|---|---|---|
| D1a | `noindex` meta on `/visit-demo` | `src/app/visit-demo/page.tsx` | Split the file. `page.tsx` becomes a **server component** exporting `metadata` with `robots: { index: false, follow: false }`. The OTP form moves unchanged into `src/app/visit-demo/VisitDemoForm.tsx` (`'use client'`). | `curl` any `/visit-demo?to=…` → HTML has `<meta name="robots" content="noindex, nofollow">`. |
| D1b | `X-Robots-Tag` on `/visit-demo` (all query variants) | `next.config.ts` | Add `async headers()` with `source: '/visit-demo'` → `X-Robots-Tag: noindex, nofollow`. A route `source` ignores the query string, so every `?to=` variant is covered. Also covers `/visit-demo/` trailing-slash. | `curl -I '/visit-demo'`, `'/visit-demo?to=/demo/clinic'`, `'/visit-demo?to=/x&y=1'` → header present on all. |
| D1c | `X-Robots-Tag: noindex` on the `/demo/*` 307s | `src/middleware.ts` | Set the header on **both** redirects: the bare-keyword canonicalisation redirect and the gate redirect to `/visit-demo`. Responses that pass with a valid pass cookie are left alone. | `curl -I -A Googlebot /demo/clinic` → `307`, `Location: /visit-demo?to=%2Fdemo%2Fclinic`, `X-Robots-Tag: noindex`. Same for `/demo/dental` (keyword redirect) and with a normal UA. |
| D2 | Remove `/demo/*` from the sitemap | `src/app/sitemap.ts` | Delete the `allDemoPaths()` import and the `demoPages` block. `allDemoPaths` itself stays (other callers may use it). | `/sitemap.xml` contains 0 `/demo/` URLs; count falls from ≈ 715 to 37. |
| D3 | Server-render `/visit-demo` heading and text; `Suspense` around `useSearchParams` | `src/app/visit-demo/page.tsx`, `VisitDemoForm.tsx` | Server page renders the `<h1>` ("Verify to view the demo") and the explanatory paragraph as static HTML. `VisitDemoForm` (the only `useSearchParams` user) is wrapped in `<Suspense>` with a **non-empty fallback** (a disabled form skeleton, not "Loading…"). The category chip ("Clinic demo") stays inside the client island, so the page stays static and has no per-query variants. | `curl` the raw HTML (no JS) → contains the `<h1>` and paragraph; does not contain only "Loading…". Build output shows `/visit-demo` as static (○), no "useSearchParams should be wrapped in Suspense" warning. |
| D4 | Own title and description | `src/app/visit-demo/page.tsx` | `title: { absolute: 'Verify to view a demo \| Get4Domain' }`, a one-line description. No prices, no plan names. | Raw HTML `<title>` and `<meta name="description">` differ from the home page. |
| D5 | No robots.txt Disallow for `/demo/` yet | `src/app/robots.ts` | **No change** for demo paths. | `/robots.txt` has no `/demo` or `/visit-demo` line. |

**Honest limits**
- Google generally evaluates the **target** of a redirect, so the header on the 307s (D1c) is belt-and-braces. The signals that actually work are D1a/D1b on the landing page and D2 (stop submitting the URLs).
- Already-known URLs stay in Search Console for weeks ("Page with redirect" / "Crawled – not indexed"). Success is "no demo URL indexed with the home title", checked in the URL Inspection tool, not a same-day change.
- D3 does not make the demo content crawlable. That is a separate product decision (OTP gate vs discoverability, audit fix #1). This plan keeps the gate.

**Order:** D1a+D3+D4 (one change) → D1b → D1c → D2. D2 last so that the URLs Google already holds meet `noindex` on its next crawl.

## 3. The other 14 audit items

Audit rows in order; "→" marks a row that is now merged into §1/§2 or deferred.

| # | Item | File | Change | Test |
|---|---|---|---|---|
| A1 | Gated demo URLs in sitemap | → D2 | — | — |
| A2a | **Main-host `/site/<sub>` redirect** | `src/middleware.ts` | On hosts `get4domain.com` / `www.`, a path starting `/site/<sub>[/…]` → `308` to `https://<sub>.<SITE_BASE>[/…]` (404 if the sub is reserved/unknown). Do this **before** any `Disallow: /site/`, otherwise Google cannot see the redirect. | `curl -I https://get4domain.com/site/acme/about` → `308`, `Location: https://acme.get4domain.com/about`. Vendor host unaffected. |
| A2b | **Vendor-host canonical** (non-`docV2` vendors have none) | `src/app/site/[subdomain]/[[...rest]]/page.tsx` (`generateMetadata`, ~line 133) | Always emit `alternates.canonical` on the vendor host, not only when `site.docV2`. | Raw HTML of a legacy-renderer vendor page has a canonical on `<sub>.get4domain.com`. |
| A2c | **Inner-page canonical bug** (`docV2` without theme canonicalises every path to the home) | same file, same line | Canonical = vendor host + the **actual** route path, not only `/p/<slug>`. | `…/about`, `…/p/x`, `/` each have a self-canonical. |
| A3 | **Get4Domain JSON-LD only on get4domain pages** | `src/app/layout.tsx` → `src/app/(marketing)/layout.tsx` | Move the `Organization` and `WebSite` blocks out of the root layout into the marketing layout (or home only). Drop `SoftwareApplication` unless a V3 product description exists. Remove `SearchAction` (the `/industries` page ignores `?q=`). Fill `sameAs` only from real profiles; fix `foundingDate` to match About. | Vendor page `/site/<sub>` and `/ls/<slug>` HTML contain 0 Get4Domain JSON-LD blocks; `/` contains `Organization` + `WebSite` once each. |
| A4 | www/https plan (**plan only, no change**) | `nginx-get4domain.conf`, Cloudflare | Plan: nginx `www`→apex 301 that keeps the scheme (safe under Flexible SSL); http→https at Cloudflare "Always Use HTTPS" + HSTS (not in nginx, which would loop). Verify live first (audit §9). | Live check only: `curl -sI http://get4domain.com`, `https://www.get4domain.com` — record status and `Location`. |
| A5 | **`robots.ts` fixes** | `src/app/robots.ts` | (a) Remove `/_next/` from the `*` group. (b) Give the AI-bot group the same private-path Disallows (`/dashboard/ /admin/ /customer/ /api/ /login /register`), or merge into one group. (c) Add `/admin-team/`, `/d/`, `/offline`, `/theme-preview/`, `/theme-local-test`. (d) **Not yet:** `/visit-demo`, `/demo/`, `/site/` (see §0 and A2a). (e) Drop the Yandex-only `host`. | `/robots.txt` parsed per user-agent: Googlebot can fetch `/_next/static/…`; GPTBot is disallowed on `/admin/`. |
| A6 | Titles/descriptions length | → P5 and §1 | Over-long titles (`/leadspace` 96, `/features` 87, `/pricing`, `/domain-app`) shortened in metadata only; copy untouched. | Script asserts every sitemap page: title ≤ 60, description ≤ 160. |
| A7 | Noindex for transactional/token/private pages | `src/lib/metadata.ts`, `/cart`, `/order-success`, `/quote/[token]`, `/d/[token]`, `/offline`, `/theme-preview`, `/theme-local-test`, `/admin-team/accept-invite`, plus layouts for `/dashboard`, `/admin`, `/customer`, `/login`, `/register` | Add a `noIndex` option to `createPageMetadata`; add `robots: { index:false }` in the listed pages/layouts. (A `Disallow` alone does not stop indexing.) | Raw HTML of each has `noindex`; `/cart` no longer `index: true`. |
| A8 | `redirect()` 307 → `permanentRedirect()` 308 | `src/app/(marketing)/digital-growth/page.tsx`, `…/products/page.tsx` | Swap the call. | `curl -I /products` → `308`. |
| A9 | **Inbound links / crawlable nav** | `src/components/Footer.tsx`, `Header.tsx`, `src/app/(marketing)/page.tsx` | Link `/how-it-works`, `/portfolio`, `/templates`, `/features` from the footer; render all 20 `/industries/<id>` links in server HTML (footer column) instead of only in the click-open dropdown; link all 20 from the home page. Labels must follow §1 (no LeadSpace/Workspace/BOS wording). | Raw HTML of `/` has `href="/industries/<id>"` ×20 and the 3 former orphans. |
| A10 | `createPageMetadata` **`path` required** | `src/lib/metadata.ts` | Make `path` a required, non-optional field (TypeScript error if omitted) and validate it starts with `/`. Removes the "forgot `path` → canonical = home" trap. All 11 current callers already pass it. | `npm run build` (typecheck) passes; a temporary call without `path` fails to compile. |
| A11 | Sitemap hygiene | `src/app/sitemap.ts` | Real `lastModified` (or omit); drop `priority`/`changeFrequency`; later a sitemap index. | No `lastModified` equals the request time. |
| A12 | Iframe `RawThemeFrame` | → deferred | Server-rendered theme path (D3 in the V3 decisions). Not SEO-0. | — |
| A13 | Breadcrumb JSON-LD on hero pages | `src/components/PageHero.tsx` | Defer to after §1. | — |
| A14 | Server-render live prices | `src/components/marketing/home/HomePricing.tsx` | **Superseded** — prices are being removed (§1/P10). Revisit when V3 prices exist. | — |
| A15 | Directory/category/city/brand pages | new routes | V3.2/V3.9 scope. Not in SEO-0. | — |

## 4. Verification approach

There is no JS test runner in `get4domain_mvp/` (`package.json` has only `build` and `lint`), and the stack is fixed, so no new framework is proposed. Instead:

- `npm run build` and `npm run lint` after each step (repo rule).
- One plain Node script `scripts/seo-check.mjs` (new file, ~80 lines) that takes a base URL and runs the header/HTML assertions above with `fetch(…, { redirect: 'manual' })` and two User-Agents.
- Run it against a **local `next start` of the frontend only**. Per project memory, never boot the backend locally (`.env.local` points at production); the assertions here do not need the API.
- After deploy, run the same script against `https://get4domain.com`, then use Google's URL Inspection on `/visit-demo?to=/demo/clinic`.

## 5. Owner decisions (2026-11-03, plan approved)

1. **Pricing copy: keep it for now** on `/pricing`, `/domain-app`, `/features` and the home FAQ. SEO-0 cleans only meta, OG, JSON-LD, `llms.txt` and keywords. P10 (page-copy rewrite) is therefore **out of SEO-0** and moves to the queue below.
2. **`public/og-banner.jpg`:** the owner will check the image by eye and report back. P8 covers the alt text only; replace the asset if the price is in the picture.
3. **Demo pages with a valid pass also send `noindex`** (new step D6 below).

### Queue (not SEO-0)
- **Q-SEO-1: rewrite public pricing copy after V3 prices exist.** Files: the P10 list (`/pricing`, `/domain-app`, `/features`, home FAQ and pricing section, `components/marketing/pricing/*`, `Footer.tsx`). Blocked on the V3 price source of truth. Also covers audit A14 (server-render live prices).

### Added step
| # | Change | File | Test |
|---|---|---|---|
| D6 | Send `X-Robots-Tag: noindex` on `/demo/*` responses served to a visitor with a valid pass (the `NextResponse.next()` branch) | `src/middleware.ts` | `curl -I` with a signed pass cookie for the category returns 200 with `X-Robots-Tag: noindex`. |

## 6. Proposed implementation order (each its own commit, after approval)

1. §2 D1a+D3+D4 → D1b → D1c → D6 → D2
2. §1 P1–P9
3. A3, A2b, A2c, A2a (in that order, so the redirect lands after canonicals are correct)
4. A5, A7, A8, A10
5. A9, A11
6. A4 (live check, then nginx/Cloudflare as a separate ops task)

---

## 7. A4 — www / https plan (PLAN ONLY, written 2026-11-03; no code, nginx, Cloudflare or DNS was changed)

This replaces the A4 row in §3 (which proposed an nginx `www` redirect). Today Cloudflare SSL is **Flexible** (visitors reach Cloudflare over HTTPS; Cloudflare reaches the VM over plain HTTP on :80), and every nginx vhost carries the comment "no redirect, no certbot" because an origin-side redirect or certificate would loop under Flexible. Apex and `www` are served identically.

1. **Inventory first (read-only).** List every proxied hostname on the zone and every nginx vhost (`get4domain`, `stepnrock`, `deebiphotography`, `ksmquantum`, `allwintours`, `indianambulance`, the gapi API host). Full (strict) is a **zone-wide** setting unless a Configuration Rule scopes it per hostname, so each vhost needs :443 before the switch, or the switch is scoped.
2. **Origin certificate.** Create a Cloudflare Origin CA certificate for `get4domain.com` and `*.get4domain.com`; install it on the VM; add `listen 443 ssl;` blocks that proxy to the same upstreams; keep :80 working. `nginx -t`, reload. Verify straight against the origin with `curl --resolve` on :443.
3. **Switch SSL/TLS to Full (strict)**, first for `get4domain.com` only (Configuration Rule), then the zone. Smoke-test every site. **Rollback = set the mode back to Flexible** (instant; nothing else changes).
4. **`www` → apex 301 as a Cloudflare Redirect Rule** (hostname equals `www.get4domain.com` → `https://get4domain.com` + path + query, 301), created *before* any nginx change so the origin stays untouched. Turn on "Always Use HTTPS" at the edge.
5. **HSTS timing.** Only after step 3 has run clean for a week: `max-age=300`, then 1 day, 1 week, 6 months. `includeSubDomains` only when every subdomain (all vendor hosts) is confirmed on HTTPS; `preload` last and only deliberately (hard to undo).
6. **After Full (strict) is stable:** replace the "do not redirect/certbot" comments in the repo's nginx files and optionally add an origin http→https 301 (safe under Full strict).
7. Custom vendor domains (a vendor's own `.in`, say) are separate Cloudflare zones with their own SSL mode; `docs/v2/CUSTOM_DOMAIN_RUNBOOK.md` stays valid for them until each is moved.

Verify live before and after (read-only): `curl -sI http://get4domain.com`, `https://www.get4domain.com`, `https://get4domain.com` — record status and `Location`.

## 8. As built (auto-run, branch `v3-step0`)

| Plan item | Commit | Notes |
|---|---|---|
| P1–P9 legacy removal | `5a6e49e` | Root/home titles, descriptions, OG/Twitter, og:image alt, `llms.txt`, root keywords, SoftwareApplication offers, industry-page Offer. FAQPage structured data skips any Q&A that still uses retired wording (visible copy untouched; queue Q-SEO-1). |
| D1–D6 demo gate | `1073e7f` | `/visit-demo` server page + client form island; noindex meta and header on every variant; noindex header on `/demo/*` responses (both 307s and pages served with a pass); `/demo/*` out of the sitemap; no robots Disallow. |
| A2, A3 canonicals, redirects, JSON-LD | `4839fcf` | 301 `get4domain.com/site/<sub>` → vendor host and vendor-host `/site/<sub>/x` → `/x` (GET/HEAD only); `vendorCanonical()` for every renderer; Organization / WebSite / SoftwareApplication only in the marketing layout; SearchAction and empty `sameAs` removed. |
| A5, A7–A11 | `faf37a9` | robots.txt (`/_next/` open; AI bots disallow `/admin/ /dashboard/ /app/ /api/`); private-page noindex header; cart/order-success noindex meta; real 308 for `/products` and `/digital-growth`; footer links to three orphans; `path` required in `createPageMetadata`; sitemap without invented dates/priorities. |
| §4 verification | `d3ca48a` | `scripts/seo-check.mjs` (34 checks, local server only; `npm run seo:check`). |

**Decisions taken where the dispatch did not say:** redirect status 301 (the dispatch), not 308 as drafted in A2a; GET/HEAD only so a POST is never turned into a GET; `foundingDate` left as it was live (TODO in `SiteJsonLd.tsx` to confirm it with the About page); `sameAs` omitted with a TODO; A6 (shortening over-long titles) **not done** because it needs wording the owner should choose; A9's "all 20 industry links in the server HTML" not done (only the three orphan pages, as dispatched).

**Not done / owner actions:** `public/og-banner.jpg` still may carry a price in the picture itself (check by eye; replace the asset if so). Q-SEO-1 (pricing copy rewrite) is blocked on the V3 price source. Frontend `next lint` is not configured (it stops at an interactive prompt); the build's type check and `tsc --noEmit` were used instead.
