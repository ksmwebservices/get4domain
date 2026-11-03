# Theme kit handover (THEMES-CC-0)

> Branch `v3-themes` (worktree `C:\Get4Domain\get4domain-themes`), 2026-11-03, updated by THEMES-CC-0b (owner's review fixes). Everything is in `themes/` and `docs/v3/`. `backend-api`, `get4domain_mvp`, the workflows, the shared working tree, the 72 baseline files and the release branch were not touched. Nothing is pushed.
> Read `themes/CONTRACT.md` for the contract and `themes/README.md` for the commands. The per-task record is `docs/v3/THEMES_KIT_LOG.md`.

## What exists

| Piece | Where | State |
|---|---|---|
| Contract (17 recorded conflicts, package layout, manifest, slots, bindings, settings, 41 categories, 9 variants, 41 lint rules) | `themes/CONTRACT.md` | done; tables are generated from code and drift-checked |
| Package format, JSON schema, `pack`, `validate-package` | `themes/lib/{zip,schema,pack}.mjs`, `themes/schema/` | done; validates bytes in memory only |
| The one renderer `renderPage()` | `themes/lib/render.mjs` | done; pure, deterministic, escapes everything, 20 slots, SEO inputs as fields |
| Lint | `themes/lib/lint.mjs` | 41 rules (40 plus the real-browser check), each with a red fixture; optional real-browser check; renders every category with entitlements on and off |
| Sample content, 41 categories x English and Tamil, extreme fixtures | `themes/fixtures/` | done; all invented |
| Preview harness and screenshots | `themes/lib/{preview,shots}.mjs` | done; 127.0.0.1 only |
| Internal reference theme | `themes/library/_starter/` | passes all rules for all 41 categories, including at six widths in a real browser |
| Tests | `themes/test/` | 255 tests, all green |
| Five Standard themes with 41 category presets | `themes/library/free-*`, built from `themes/source` | all pass the whole lint, including the real-browser check at six widths |
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

## Standard themes (THEMES-CC-1)

**What was built.** The five Standard themes (`free-service-pro` 13 categories, `free-practice` 11, `free-studio` 5, `free-hospitality` 4, `free-shop-lite` 8) with a preset for each of the 41 categories, built from `themes/source` by `node themes/cli.mjs build-themes` (a shared base copied into each self-contained package; a test fails if the committed files differ from the build or if the shared copies differ between themes). Each ships home, about, services, gallery, contact, page and item, plus the extras it needs (`doctors`, `courses`, `menu`, `packages`, `properties`). Results: lint PASS for every theme and category with `--browser` (39 rules, English, Tamil, extreme fixtures, entitlements on and off, six widths); layout CSS 29.5 to 30.9 KB of 40, motion CSS 5.1 KB of 6, zips 24 to 34 KB; layout-shift risk low for all 41 renders; the hero image is the estimated LCP element; 168 screenshots (`themes/.shots/standard`).

**Contract changes** (all in `themes/CONTRACT.md`, each with a red test first): category presets (section 9b, the `preset-valid` lint rule, package validation `preset-invalid` and `preset-category`); a theme may list up to 12 fonts (was 4); the palette reaches themes as `--g4d-pal-*` variables (the vendor accent and dark accent replace the preset's); `category-fit-order` follows the preset's order with the lead block first; new bindings `hero.badge`, `ui.why`, `ui.hours`, `ui.orderOnWhatsApp`, `ui.shippingNote` and new lists `products` and `offers`; `<g4d-product-grid limit="N">` (capped at 24; with no products the items are the catalogue).

**Decisions taken.**
1. Shared parts are copied by a build step, not imported (the package format stays self-contained); partials and pages in a theme's own source beat the shared ones.
2. Presets are generated from design seeds (hue, saturation, accent shift, font pair, hero pattern, block order, hidden and moved sections) by one palette function and refuse to build if a palette fails contrast; the generated JSON is what the package carries.
3. A preset gives primary, accent and background only; surface, border and button text are derived by one rule shared by the renderer and the lint, so they cannot disagree.
4. Starter content in a preset (services, FAQs) is generic, invented, without prices, and only shown when the vendor has none; it uses the same names as the fixtures.
5. Standard themes use Low motion by default (the manifest says so); hover and reveal effects come from the shared motion kit.
6. The lint of a theme runs for the categories the theme lists, never for all 41 (Coverage shows a dash for the others).
7. `--all` for screenshots means every Standard theme with the categories it lists; Tamil is a sample of three per theme.
8. Looking at screenshots found real layout bugs that the lint cannot see (a phantom grid column that made a phone page 14,560 px tall, a block rendering one letter per line, Tamil headings hyphenated oddly, one giant product per row on a phone); all were fixed in the shared core and are recorded in the log. A page-height sanity check is not part of the lint.

**Pictures (THEMES-CC-1b).** Before: 22 to 25 `<img>` per Standard home page (gallery thumbnails plus a second copy of every photo for the lightbox, a picture on every service, hidden service pictures in Practice and Studio, team photos, video posters that were decorative, and a logo that was not lazy). After: at most 12 with the Free limits and 18 with the largest Pro content (budget 19), enforced by the lint rule `image-budget` for all 41 categories. Decorations are SVG or CSS, only the hero picture is eager, the gallery has one picture per photo, a letter badge replaces team photos on the home page, the first three services carry a picture, shop catalogues carry three, video posters are limited to three on the home page. Contract additions: loop helpers `featured`, `shown`, `initial`; slot attributes `<g4d-video limit>` and `<g4d-product-grid images>`.

## Bolt kit and Premium motion kit (THEMES-CC-2)

| Piece | Where | State |
|---|---|---|
| Portability test: lint, starter lint, contract-table, category-map, pack and preview in a clean environment with an empty node_modules, plus static checks (no spawn, no native or Windows-only code, no Node 20+ APIs, no npm imports) | `themes/test/portability.test.mjs` | done; `engines` is now node >=18; the `lint` script no longer checks Standard themes against all 41 categories |
| Premium motion kit | `themes/shared/motion-kit.css` (4,079 bytes), `themes/MOTION_KIT.md` | done; copied into every package between markers; Standard themes now 4,663 bytes of motion CSS (was 5,229) |
| Variant hooks and rule `variant-coverage` | `CONTRACT.md` section 8, `themes/test/variants.test.mjs` | done; Premium themes only |
| Bolt kit command | `themes/lib/bolt-kit.mjs`, `themes/commands/bolt-kit.mjs` | done; 299 KB zip, 163 files; unzip-and-run test |
| Bolt brief | `themes/BOLT_BRIEF.md` generated by `themes/lib/bolt-brief.mjs` | done; drift-tested |

**Decisions (THEMES-CC-2).**
1. The kit file is under 4 KB by design so that kit plus a theme's own motion fits the 6 KB budget; to fit, the headline shimmer is a brightness pulse (a filter) rather than a moving sheen, the card accent sweep reuses the underline rule, and the pulsing button reuses the float keyframes with a 3-cycle count.
2. The Standard themes now use the kit and keep two extras of their own (`g4d-zoom` card picture zoom, `g4d-mask` reveal) in `themes/source/shared/css/motion.css`; the old shared motion file is gone.
3. Off is made static by tokens and gates: speed 0 s (transitions and the finite animations end at once), lift 0, and the reveal, counter, float and pulse rules are not applied; checked in a real browser at all four intensities with and without reduced motion.
4. `g4d-count` is an empty element with the number in `--g4d-to`; because the lint removes bindings inside `style=""`, a counter can only show a number the designer writes, not the vendor's own figure. It shows the final number when motion is off.
5. `variant-coverage` looks for a `[data-variant=<id>]` selector (quoted, unquoted or `~=`) in `base.css`, `tokens.css` or `motion.css`; Standard themes are exempt (they style by the parts `data-hero`, `data-card` and so on). The starter marked Premium therefore fails the rule by design; the tier test was changed to say so.
6. The Bolt zip contains the Standard themes and the starter only; a Premium theme in progress is never packed into it. `BOLT_BRIEF.md` is also committed so that drift is visible in review.
7. The kit's `engines` was lowered to Node 18; the portability test is static as well as dynamic because the dev machine runs a newer Node than Bolt.
8. During this task a bug in earlier documentation patches was found and repaired: replacement text starting with `$&` or `$1` was written literally and overwrote the line it was meant to keep. The lost lines in `CONTRACT.md` (conditionals, mobile menu, assets, four lint rules, the T5 paragraph), `README.md` (command table) and this handover (font hosting) were restored from git history.

## Open questions for the owner (Premium kit)

1. Is the lighter **shimmer** (a brightness pulse, not a moving sheen) acceptable, or should the headline shimmer get its own 300 bytes inside the theme's 2 KB?
2. Should **counters** be allowed to show the vendor's own numbers (needs a platform feature: a number binding outside `style=""`), or stay fixed designer numbers?
3. Bolt's output will be **checked by `variant-coverage` for all nine variants**. Do all nine Premium themes serve every variant, or should each theme list only the categories it is designed for (the lint then asks only for those)?
4. The Bolt zip includes the five Standard themes as references. Is it acceptable that Bolt (an outside tool) sees their full source, or should it get the starter only?
5. The real-browser lint and the screenshots need Playwright on the machine. Should the Bolt kit say that `--browser` is optional for Bolt, with the platform running it on import?

## Open questions for the owner (Standard themes)
1. The presets' starter FAQs and service names are generic and I wrote the Tamil: a Tamil speaker should read `themes/source/*/presets.mjs` (and the fixtures) before a customer sees them.
2. The colour palettes (41 hues) are my choice from the category's mood; do you want to review them in the Coverage and Variant picker pages and change any?
3. Hospitality shows the booking button on the picture and in the contact block only when the booking entitlement is on; the reservation button from the category's call to action is always shown. Is that the intended split?
4. Should the Free plan really show the WhatsApp button in the header on every theme (it is placed in all five), or only the phone?
5. When the backend importer is built, should each theme's `presets/` be imported as part of the `ThemePackage` row, or kept as separate preset rows keyed by category?
6. Team photos no longer appear on the home page (a letter badge shows instead, to stay inside the picture budget); the About page still shows real photos. Is that acceptable, or should the Free budget allow team photos instead of, say, the about picture?
7. The picture budget assumes a Free site shows at most 8 gallery images on the home page and gives pictures to the first three services only: is that the right trade-off for Free sites?

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
9. **Presets in the backend**: store `presets/<categoryId>.json` with each theme package, apply them as the default for a vendor's category (the renderer already does), and teach the settings screen that the vendor's accent, fonts, section order, hidden sections and motion override them.
10. **Free-plan limits** (1 page, 8 services, 5 gallery images, 6 FAQs) are not enforced by the kit: the platform must, and should assign the Standard theme of the vendor's category.
