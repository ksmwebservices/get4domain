# Theme kit handover (THEMES-CC-0)

> Branch `v3-themes` (worktree `C:\Get4Domain\get4domain-themes`), 2026-11-03, updated by THEMES-CC-0b (owner's review fixes). Everything is in `themes/` and `docs/v3/`. `backend-api`, `get4domain_mvp`, the workflows, the shared working tree, the 72 baseline files and the release branch were not touched. Nothing is pushed.
> Read `themes/CONTRACT.md` for the contract and `themes/README.md` for the commands. The per-task record is `docs/v3/THEMES_KIT_LOG.md`.

## What exists

| Piece | Where | State |
|---|---|---|
| Contract (17 recorded conflicts, package layout, manifest, slots, bindings, settings, 41 categories, 9 variants, 37 lint rules) | `themes/CONTRACT.md` | done; tables are generated from code and drift-checked |
| Package format, JSON schema, `pack`, `validate-package` | `themes/lib/{zip,schema,pack}.mjs`, `themes/schema/` | done; validates bytes in memory only |
| The one renderer `renderPage()` | `themes/lib/render.mjs` | done; pure, deterministic, escapes everything, 20 slots, SEO inputs as fields |
| Lint | `themes/lib/lint.mjs` | 38 rules, each with a red fixture; optional real-browser check; renders every category with entitlements on and off |
| Sample content, 41 categories x English and Tamil, extreme fixtures | `themes/fixtures/` | done; all invented |
| Preview harness and screenshots | `themes/lib/{preview,shots}.mjs` | done; 127.0.0.1 only |
| Internal reference theme | `themes/library/_starter/` | passes all rules for all 41 categories, including at six widths in a real browser |
| Tests | `themes/test/` | 102 tests, all green |
| Category map for the backend importer | `themes/data/category-map.json` | generated from `themes/lib/categories.mjs`, drift-checked, marked as an inference |

## Decisions taken (each also recorded where it applies)

1. **As-built syntax wins unless it breaks a V3 rule.** Bindings are `{{slot}}` and `<template data-g4d-each>`; the T0 `data-g4d="..."` attribute style was not adopted. T0's section markers (`data-g4d-section`, `-label`, `-optional`) were added.
2. **Slots are custom elements** (`<g4d-reviews>` ...), as-built style. `social-links` is the T0 name for the as-built `<g4d-social>`.
3. **No `<input>` or `<form>` in a theme** (the existing sanitiser drops them), so the mobile menu, the lightbox and the before/after slider use `:target`, and FAQ uses `<details>`. T5's radio-input slider is not possible as built.
4. **Fonts**: twelve approved fonts (the ten of T0 plus **Noto Sans Tamil** and **Noto Serif Tamil**). **The platform self-hosts every approved font**; a theme only names a font and may not contain any outside address (no Google Fonts link). The Tamil body stack must name an approved Tamil font first; system Tamil fonts may follow as a fallback.
5. **Tier is a price class, not a plan.** Standard and Premium are what a theme costs. A Free-plan vendor gets an assigned Standard layout; a Pro-plan vendor may choose any Standard or Premium theme. No slot or feature rule depends on the tier. **Any theme may place `video`, `cart` and `booking`**; `renderPage` takes `entitlements` (`video`, `cart`, `booking`, `customDomain`, default false) and draws each gated slot only when its entitlement is true, with no empty box. With the cart off an Ecommerce product shows an enquiry link (Shop Lite); with it on, Add to cart. `customDomain` makes the vendor's own https domain the canonical address.
6. **Two family notions kept**: V3 families (12, in the manifest) and the as-built flow families (8, recorded per category as `flow`), plus the nearest as-built pack (`packKey`).
7. **Required platform slots** for every theme: enquiry form, WhatsApp float, bottom action bar, map, reviews, social links, open-now, share and QR, listed-on badge, action, header nav, footer; Ecommerce categories also product grid. Video, cart and booking are optional for every theme.
8. **Dark mode** is required (T1B), through `prefers-color-scheme` and the same tokens; AA is checked in both.
9. **Motion**: effects only in `prefers-reduced-motion: no-preference`, plus an explicit reduce block; "12 animated elements in view" is enforced per section (a stagger container counts as itself plus its first six children); the hero never carries a reveal class.
10. **Platform wording** (`ui.*`) is supplied by the renderer in English or Tamil so a theme never hard-codes visitor words.
11. Screenshots are taken with reduced motion on (a full-page capture never scrolls).

## Conflicts between the T0 brief and the as-built contract

All 17 are in the table in `themes/CONTRACT.md` section 2 with the decision for each: package layout, manifest name, binding syntax, content keys, slot syntax, CSS-only interactivity, `lang`, CSS scoping, fonts, families, categories, Free/Pro, size budgets, iframes, reviews, version type, SEO ownership.

## Things found while building (worth knowing)

- The real-browser check caught a layout bug in my first starter CSS (the map slot widened a grid column to 414px at 360px). Fixed; the check now passes at all six widths for 41 categories x 6 content variants.
- Looking at the screenshots found that scroll-driven reveals leave below-the-fold content invisible in a full-page capture; screenshots now use reduced motion. This is a reminder that **reveal effects must stay progressive enhancement**; the lint already forbids hiding the hero.
- The category-to-pack mapping (`packKey`, `flow`) is an **inference** (the backend states none); the 41 ids do not exist in the backend (it has 24 packs with other ids).
- The Tamil text in `themes/fixtures/data.mjs` was written by me and is plain and short; it should be read by a Tamil speaker before any customer sees a preview built from it. The same applies to the Tamil wording in `render.mjs` (`UI.ta`).
- Extra-block content in the fixtures is generated per kind (price, place, text, list) from each category's own services; it is deliberately generic.

## Owner's answers (applied in THEMES-CC-0b)

1. **Category map**: accepted **as an inference for now** (not yet confirmed against the backend). Exported as `themes/data/category-map.json`, marked `"status": "inference"`.
2. **Tamil URL pattern**: `/ta/<path>` on the same host is **confirmed**.
3. **Fonts**: **self-hosted by the platform**; Noto Sans Tamil and Noto Serif Tamil added to the approved list.
4. **Booking** is offered on **Handyman and Professional** vendors (not Ecommerce). The renderer only looks at the `booking` entitlement, so the platform must grant it accordingly (the fixtures' `sampleEntitlements` shows the intended pattern). Ecommerce Standard has no cart (Shop Lite) and Ecommerce Pro has it, through the `cart` entitlement.
5. **Legal and finance motion** is **Low** (as built).
6. **Tamil wording** still needs a Tamil speaker.

## Open questions for the owner

1. Who reviews the **Tamil wording** (the fixtures in `themes/fixtures/data.mjs` and the platform strings in `render.mjs` `UI.ta`) before any customer sees a preview built from it?
2. When the backend importer is built, should the category map be re-checked against real packs first (it is still an inference)?

## Follow-ups (not started; each is a separate task)

1. **CI job for the themes lint** (`.github/workflows` was not changed in this task): `node --test "themes/test/*.test.mjs"` and `node themes/cli.mjs lint --all --all-categories` on every theme in `themes/library/`; add `--browser` only where Playwright is installed.
2. **Backend slice 5.4**: teach the sanitiser and `theme-contract.json` (and its byte-identical copy in `get4domain_mvp`) the new tags and bindings; import `renderPage` and `validatePackage`; write the importer that maps `templates/*.html` + `css/*.css` to the existing `ThemePackage` rows and concatenates the CSS; map `VendorCMS` content to the kit's content model; add the `/ta` pages; build the SEO `<head>` from `seo`.
3. **Admin Themes > Requests tab**: upload, `validatePackage`, lint findings in plain language, approve as DRAFT, pricing.
4. **Theme Studio** (staff only): AI draft -> same validate and lint loop -> draft theme.
5. **Library themes T1 to T5** (the owner reviews this kit first): the five Standard layouts, the nine Premium themes, using the kit.
6. A real **Tamil review** and a **keyboard and screen-reader pass** of the `_starter` and the platform slots.
7. **Entitlements in the backend**: compute `{ video, cart, booking, customDomain }` from the vendor's plan (Pro plan: video and custom domain; booking for Handyman and Professional; cart for Ecommerce Pro), pass them to `renderPage`, assign a Standard layout to Free-plan vendors, and let Pro-plan vendors choose any Standard or Premium theme. None of this is in the kit.
8. **Font hosting**: put the twelve approved fonts (woff2) on the platform's own storage and decide the loading strategy (preload the Latin font; load Tamil only for Tamil pages).
