# Vendor Dashboard — Theme-Aware Shared Components: Refactor Plan (REVIEW FIRST)

Status: **PLAN ONLY — not implemented.** Review and approve before running.
Author context: written during the vendor-app wiring engagement (Phase 3). Phases
1–2 (design system + primitives, dashboard home) and the Accounts re-skin are done.
TeleCRM / Campaigns / AI Studio are **blocked** on the issue below.

---

## 1. The problem (why Phase 3 stopped)

The remaining Phase-3 pages are **not** independently re-skinnable in place, because
they render **shared, multi-consumer components** that are light-themed:

| Page | Renders | Also used by | Blast radius if dark-skinned in place |
|---|---|---|---|
| `/dashboard/telecrm` | `components/telecrm/TeleCrmBoard.tsx` (687 lines, light) | **`/admin/telecrm`** | Dark-skinning the board **breaks the admin CRM** (needs to stay light). |
| `/dashboard/campaigns` (441 lines) | `components/ui/Button` (+ inline light styles) | The whole app's light UI kit | Rewrite is large; UI-kit changes ripple app-wide. |
| `/dashboard/ai-studio` (862 lines) | `components/ui/Button`, `Card`, `Input`, `Modal` | The whole app's light UI kit | Same — the UI kit is shared by every light page. |

So a blind "make it dark" either **breaks other consumers** (admin, marketing) or
requires **app-wide UI-kit changes** — neither is safe to do without visual QA (all
of these are auth-gated and can't be rendered in the build harness).

The clean fix is to make the shared components **theme-aware**: the vendor
dashboard passes a dark skin; every existing (light) consumer is unchanged by
default.

---

## 2. The approach

Introduce an explicit, opt-in **skin** with a safe default of `light`, so **no
existing consumer changes behavior** unless it asks for `dark`.

Two mechanisms, used together:

- **Context** (preferred for deep trees): a `VendorSkinProvider` exposing
  `useSkin(): 'light' | 'dark'`, defaulting to `light`. The vendor dashboard
  layout (or each re-skinned vendor page, via its `.vendor-ui` root) wraps its
  subtree in `<VendorSkinProvider skin="dark">`. Admin/marketing never wrap →
  they stay `light`.
- **Prop override** (for leaf/shared components that take explicit props):
  `skin?: 'light' | 'dark'` prop, default `light`, which wins over context when
  provided. Lets a single component be forced without a provider.

Inside each themed component, replace hard-coded light Tailwind classes with a
small `cx(skin)` helper that returns the light **or** dark class string per
surface (card, text, border, input, hover, active). No logic changes — only
class selection. Keep the existing light strings **exactly** as the `light`
branch so admin is byte-for-byte unchanged.

Reuse what Phase 1 already built: the `.vendor-ui` scoped utilities
(`.card`, `.btn-*`, `.input`, `.chip`) and the `brand/gold/ruby/ink` tokens are
the dark target; the light branch keeps today's `slate/primary/white` classes.

---

## 3. Order of work (lowest risk first)

1. **Scaffolding (no visible change).** Add `VendorSkinProvider` + `useSkin` +
   the `cx(skin, light, dark)` helper. Ship + verify build. Zero consumers use it
   yet → zero risk.
2. **`ui/*` kit — Button, Card, Input, Modal.** Add `skin` prop (default
   `light`) + dark branches. Verify **every existing caller is untouched**
   (default light). This unblocks Campaigns + AI Studio without rewriting them —
   they only need their page shell wrapped in the provider/`.vendor-ui` and the
   kit renders dark.
3. **`TeleCrmBoard`.** Add `skin` prop (default `light`). Thread it through the
   ~29 light class sites via the `cx` helper. `/dashboard/telecrm` passes
   `skin="dark"`; `/admin/telecrm` passes nothing (stays light). This is the
   biggest single file — do it in one focused pass, diff-review the admin path.
4. **Re-skin the three pages' own shells** (Campaigns, AI Studio, TeleCRM page
   wrappers) to the Bolt dark layout, now that their shared parts render dark —
   binding the real endpoints already catalogued (getCrmLeads/updateCrmLead/
   logCrmCall; createCampaign/campaign-pages; generateAiContent/aiTemplates/
   aiCosts + real wallet debit).
5. **Flip the dashboard shell (`DashboardLayout`) to dark** once all inner pages
   are dark, so the whole vendor dashboard is coherent (until then, keep the
   per-page dark canvas approach used in Phase 2/Accounts).

---

## 4. Risks & mitigations

- **Breaking admin (highest risk).** Mitigation: `light` is the default
  everywhere; admin passes no `skin`. Add a quick visual diff of `/admin/telecrm`
  and one `ui/*`-heavy admin page after step 2/3, on a login.
- **UI-kit ripple.** `ui/*` is used app-wide (marketing + admin + vendor).
  Mitigation: default-light + additive dark branch; no existing class removed.
- **No build-harness visual QA.** All pages are auth-gated. Mitigation: land each
  step behind the default-light guarantee and verify on a **real login** (vendor
  *and* admin) before the next step. Do **not** batch steps 2–4 without a QA gate.
- **Scope creep into logic.** Rule: theme changes touch **classNames only** —
  never data flow, adapters, or handlers.

---

## 5. Out of scope for this plan

- Phase 4 (new Prisma models: Task/Table/KitchenTicket/Appointment; POS +
  inventory + payment persistence; migration) — remains a separate, explicitly
  gated step (real vendor/payment data).
- Phase 5 (Payments/GST ledger models; ClientApp portal).

---

## 6. Suggested checkpoints

- After step 1: build 0 errors, push. (invisible)
- After step 2: build + **login QA** on one marketing page, one admin page, one
  vendor page using the kit.
- After step 3: build + **login QA** on `/admin/telecrm` (light) and
  `/dashboard/telecrm` (dark) side by side.
- After steps 4–5: full vendor-dashboard walkthrough on a login.
