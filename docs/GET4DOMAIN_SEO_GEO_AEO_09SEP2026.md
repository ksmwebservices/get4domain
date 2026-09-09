# SEO + GEO + AEO overhaul — 09 Sep 2026

## Root cause of the indexing failure (fixed)
`src/app/layout.tsx` set a **site-wide canonical to the homepage** (`alternates.canonical =
https://get4domain.com`). Every page that didn't override it inherited that tag, so Google saw
`/industries/clinic`, `/contact`, `/book-demo`, and others as **duplicates of the homepage** and
refused to index them — despite the sitemap discovering 715 URLs. Confirmed live:
`/industries/clinic` was emitting `<link rel="canonical" href="https://get4domain.com"/>`.

## Fixed (verified on the dev render)
- **Removed the global canonical** from the root layout; every page now emits a correct
  **self-referencing canonical** (verified: `/`, `/industries/clinic`, `/contact`, `/book-demo`,
  `/pricing`, `/about`, `/features` all self-canonical).
- Added self-canonicals where missing: **all 20 `/industries/[id]`** pages, `/contact`, `/book-demo`
  (layout), `/checkout` (new noindex layout — transactional).
- Fixed **duplicate `| Get4Domain | Get4Domain`** titles: `createPageMetadata` now returns an
  absolute title (root template no longer double-appends); removed the manual brand suffix on
  `/industries/[id]` and `/features`.
- Removed the broken `google-site-verification` **placeholder** meta from the root layout.
- **Sitemap**: added the real indexable pages that were missing — `/features`, `/how-it-works`,
  `/portfolio`, `/templates`. Sitemap remains dynamically generated (industries + demo paths).
- Rendering: marketing pages are **server-rendered / statically prerendered** (Next App Router,
  `○ (Static)` in the build) — NOT client-only. So the slow indexing was the canonical, not SSR.

## Structured data (SEO + AEO)
- Root layout now emits **Organization + SoftwareApplication + WebSite** (with SearchAction) JSON-LD.
- Each `/industries/[id]` emits **Service + BreadcrumbList** JSON-LD.
- **FAQPage** JSON-LD + a visible FAQ already exist on the home and pricing pages (real Q&A: what
  Get4Domain is, cost, no-tech-needed, already-have-a-website). All JSON-LD verified to parse.

## GEO (AI answer engines)
- Added **`/llms.txt`** (served 200, text/plain) summarizing what Get4Domain is, pricing, the 20
  industries, and key links — for GPTBot/ClaudeBot/Perplexity context.
- Plain-text, extractable facts about the product, pricing and industries are present on the
  server-rendered home/pricing/industries pages (not JS-only).

## ⚠ Needs KSM's decision (not code — Cloudflare)
The **live robots.txt is Cloudflare-managed** and currently **blocks all AI crawlers**
(`GPTBot`, `ClaudeBot`, `Google-Extended`, `CCBot`, `Bytespider`, `Applebot-Extended`,
`meta-externalagent`, `Amazonbot` → `Disallow: /`, plus `Content-Signal: ai-train=no`). Regular
**Googlebot search is allowed**, so this does NOT affect normal Google indexing. But it means
ChatGPT/Perplexity/Gemini **cannot crawl or cite the site** — which is the opposite of the GEO goal.
This is a **Cloudflare dashboard setting** (AI Audit / "Block AI bots" / Managed robots.txt) and
cannot be changed from our code (Cloudflare prepends its block ahead of our robots.txt).
- Recommendation: if you want AI engines to cite Get4Domain, **allow GPTBot / ClaudeBot /
  PerplexityBot / Google-Extended** (at least for input/reference) in Cloudflare. Keeping
  `ai-train=no` (don't allow model training) is a reasonable middle ground. Your call.

## Noted, not "fixed" (per the task)
- The 7 GSC errors are from URLs (`/book-demo`, `/about`, `/pricing`, `/industries`) wrongly
  submitted **as sitemaps** in Search Console — a GSC submission mistake, not a site bug. Those
  pages are already inside `sitemap.xml`. Fix in GSC: remove them from the "Sitemaps" list.
- The sitemap also lists ~680 **gated demo URLs** (`/demo/...`) that redirect to `/visit-demo`
  (OTP gate) — they can't be indexed and will show as "Page with redirect" in GSC. They make up the
  bulk of the 715. Consider removing gated demo paths from the sitemap so crawl budget + GSC focus
  on the ~40 real public pages. Left as-is pending your call (you flagged the 715 as intentional).

## Do NOT expect an instant result
Google re-crawl/indexing timing is outside our control. What's fixed here is technical: correct
canonicals, complete sitemap, valid schema, llms.txt. Re-request indexing in GSC for the key pages
after deploy.

## Deploy
Frontend-only, no migration:
```bash
cd /srv/get4domain-site/get4domain_mvp && git pull origin get4domain-site && docker compose build frontend && docker compose up -d frontend
```
After deploy, spot-check: `curl -s https://get4domain.com/industries/clinic | grep canonical`
should show `href="https://get4domain.com/industries/clinic"` (not the homepage).
