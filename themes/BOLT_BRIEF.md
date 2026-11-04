# Get4Domain theme kit: brief for Bolt

*This file is generated from the kit's code. Do not edit it by hand.*

You are designing a **website theme** for Get4Domain. A theme is a set of HTML templates and CSS files that the platform fills with a business's own content (name, services, photos, hours). You do not write any content, any script or any form: you design the look. The kit in this folder checks your work with the same rules the platform uses, so what passes here imports without rework.

## 1. What you deliver

A folder `library/<id>/` in this exact layout (copy `library/_starter` or one of the `library/free-*` themes and change it):

```
library/<id>/
  theme.json            name, id, tier (Premium), the categories and families it serves, motion default, fonts
  templates/            home.html, about.html, services.html, gallery.html, contact.html, page.html, item.html, menu.html, packages.html, properties.html, courses.html, doctors.html, portfolio.html (home is required; the others as needed)
  css/base.css          layout and components (with tokens.css, under 40 KB)
  css/tokens.css        the colour, radius and font tokens (light and dark)
  css/motion.css        the shared motion kit, copied unchanged, then your own motion (whole file under 6 KB)
  css/print.css         print rules that hide navigation
  assets/               optional: SVG decoration only
```

There are **no presets**: do not add a `presets/` folder. Claude Code generates the presets for each category after your theme is imported.

## 2. Run it

- `npm run lint -- <id>`  checks one theme for every category it lists (add `--category <category-id>` to check just one).
- `npm run lint:all`  checks every theme in `library/`. Your theme must say PASS.
- `npm run preview`  starts a review server on 127.0.0.1 (open the address it prints): Coverage, Variant picker, Motion lab, Performance, Contrast and a rendered page for every category, in English and Tamil.
- `npm run pack -- <id>`  builds the zip of your theme.

A lint line looks like `x rule-name (1)` followed by `templates/home.html: the message`. Section 11 explains every rule and how to fix it.

## 3. The page markup

Templates are plain HTML with these additions. The renderer fills them; it never runs script.

- **Values**: `{{name}}` is replaced with escaped text. Only the names below exist; anything else is an error.
- **Lists**: `<template data-g4d-each="items"><li>{{item.name}}</li></template>` repeats its content for each entry. Inside, the entry has the name given below.
- **Conditions**: `data-g4d-if="hero.image"` keeps the element only when that value (or list) is not empty; `data-g4d-if-not="..."` keeps it only when it is empty. Plan features are conditions too: `data-g4d-if="entitlements.video"`.
- **Sections**: wrap each page section as `<section data-g4d-section="services" data-g4d-label="Services">`. Add `data-g4d-optional="true"` when the owner may hide it. The hero is never optional.
- **Platform slots**: custom tags such as `<g4d-enquiry-form></g4d-enquiry-form>`. The platform draws them; you style the box around them.

### Values
- **site**: `{{site.name}}` `{{site.tagline}}` `{{site.logo}}` `{{site.favicon}}` `{{site.year}}` `{{site.url}}` `{{site.established}}` `{{site.registrationNo}}` `{{site.logoAlt}}`
- **hero**: `{{hero.title}}` `{{hero.subtitle}}` `{{hero.image}}` `{{hero.cta}}` `{{hero.imageAlt}}` `{{hero.badge}}`
- **about**: `{{about.title}}` `{{about.text}}` `{{about.image}}` `{{about.imageAlt}}`
- **contact**: `{{contact.phone}}` `{{contact.phoneHref}}` `{{contact.whatsapp}}` `{{contact.email}}` `{{contact.address}}` `{{contact.mapUrl}}` `{{contact.city}}` `{{contact.area}}` `{{contact.pin}}` `{{contact.whatsappHref}}`
- **other**: `{{hours}}`
- **social**: `{{social.instagram}}` `{{social.facebook}}` `{{social.youtube}}` `{{social.linkedin}}` `{{social.x}}` `{{social.whatsapp}}` `{{social.maps}}` `{{social.custom}}` `{{social.customLabel}}` `{{social.pinterest}}` `{{social.telegram}}` `{{social.whatsappChannel}}`
- **page**: `{{page.title}}` `{{page.body}}` `{{page.slug}}` `{{page.intro}}`
- **terms**: `{{terms.team}}` `{{terms.teamOne}}` `{{terms.items}}` `{{terms.itemOne}}` `{{terms.groups}}`
- **cta**: `{{cta.label}}` `{{cta.href}}` `{{cta.secondaryLabel}}` `{{cta.secondaryHref}}`
- **entitlements**: `{{entitlements.video}}` `{{entitlements.cart}}` `{{entitlements.booking}}` `{{entitlements.customDomain}}`
- **ui**: `{{ui.skip}}` `{{ui.call}}` `{{ui.whatsapp}}` `{{ui.directions}}` `{{ui.menu}}` `{{ui.readMore}}` `{{ui.viewAll}}` `{{ui.home}}` `{{ui.about}}` `{{ui.gallery}}` `{{ui.contact}}` `{{ui.closeImage}}` `{{ui.faq}}` `{{ui.process}}` `{{ui.why}}` `{{ui.hours}}` `{{ui.orderOnWhatsApp}}` `{{ui.shippingNote}}`

Plan features (true or false): `{{entitlements.video}}` `{{entitlements.cart}}` `{{entitlements.booking}}` `{{entitlements.customDomain}}` `{{entitlements.callsToAction}}`. Use them as conditions, for example `<section data-g4d-section="booking" data-g4d-if="entitlements.booking"><g4d-booking></g4d-booking></section>`.

### Lists and their fields
- `<template data-g4d-each="items">` ... each entry is `item`: `{{item.id}}` `{{item.name}}` `{{item.description}}` `{{item.price}}` `{{item.image}}` `{{item.duration}}` `{{item.badge}}` `{{item.href}}` `{{item.category}}` `{{item.tags}}` `{{item.includes}}` `{{item.location}}` `{{item.area}}` `{{item.bedrooms}}` `{{item.veg}}` `{{item.slug}}` `{{item.n}}` `{{item.featured}}` `{{item.shown}}` `{{item.initial}}`
- `<template data-g4d-each="groups">` ... each entry is `group`: `{{group.name}}` `{{group.slug}}` `{{group.count}}` `{{group.items}}` `{{group.n}}` `{{group.featured}}` `{{group.shown}}` `{{group.initial}}`
- `<template data-g4d-each="team">` ... each entry is `member`: `{{member.id}}` `{{member.name}}` `{{member.role}}` `{{member.note}}` `{{member.image}}` `{{member.n}}` `{{member.featured}}` `{{member.shown}}` `{{member.initial}}`
- `<template data-g4d-each="testimonials">` ... each entry is `testimonial`: `{{testimonial.quote}}` `{{testimonial.author}}` `{{testimonial.note}}` `{{testimonial.n}}` `{{testimonial.featured}}` `{{testimonial.shown}}` `{{testimonial.initial}}`
- `<template data-g4d-each="faqs">` ... each entry is `faq`: `{{faq.q}}` `{{faq.a}}` `{{faq.n}}` `{{faq.featured}}` `{{faq.shown}}` `{{faq.initial}}`
- `<template data-g4d-each="gallery">` ... each entry is `image`: `{{image.src}}` `{{image.alt}}` `{{image.title}}` `{{image.caption}}` `{{image.n}}` `{{image.featured}}` `{{image.shown}}` `{{image.initial}}`
- `<template data-g4d-each="steps">` ... each entry is `step`: `{{step.title}}` `{{step.desc}}` `{{step.n}}` `{{step.featured}}` `{{step.shown}}` `{{step.initial}}`
- `<template data-g4d-each="trust">` ... each entry is `point`: `{{point.text}}` `{{point.n}}` `{{point.featured}}` `{{point.shown}}` `{{point.initial}}`
- `<template data-g4d-each="stats">` ... each entry is `stat`: `{{stat.value}}` `{{stat.label}}` `{{stat.n}}` `{{stat.featured}}` `{{stat.shown}}` `{{stat.initial}}`
- `<template data-g4d-each="pages">` ... each entry is `navpage`: `{{navpage.title}}` `{{navpage.href}}` `{{navpage.n}}` `{{navpage.featured}}` `{{navpage.shown}}` `{{navpage.initial}}`
- `<template data-g4d-each="areas">` ... each entry is `area`: `{{area.name}}` `{{area.n}}` `{{area.featured}}` `{{area.shown}}` `{{area.initial}}`
- `<template data-g4d-each="credentials">` ... each entry is `credential`: `{{credential.title}}` `{{credential.detail}}` `{{credential.n}}` `{{credential.featured}}` `{{credential.shown}}` `{{credential.initial}}`
- `<template data-g4d-each="blocks">` ... each entry is `block`: `{{block.key}}` `{{block.title}}` `{{block.items}}` `{{block.n}}` `{{block.featured}}` `{{block.shown}}` `{{block.initial}}`
- `<template data-g4d-each="products">` ... each entry is `product`: `{{product.id}}` `{{product.name}}` `{{product.description}}` `{{product.price}}` `{{product.image}}` `{{product.duration}}` `{{product.badge}}` `{{product.href}}` `{{product.category}}` `{{product.tags}}` `{{product.includes}}` `{{product.location}}` `{{product.area}}` `{{product.bedrooms}}` `{{product.veg}}` `{{product.slug}}` `{{product.n}}` `{{product.featured}}` `{{product.shown}}` `{{product.initial}}`
- `<template data-g4d-each="offers">` ... each entry is `offer`: `{{offer.title}}` `{{offer.detail}}` `{{offer.price}}` `{{offer.n}}` `{{offer.featured}}` `{{offer.shown}}` `{{offer.initial}}`
- `<template data-g4d-each="block.items">` ... each entry is `entry`: `{{entry.title}}` `{{entry.detail}}` `{{entry.price}}` `{{entry.n}}` `{{entry.featured}}` `{{entry.shown}}` `{{entry.initial}}`

Nested lists: `group.items`, `block.items`. Every list entry also has `n` (its position from 1), `featured` (true for the first three entries that have a picture), `shown` (true for the first eight) and `initial` (the first letter of the name, for a letter badge instead of a photo): for example `<img data-g4d-if="item.featured" …>` gives only the first three services a picture.

### Template attributes
`data-g4d-each`, `data-g4d-as`, `data-g4d-if`, `data-g4d-if-not`, `data-g4d-open`, `data-g4d-quickview`, `data-g4d-item`, `data-g4d-section`, `data-g4d-label`, `data-g4d-optional`.

### Platform slots
A theme places a slot with its tag; **required** slots must appear somewhere in the templates (usually in the header, footer or home page). Every slot also accepts a `class`.

| Slot | Tag | Required | Attributes | What it draws |
|---|---|---|---|---|
| `action` | `<g4d-action label="Book now">` | yes | label="Book now"; class | the main call-to-action button (text and link come from the vendor's content). |
| `header-nav` | `<g4d-header-nav label="Main">` | yes | label="Main"; class | the page links, plus the phone menu: a "Menu" link and a panel opened with :target (#g4d-menu). |
| `bottom-nav` | `<g4d-bottom-nav>` | yes | class | the sticky phone bar: Call, WhatsApp, Directions. |
| `footer` | `<g4d-footer variant="columns">` | yes | variant="columns" (or centered, minimal); class | name, address, phone, email and social links. |
| `hours` | `<g4d-hours>` | no | class | the opening-hours table. |
| `tabs` | `<g4d-tabs>` | no | class | tab bar for pages that show grouped content. |
| `map` | `<g4d-map>` | yes | class | the map: one click-to-load embed; reserve its space in CSS. |
| `social-links` | `<g4d-social>` | yes | class | the social icons and links the vendor filled in. |
| `cart` | `<g4d-cart>` | no (any theme may place it) | class | the basket button; drawn only when the vendor's plan allows a cart. Drawn only when the plan has `entitlements.cart`. |
| `enquiry-form` | `<g4d-enquiry-form>` | yes | class | the enquiry form (a theme never draws its own form). |
| `whatsapp-float` | `<g4d-whatsapp-float>` | yes | class | the floating WhatsApp button. |
| `reviews` | `<g4d-reviews>` | yes | class | the reviews block. |
| `video` | `<g4d-video limit="3">` | no (any theme may place it) | limit="3" (1 to 6); class | videos as pictures with a play link; drawn only when the plan allows video. Drawn only when the plan has `entitlements.video`. |
| `booking` | `<g4d-booking>` | no (any theme may place it) | class | the booking panel; drawn only when the plan allows booking. Drawn only when the plan has `entitlements.booking`. |
| `product-grid` | `<g4d-product-grid limit="12" images="3">` | Ecommerce categories | limit="12" images="3" (images = how many cards carry a picture; the rest are text cards); class | the shop catalogue; also required for the Ecommerce categories. |
| `search` | `<g4d-search>` | no | class | the catalogue search box. |
| `claim-banner` | `<g4d-claim-banner>` | no | class | the banner shown on a listing the owner has not claimed yet. |
| `listed-on-badge` | `<g4d-listed-on-badge>` | yes | class | the "Listed on Get4Domain" badge. |
| `open-now` | `<g4d-open-now>` | yes | class | an "Open now / Closed" label. |
| `share-qr` | `<g4d-share-qr>` | yes | class | share links and a QR code. |

Give each slot's box a `min-height` or `aspect-ratio` (class `.g4d-slot--<name>`) so the page does not jump when it loads.

## 4. Plan features (entitlements)

Any theme may place `<g4d-video>`, `<g4d-cart>` and `<g4d-booking>`. The platform draws them **only when the owner's plan allows it**; otherwise they draw nothing. So a section that exists only to host one of them must carry `data-g4d-if="entitlements.video"` (or `.cart`, `.booking`), or it leaves an empty gap. Never build your own cart, booking or video player.

## 5. CSS tokens

Define these in `css/tokens.css` on `.g4d-theme` for light mode and again inside `@media (prefers-color-scheme: dark)`. Use them everywhere; never write a hard-coded colour in `base.css`.

`--g4d-primary`, `--g4d-primary-contrast`, `--g4d-accent`, `--g4d-bg`, `--g4d-surface`, `--g4d-text`, `--g4d-muted`, `--g4d-border`, `--g4d-radius`, `--g4d-font-heading`, `--g4d-font-body`

Motion tokens (set by the kit, change only if you must): `--g4d-motion-speed`, `--g4d-motion-ease`, `--g4d-motion-distance`.

Also defined for presets (use them with a fallback): the palette variables `--g4d-pal-*`. Hero decoration patterns a category may choose: dots, grid, waves, rays, rings, chevrons, diagonal, blobs.

### Fonts
Name only these twelve (the platform hosts them; never load a font yourself): **Inter**, **Poppins**, **DM Sans**, **Manrope**, **Nunito**, **Work Sans**, **Montserrat**, **Playfair Display**, **Lora**, **Merriweather**, **Noto Sans Tamil**, **Noto Serif Tamil**. The body font stack must include a Tamil font (Noto Sans Tamil or Noto Serif Tamil).

## 6. What the renderer puts on the wrapper

Every page is wrapped as `<div class="g4d-theme g4d-theme-<id>" lang="en-IN" data-variant="…" data-hero="…" data-header="…" data-services="…" data-card="…" data-divider="…" data-decor="…" data-motion="…">`.

- `lang` is `en-IN` or `ta-IN`; never write `lang` yourself. Tamil text is longer and wraps differently: test it in the preview.
- `data-variant` and its parts (`data-hero`, `data-header`, `data-services`, `data-card`, `data-divider`, `data-decor`) say which layout the category uses. Style the SAME markup per variant with attribute selectors, for example `.g4d-theme[data-variant="bold-split"] .hero { … }`. An element only some variants need stays in the markup and is hidden by CSS elsewhere (never a second `<img>`).
- `data-motion` is `off`, `low`, `medium` or `rich` (Off, Low, Medium, Rich); the motion kit reads it.

## 7. The nine layout variants

A Premium theme must have CSS for **every variant that one of its categories uses** (`[data-variant="…"]` selectors).

| Family | Variant (`data-variant`) | Hero | Header | Services | Secondary | Card | Divider | Decor | Default motion |
|---|---|---|---|---|---|---|---|---|---|
| `home-services` | `bold-split` | split | bold | icon-grid | price-table | sharp | notch | badge-shapes | Medium |
| `auto-services` | `dark-bento` | full-bleed | dark | bento | before-after | sharp | speed-line | stripes | Medium |
| `healthcare` | `calm-centered` | centered-statement | light | tabbed-list | - | soft | curve | soft-blobs | Low |
| `legal-finance` | `structured-split` | split | serif | price-table | - | flat | notch | rules | Low |
| `education` | `card-stack` | card-stack | playful | timeline | price-table | round | wave | playful-shapes | Medium |
| `wellness-beauty` | `fullbleed-bento` | full-bleed | transparent | bento | price-table | round | wave | petals | Rich |
| `creative-consulting` | `portfolio-first` | diagonal-cut | minimal | timeline | - | flat | diagonal | lines | Rich |
| `hospitality-property` | `fullbleed-booking` | full-bleed | transparent | image-cards | - | round | curve | ornaments | Rich |
| `fashion-lifestyle` | `product-first` | split | shop | bento | - | product | curve | tags | Medium |
| `food-grocery` | `product-first` | split | shop | bento | - | product | curve | tags | Medium |
| `electronics-home` | `product-first` | split | shop | bento | - | product | curve | tags | Medium |
| `gifts-books` | `product-first` | split | shop | bento | - | product | curve | tags | Medium |

41 categories belong to these 12 families; the variant follows from the category and the owner cannot change it.

## 8. The motion kit

`css/motion.css` starts with the shared motion kit between the markers `/* shared:motion-kit:begin */` and `/* shared:motion-kit:end */`. Copy it unchanged from `shared/motion-kit.css` and use the classes below; do not write your own animation CSS for these effects. Everything is switched by `data-motion` (Off is fully static) and stops under the visitor's reduced-motion setting. Only transform, opacity, clip-path and filter are animated.

| Class | Example | What it does |
|---|---|---|
| `g4d-reveal` | `<ul class="g4d-reveal"><li>…</li><li>…</li></ul>` | the box and its first six children fade and rise as they enter the screen, one after another. Never on the hero. |
| `g4d-hero-zoom` | `<div class="g4d-hero-zoom"><img src="{{hero.image}}" …></div>` | the hero picture zooms very slowly (Medium and Rich). |
| `g4d-shimmer` | `<em class="g4d-shimmer">friendly</em>` | a soft brightness pulse on the accent word of the headline (Rich). |
| `g4d-float` | `<span class="g4d-float">24x7</span>` | a badge that floats gently up and down. |
| `g4d-underline` | `<a class="g4d-underline" href="{{cta.href}}">{{cta.label}}</a>` | a line draws under the link on hover and focus. |
| `g4d-sweep` | `<li class="card g4d-sweep">…</li>` | the same line, in the accent colour, sweeps along the bottom edge of a card. |
| `g4d-count` | `<strong class="g4d-count" style="--g4d-to:25"></strong>` | an EMPTY element that counts from 0 to the number in --g4d-to. Only for a fixed number you write yourself: a binding inside style="" is removed, so do not use it for the vendor's numbers. |
| `g4d-marquee` | `<div class="g4d-marquee"><div class="g4d-marquee__track"><ul>…</ul><ul aria-hidden="true">…the same list again…</ul></div></div>` | a strip that scrolls slowly and pauses on hover and focus (Medium and Rich). |
| `g4d-lift` | `<li class="card g4d-lift">…</li>` | a card rises 4 px on hover and focus. |
| `g4d-parallax` | `<div class="g4d-parallax"><img …></div>` | the picture drifts as the page scrolls (Rich). |
| `g4d-ba` | `<div class="g4d-ba" id="ba1"><img …><img class="g4d-ba__after" …></div><a href="#ba1">Show after</a>` | a before and after switch with no script: half of the second picture shows, and following the link #ba1 shows all of it. |
| `g4d-divider` | `<div class="g4d-divider"></div>` | a section divider whose shape follows the wrapper's data-divider (wave, curve, diagonal, notch, speed-line). |
| `g4d-burger` | `<a class="g4d-burger" href="#g4d-menu"><i></i><i></i><i></i></a>` | the phone menu button: three bars (give each <i> display:block, a height of 2px and a 5px gap) that turn into a cross while the menu is open. |
| `g4d-bottom-nav` | `<g4d-bottom-nav></g4d-bottom-nav>` | automatic: the sticky phone bar slides up. |
| `g4d-whatsapp-float` | `<g4d-whatsapp-float></g4d-whatsapp-float>` | automatic: the floating button pulses three times and stops. |

Dividers use the wrapper's `data-divider`: wave, curve, diagonal, notch, speed-line.

## 9. Budgets

- Layout CSS (tokens + base + print): under 40 KB. Motion CSS: under 6 KB (the kit is under 4 KB, so about 2 KB is yours).
- One rendered page: under 100 KB. A whole theme package: under 5 MB.
- Pictures on the home page: at most 12 pictures with the Free limits (8 services, 5 gallery images, 6 FAQs) and fewer than 20 pictures with the largest Pro content.
- Only the hero picture is eager (`fetchpriority="high"`); every other picture is `loading="lazy"`. Every picture has `alt` text and **width and height**. Decoration is inline SVG or CSS, never an `<img>` (no `alt=""`). A gallery has **one picture per photo**; its lightbox is the same figure opened with `:target`.
- Pages must not scroll sideways at 360, 414, 768, 1024, 1280, 1536 px. Links and buttons are at least 44 px high.

## 10. Not allowed

`<script>`, `<form>`, `<input>`, `<select>`, `<textarea>`, `<iframe>`, `<object>`, `<embed>`, `<canvas>`, `<audio>`, `<dialog>`, `<base>`, `<noscript>` and `<style>` elements; any outside address (images, fonts, stylesheets, scripts); inline handlers such as onclick; `<title>`, `<meta>` and JSON-LD (the platform writes SEO); a `lang` attribute; a binding inside `style=""`; `!important` and `@import`; hard-coded colours in `base.css` (use the tokens); animating anything but transform, opacity, clip-path and filter. Maps may only come from www.google.com, maps.google.com, www.openstreetmap.org and videos from www.youtube.com, www.youtube-nocookie.com, youtu.be, player.vimeo.com, vimeo.com, and only through the platform slots.

## 11. Reading lint messages and fixing the common failures

`npm run lint -- <id>` prints one block per failing rule: the rule name, then each place and message. Find the rule in this table.

| Rule | What it means | How to fix it |
|---|---|---|
| `manifest-valid` | theme.json is wrong or incomplete | compare it with library/_starter/theme.json: id, version, name, tier, tracks, families, categories, layoutVariantRules, motion, settingsSchema, fonts. |
| `no-script-tag` | a <script> is in a template | remove it. Themes are HTML and CSS only; use :target, :has() and CSS animations for behaviour. |
| `no-inline-handler` | an onclick, onload or other on… attribute | remove it; use a link to #anchor and CSS :target instead. |
| `no-forbidden-element` | an element the platform draws for you (form, input, iframe, style…) | delete it and place the matching slot, e.g. <g4d-enquiry-form>, <g4d-map>. Put CSS in css/*.css, not in <style>. |
| `no-seo-output` | <title>, <meta>, canonical links or JSON-LD in a template | remove them. The platform writes all SEO tags. |
| `no-external-request` | an address on another website (image, font, stylesheet, script) | use only pictures from the content bindings or inline SVG. Fonts are named, never loaded. |
| `iframe-hosts` | an embed from a host that is not allowed | do not write embeds; the map and video slots do it safely. |
| `css-hygiene` | !important, @import or nested rules in CSS | write plain, flat rules with enough specificity instead of !important; no @import. |
| `css-scoped` | a CSS selector that does not start with .g4d-theme | start every selector with .g4d-theme (for example .g4d-theme .card { … }); keyframes are the only exception. |
| `approved-fonts` | a font that is not one of the twelve | use only the approved fonts listed above. |
| `tamil-fonts` | the body font stack has no Tamil font | add "Noto Sans Tamil" (or "Noto Serif Tamil") to --g4d-font-body. |
| `tokens-defined` | a --g4d-* token is missing, or not redefined for dark mode | define all eleven tokens in css/tokens.css and again inside @media (prefers-color-scheme: dark). |
| `contrast-tokens` | text and background colours that are too close | make text/background, muted/background and the button text pass 4.5:1 (WCAG AA) in light and dark. |
| `contrast-accent` | the vendor's accent colour cannot be made readable on your background | use a background that leaves room for a readable accent in both modes. |
| `one-h1` | zero or more than one <h1> | exactly one <h1> per page. |
| `landmarks` | a missing <header>, <nav>, <main id="main"> or <footer> | add the landmark; there is exactly one <main id="main">. |
| `skip-link` | the first link is not the "skip to content" link | start the page with <a class="skip-link" href="#main">{{ui.skip}}</a>. |
| `language-attr` | a lang attribute in a template | remove it; the platform sets lang (en-IN or ta-IN) on the wrapper. |
| `alt-text` | an <img> without alt, or alt="" on a real picture | give every picture alt text from its binding, and width and height. |
| `form-labels` | a form control without a label | you should have no forms; use the enquiry-form slot. |
| `touch-targets` | links or buttons smaller than 44 px | add .g4d-theme :is(a, button, summary) { min-height: 44px; } (and enough width). |
| `responsive-static` | fixed widths or pictures that can overflow a phone | use max-width: 100% on pictures and flexible grids; no fixed pixel widths wider than 360. |
| `responsive-browser` | a page scrolls sideways at 360, 414, 768, 1024, 1280 or 1536 px (real browser check) | find the wide element, give it min-width: 0 or max-width: 100%. |
| `text-stretch` | long names or Tamil words can overflow | set overflow-wrap: anywhere on the wrapper and min-width: 0 on grid and flex children. |
| `css-budget-layout` | tokens.css + base.css + print.css are 40 KB or more | remove unused rules; reuse selectors. |
| `css-budget-motion` | css/motion.css is 6 KB or more | keep the motion kit unchanged and add at most about 2 KB of your own. |
| `reduced-motion` | no @media (prefers-reduced-motion: reduce) block that stops animation | keep the motion kit at the top of css/motion.css; it has the block. |
| `hero-visible` | the hero is hidden at the start, optional, or missing | mark the hero data-g4d-section="hero" (not optional) and never give it g4d-reveal. |
| `motion-properties` | an animation or transition on width, height, top, left, colour… | animate only transform, opacity, clip-path and filter. |
| `motion-count` | more than 12 animated elements in one section | use fewer motion classes in that section. |
| `slots-required` | a required platform slot is not in any template | place every required slot from the table above in the home template (or the shared header and footer). |
| `slots-reserve-space` | a slot has no reserved space, so the page jumps when it loads | give .g4d-slot--<name> a min-height or aspect-ratio in base.css. |
| `bindings-known` | a {{name}}, list, attribute or slot tag that does not exist | use only the names in the vocabulary above; check spelling. |
| `print-stylesheet` | print.css does not hide navigation | add @media print { .g4d-theme nav, .g4d-theme .g4d-slot { display: none; } }. |
| `html-budget` | a rendered page is over 100 KB | remove repeated markup and big inline SVG. |
| `category-renders` | a category block or list is not shown | keep the generic loop over blocks (<template data-g4d-each="blocks">) so every category's extra blocks render. |
| `category-fit-order` | the blocks of a category come out in the wrong order | loop over blocks in order; do not reorder them in CSS. |
| `entitlements-render` | a section that only hosts a video, cart or booking slot leaves an empty gap when the plan does not allow it | put data-g4d-if="entitlements.video" (or cart, booking) on that section. |
| `preset-valid` | a preset file is wrong | ship no presets; Claude Code generates them after import. |
| `image-budget` | too many pictures, no eager hero, a decorative <img>, or a picture without size | see the picture rules above: one eager hero, everything else loading="lazy" with width and height, decoration as SVG or CSS. |
| `variant-coverage` | a Premium theme has no CSS for a layout variant that one of its categories uses | add rules such as .g4d-theme[data-variant="bold-split"] .hero { … } for each variant in the table above. |
