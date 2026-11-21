# T01 Clean: theme kit lint report (re-run 3)

Candidate: `C:\Get4Domain\theme-inbox\t01-home-services-clean` (not changed). It now holds `theme.json`, `css/` (4 files) and `templates/` (7 files); no zip. All files are dated 2026-11-21 09:08, i.e. a new version of the files replaced the one linted earlier today.

## How it was run

The kit is in `C:\Get4Domain\get4domain-w2\themes` (branch `v3-lane-e1`); `get4domain-pub\themes\` holds only `reference\`. Per `themes/README.md` and `commands/lint.mjs` the lint takes a folder path:

```
cd C:\Get4Domain\get4domain-w2\themes
node cli.mjs lint "C:/Get4Domain/theme-inbox/t01-home-services-clean" --all-categories --json <scratch folder>/lint6.json
```

`--json` pointed outside the repo so nothing was written into it. Not run: `pack`, `--browser` (the 41st rule `responsive-browser` needs Playwright and was not asked for).

## Result

**FAIL. 40 rules checked: 33 passed, 7 failed (38 errors).** Exit code 1.
The theme lists 11 categories (home-services). Run on its own 11 categories only (no `--all-categories`) it is **34 passed, 6 failed**: the only difference is `slots-required`, whose `product-grid` finding is demanded only for the 8 Ecommerce categories that `--all-categories` adds.

### Passed (33)
no-script-tag, no-inline-handler, no-forbidden-element, no-seo-output, no-external-request, iframe-hosts, css-scoped, approved-fonts, tamil-fonts, tokens-defined, contrast-tokens, contrast-accent, one-h1, landmarks, skip-link, language-attr, alt-text, form-labels, touch-targets, responsive-static, text-stretch, css-budget-layout, css-budget-motion, reduced-motion, hero-visible, motion-properties, slots-reserve-space, print-stylesheet, html-budget, category-renders, category-fit-order, preset-valid, variant-coverage.

Fixed since the previous run (now pass): `tamil-fonts`, `tokens-defined`, `contrast-tokens`, `text-stretch`, `motion-properties`, `slots-reserve-space`, `touch-targets`, `category-renders`; `manifest-valid` is down from 2 errors to 1; `slots-required` is down from 3 to 1.

### Failed (7)

**1. `manifest-valid` (1 error), file `theme.json`, field `contentHash`**
`contentHash` is `""`; the schema wants the sha256 of the package. It is not something to type by hand: `node cli.mjs pack <folder>` computes and writes it (`commands/pack.mjs`, `lib/pack.mjs`). Smallest fix: none in the files; it clears when the package is built. (`motion.default` is now present.)

**2. `bindings-known` (13 findings; 2 in source, the rest are the renderer warning for the same thing), files `templates/home.html:39` and `templates/services.html:12`**
`<span class="card-index">{{n}}</span>` uses `{{n}}` on its own, which is not a binding. The position helper is read through the loop variable. Smallest fix: in both files change `{{n}}` to `{{item.n}}` (the `n` helper exists on every loop: `lib/vocabulary.mjs` `LOOP_HELPERS`).

**3. `entitlements-render` (4), same cause**
Only the same unknown binding `n` in `home` and `services`, rendered with entitlements on and off. Cleared by fix 2.

**4. `css-hygiene` (3), files `css/base.css:72` and `css/motion.css:13,14`**
`!important` is forbidden. Smallest fixes:
- `css/base.css:72` `.g4d-theme .category-entry__price { color:var(--g4d-primary)!important; ... }`: the `!important` is there because `.g4d-theme .category-entry p` (line 71) is more specific. Fix: drop `!important` and select more specifically: `.g4d-theme .category-entry p.category-entry__price { color:var(--g4d-primary); font-weight:800; }`.
- `css/motion.css:13` reduced-motion rule: remove the three `!important` (`animation:none; transition:none; scroll-behavior:auto;`).
- `css/motion.css:14` `.g4d-theme .hero__media img { transform:none!important; }`: delete the line. The hover zoom it cancels is defined inside the `no-preference` block (lines 5-6), so it never applies under `reduce`.

**5. `motion-count` (14 findings; 9 on the theme's own categories), file `css/motion.css:8`, section `category-details` of `templates/home.html:54`**
At most 12 animated elements are allowed per section; each `.category-entry` card is animated by line 8 (`.process-card,.category-entry { animation:g4d-rise ... }`), and the plumber sample has 13 (the long-list sample has 60 to 100). Smallest fix: remove `.g4d-theme .category-entry` from that selector (keep `.process-card`), so the category blocks are not animated.

**6. `image-budget` (2), file `templates/home.html` lines 38 and 67**
The home page draws 17 pictures with Free limits (limit 12) and 40 with the largest Pro content (limit 19). Causes: line 38 shows the picture of every service (`data-g4d-if="item.image"`, up to 8 on Free); line 67 draws every gallery photo (no cap). Smallest fix: line 38 change to `data-g4d-if="item.featured"` (the first three entries with a picture); line 67 add `data-g4d-if="image.shown"` to the `<figure class="gallery-card">` (first eight). Count after the fix, Free: logo 1 + hero 1 + services 3 + about 1 + gallery 5 + QR 1 = 12. Pro: 1 + 1 + 3 + 1 + 8 + 1 = 15 (+ up to 3 video posters = 18, under 19). The lint message adds: no copies for a lightbox, decoration in SVG or CSS.

**7. `slots-required` (1 with `--all-categories`), `templates/`**
"the platform slot `product-grid` is not placed in any template". It is required only for Ecommerce categories. This theme does not list any, so the finding appears only because `--all-categories` adds them, and it disappears when the lint runs on the theme's own categories. No change needed unless the theme is meant for Ecommerce categories too. (`share-qr` and `listed-on-badge` are now placed, `home.html:86-87`.)

## Can `pack` be run now?

Yes by the code: `commands/pack.mjs` builds the zip by its own package validation (layout, size, executables, unknown slots, manifest) and does not require the lint to pass; it is also what fills `contentHash` (failure 1). I did not run it (instruction). Expect the packaged result to still fail lint rules 2 to 6 until those fixes are made.

## Fragments

Yes: all 7 templates start with `<a class="skip-link" href="#main">{{ui.skip}}</a>`; a search of all 7 files finds no `<!doctype>`, `<html>`, `<head>` or `<body>` (the only match for "<head" is the `<header>` element on line 2). This matches `CONTRACT.md` section 5.

## Reproduce

From `C:\Get4Domain\get4domain-w2\themes`: `node cli.mjs lint <folder> --all-categories --json <file>`.
