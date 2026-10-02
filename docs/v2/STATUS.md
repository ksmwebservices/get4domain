# STATUS — Get4Domain V2 (current reality)

> Reflects reality, not intent. Product requirements live in [`../reference/GET4DOMAIN_V2_PRD.md`](../reference/GET4DOMAIN_V2_PRD.md); evidence in [AUDIT_REPORT.md](AUDIT_REPORT.md). **Last updated: 2026-10-02.** Update this file after every completed dispatch.

## Headline
V2 execution has **not started** (PRD §99: audit baseline first). The existing application is **not** 100% functional against the PRD — see the verdict and the critical-findings table in [AUDIT_REPORT.md](AUDIT_REPORT.md). **Security items S1–S6 are live in production today** and are recommended before any V2 feature work.

## Source control
| Item | State |
|---|---|
| Branch | `get4domain-site` |
| Local HEAD vs live remote (`git ls-remote`) | **identical** at last check (`f7ad328`); nothing unpushed on any branch |
| Last session's commits all on origin | yes — `ca95c07` (Managed Services), `0ff83a6` (Workspace/BOS pricing), `0092985` (DomainCampaign), `f7ad328` (fee fix) and the earlier deebiphotography/my-products/stepnrock commits |
| Uncommitted | this audit's documentation (`docs/v2/**`) and the "superseded" notices on three older PRD documents |

## Database / migrations (verified read-only against the live DB, 2026-10-02)
| Migration | State |
|---|---|
| 38 local migration folders | **all applied** on the live DB |
| `20261001100000_add_subscription_theme_change_tracking` | applied (theme-change limits are now enforced for Workspace/BOS subscriptions created after it) |
| `20261001110000_add_domain_campaign_records` | applied (`g4d_domain_campaign_records` exists) |
| `20261002120000_domain_campaign_custom_fee` | **NOT applied** — adds `isCustomFee`. **Apply before deploying the new DomainCampaign code**: `cd backend-api && npx prisma migrate deploy` (otherwise recording a spend fails "column does not exist"). |
| Drift | `20260719093736_add_leads` is applied in the DB but has no local folder; 28 core tables were created by `prisma db push`, not by migrations (see [MIGRATION_PLAN.md](MIGRATION_PLAN.md)) |

## Product surface — what's shipped
| Area | Status |
|---|---|
| DomainApp plans | **Workspace** ₹999/mo (₹11,988/yr + GST) and **BOS** ₹1,999/mo (₹23,988/yr + GST); annual-only; quarterly retired for new purchases. One-time AI Studio credit (₹499 / ₹1,299) tagged `ai_studio_bonus`. Theme-change allowance 2 / 4 per year. HRM and Office Management shown as "coming soon" (not built). **Razorpay Plans still to be created by KSM**: "DomainApp Workspace — Annual" ₹14,145.84 and "DomainApp BOS — Annual" ₹28,305.84 (GST-inclusive). |
| Domain Campaign | Public page, two lead-capture entry points, admin tab (Managed Services page) with client onboarding, manual spend, billing history, one-click invoice. **Fee = PRD §88 brackets**: spend ≤ ₹20,000 → ₹2,000; ₹20,001–₹1,00,000 → ₹5,000; above → ₹10,000 (+ GST); **Enterprise/Custom = admin-entered fee per client-month (interpretation — needs KSM confirmation)**. Old 10%/₹9,999 logic removed everywhere. |
| Managed Services | Public page + lead capture + admin proposal/quote tool with shareable accept/decline link. |
| Standalone vendor sites | stepnrock and deebiphotography live on the shared backend; ksm-quantum built, deploy/DNS pending; allwin-tours separate. |

## Known open defects (tracked, not fixed in this audit)
- S1–S15 in [AUDIT_REPORT.md](AUDIT_REPORT.md) (critical: forgeable payment verification, client-priced checkout, password-hash/invite-token exposure, open WhatsApp webhook, no rate limiting).
- `generateInvoice` (DomainCampaign) lacks a server-side already-invoiced guard (UI hides the button once invoiced).
- Stale "₹999/month or ₹9,999/year" line on `/features` (`get4domain_mvp/src/app/(marketing)/features/page.tsx:122`).
- Vendor team invite email links to `/team/accept-invite`, which has no route.
- DomainCampaign spend/fee SQL uses raw parameterised queries until `prisma generate` is run for the model.

## Decisions awaiting KSM
1. Confirm the Enterprise/Custom interpretation and "GST on top" for Domain Campaign fees.
2. Confirm Workspace ≙ "Business Growth System" and BOS ≙ "Business Operating System" (PRD §69–70) and whether PRD tier boundaries should now drive server-side entitlements.
3. AI Reels/Video: relabel "Coming Soon" (PRD §18/39) or accept the deviation.
4. `CLAUDE.md` vs reality (UUIDs, soft delete, refresh tokens, shadcn, lint/tests): change the rule or the code.
5. Approve a pre-V2 stabilisation sprint for S1–S6.

## Next actions (no V2 execution until approved)
1. Apply `20261002120000` on the VM, then deploy.
2. Create the two Razorpay Plan objects.
3. Review [ROADMAP.md](ROADMAP.md) / [RELEASE_PLAN.md](RELEASE_PLAN.md) and approve (or amend) the V2.0a stabilisation scope.
