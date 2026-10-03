# Marketing redesign — confident feature presentation (2026-10-03)

Business decision by KSM: customer-facing pages present the full feature set as included, with no "coming soon" / status language. This file is the **internal** record of what that copy maps to in code, so the decision is made with the facts in view. It is not customer-facing.

## What shipped
- One shared source of truth for the story: `get4domain_mvp/src/data/platform-features.ts` (12 capabilities, the 4-product matrix, the "Why" comparison rows). Home, Features, Pricing, Industries, `lib/pricing.ts` plan lists, `llms.txt` and the chat-bot prompt all say the same thing.
- `/pricing`: hero → **one 4-column table** (Workspace | BOS | DomainCampaign | Managed Services; `ProductComparison.tsx`, fits a 390px phone without sideways scroll) → DomainApp plan cards → DomainCampaign fees/scope → Managed Services band → **Why Get4Domain** (`WhyGet4Domain.tsx`, no named competitors) → wallet → domain → FAQ.
- Home: 12-capability feature grid; "Why Get4Domain" (dark) replaces the old "vs custom dev" table. Features page: driven by the same 12 capabilities. Industries index + every industry page: "everything included" strip.
- Status language removed from every marketing surface (grep clean; only the legal refund-policy wording "in progress"/"Partial Refunds" remains, which is contract language, not feature status). "Office management" was dropped from marketing entirely (not in the requested list).
- Step 6: `/dashboard/hrm` + a sidebar "HRM" entry showing "Setting up your account — available shortly".

## Tier placement (no new boundaries invented, one assumption)
Workspace/BOS follow the 01-Oct plan definitions. **Assumption to confirm:** *Inventory management* is listed under **BOS only** (it is "back office"; the 01-Oct definitions never placed it). Move it to Workspace by editing one row in `buildMatrix`.

## What the copy promises vs what exists in code today (for KSM's risk decision)
| Advertised | State in code |
|---|---|
| CRM, TeleCRM, lead capture, website auto-bot, Communication Hub (WhatsApp/SMS/email), AI Studio, PWA, themes/CMS | Built |
| GST invoicing, expenses, P&L, GST statement, payments ledger | Built (`/dashboard/accounts`, backend `accounting`) |
| "GSTR filing" | Built as a **filing tracker** (period/form/status/due/filed date). There is no e-filing to the GST portal. |
| HRM (staff, attendance, payroll) | **Not built** — placeholder page added; no backend module |
| Inventory management | **Partial** — retail stock/low-stock + automobile/agriculture stock exist per-industry; no general inventory module (the Universal Catalogue work is the foundation) |
| SEO / meta optimization | A vendor-editable SEO title/description/keywords form exists; ongoing optimization is a team-delivered service |
| Google Business Profile, Search Console, backlinks | No integration code. GA exists only as a Google Analytics ID field. These are team-delivered setup/services (the Growth Hub bundle) |
| Social media posting | Meta/Facebook/Instagram publishing is a **mock** (`meta.service.ts`) until Meta App Review; Google/Meta Ads launch is also mock |

**Step 6 deviation:** the brief said Accounting was "confirmed not built". It is built (876-line page, real backend), so a placeholder was **not** added over it — only HRM got one.

## Other notes
- `dashboard/my-services` still shows the old single-plan card (logic, flagged previously).
- Evidence screenshots: `docs/v2/evidence/marketing-redesign/` (desktop 1440 and mobile 390 full pages for pricing, home, industries, clinic industry page, features; plus section crops of the comparison table, Why section, Managed band, home feature grid, industry strip).
