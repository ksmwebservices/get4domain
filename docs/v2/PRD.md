# PRD — pointer and decision log

**The authoritative product requirements document is [`../reference/GET4DOMAIN_V2_PRD.md`](../reference/GET4DOMAIN_V2_PRD.md)** (adopted 2026-10-02). It supersedes `docs/PRD.md` (July 2026), `docs/reference/PRD_FULL_PLATFORM_VISION.md` and the root `GET4DOMAIN_V2_PRD_CLAUDE_CODE_PROMPT.md`; those remain in the repository, marked superseded, for history. `GET4DOMAIN_V2_MASTER_SPEC.md` was named in the adoption request but does not exist in the repository or its git history.

Per PRD §93, this file is the requirements pointer only; do not duplicate requirement text here. Current reality is in [STATUS.md](STATUS.md); future execution in [ROADMAP.md](ROADMAP.md) / [RELEASE_PLAN.md](RELEASE_PLAN.md).

## PRD section map (where each concern is specified)
| Concern | PRD sections |
|---|---|
| Inspect-before-change, preservation, status vocabulary, "100% working" | §2, §64, §65 |
| Dashboard, navigation, capability engine | §3–§5, §63I |
| CRM / TeleCRM / tasks / Communication Hub / WhatsApp / SMS / Email / automation | §7–§13, §73–§78 |
| Growth, SEO Manager, Search Insights, share links, analytics | §14–§17, §31–§33, §69 |
| Marketing Studio, documents, AI | §18, §19, §37–§39, §84 |
| Social publishing | §20–§21, §72 |
| Sales channels, shipping connectors | §22–§24 |
| Commerce, restaurant, grocery, offers, loyalty, referrals | §25–§30, §63A–§63G |
| Business/Employee master, BOS, industries, billing, GST, accounting, HR, inventory, POS | §34–§36, §63H–§63AF, §68–§71, §79–§83 |
| Multi-tenancy, security, audit | §49, §55–§57, §86 |
| Domain Campaign (managed ads) | §88 |
| External integration rule, no-placeholder policy | §54, §89, §96 |
| Release structure, scheduling, matrices, documents, first response | §61, §90–§94 |

## Decision log (conflicts between the PRD and earlier decisions / the code)
| # | Topic | PRD says | Previous state | Resolution |
|---|---|---|---|---|
| D1 | Domain Campaign fee | §88: ≤₹20k → ₹2,000; ₹20,001–₹1L → ₹5,000; >₹1L → ₹10,000; enterprise custom | 10% of spend, ₹9,999 floor (built 2026-10-01) | **Resolved 2026-10-02** (`f7ad328`) — PRD brackets implemented. Enterprise = admin "Mark as Enterprise / Custom" toggle with manual fee. **Interpretation + "GST on top" await KSM confirmation.** |
| D2 | Product/tier names | §69–70 "DomainApp Business Growth System" / "Business Operating System"; no prices | Workspace ₹999/mo and BOS ₹1,999/mo, annual-only (2026-10-01) | **Open** — confirm mapping and entitlements |
| D3 | AI Reels/Video | §18/§39 "Coming Soon" | Shipped as live (fake clip when unkeyed) | **Open** |
| D4 | Social posting | §72 vendor-initiated, official APIs, never fake | Mock Meta service returns "published" | **Open** (V2.0b removes the mock; V2.2 builds real) |
| D5 | Soft delete / ids / refresh tokens / shadcn | PRD §63AB: financial records never silently overwritten | `CLAUDE.md` claims these; code differs | **Open** — see MIGRATION_PLAN Step 2 |
| D6 | Source-code/licensing | §71: Custom BOS source licensing is a separate commercial option | Business model: SaaS managed hosting, no source to client | consistent — no action |
