# /pricing investigation & rebuild — 2026-10-03

Triggered by: "Managed Services is NOT visible on the live /pricing page, only via the footer." Re-verified against the **live site** (https://get4domain.com/pricing), not the earlier report.

## Step 1 — root cause (with evidence)

**The section was live and in the HTML. It was effectively invisible because of where and how it sat.** Not a bad merge, not a build that missed it, not a cache/ISR/CDN problem.

| Check | Result |
|---|---|
| Live DOM (browser, desktop 1440) | `"Want us to do it for you?"` present; `#domain-campaign` and `#managed-services` ids present; no stale "₹9,999" |
| Raw HTML via `curl`, normal **and** cache-busted (`?nocache=…`) | identical: section present (6 text hits incl. RSC payload), 155,374 bytes both times |
| Commit on origin | `95cf579 feat(pricing): make /pricing the hub…` is an ancestor of `origin/get4domain-site`; live HTML matches the code line for line |
| Cache layers | Cloudflare `cf-cache-status: DYNAMIC` (HTML not cached at the edge). Next ISR `x-nextjs-cache: HIT/STALE`, `s-maxage=300`. `STALE` on the first request is ISR's normal stale-while-revalidate; the content was identical either way |
| Service worker (`public/sw.js`) | network-first for navigations, only precaches `/offline` — cannot serve a stale /pricing |
| Duplicate `<main>` in DOM | one is `display:none` inside `DIV#S:0` — Next's streaming-Suspense template (from `loading.tsx`); normal, not a double render |

**Why KSM could not see it** (measured on the live page):
- The section started at **13,069 px of a 20,130 px page on mobile (8.2 screen-heights down, 65%)** and 4,631 px of 7,364 px on desktop (63%).
- Above it: a toggle that shows **one plan at a time** (no side-by-side comparison), two heroes stacked back to back ("Two plans. No surprises." then "Two plans. Billed annually."), two comparison tables, plan lists, and the wallet price list.
- Nothing above the fold, and no nav link, mentioned DomainCampaign or Managed Services (header: Features / Pricing / Contact; footer only).
- When reached, it was two small light "summary" cards with outline buttons, in a page that is otherwise dark/loud.

## Step 2 — rebuilt /pricing

New components in `get4domain_mvp/src/components/marketing/pricing/`: `PlanComparison.tsx`, `CampaignPricing.tsx`, `ManagedServicesSection.tsx`; `pricing/page.tsx` rewritten.

- **Hero:** three tiles (DomainApp ₹999–₹1,999/mo · DomainCampaign from ₹2,000/mo · Managed Services "Custom quote", highlighted) visible above the fold on desktop **and** a 375 px phone; each jumps to its section.
- **DomainApp:** two plan cards side by side + one grouped feature table (Workspace vs BOS columns repeated per group): website & hosting, Workplace (expenses, full GST+P&L accounting, tasks, HRM/Office *coming soon*), CRM/TeleCRM/bot replies, growth hub (SEO keywords, SEO/GEO/AEO bundle), AI Studio credit, theme-change entitlement, team & support, price row. Plan-dependent numbers come from the live admin pricing (`applyLivePricing`), fallback to `PLAN_TERMS`.
- **DomainCampaign:** full §88 bracket table (₹2,000 / ₹5,000 / ₹10,000 + Enterprise custom, worked examples, GST/ad-spend notes) and a six-card scope grid (ads, content, analytics, SEO/GEO/AEO, group + link distribution).
- **Managed Services:** full-width dark band, large amber "Get a Custom Quote" CTA at the top and bottom, the eight services grouped Build/Grow, 4-step quote process, explicit "custom-quoted per project, no fixed price list".
- Page height 20,130 px → ~15,100 px mobile / 9,304 px desktop; Managed Services now starts at 47% down on desktop. Header gained a **Managed Services** link; `/managed-services` added to the sitemap.
- Copy beyond the existing /domain-campaign and /managed-services page text (the "Build/Grow" headings, quote-process steps, the "Not the same as DomainApp's campaign tools" note) is new wording — review before marketing sign-off.

## Step 3 — stale references found and fixed

| Where | Was | Now |
|---|---|---|
| `backend-api/src/ai/ai.service.ts` MARKETING_PROMPT (the **site chat bot**) | "ONE plan, ₹999… Do NOT mention DomainCampaign" — the bot told visitors DomainCampaign doesn't exist | three products, both annual plans, Campaign brackets, Managed Services; old tiers flagged outdated. **Needs backend deploy.** |
| `public/llms.txt` (read by AI search engines) | one plan, ₹999 quarterly (₹2,997) or ₹9,999/yr | Workspace/BOS annual with GST totals, Campaign brackets, Managed Services |
| `app/layout.tsx` | default title "₹999/month"; description "One plan… everything included"; JSON-LD single Offer ₹999 | "From ₹999/month"; Workspace/BOS/Campaign/Managed description; two Offers (₹11,988, ₹23,988) |
| `how-it-works` | "Just ₹4,999 one-time. No recurring fees" and "everything in one price" | annual Workspace/BOS pricing, plan-scoped inclusions |
| `data/content.ts` FAQ (rendered on `/support`) | "DomainApp Startup vs Enterprise", "launch within a few business days", DomainCampaign = social-media platform, "upgrade Startup→Enterprise" | Workspace vs BOS, 24-hour launch, DomainCampaign = managed ads with fee, Workspace→BOS |
| `components/CTABanner.tsx` (used on about, contact, how-it-works, portfolio, industries/[id]) | "for ₹999/month" / "Buy Now — ₹999/mo" | "from ₹999/month" / "from ₹999/mo" |
| `industries/[id]` | "From ₹999/month — everything included" | "…website, CRM & AI Studio" |
| `constants/site.ts` OG alt text | "₹999/mo" | "From ₹999/mo" |
| `managed-services` FAQ | "the ₹999/month DomainApp plan" | Workspace/BOS wording |
| `admin/leads` demo-followup WhatsApp template | "just ₹999/month, everything included" | Workspace/BOS annual |
| `dashboard/page.tsx` sandbox banner | "everything included for ₹999/month" | plans from ₹999 / ₹1,999 billed annually |
| `app/sitemap.ts` | `/managed-services` missing | added |

Already correct (checked): home, features, about, domain-app, domain-campaign, managed-services body copy, pricing metadata.

**Found, deliberately NOT changed (decisions for KSM):**
- `app/dashboard/my-services/page.tsx` — the logged-in plan-request card is still a hard-coded "single product, ₹999/month, everything included" with `PLAN.monthly = 999` feeding a request flow. That is logic (amount sent), not copy; it should offer Workspace/BOS.
- `data/content.ts` `addOns` (SEO ₹2,999, Social posting ₹3,999 …) and `components/AddOnMarketplace.tsx` — the component is imported nowhere (dead); the same price list also lives in `dashboard/my-services` (functional).
- Frontend has **no ESLint config** (`next lint` opens an interactive setup prompt) — CLAUDE.md's "run lint" gate can't pass until one is chosen.

## Step 4 — cache/propagation

No cache fault was found, so no code change was needed for cache. For this deploy:
1. `cd get4domain_mvp && npm run build` produces a fresh prerender of `/pricing`; restarting the Next server replaces the ISR cache. `revalidate = 300` then keeps it fresh.
2. **No Cloudflare purge is required** for HTML (it is `DYNAMIC`, uncached). Static JS/CSS are content-hashed. If you ever see an old page, it is the browser's 5-minute client router cache (`x-nextjs-stale-time: 300`) — hard-reload.
3. Deploy the **backend too** (chat-bot prompt lives in `ai.service.ts`); the bot keeps the old text until the API restarts.
4. After deploy: `curl -s https://get4domain.com/pricing | grep -c "Three ways to work with us"` should be ≥ 1, and `curl -s https://get4domain.com/llms.txt | grep -c "Workspace"` ≥ 1.
