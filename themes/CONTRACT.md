# Theme kit contract (version 1)

> THEMES-CC-0, task C0.1. Written 2026-11-03 on branch `v3-themes`. This is the single reference for the theme package format, the one renderer, the lint and the 41 V3 categories.
> Sources: the owner's briefs T0, T1B and T5 (`docs/v3/themes-brief/`), `docs/v3/THEME_CONTRACT_AS_BUILT.md` and `docs/v3/CATEGORY_FAMILIES_AS_BUILT.md`. The as-built vocabulary is `backend-api/src/themes/core/theme-contract.json`; the kit's vocabulary (`themes/lib/vocabulary.mjs`) is a **superset** of it and a test fails if any as-built name is missing.
> The tables marked *generated* are written by `node themes/cli.mjs contract-table` from the code; a test fails if they drift.

Rule of thumb used for every conflict below: **take the as-built syntax unless it breaks a V3 rule**, and record the decision.

## 1. What a theme is

A theme is a folder (or zip) of plain HTML templates and CSS. It only **presents** content; the vendor's content lives in a theme-independent model, so the same content renders in any theme. A theme cannot run script, make a network request, or touch anything outside its box. The platform (the single renderer, `themes/lib/render.mjs`) fills the bindings, draws the platform slots and supplies the SEO layer.

## 2. Conflicts between the T0 brief and the as-built contract

| # | Topic | T0 brief says | As built says | Decision |
|---|---|---|---|---|
| 1 | Package layout | `/public/themes/<id>/index.html`, `theme.css`, `manifest.json`, `assets/` | `theme.json`, `home.html` and other pages at the top, one `theme.css`, `assets/` | **Kit layout** (the C0.2 task): `theme.json`, `templates/*.html`, `css/{base,tokens,motion,print}.css`, `assets/`. A later importer maps `templates/home.html` to `home.html` and concatenates the four CSS files into `theme.css` for the existing backend. |
| 2 | Manifest file name | `manifest.json` | `theme.json` | **`theme.json`.** |
| 3 | Binding syntax | attributes that replace the element's text: `data-g4d="a.b"`, `data-g4d-rich`, `data-g4d-img`, `data-g4d-href`, `data-g4d-repeat`, with sample text kept as a preview default | `{{slot.name}}` placeholders, `<template data-g4d-each="list">`, `data-g4d-if`, `data-g4d-if-not` | **As built** (`{{ }}` and `data-g4d-each`). The sample-text-as-default idea is dropped: a missing value renders empty. T0's section wrapper (`data-g4d-section`, `data-g4d-label`, `data-g4d-optional`) has no as-built equivalent and no conflict, so it is **added**. |
| 4 | Content keys | `business.name`, `page.h1`, `contact.*`, `cta.primary.label`, `about.title` ... | `site.name`, `hero.title`, `contact.*`, `cta.label`, `about.title` ... | **As-built names.** Mapping: `business.name`->`site.name`, `business.tagline`->`site.tagline`, `business.established`->`site.established` (new), `business.registrationNo`->`site.registrationNo` (new), `brand.logo`->`site.logo`, `brand.logoAlt`->`site.logoAlt` (new), `brand.cover`->`hero.image`, `brand.coverAlt`->`hero.imageAlt` (new), `page.h1`->`hero.title` on the home page and `page.title` elsewhere, `page.intro`->`page.intro` (new), `contact.city/area/pin`->new bindings of the same name, `cta.primary.label`->`cta.label`, `cta.primary.href`->`cta.href` (new), `cta.secondary.*`->`cta.secondaryLabel/secondaryHref` (new), lists `services`->`items`, `testimonials`->`testimonials`, `faq`->`faqs`, `team`->`team`, `gallery`->`gallery`, `areas`->`areas` (new), `credentials`->`credentials` (new), `hours`->the `hours` slot. |
| 5 | Platform slots | `<div data-g4d-slot="NAME"></div>`, a fixed list of 12 names | engine custom elements such as `<g4d-map>`, `<g4d-social>`, `<g4d-hours>` | **Custom elements** for every slot: the 9 as-built tags are kept and the V3 slots are added in the same style (`<g4d-reviews>`, `<g4d-video>` ...). T0's names are the slot names; `social-links` is the T0 name of the as-built `<g4d-social>`. See section 6. |
| 6 | CSS-only interactivity | mobile menu with a checkbox, carousels, lightbox with `:target` | the sanitiser drops `<input>` and `<form>` with their content | **No `<input>` or `<form>` in a theme.** Menu, lightbox and the T5 before/after slider use `:target`; FAQ uses `<details>`; carousels use scroll-snap. (T5 asks for radio inputs for the slider: not possible as built.) |
| 7 | Language | "Do not set lang" | the renderer wraps output | **A theme never sets `lang`.** The renderer's wrapper element carries `lang` (T1B asks for a language attribute) and a lint rule checks it. |
| 8 | CSS scoping | all CSS under `.g4d-theme` | the sanitiser rewrites every rule to `.g4d-theme-<id>` | Authors scope under **`.g4d-theme`**; the renderer's wrapper carries both `g4d-theme` and `g4d-theme-<id>`, so the importer's rewrite and the kit agree. |
| 9 | Fonts | ten approved fonts, "declared in manifest.fonts", no other font | `googleFonts[]` (Google Fonts CSS addresses only) | `manifest.fonts` lists approved names only, and the approved list is now **twelve**: the ten of T0 plus **Noto Sans Tamil** and **Noto Serif Tamil**. **The platform self-hosts every approved font** (from its own storage, never from a third-party host); a theme only *names* a font, and **no CSS or template may contain an outside address** (so no Google Fonts link in a theme). The importer can derive the as-built `googleFonts` field if the backend still needs it. System fonts are allowed only as fallbacks after the web font; for Tamil the body stack must name an approved Tamil font first, then system Tamil fonts (`Nirmala UI`, `Latha`, ...). |
| 10 | Families | 12 families (home-services, auto-services, healthcare ...) | 8 *flow* families (`shop booking enquiry packages menu portfolio listings courses`) | **Both, with different jobs.** `families` in the manifest = V3 family (what a theme is designed for); each category also records its `flow` = the as-built flow family. |
| 11 | Categories | 41 ids | 24 category packs, with other ids | **The 41 ids are V3.** Each records the nearest as-built `packKey`. The mapping is an inference (the backend does not state it); review it before the importer is built. |
| 12 | Free / Pro | Free, Pro | `FREE_DEFAULT`, `MARKETPLACE` roles | **`tier` is a price class of a theme, not a plan.** `Standard` and `Premium` say what a theme costs to buy; they say nothing about what a vendor's plan can do. Plans decide two separate things: a **Free-plan vendor** is given an assigned Standard layout; a **Pro-plan vendor** may choose any Standard or Premium theme. What a vendor can *use* (video, cart, booking, custom domain) comes from the vendor's **entitlements**, which the platform passes to the renderer at render time (section 7), never from the theme tier. The backend role (`FREE_DEFAULT`, `MARKETPLACE`) is a separate, later mapping. |
| 13 | Size budgets | page under 100 KB, `theme.css` under 60 KB | page 400 KB, stylesheet 400 KB | **Stricter wins**: page under 100 KB; layout CSS (base + tokens + print) under 40 KB (T1B); motion CSS under 6 KB (T5). The as-built limits stay the upper bound for an upload. |
| 14 | Iframes | no `<iframe>` in a theme; map/video are platform slots | `iframe` is dropped | **None in a theme.** The *platform's* map slot may emit a map iframe from an allowed host; the lint checks the rendered output against the allowed-host list. Videos are click-to-load facades, never an iframe. |
| 15 | Reviews | `reviews` slot with Google reviews and customer testimonials | `testimonials` list (sample quotes never public) | **Both stay.** `testimonials` remains the vendor's list; the `reviews` slot draws the two kinds under separate labels. Google reviews are display only, never invented, never filtered. |
| 16 | Version | not stated | whole number | **Whole number**, raised on every new upload of the same id. |
| 17 | Interactive extras | `lang`, `title`, `meta`, JSON-LD never output by a theme | same | **Agreed.** The theme gives structure only; the renderer exposes the SEO inputs as fields (section 7). |

## 3. Package layout

```
my-theme/
  theme.json                 required
  templates/home.html        required; also about, services, gallery, contact, page, item (and menu, packages, properties, courses, doctors, portfolio)
  css/base.css               required: layout, components
  css/tokens.css             required: the design tokens (light, and dark under prefers-color-scheme)
  css/motion.css             required: motion, reduced-motion block (may be tiny; Off intensity must be fully static)
  css/print.css              required: business-card print
  presets/<categoryId>.json   optional: the default look and starter content of one category (Standard themes ship one for every category they list; section 9b)
$1
```

Limits: package 5 MB, one file 1 MB, 400 files, a template under 100 KB, layout CSS under 40 KB, motion CSS under 6 KB. A file path may not contain `..`, a leading `/`, a drive letter or a backslash. No executable file of any kind (by extension or by first bytes).

## 4. `theme.json` fields

| Field | Type | Notes |
|---|---|---|
| `id` | string | 3-40 chars, `^[a-z0-9]+(-[a-z0-9]+)*$` |
| `version` | integer >= 1 | raised on every upload |
| `name` | string | shown to vendors and staff |
| `tier` | `Standard` or `Premium` | a price class of the theme only (conflict 12): no slot, feature or plan rule depends on it |
| `tracks` | array of `handyman`, `professional`, `ecommerce` | which tracks the theme is designed for |
| `families` | array of V3 family ids | at least one; every category the theme lists must belong to one of them |
| `categories` | array of the 41 category ids | each must be in a declared family, a declared track and eligible for the tier |
| `layoutVariantRules` | object | `{ "<familyId>": "<variantId>" }`: the variant is **chosen by the category's family** (section 8); a theme may only restate the table, never override it |
| `motion` | object | `{ "default": "Off/Low/Medium/Rich", "variantDefaults": {...} }`: defaults used when the vendor has not chosen |
| `settingsSchema` | object | which vendor settings the theme honours (section 9); must not add others |
| `fonts` | array | approved names only (12 allowed in the whole list, up to 12 per theme because category presets use different pairs; the platform self-hosts them); list a Tamil font here if the theme's stacks use one |
| `assets` | array | `{ path, bytes, sha256 }` for every file under `assets/` (filled by `pack`) |
| `contentHash` | string | sha256 over the package content (filled by `pack`; required in a packaged zip) |
| `internal` | boolean | true only for the kit's own `_starter` theme; never offered to vendors |
| `author`, `description` | string | optional |

Machine-readable form: `themes/schema/theme.schema.json`.

## 5. Page templates

`home`, `about`, `services`, `gallery`, `contact`, `page`, `item` are the kit's standard set; `menu`, `packages`, `properties`, `courses`, `doctors`, `portfolio` are the as-built extras. A template is an HTML **fragment** (no `<html>`, `<head>`, `<body>`, `<title>`, `<meta>`, `<script>`, `<style>`, `<link>`). Reserved page slugs: `book enquire order legal p api`.

Every page:

- starts with a skip link (`<a class="skip-link" href="#main">`), then `<header>` with `<g4d-header-nav>`, then `<main id="main">`, then the footer (`<g4d-footer>`);
- has exactly one `<h1>` (home: `{{hero.title}}`; others: `{{page.title}}` or the item's name), headings in order;
- gives every image a bound or literal `alt` and `width`/`height`;
- puts each vendor-editable block in `<section data-g4d-section="id" data-g4d-label="Name" data-g4d-optional="true|false">`; the hero is never optional.

## 6. Platform slots

Placed with a custom element; the renderer replaces it with the platform's markup (wrapper with a reserved size, labelled, accessible). The theme styles the wrapper only.

<!-- GENERATED:slots:START -->
| Slot | Tag in a template | Origin | Required in a theme | Drawn when |
|---|---|---|---|---|
| `action` | `<g4d-action>` | as built | every theme | always (when it has something to show) |
| `header-nav` | `<g4d-header-nav>` | as built | every theme | always (when it has something to show) |
| `bottom-nav` | `<g4d-bottom-nav>` | as built | every theme | always (when it has something to show) |
| `footer` | `<g4d-footer>` | as built | every theme | always (when it has something to show) |
| `hours` | `<g4d-hours>` | as built | optional | always (when it has something to show) |
| `tabs` | `<g4d-tabs>` | as built | optional | always (when it has something to show) |
| `map` | `<g4d-map>` | as built | every theme | always (when it has something to show) |
| `social-links` | `<g4d-social>` | as built | every theme | always (when it has something to show) |
| `cart` | `<g4d-cart>` | as built | optional | the vendor has the `cart` entitlement |
| `enquiry-form` | `<g4d-enquiry-form>` | V3 addition | every theme | always (when it has something to show) |
| `whatsapp-float` | `<g4d-whatsapp-float>` | V3 addition | every theme | always (when it has something to show) |
| `reviews` | `<g4d-reviews>` | V3 addition | every theme | always (when it has something to show) |
| `video` | `<g4d-video>` | V3 addition | optional | the vendor has the `video` entitlement |
| `booking` | `<g4d-booking>` | V3 addition | optional | the vendor has the `booking` entitlement |
| `product-grid` | `<g4d-product-grid>` | V3 addition | Ecommerce categories | always (when it has something to show) |
| `search` | `<g4d-search>` | V3 addition | optional | always (when it has something to show) |
| `claim-banner` | `<g4d-claim-banner>` | V3 addition | optional | the page is unclaimed |
| `listed-on-badge` | `<g4d-listed-on-badge>` | V3 addition | every theme | always (when it has something to show) |
| `open-now` | `<g4d-open-now>` | V3 addition | every theme | always (when it has something to show) |
| `share-qr` | `<g4d-share-qr>` | V3 addition | every theme | always (when it has something to show) |
<!-- GENERATED:slots:END -->

Rules: every theme places the "every theme" slots (T0 item 6: reviews, map and social links on every layout); an Ecommerce category needs `product-grid`. **Any theme may place `video`, `cart` and `booking`** (a theme is never required to, and its tier does not decide it). The platform draws them only when the vendor's **entitlements** say so (section 7). When an entitlement is off the slot draws **nothing at all** (no wrapper, no empty box), and a section that exists only to host a gated slot must be hidden with `data-g4d-if="entitlements.<name>"` so no gap is left. With the cart off, an Ecommerce product shows an enquiry link; with it on, an add-to-cart link. $1

## 7. Bindings and the renderer's outputs

**Scalar bindings** `{{name}}` (all HTML-escaped; URL bindings must use `http`, `https`, `tel` or `mailto`, or a relative asset path, otherwise they render empty):
the 38 as-built slots (`site.*`, `hero.*`, `about.*`, `contact.*`, `social.*`, `page.*`, `terms.*`, `cta.label`, `hours`) plus the V3 additions listed in `themes/lib/vocabulary.mjs` (`V3_BINDINGS`).

**Lists**: `<template data-g4d-each="items"> ... {{item.name}} ... </template>` for `items groups team testimonials faqs gallery steps trust stats pages` (as built) and `areas credentials blocks` (new). `blocks` is the category's extra blocks (price list, packages, timetable ...): one generic loop draws all of them, in the category's order. Nested: `group.items`, `block.items`. A missing value is an empty string, never the word `undefined`; every miss is reported in the renderer's `warnings`.

**Conditionals**: `data-g4d-if="path"` shows the element only when the value or list is non-empty; `data-g4d-if-not="path"` is the opposite.

**`renderPage({ theme, page, content, settings, vendor, host, entitlements })`** returns `{ html, lang, seo, slots, warnings }`:

- `html` - static markup inside the wrapper `<div class="g4d-theme g4d-theme-<id>" lang=... data-motion=... data-variant=...>`;
- `seo` - the inputs for the platform SEO layer, **not** output by the theme: `title`, `description`, `canonical`, `structuredData` (a JSON-LD object for the category's schema type), and `hreflang` (`en-IN` and `ta-IN` alternates);
- `slots` - which platform slots were drawn;
- `warnings` - unknown bindings, empty required fields.

**Entitlements** (the vendor's plan, decided by the platform, not by the theme): `{ video, cart, booking, customDomain }`, each defaulting to `false`; only an explicit `true` counts.

| Entitlement | When true | When false |
|---|---|---|
| `video` | `<g4d-video>` draws the vendor's videos as click-to-load facades | nothing is drawn |
| `cart` | `<g4d-cart>` draws the cart link and each product shows "Add to cart" (Ecommerce Pro) | nothing is drawn; each product shows the enquiry link ("Shop Lite") |
| `booking` | `<g4d-booking>` draws the booking request block (offered to Handyman and Professional vendors) | nothing is drawn |
| `customDomain` | `host.customDomain` (an https origin) becomes the canonical address, the hreflang base and the share link | the `host.siteUrl` address is used |

A template can also test them: `data-g4d-if="entitlements.booking"` (bindings `entitlements.video`, `.cart`, `.booking`, `.customDomain`). The lint renders every category with all entitlements on and all off (rule `entitlements-render`).

It is a pure function: no network, no clock (the year comes from `content.site.year`), no randomness; the same input gives byte-identical output.

Details fixed by the renderer (C0.3):

- **Platform wording** (`ui.skip`, `ui.call`, `ui.menu`, ...) comes from the renderer in the visitor's language (English or Tamil), so a theme never hard-codes visitor-facing words.
- **Tamil URL pattern** for `hreflang`/canonical: English page at `<site>/<path>`, Tamil page at `<site>/ta/<path>`, `x-default` = English. The platform may change the pattern; the kit only needs one.
- **Pictures**: a value of the form `sample:<name>` (fixtures only) becomes a deterministic placeholder picture; any other value must be `http`, `https` or a relative path, otherwise it renders empty (and an `<img>` with no source is dropped).
- **Removed on sight** (even if the lint was skipped): `script style iframe object embed link meta base title canvas audio dialog form input select textarea` elements with their content, `on*` attributes, bindings inside a `style` attribute, and unsafe `href`/`src` values. This mirrors the existing sanitiser.
- **Settings**: an invalid accent, an unapproved font, an unknown motion intensity or any `layoutVariant` is ignored and reported in `warnings` (`setting-ignored:<name>`).
- **Mobile menu** is the platform's `:target` menu (`#g4d-menu`), styled by the theme; no script.

## 8. Layout variants (T5)

The variant is set by the category's family and is **read-only** for vendors.

<!-- GENERATED:variants:START -->
| V3 family | Track | Variant id | Hero | Header | Services | Secondary | Card | Divider | Decor | Default motion | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `home-services` | Handyman | `bold-split` | split | bold | icon-grid | price-table | sharp | notch | badge-shapes | Medium | emergency badge and big phone number |
| `auto-services` | Handyman | `dark-bento` | full-bleed | dark | bento | before-after | sharp | speed-line | stripes | Medium | dark hero, before and after slider |
| `healthcare` | Professional | `calm-centered` | centered-statement | light | tabbed-list | - | soft | curve | soft-blobs | Low | trust strip first |
| `legal-finance` | Professional | `structured-split` | split | serif | price-table | - | flat | notch | rules | Low | practice-area list, serif headings; "minimal motion" is read as Low |
| `education` | Professional | `card-stack` | card-stack | playful | timeline | price-table | round | wave | playful-shapes | Medium | batch and fee tables |
| `wellness-beauty` | Professional | `fullbleed-bento` | full-bleed | transparent | bento | price-table | round | wave | petals | Rich | masonry gallery |
| `creative-consulting` | Professional | `portfolio-first` | diagonal-cut | minimal | timeline | - | flat | diagonal | lines | Rich | portfolio first, masonry gallery, case-study timeline |
| `hospitality-property` | Professional | `fullbleed-booking` | full-bleed | transparent | image-cards | - | round | curve | ornaments | Rich | booking slot in the hero |
| `fashion-lifestyle` | Ecommerce | `product-first` | split | shop | bento | - | product | curve | tags | Medium | product-first, offer strip marquee |
| `food-grocery` | Ecommerce | `product-first` | split | shop | bento | - | product | curve | tags | Medium | product-first, offer strip marquee |
| `electronics-home` | Ecommerce | `product-first` | split | shop | bento | - | product | curve | tags | Medium | product-first, offer strip marquee |
| `gifts-books` | Ecommerce | `product-first` | split | shop | bento | - | product | curve | tags | Medium | product-first, offer strip marquee |
<!-- GENERATED:variants:END -->

Where T5 gives no value (for example a divider for home services), the safest value from the same family of choices was used; "minimal motion" for legal and finance is read as `Low`.

## 9. Settings a vendor may change

| Setting | Values | Notes |
|---|---|---|
| `accent`, `accentDark` | `#rrggbb` | must meet 4.5:1 against the theme's background; the lint returns an auto-adjusted suggestion otherwise |
| `fontHeading`, `fontBody` | a name from the theme's `fonts` (approved list) | |
| `logo` | an asset reference | with `site.logoAlt` |
| `sectionOrder` | array of section ids | only sections marked reorderable; unknown ids are ignored |
| `hiddenSections` | array of section ids | only sections with `data-g4d-optional="true"` can be hidden; the hero cannot |
| `motionIntensity` | `Off`, `Low`, `Medium`, `Rich` | `Off` shows a fully static site; reduced-motion visitors always get static |
| `layoutVariant` | **read only** | derived from the category; any value sent is ignored |

Nothing else (primary colour, spacing, templates) can be changed by a vendor.

## 9b. Category presets (`presets/<categoryId>.json`)

One layout looks clearly different per category through a **preset**, without becoming a separate hand-built theme. A preset is the **default settings and starter content** for one category inside one theme; the vendor's own settings and content always override it. Machine-readable form: `themes/schema/preset.schema.json`.

| Field | Meaning |
|---|---|
| `category` | the category id; must equal the file name and be listed in `theme.json` `categories` |
| `palette` | `{ light: { primary, accent, background }, dark: { primary, accent, background } }`, each `#rrggbb`. The text, muted-text, surface, border and button-text colours are not chosen by the preset: the surface and border are derived from the background and the button text is white or near-black, whichever reads better on the primary colour (one rule, `derivePalette`, shared by the renderer and the lint) |
| `fonts` | `{ heading, body }` from the approved list, both listed in `theme.json` `fonts` |
| `blocks` | the order of the category's extra blocks: every extra block exactly once, **the category's lead block first** |
| `hero.pattern` | one of `dots grid waves rays rings chevrons diagonal blobs`: a hero decoration the theme draws with CSS (`[data-pattern=...]`); no photos |
| `services`, `faqs` | invented, generic starter content as `{ en: [...], ta: [...] }`: services `{ name, description }` (1 to 8), FAQs `{ q, a }` (1 to 6), matching the Free plan limits (1 page, 8 services, 5 gallery images, 6 FAQs) |
| `sections` | optional: `order` (default order of the home sections) and `hidden` (sections hidden by default); hidden sections must exist in the home template, must be optional, and the hero can never be hidden |

How the renderer applies a preset (the category of the content selects it):

- **Palette**: written as wrapper variables `--g4d-pal-primary`, `-primary-contrast`, `-accent`, `-bg`, `-surface`, `-border` (light) and the same with a `-d` suffix (dark). A theme's `tokens.css` consumes them with its own fallback, for example `--g4d-accent: var(--g4d-pal-accent, #0a5f7a);` and, in the dark block, `var(--g4d-pal-accent-d, #63c2e0)`. The vendor's accent replaces `--g4d-pal-accent` and the dark accent replaces `--g4d-pal-accent-d`; both are checked for contrast by `contrast-accent`.
- **Fonts**: `--g4d-font-heading` and `--g4d-font-body`, with the Tamil-capable fallback stack after them. A vendor font setting replaces the preset's.
- **Blocks**: `content.blocks` is sorted by the preset's order.
- **Hero**: `data-pattern="<pattern>"` on the wrapper.
- **Sections**: the preset's `hidden` and `order` are used when the vendor has not set `hiddenSections` / `sectionOrder` (an empty vendor list means "hide nothing").
- **Starter content**: when the vendor has no services (or FAQs) the preset's are shown in the visitor's language, without prices; vendor content is never replaced.
- An unusable preset is ignored with a warning (`preset-ignored:fonts` drops only the fonts; `preset-ignored:invalid` drops the preset).

A package may carry presets only for categories its manifest lists (`preset-category`); each is validated on upload (`preset-invalid`). The lint rule `preset-valid` also requires a complete set: a theme that has any preset must have one for every category it lists. The Standard themes ship all 41 (a test fails if any category has none or a preset fails contrast).

## 10. The 41 categories

Tracks: **Handyman** (13), **Professional** (20), **Ecommerce** (8). Price class (tier) eligibility: every category accepts both Standard and Premium themes.

<!-- GENERATED:categories:START -->
| # | Category id | Label | Track | V3 family | Schema type | Primary call to action | Extra blocks (first is shown first) | Flow (as built) | Pack (as built) |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | `plumber` | Plumber | Handyman | `home-services` | Plumber | Call now | `areas`, `emergency24x7`, `priceList`, `beforeAfter`, `licence` | `enquiry` | `home-services` |
| 2 | `electrician` | Electrician | Handyman | `home-services` | Electrician | Call now | `areas`, `emergency24x7`, `priceList`, `safetyCertificates` | `enquiry` | `home-services` |
| 3 | `carpenter` | Carpenter | Handyman | `home-services` | HomeAndConstructionBusiness | Get a quote | `portfolio`, `materials`, `process` | `enquiry` | `home-services` |
| 4 | `painter` | Painter | Handyman | `home-services` | HousePainter | Get a quote | `portfolio`, `packages`, `beforeAfter` | `enquiry` | `home-services` |
| 5 | `ac-appliance-repair` | AC and appliance repair | Handyman | `home-services` | HVACBusiness | Book a visit | `brandsServiced`, `amcPlans`, `sameDay` | `booking` | `home-services` |
| 6 | `pest-control` | Pest control | Handyman | `home-services` | HomeAndConstructionBusiness | Book a visit | `packages`, `safetyNote`, `areaPricing` | `booking` | `home-services` |
| 7 | `home-cleaning` | Home cleaning | Handyman | `home-services` | HomeAndConstructionBusiness | Book a visit | `packages`, `areaPricing`, `checklist` | `booking` | `home-services` |
| 8 | `locksmith` | Locksmith | Handyman | `home-services` | Locksmith | Call now | `areas`, `emergency24x7` | `enquiry` | `home-services` |
| 9 | `packers-movers` | Packers and movers | Handyman | `home-services` | MovingCompany | Get a quote | `routes`, `process`, `pricing` | `enquiry` | `logistics` |
| 10 | `mason-contractor` | Mason and contractor | Handyman | `home-services` | GeneralContractor | Get a quote | `portfolio`, `process`, `areas` | `portfolio` | `construction` |
| 11 | `cctv-security-installer` | CCTV and security installer | Handyman | `home-services` | HomeAndConstructionBusiness | Get a quote | `packages`, `brands` | `enquiry` | `home-services` |
| 12 | `auto-mechanic` | Auto mechanic | Handyman | `auto-services` | AutoRepair | Book a visit | `servicesMenu`, `brandsServiced`, `pickupDrop` | `booking` | `automobile` |
| 13 | `car-wash-detailing` | Car wash and detailing | Handyman | `auto-services` | AutoRepair | Book a slot | `packages`, `beforeAfter` | `booking` | `automobile` |
| 14 | `doctor-clinic` | Doctor and clinic | Professional | `healthcare` | Physician | Book appointment | `departments`, `timings`, `insuranceAccepted`, `disclaimer` | `booking` | `clinic` |
| 15 | `dentist` | Dentist | Professional | `healthcare` | Dentist | Book appointment | `treatments`, `beforeAfter`, `disclaimer` | `booking` | `clinic` |
| 16 | `physiotherapy` | Physiotherapy | Professional | `healthcare` | MedicalClinic | Book appointment | `conditions`, `packages`, `disclaimer` | `booking` | `clinic` |
| 17 | `diagnostics-lab` | Diagnostics lab | Professional | `healthcare` | MedicalBusiness | Book a test | `testList`, `homeCollection`, `reportsLink` | `booking` | `diagnostics` |
| 18 | `lawyer` | Lawyer | Professional | `legal-finance` | LegalService | Book consultation | `practiceAreas`, `barCouncilNo`, `consultationModes`, `disclaimer` | `enquiry` | `advocate` |
| 19 | `ca-tax-consultant` | CA and tax consultant | Professional | `legal-finance` | AccountingService | Book consultation | `services`, `complianceCalendar`, `disclaimer` | `enquiry` | `finance` |
| 20 | `insurance-advisor` | Insurance advisor | Professional | `legal-finance` | InsuranceAgency | Get a quote | `products`, `disclaimer` | `enquiry` | `finance` |
| 21 | `coaching-centre` | Coaching centre | Professional | `education` | EducationalOrganization | Enquire now | `courses`, `batches`, `fees`, `results`, `faculty` | `courses` | `coaching` |
| 22 | `tutor` | Tutor | Professional | `education` | LocalBusiness | Book a demo | `subjects`, `fees`, `results` | `courses` | `coaching` |
| 23 | `music-dance-school` | Music and dance school | Professional | `education` | EducationalOrganization | Book a trial | `courses`, `batches`, `events` | `courses` | `education` |
| 24 | `salon-spa` | Salon and spa | Professional | `wellness-beauty` | BeautySalon | Book a slot | `servicesMenu`, `stylists`, `packages` | `booking` | `salon` |
| 25 | `gym-yoga` | Gym and yoga | Professional | `wellness-beauty` | ExerciseGym | Book a trial | `memberships`, `classTimetable`, `trainers` | `booking` | `gym` |
| 26 | `photographer` | Photographer | Professional | `creative-consulting` | Photographer | Check dates | `portfolio`, `packages`, `process` | `portfolio` | `photography` |
| 27 | `interior-designer-architect` | Interior designer and architect | Professional | `creative-consulting` | ProfessionalService | Get a quote | `portfolio`, `process`, `packages` | `portfolio` | `construction` |
| 28 | `event-planner` | Event planner | Professional | `creative-consulting` | ProfessionalService | Get a quote | `portfolio`, `packages`, `eventTypes` | `portfolio` | `events` |
| 29 | `it-consultant` | IT and business consultant | Professional | `creative-consulting` | ProfessionalService | Book a call | `caseStudies`, `services`, `process` | `enquiry` | `technology` |
| 30 | `restaurant-cafe` | Restaurant and cafe | Professional | `hospitality-property` | Restaurant | Reserve a table | `menu`, `reservations`, `deliveryLinks` | `menu` | `restaurant` |
| 31 | `hotel-homestay` | Hotel and homestay | Professional | `hospitality-property` | Hotel | Check availability | `rooms`, `amenities`, `nearby` | `packages` | `hotel` |
| 32 | `travel-agency` | Travel agency | Professional | `hospitality-property` | TravelAgency | Plan my trip | `packages`, `destinations` | `packages` | `travel` |
| 33 | `real-estate-agent` | Real estate agent | Professional | `hospitality-property` | RealEstateAgent | Enquire now | `listings`, `areas`, `process` | `listings` | `realestate` |
| 34 | `fashion-apparel` | Fashion and apparel | Ecommerce | `fashion-lifestyle` | Store | Shop now | `sizeGuide`, `collections`, `offers` | `shop` | `retail` |
| 35 | `jewellery` | Jewellery | Ecommerce | `fashion-lifestyle` | JewelryStore | Shop now | `collections`, `purityNote`, `offers` | `shop` | `retail` |
| 36 | `grocery-kirana` | Grocery and kirana | Ecommerce | `food-grocery` | GroceryStore | Order now | `deliveryPinCheck`, `categories`, `offers` | `shop` | `retail` |
| 37 | `bakery-sweets` | Bakery and sweets | Ecommerce | `food-grocery` | Bakery | Order now | `menu`, `customOrders`, `deliveryPinCheck` | `shop` | `retail` |
| 38 | `electronics-mobile` | Electronics and mobiles | Ecommerce | `electronics-home` | ElectronicsStore | Shop now | `warranty`, `brands`, `offers` | `shop` | `retail` |
| 39 | `home-furniture` | Home and furniture | Ecommerce | `electronics-home` | FurnitureStore | Shop now | `collections`, `deliveryInfo`, `assemblyInfo` | `shop` | `retail` |
| 40 | `gifts-handicrafts` | Gifts and handicrafts | Ecommerce | `gifts-books` | Store | Shop now | `customOrders`, `collections`, `occasions` | `shop` | `retail` |
| 41 | `books-stationery` | Books and stationery | Ecommerce | `gifts-books` | BookStore | Shop now | `categories`, `bulkOrders` | `shop` | `retail` |
<!-- GENERATED:categories:END -->

*Flow* and *Pack* are the bridge to the as-built backend (8 flow families, 24 packs). They are an **inference** (the backend does not state them) and should be reviewed with the owner before the importer is built.

## 11. Lint rules

Each rule has an id and a red fixture in `themes/test/lint.test.mjs` (a test fails if a rule has none). Run `node themes/cli.mjs lint <theme-folder> [--category id | --all-categories] [--browser] [--accent #rrggbb]`. Exit code 1 on any failure. Output: a readable report on screen and a JSON report in `themes/.reports/lint.json` (or `--json file`). `--browser` adds `responsive-browser` using the Playwright already on the machine.

How the rendered rules work: for every category the theme lists (or all 41 with `--all-categories`) the lint renders **every template** with the English and the Tamil sample content, the same content stretched 1.6x, and the five extreme fixtures (long name, long list, empty, no images, long text), all through the one renderer, then checks the output. Two conventions follow from that: the home template must draw the `blocks` list with `data-block="{{block.key}}"` (so the category's extra blocks can be found, in order), and a list name may be used directly in `data-g4d-if` (for example `data-g4d-if="faqs"`).

| Id | Checks |
|---|---|
| `manifest-valid` | `theme.json` matches the schema; categories sit in declared families, tracks and price class |
| `no-script-tag` | no `<script>` in a template |
| `no-inline-handler` | no `on*=` attribute |
| `no-forbidden-element` | no `iframe object embed form input select textarea style link meta base title canvas audio dialog` in a template |
| `no-seo-output` | no `<title>`, `<meta>`, canonical link or JSON-LD from a theme |
| `no-external-request` | no outside address in `src`, `srcset`, `poster`, CSS `url()` or `@import` (anchors to other sites are links, not requests) |
| `iframe-hosts` | any iframe in the *rendered* output is a map embed from an allowed host |
| `css-hygiene` | no `!important`, no `@import`, no outside `url()` |
| `css-scoped` | every rule is under `.g4d-theme` (or is `@font-face`, `@keyframes`, `@media`, `@supports`, `@property`) |
| `approved-fonts` | `font-family` names only from the 12 approved fonts, system fallbacks and generic families; `manifest.fonts` approved only; the platform self-hosts them |
| `tamil-fonts` | the body font stack names an approved Tamil font (Noto Sans Tamil or Noto Serif Tamil); system Tamil fonts may follow as a fallback |
| `tokens-defined` | all design tokens exist in light mode (and in dark mode if a dark block exists) |
| `contrast-tokens` | AA (4.5:1) for text, muted text, button text and accent on the background and surface tokens, light and dark |
| `contrast-accent` | the vendor accent colour passes AA on the theme background; a failing colour returns a suggested fix |
| `one-h1` | exactly one `<h1>` in every rendered page |
| `landmarks` | `header`, `nav`, `main#main`, `footer` present |
| `skip-link` | the first focusable element is a skip link to `#main` |
| `language-attr` | the wrapper carries `lang`; a template never sets it |
| `alt-text` | every `<img>` has `alt` (empty only with `role="presentation"` or `aria-hidden`) and `width`/`height` |
| `form-labels` | every control in a rendered slot has a label |
| `touch-targets` | the CSS gives interactive elements at least 44 px (`min-height`) |
| `responsive-static` | no fixed width wider than 360 px outside a media query; images have `max-width:100%`; the wrapper breaks long words |
| `responsive-browser` | (with `--browser`, needs Playwright) no horizontal scroll at 360, 414, 768, 1024, 1280 and 1536 px for English, Tamil and the extreme fixtures |
| `text-stretch` | English and Tamil sample text, and a 1.6x stretched copy, render without an unbroken overflow risk (wrap rules present, no `white-space:nowrap` on text blocks) |
| `css-budget-layout` | base + tokens + print under 40 KB; every page under 100 KB |
| `css-budget-motion` | motion CSS under 6 KB |
| `reduced-motion` | motion CSS has a `prefers-reduced-motion: reduce` block that stops animation and shows all content |
| `hero-visible` | the hero section exists, is not optional, has no reveal class, and no rule hides it at load |
| `motion-properties` | animations and transitions use only `transform`, `opacity`, `clip-path`, `filter` (and registered custom properties for counters); never `width`, `height`, `top`, `left` |
| `motion-count` | at most 12 animated elements in any one section of a rendered page |
| `slots-required` | every required slot is placed (Ecommerce categories: `product-grid`); video, cart and booking are optional for every theme |
| `slots-reserve-space` | every placed slot has a CSS rule that reserves its size |
| `bindings-known` | no unknown binding, list, list field or `g4d-*` tag |
| `print-stylesheet` | `print.css` exists and hides navigation and slots |
| `html-budget` | see `css-budget-layout` |
| `category-renders` | the theme renders with sample content for every category it lists, with no warning and with all of the category's extra blocks present |
$1
$1
| `preset-valid` | every `presets/<id>.json`: valid against the schema, fonts listed in `theme.json`, the lead block first, AA contrast in light and dark against the theme's own text colours, a hero pattern the theme's CSS defines, only existing and optional sections hidden; and a preset for every category the theme lists (when it has any) |

## 12. Not in this kit (follow-ups)

Adding the new `g4d-*` tags and bindings to the **backend sanitiser and `theme-contract.json`**, the importer that maps this layout to the existing `ThemePackage` rows, the admin upload, the CI job and the AI Theme Studio are listed in `docs/v3/THEMES_KIT_HANDOVER.md`. Nothing in `backend-api` or `get4domain_mvp` is changed by THEMES-CC-0.
