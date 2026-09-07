# HTML → Section-Kit Converter (catalog themes)

**Date:** 07 Sep 2026 · **Branch:** `get4domain-site` · **No migration / no backend change** — the
converter is browser-side and outputs into the EXISTING `WebsiteTheme.layout` + `cssVars`.

## What it does
Turns an uploaded static HTML theme (Bolt/designer) into a data-driven **section-kit** theme so it
gets the live product loop, cart/checkout and enquiry operations that raw-HTML themes can't have —
reusing everything Phase 1-3 built. A converted theme is indistinguishable in the DB from a
hand-built section-kit theme (same `layout` shape).

- **Converter:** `get4domain_mvp/src/engine/kit/html-to-sectionkit.ts` — parses with DOMParser,
  extracts theme tokens (CSS custom props / colours / fonts, else the admin colour pickers),
  classifies top-level blocks (hero / catalog-grid / about / contact), and emits `KitSection[]`:
  - hero → `hero` (headline/subline bound to `{{businessName}}`/`{{tagline}}` when the HTML has none),
  - the marked/auto-detected product grid → `showcase` (fills live from the vendor's products via the
    existing `resolveTemplate`→`itemsFrom`; `Showcase` renders `AddToCartButton`),
  - long text block → `cta` (About), contact/footer → covered by the footer + enquiry block,
  - always appends an `enquiry` block wired to the industry's operations (from `operations.ts` +
    `industry-experience.ts`), injecting the primary operation if the HTML had no action buttons.
- **Admin UX:** Content Library → Website Themes → upload HTML → choose **Static (raw HTML)** or
  **Catalog (convert)** → *Convert to catalog theme* → review the detected sections, re-pick the
  catalog grid if wrong → *Add theme* (saved as section-kit `layout`). Both paths stay available.

## Operations wiring (reused, no new backend)
- Enquiry/booking/appointment tabs → `KitEnquiry` dispatches `engine.enquiry` on a live site →
  a **real CRM lead** (the correct operation for all kit industries; operations.ts maps
  appointment/booking→engine.enquiry).
- Product grid + cart → `AddToCartButton` → `CartProvider` → **`engine.checkout.order` / `.confirm`**
  → a **real order** (PosSale + stock + CRM lead), auto-enabled when the vendor turns on payments.
- Real-estate's distinct `site_visit` keeps its bespoke engine site (not the converter/KitEnquiry) —
  the converter never sends a mismatched payload to it.

## Verified
- Full frontend `tsc` clean — the emitted layout is type-checked against the real `KitSection` /
  `ThemeTokens` / `EnquiryTab` types, so it renders through the existing `KitRenderer`.
- Detection verified on a realistic restaurant Bolt export (DOMParser): HEADER→hero, "Our Menu"→
  catalog grid, "About us"→about, FOOTER→contact; button signals detected order+booking; `--primary`
  extracted. Converter always returns a valid, rendering layout (never throws; injects defaults).
- `/admin/library` compiles + 200 with the converter UI.

## Not yet verified end-to-end (needs a real theme + a session — flagged, not guessed)
The admin-login → convert → save → vendor-buy → live-render-with-real-products → real-order path
needs: (a) a real catalog-style **Bolt export** (theme-uploads/ is still empty), (b) an admin login,
(c) a payments-enabled vendor for the cart. Provide one catalog Bolt export and I'll run the whole
chain and confirm a real order/lead is created.

## Honest limits
- Fidelity: converted themes adopt the uploaded theme's **palette/typography + section order**,
  rendered through kit components — not a pixel clone (that's the raw-HTML path). Best-effort, and
  tunable once we see real Bolt output.
- **Multi-page:** section-kit renders a single rich page; a multi-page HTML is converted from its
  **home page** (extra pages aren't split into section-kit routes). Multi-page designs that must keep
  separate routed pages should use the raw-HTML (Static) path.
- Product/catalog auto-detect uses a repeated-card heuristic; if it picks the wrong block, the admin
  re-selects the grid from the dropdown before saving.
