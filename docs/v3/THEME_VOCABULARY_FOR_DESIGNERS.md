# Theme vocabulary for designers

For someone who has never seen the code. Everything here is copied from three files of the theme kit; where the files do not say, this document says **NOT FOUND**.

Sources (all read-only, in `C:\Get4Domain\get4domain-w2\themes`, branch `v3-lane-e1`; `get4domain-pub\themes\` holds only `reference\`):
- `CONTRACT.md` (the contract; short name **C**, with section numbers)
- `lib/vocabulary.mjs` (the vocabulary list; **V**)
- `schema/theme.schema.json` (the manifest schema; **S**)
- Where a fact is not in those three, the extra file is named: `lib/render.mjs` (**R**), `lib/pack.mjs` (**P**), `library/_starter/templates/home.html` (**ST**).

## 1. What you deliver

A folder (or zip) with plain HTML templates and CSS. "A theme cannot run script, make a network request, or touch anything outside its box. The platform ... fills the bindings, draws the platform slots and supplies the SEO layer." (C section 1)

```
my-theme/
  theme.json                 required
  templates/home.html        required; also about, services, gallery, contact, page, item (and menu, packages, properties, courses, doctors, portfolio)
  css/base.css               required: layout, components
  css/tokens.css             required: the design tokens (light, and dark under prefers-color-scheme)
  css/motion.css             required: motion, reduced-motion block (may be tiny; Off intensity must be fully static)
  css/print.css              required: business-card print
  presets/<categoryId>.json   optional: ...
  assets/                    png, jpg, webp, svg (no script), woff2
```
(C section 3.) Limits: "package 5 MB, one file 1 MB, 400 files, a template under 100 KB, layout CSS under 40 KB, motion CSS under 6 KB."

### Fragments or full documents
**Fragments.** "A template is an HTML **fragment** (no `<html>`, `<head>`, `<body>`, `<title>`, `<meta>`, `<script>`, `<style>`, `<link>`)." (C section 5). Do not add your own outer wrapper: the renderer wraps the output in `<div class="g4d-theme g4d-theme-<id>" lang=... data-motion=... data-variant=...>` (C section 7). Write CSS under `.g4d-theme` (C conflict 8).

### Is a README.md at the zip root allowed?
**No.** The package validator accepts only `theme.json`, files under `templates/`, `css/`, `presets/`, and `assets/` with an allowed extension; any other file is refused with the code `unknown-file`: "this file is not part of the package layout (theme.json, templates/, css/, assets/)" (P, `validatePackage`). C section 3 lists no README.

## 2. Scalar placeholders `{{name}}`

"All HTML-escaped; URL bindings must use `http`, `https`, `tel` or `mailto`, or a relative asset path, otherwise they render empty." (C section 7). A missing value renders empty (C conflict 3). The complete list (V `BINDINGS`):

| Group | Placeholders |
|---|---|
| Site | `{{site.name}}` `{{site.tagline}}` `{{site.logo}}` `{{site.favicon}}` `{{site.year}}` `{{site.url}}` `{{site.established}}` `{{site.registrationNo}}` `{{site.logoAlt}}` |
| Hero | `{{hero.title}}` `{{hero.subtitle}}` `{{hero.image}}` `{{hero.cta}}` `{{hero.imageAlt}}` `{{hero.badge}}` |
| About | `{{about.title}}` `{{about.text}}` `{{about.image}}` `{{about.imageAlt}}` |
| Contact | `{{contact.phone}}` `{{contact.phoneHref}}` `{{contact.whatsapp}}` `{{contact.email}}` `{{contact.address}}` `{{contact.mapUrl}}` `{{contact.city}}` `{{contact.area}}` `{{contact.pin}}` `{{contact.whatsappHref}}` |
| Hours | `{{hours}}` |
| Social | `{{social.instagram}}` `{{social.facebook}}` `{{social.youtube}}` `{{social.linkedin}}` `{{social.x}}` `{{social.whatsapp}}` `{{social.maps}}` `{{social.custom}}` `{{social.customLabel}}` `{{social.pinterest}}` `{{social.telegram}}` `{{social.whatsappChannel}}` |
| Page | `{{page.title}}` `{{page.body}}` `{{page.slug}}` `{{page.intro}}` |
| Terms (words for this business type) | `{{terms.team}}` `{{terms.teamOne}}` `{{terms.items}}` `{{terms.itemOne}}` `{{terms.groups}}` |
| Call to action | `{{cta.label}}` `{{cta.href}}` `{{cta.secondaryLabel}}` `{{cta.secondaryHref}}` |
| Plan switches | `{{entitlements.video}}` `{{entitlements.cart}}` `{{entitlements.booking}}` `{{entitlements.customDomain}}` (used in conditions) |
| The single item page | `{{item.id}}` `{{item.name}}` `{{item.description}}` `{{item.price}}` `{{item.image}}` `{{item.duration}}` `{{item.badge}}` `{{item.href}}` `{{item.category}}` `{{item.tags}}` `{{item.includes}}` `{{item.location}}` `{{item.area}}` `{{item.bedrooms}}` `{{item.veg}}` `{{item.slug}}` (V `ITEM_BINDINGS`: "The item page binds the single item as {{item.*}}") |

Any other `{{...}}` is an "unknown binding" and fails the lint rule `bindings-known`.

## 3. Loops

Syntax: `<template data-g4d-each="NAME"> ... {{VAR.field}} ... </template>` (V). **The variable name is fixed per list** (the "as" column) and is the only name that works inside that loop (`{{item.name}}` inside a `steps` loop is an error). Optional: `data-g4d-as="x"` renames the variable (V `DATA_ATTRIBUTES`; R `render.mjs:513` reads it; whether the lint accepts a renamed variable: NOT FOUND).

Every loop also gives these helpers: `n` ("position, from 1"), `featured` ("one of the first three entries that have a picture; for lists without pictures, simply the first three"), `shown` ("among the first eight"), `initial` ("the first letter of the name, upper case") (C section 7, V `LOOP_HELPERS`). The `gallery` loop adds `caption`.

| List (`data-g4d-each`) | Variable | Fields (exactly as listed in V) | Plus helpers |
|---|---|---|---|
| `items` | `item` | `id` `name` `description` `price` `image` `duration` `badge` `href` `category` `tags` `includes` `location` `area` `bedrooms` `veg` `slug` | `n featured shown initial` |
| `groups` | `group` | `name` `slug` `count` `items` | same |
| `team` | `member` | `id` `name` `role` `note` `image` | same |
| `testimonials` | `testimonial` | `quote` `author` `note` | same |
| `faqs` | `faq` | `q` (the question) `a` (the answer) | same |
| `gallery` | `image` | `src` `alt` `title` `caption` | same |
| `steps` | `step` | `title` `desc` `n` | same |
| `trust` | `point` | `text` | same |
| `stats` | `stat` | `value` `label` | same |
| `pages` | `navpage` | `title` `href` | same |
| `areas` | `area` | `name` | same |
| `credentials` | `credential` | `title` `detail` | same |
| `blocks` | `block` | `key` `title` `items` | same |
| `products` | `product` | same fields as `items` | same |
| `offers` | `offer` | `title` `detail` `price` | same |
| `block.items` (nested inside `blocks`) | `entry` | `title` `detail` `price` | same |
| `group.items` (nested inside `groups`) | `item` (the `items` fields) | | |

Notes:
- `blocks` is "the category's extra blocks (price list, packages, timetable ...): one generic loop draws all of them, in the category's order." The home template must draw it with `data-block="{{block.key}}"` so the lint can find each block (C section 11). Block keys per category are in section 11 below.
- The item and product fields have **no separate alt text field**; the `_starter` uses the item name as the alt (`alt="{{item.name}}"`, ST).
- Type of each field (number, text, list): NOT FOUND in these files. `item.price` is printed as given.

## 4. Pictures

| Picture | Binding | Alt text binding | Source |
|---|---|---|---|
| Logo | `{{site.logo}}` (also `{{site.favicon}}`) | `{{site.logoAlt}}` | V |
| Hero image | `{{hero.image}}` | `{{hero.imageAlt}}` | V |
| About image | `{{about.image}}` | `{{about.imageAlt}}` | V |
| Item or product image | `{{item.image}}`, `{{product.image}}` | none (use `{{item.name}}`) | V, ST |
| Team photo | `{{member.image}}` | none | V |
| Gallery photo | `{{image.src}}` | `{{image.alt}}`, plus `{{image.title}}`, `{{image.caption}}` | V |
| Cover image | NOT FOUND (no `cover` binding) | | V |

Rules (C section 7, "Pictures"): a value `sample:<name>` is a test placeholder; any other value "must be `http`, `https` or a relative path, otherwise it renders empty (and an `<img>` with no source is dropped)". A Standard home page may hold at most **12** `<img>` with Free limits and **19** with the largest Pro content (lint `image-budget`); "the hero picture is the only eager one (exactly one, `fetchpriority="high"`); every other picture is `loading="lazy"` with a width and a height; **decoration is inline SVG or CSS, never an `<img>`**"; every `<img>` needs `alt` and `width`/`height` (lint `alt-text`). Wrap optional pictures in `data-g4d-if="hero.image"` so nothing is drawn when empty (ST does this).
Free-plan content limits the platform enforces: `{ pages: 1, services: 8, gallery: 5, faqs: 6 }` (V `FREE_LIMITS`).

## 5. Platform words `{{ui.*}}`

The platform writes these in the visitor's language (English or Tamil). "A theme never hard-codes visitor-facing words." (C section 7.) The 18 available (V): `{{ui.skip}}` (English: "Skip to main content", R `render.mjs:22`), `{{ui.call}}` ("Call"), `{{ui.whatsapp}}` ("WhatsApp"), `{{ui.directions}}` ("Directions"), `{{ui.menu}}` ("Menu"), `{{ui.readMore}}` ("Read more"), `{{ui.viewAll}}` ("View all"), `{{ui.home}}` ("Home"), `{{ui.about}}` ("About"), `{{ui.gallery}}` ("Gallery"), `{{ui.contact}}` ("Contact"), `{{ui.closeImage}}`, `{{ui.faq}}`, `{{ui.process}}`, `{{ui.why}}`, `{{ui.hours}}`, `{{ui.orderOnWhatsApp}}`, `{{ui.shippingNote}}`. (The English text of the last six: NOT FOUND in the lines read.)

## 6. Conditions and section attributes

- `data-g4d-if="path"`: "shows the element only when the value or list is non-empty". `data-g4d-if-not="path"`: "the opposite" (C section 7). Examples in ST: `data-g4d-if="site.logo"`, `data-g4d-if="items"`, `data-g4d-if="entitlements.video"`, `data-g4d-if="image.shown"`.
- Section wrapper: `<section data-g4d-section="id" data-g4d-label="Name" data-g4d-optional="true|false">` "puts each vendor-editable block"; "the hero is never optional" (C section 5). A vendor can hide only `data-g4d-optional="true"` sections and reorder sections (C section 9). Hide a section whose only content is a gated slot with `data-g4d-if="entitlements.<name>"`, else the lint rule `entitlements-render` complains of an empty section.
- Every page: "starts with a skip link (`<a class="skip-link" href="#main">`), then `<header>` with `<g4d-header-nav>`, then `<main id="main">`, then the footer (`<g4d-footer>`); has exactly one `<h1>` (home: `{{hero.title}}`; others: `{{page.title}}` or the item's name), headings in order" (C section 5).
- Other attributes in the vocabulary: `data-g4d-open`, `data-g4d-quickview`, `data-g4d-item` are listed in V `DATA_ATTRIBUTES`; what they do: NOT FOUND.
- Forbidden in a template (lint `no-forbidden-element`): `iframe object embed form input select textarea style link meta base title canvas audio dialog`, plus `<script>`, `on*=` attributes and any outside address. No `lang` attribute. "Menu, lightbox and the T5 before/after slider use `:target`; FAQ uses `<details>`; carousels use scroll-snap." (C conflict 6.)

## 7. Platform slots

You place a slot with a custom element; "the renderer replaces it with the platform's markup (wrapper with a reserved size, labelled, accessible). The theme styles the wrapper only." The wrapper has the classes `g4d-slot g4d-slot--<slot name>` (R lines 337, 406), so **CSS must target `.g4d-slot--<name>` and reserve a size** (lint `slots-reserve-space`), not the tag name.

| Slot | Tag | Required in a theme |
|---|---|---|
| `action` | `<g4d-action>` | every theme |
| `header-nav` | `<g4d-header-nav>` | every theme |
| `bottom-nav` | `<g4d-bottom-nav>` | every theme |
| `footer` | `<g4d-footer>` | every theme |
| `hours` | `<g4d-hours>` | optional |
| `tabs` | `<g4d-tabs>` | optional |
| `map` | `<g4d-map>` | every theme |
| `social-links` | `<g4d-social>` | every theme |
| `cart` | `<g4d-cart>` | optional; drawn only with the `cart` entitlement |
| `enquiry-form` | `<g4d-enquiry-form>` | every theme |
| `whatsapp-float` | `<g4d-whatsapp-float>` | every theme |
| `reviews` | `<g4d-reviews>` | every theme |
| `video` | `<g4d-video>` | optional; `video` entitlement |
| `booking` | `<g4d-booking>` | optional; `booking` entitlement |
| `product-grid` | `<g4d-product-grid>` | Ecommerce categories |
| `search` | `<g4d-search>` | optional |
| `claim-banner` | `<g4d-claim-banner>` | optional; only when the page is unclaimed |
| `listed-on-badge` | `<g4d-listed-on-badge>` | every theme |
| `open-now` | `<g4d-open-now>` | every theme |
| `share-qr` | `<g4d-share-qr>` | every theme |

(C section 6.) Any other `<g4d-...>` tag is refused (`unknown-slot`). Call-to-action slots (`action`, `bottom-nav`, `enquiry-form`, `whatsapp-float`, `booking`, `cart`, `search`, `share-qr`) "are drawn only when the callsToAction entitlement is true: a Free site is an informational listing with none of them" (V `CTA_SLOTS`). When an entitlement is off the slot draws nothing.

**Attributes a slot accepts** (the contract does not list them; found in R, the renderer): `class` (action, whatsapp-float, footer, cart, tabs), `label` (header-nav: the nav's accessible label; action: the button text; cart: the cart link text), `limit` (video: number of videos; product-grid: number of products, at most 24), `images` (product-grid: number of pictures), `variant` (footer, hours: used in ST as `<g4d-footer variant="columns">`, `<g4d-hours variant="table">`; the accepted values: NOT FOUND). Anything else: NOT FOUND.
Text inside `<g4d-action>` (e.g. `{{cta.label}}`): R uses `attrs.label || cta.label || category default`; whether inner text is used: NOT FOUND.

## 8. Manifest `theme.json`

Required fields (S): `id version name tier tracks families categories layoutVariantRules motion settingsSchema fonts`. Others: `assets` and `contentHash` (filled by `pack`), `internal`, `author`, `description`, `marketplace`.

| Field | Real shape |
|---|---|
| `id` | 3-40 chars, `^[a-z0-9]+(-[a-z0-9]+)*$` |
| `version` | whole number >= 1 |
| `tier` | `"Standard"` or `"Premium"` (a price class only) |
| `tracks` | array of `handyman`, `professional`, `ecommerce` |
| `families` | array of family ids (section 10) |
| `categories` | array of the 41 ids (section 11), at least one |
| `layoutVariantRules` | `{ "<familyId>": "<variantId>" }`, values 3-40 chars. Real example (library `free-service-pro`): `{ "home-services": "bold-split", "auto-services": "dark-bento" }`. "a theme may only restate the table, never override it" (C section 4) |
| `motion` | `{ "default": "Off"|"Low"|"Medium"|"Rich", "variantDefaults": { "<variantId>": "Off"|"Low"|"Medium"|"Rich" } }`. `default` required; no other keys. Real example: `{ "default": "Low", "variantDefaults": {} }` |
| `settingsSchema` | object of booleans, only these keys: `accent`, `fonts`, `logo`, `sectionOrder`, `sectionVisibility`, `motionIntensity`. Real example: all six `true`. |
| `fonts` | array of approved names, unique, at most 12 |
| `marketplace` | optional block (S: `packs addons capabilities tags catalogueCategories previews licence starter sourceVendorId`) |

Variant ids by family (C section 8): home-services `bold-split`; auto-services `dark-bento`; healthcare `calm-centered`; legal-finance `structured-split`; education `card-stack`; wellness-beauty `fullbleed-bento`; creative-consulting `portfolio-first`; hospitality-property `fullbleed-booking`; fashion-lifestyle, food-grocery, electronics-home, gifts-books `product-first`.

## 9. Design tokens, fonts, motion

Tokens every theme defines in `css/tokens.css` (V `TOKENS`): `--g4d-primary --g4d-primary-contrast --g4d-accent --g4d-bg --g4d-surface --g4d-text --g4d-muted --g4d-border --g4d-radius --g4d-font-heading --g4d-font-body`; motion tokens: `--g4d-motion-speed --g4d-motion-ease --g4d-motion-distance`. Dark mode: add an `@media (prefers-color-scheme: dark)` block. Text must reach contrast 4.5:1 (lint `contrast-tokens`).

**Approved fonts** (V `APPROVED_FONTS`, S): Inter, Poppins, DM Sans, Manrope, Nunito, Work Sans, Montserrat, Playfair Display, Lora, Merriweather, Noto Sans Tamil, Noto Serif Tamil. "The platform self-hosts every approved font ... a theme only names a font." The body stack must name a Tamil font (lint `tamil-fonts`). Allowed system fonts after them: system-ui, ui-sans-serif, ui-serif, sans-serif, serif, monospace, Segoe UI, Roboto, Helvetica Neue, Arial, Georgia, Noto Sans, Noto Serif, Latha, Nirmala UI, Tamil Sangam MN, Tamil MN, Lohit Tamil, inherit.

Motion: animate only `transform`, `opacity`, `clip-path`, `filter`; `motion.css` under 6 KB with a `prefers-reduced-motion: reduce` block; at most 12 animated elements per section; intensities Off, Low, Medium, Rich (C section 11, V). Hooks on the wrapper: `data-variant`, `data-hero`, `data-header`, `data-services`, `data-card`, `data-divider`, `data-decor`, `data-motion` (C section 8). Vendors can change only: accent colour(s), heading/body font from the theme's `fonts`, logo, section order, hidden sections, motion intensity (C section 9).

## 10. Families (V3, 12) and tracks

home-services, auto-services (Handyman); healthcare, legal-finance, education, wellness-beauty, creative-consulting, hospitality-property (Professional); fashion-lifestyle, food-grocery, electronics-home, gifts-books (Ecommerce). (C section 8 table.) Note: these are the 12 kit families, not the owner's 45-family taxonomy.

## 11. The 41 kit category ids, with each category's extra blocks

(C section 10.) First block listed is shown first.

| # | id | family | extra blocks |
|---:|---|---|---|
| 1 | plumber | home-services | areas, emergency24x7, priceList, beforeAfter, licence |
| 2 | electrician | home-services | areas, emergency24x7, priceList, safetyCertificates |
| 3 | carpenter | home-services | portfolio, materials, process |
| 4 | painter | home-services | portfolio, packages, beforeAfter |
| 5 | ac-appliance-repair | home-services | brandsServiced, amcPlans, sameDay |
| 6 | pest-control | home-services | packages, safetyNote, areaPricing |
| 7 | home-cleaning | home-services | packages, areaPricing, checklist |
| 8 | locksmith | home-services | areas, emergency24x7 |
| 9 | packers-movers | home-services | routes, process, pricing |
| 10 | mason-contractor | home-services | portfolio, process, areas |
| 11 | cctv-security-installer | home-services | packages, brands |
| 12 | auto-mechanic | auto-services | servicesMenu, brandsServiced, pickupDrop |
| 13 | car-wash-detailing | auto-services | packages, beforeAfter |
| 14 | doctor-clinic | healthcare | departments, timings, insuranceAccepted, disclaimer |
| 15 | dentist | healthcare | treatments, beforeAfter, disclaimer |
| 16 | physiotherapy | healthcare | conditions, packages, disclaimer |
| 17 | diagnostics-lab | healthcare | testList, homeCollection, reportsLink |
| 18 | lawyer | legal-finance | practiceAreas, barCouncilNo, consultationModes, disclaimer |
| 19 | ca-tax-consultant | legal-finance | services, complianceCalendar, disclaimer |
| 20 | insurance-advisor | legal-finance | products, disclaimer |
| 21 | coaching-centre | education | courses, batches, fees, results, faculty |
| 22 | tutor | education | subjects, fees, results |
| 23 | music-dance-school | education | courses, batches, events |
| 24 | salon-spa | wellness-beauty | servicesMenu, stylists, packages |
| 25 | gym-yoga | wellness-beauty | memberships, classTimetable, trainers |
| 26 | photographer | creative-consulting | portfolio, packages, process |
| 27 | interior-designer-architect | creative-consulting | portfolio, process, packages |
| 28 | event-planner | creative-consulting | portfolio, packages, eventTypes |
| 29 | it-consultant | creative-consulting | caseStudies, services, process |
| 30 | restaurant-cafe | hospitality-property | menu, reservations, deliveryLinks |
| 31 | hotel-homestay | hospitality-property | rooms, amenities, nearby |
| 32 | travel-agency | hospitality-property | packages, destinations |
| 33 | real-estate-agent | hospitality-property | listings, areas, process |
| 34 | fashion-apparel | fashion-lifestyle | sizeGuide, collections, offers |
| 35 | jewellery | fashion-lifestyle | collections, purityNote, offers |
| 36 | grocery-kirana | food-grocery | deliveryPinCheck, categories, offers |
| 37 | bakery-sweets | food-grocery | menu, customOrders, deliveryPinCheck |
| 38 | electronics-mobile | electronics-home | warranty, brands, offers |
| 39 | home-furniture | electronics-home | collections, deliveryInfo, assemblyInfo |
| 40 | gifts-handicrafts | gifts-books | customOrders, collections, occasions |
| 41 | books-stationery | gifts-books | categories, bulkOrders |

## 12. Previews

- Marketplace listing pictures (S `marketplace.previews`): up to **6** entries `{ "path", "alt", "page" }`; `path` must match `^assets/previews/[a-z0-9-]+\.(png|jpg|jpeg|webp)$` (so no SVG preview, and the file must exist in the zip); `alt` 3-160 characters (required); `page` optional, a kebab-case page name up to 30 characters.
- Local review: `node themes/cli.mjs preview` (server at `http://127.0.0.1:4173`: Coverage, Motion lab, Variant picker, Performance, Contrast pages) and `node themes/cli.mjs shots` (PNG at 360, 768 and 1280 px) (`themes/README.md`). Other preview rules inside `CONTRACT.md`/`schema`: NOT FOUND.

## 13. One minimal valid template (home)

Uses: skip link and `<header>`, logo with alt, hero with image, conditions, an `items` loop with image, `steps`, `faqs`, `gallery`, `areas`, `blocks` with nested `block.items`, section attributes, platform words, and the required slots. It is built only from names listed above and from the kit's `_starter` home template (`library/_starter/templates/home.html`); it has **not** been run through the lint.

```html
<a class="skip-link" href="#main">{{ui.skip}}</a>
<g4d-claim-banner></g4d-claim-banner>
<header class="site-header">
  <a class="brand" href="/">
    <img data-g4d-if="site.logo" src="{{site.logo}}" alt="{{site.logoAlt}}" width="160" height="48" loading="lazy" decoding="async">
    <span>{{site.name}}</span>
  </a>
  <g4d-header-nav label="Main"></g4d-header-nav>
  <g4d-action class="btn"></g4d-action>
</header>
<main id="main">
  <section class="hero" data-g4d-section="hero" data-g4d-label="Hero banner" data-g4d-optional="false">
    <p data-g4d-if="site.tagline">{{site.tagline}}</p>
    <h1>{{hero.title}}</h1>
    <p data-g4d-if="hero.subtitle">{{hero.subtitle}}</p>
    <a data-g4d-if="contact.phone" href="{{contact.phoneHref}}">{{ui.call}} {{contact.phone}}</a>
    <g4d-open-now></g4d-open-now>
    <img data-g4d-if="hero.image" src="{{hero.image}}" alt="{{hero.imageAlt}}" width="1200" height="600" fetchpriority="high">
  </section>

  <section data-g4d-section="services" data-g4d-label="Services" data-g4d-optional="true" data-g4d-if="items">
    <h2>{{terms.items}}</h2>
    <ul><template data-g4d-each="items"><li>
      <img data-g4d-if="item.featured" src="{{item.image}}" alt="{{item.name}}" width="400" height="300" loading="lazy">
      <h3>{{item.name}}</h3>
      <p data-g4d-if="item.price">{{item.price}}</p>
      <p>{{item.description}}</p>
    </li></template></ul>
  </section>

  <section data-g4d-section="highlights" data-g4d-label="Highlights" data-g4d-optional="true" data-g4d-if="blocks">
    <template data-g4d-each="blocks"><section data-block="{{block.key}}">
      <h2>{{block.title}}</h2>
      <ul><template data-g4d-each="block.items"><li>{{entry.title}} {{entry.detail}} {{entry.price}}</li></template></ul>
    </section></template>
  </section>

  <section data-g4d-section="process" data-g4d-label="How we work" data-g4d-optional="true" data-g4d-if="steps">
    <h2>{{ui.process}}</h2>
    <ol><template data-g4d-each="steps"><li><span>{{step.n}}</span> <strong>{{step.title}}</strong> {{step.desc}}</li></template></ol>
  </section>

  <section id="gallery" data-g4d-section="gallery" data-g4d-label="Gallery" data-g4d-optional="true" data-g4d-if="gallery">
    <h2>{{ui.gallery}}</h2>
    <ul><template data-g4d-each="gallery"><li data-g4d-if="image.shown">
      <figure><img src="{{image.src}}" alt="{{image.alt}}" width="400" height="300" loading="lazy"><figcaption>{{image.caption}}</figcaption></figure>
    </li></template></ul>
  </section>

  <section data-g4d-section="reviews" data-g4d-label="Reviews" data-g4d-optional="true"><g4d-reviews></g4d-reviews></section>

  <section data-g4d-section="areas" data-g4d-label="Areas" data-g4d-optional="true" data-g4d-if="areas">
    <ul><template data-g4d-each="areas"><li>{{area.name}}</li></template></ul>
  </section>

  <section data-g4d-section="faq" data-g4d-label="Questions" data-g4d-optional="true" data-g4d-if="faqs">
    <h2>{{ui.faq}}</h2>
    <template data-g4d-each="faqs"><details><summary>{{faq.q}}</summary><p>{{faq.a}}</p></details></template>
  </section>

  <section id="contact" data-g4d-section="contact" data-g4d-label="Contact" data-g4d-optional="true">
    <h2>{{ui.contact}}</h2>
    <address data-g4d-if="contact.address">{{contact.address}}</address>
    <g4d-hours variant="table"></g4d-hours>
    <g4d-social></g4d-social>
    <g4d-map></g4d-map>
    <g4d-enquiry-form></g4d-enquiry-form>
  </section>
</main>
<g4d-footer variant="columns"></g4d-footer>
<g4d-listed-on-badge></g4d-listed-on-badge>
<g4d-share-qr></g4d-share-qr>
<g4d-bottom-nav></g4d-bottom-nav>
<g4d-whatsapp-float></g4d-whatsapp-float>
```

Still needed for a pass, not in the template: CSS rules `.g4d-theme .g4d-slot--<name>` that reserve a size for every slot placed; the 44 px touch-target rule; `overflow-wrap:anywhere` on `.g4d-theme`; a dark block in `tokens.css`; a Tamil font in the body font stack.
