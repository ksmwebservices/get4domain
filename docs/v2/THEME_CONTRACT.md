# Theme package contract (version 1)

A theme is a folder (or a zip of that folder) of **plain HTML and CSS**. Get4Domain fills it with each vendor's own content on the server. A theme cannot run scripts, so it cannot break a site, read a visitor, or touch another vendor. Everything below is checked by the same code in three places: the admin upload, the command `node scripts/theme/lint.mjs`, and the website renderer.

The machine-readable version of this page is `backend-api/src/themes/core/theme-contract.json` (the website keeps a byte-identical copy in `get4domain_mvp/src/engine/themepack/`; a guard fails if they differ).

## 1. What is in the package

```
my-theme/
  theme.json        names the theme and lists its pages            (required)
  home.html         the home page                                  (required)
  theme.css         all the styles, one file                       (required)
  services.html     the main list page (or menu / packages / properties / courses / portfolio / doctors)
  about.html  gallery.html  contact.html
  page.html         a page the vendor writes (offers, policies)    (recommended)
  item.html         the page of one service, dish, package ...    (recommended)
  assets/           pictures (png, jpg, webp, svg) and fonts (woff2)
```

Limits: package 5 MB, a picture 1 MB, a font 1 MB, a page 400 KB, the stylesheet 400 KB, 400 files, 40 pages. A picture or font under 20 KB may be written inline (`data:`).

## 2. theme.json

```json
{
  "id": "clinic-calm", "name": "Clinic Calm", "version": 1, "author": "Your name",
  "families": ["booking"], "categories": ["clinic", "diagnostics"],
  "pages": [ { "slug": "services", "template": "services", "title": "Treatments", "navLabel": "Treatments" } ],
  "itemsPage": "services",
  "googleFonts": ["https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap"],
  "colors": { "bg": "#ffffff", "fg": "#12312f", "muted": "#4a6360", "accent": "#0f766e", "accentFg": "#ffffff" },
  "cssVars": { "--g4d-radius": "14px" }
}
```

* `id` 3 to 40 lower-case letters, numbers and dashes. `version` is a whole number; raise it for every new upload of the same id.
* `families` is at least one of `shop, booking, enquiry, packages, menu, portfolio, listings, courses`. `categories` lists the category keys the theme works for; a category must belong to one of the declared families.
* `pages` lists the standard pages other than the home page, `page` and `item`. Slugs may not be `book, enquire, order, legal, p, api` (the engine uses them).
* `colors` (plain `#hex`) lets the admin screen check contrast (4.5 to 1 for text, buttons and accents).
* `googleFonts` may only hold addresses that start with `https://fonts.googleapis.com/css`. No other outside address is allowed anywhere.

Page templates: `home, about, services, gallery, contact, page, item, menu, packages, properties, courses, doctors, portfolio`. Item pages exist for `services, menu, packages, properties, courses, portfolio, doctors`.

## 3. Slots (`{{name}}`)

Site: `site.name  site.tagline  site.logo  site.favicon  site.year  site.url` · Hero: `hero.title  hero.subtitle  hero.image  hero.cta` · About: `about.title  about.text  about.image` · Contact: `contact.phone  contact.phoneHref  contact.whatsapp  contact.email  contact.address  contact.mapUrl` · `hours` · Social: `social.instagram  social.facebook  social.youtube  social.linkedin  social.x  social.whatsapp  social.maps  social.custom  social.customLabel` · Vendor page: `page.title  page.body  page.slug` · Words for this kind of business: `terms.team  terms.teamOne  terms.items  terms.itemOne  terms.groups` · `cta.label`.

A slot with nothing behind it is empty. Hide its block with `data-g4d-if="contact.phone"`; hide it when empty with `data-g4d-if-not`.

## 4. Lists

Write `<template data-g4d-each="items"> ... </template>`; inside, use the list's variable.

| List | Variable | Fields |
|---|---|---|
| `items` | `item` | id, name, description, price, image, duration, badge, href, category, tags, includes, location, area, bedrooms, veg, slug |
| `groups` | `group` | name, slug, count, items (a list: `data-g4d-each="group.items"`) |
| `team` | `member` | id, name, role, note, image |
| `testimonials` | `testimonial` | quote, author, note |
| `faqs` | `faq` | q, a |
| `gallery` | `image` | src, alt, title |
| `steps` | `step` | title, desc, n |
| `trust` | `point` | text |
| `stats` | `stat` | value, label |
| `pages` | `navpage` | title, href |

On `item.html` the single item is `{{item.name}}`, `{{item.price}}` and so on. A starter price shows as "Contact for price"; sample customer quotes never reach a public page, so wrap quote blocks in `data-g4d-if="testimonials"`.

## 5. Engine tags

The engine draws the parts every site needs. A theme only marks where they go and styles the box around them.

| Tag | What it draws |
|---|---|
| `<g4d-action label="..." item="{{item.id}}">` | the main action (book, enquire, order). Opens the popup; without script it is a link to a real form page. Give it `class` to style it. |
| `<g4d-header-nav label="Main">` | links to the site's pages |
| `<g4d-bottom-nav>` | the phone's bottom bar (always drawn at the end of the page; the tag only records where you wanted it) |
| `<g4d-footer variant="columns|centered|minimal">` | footer with contact, hours, social icons and legal links |
| `<g4d-social>` | social icons (an empty link hides its icon) |
| `<g4d-hours variant="table|card|strip" title="...">` | opening hours |
| `<g4d-map title="..." height="380">` | the vendor's map |
| `<g4d-tabs for="groups" tab-class="..." panel-class="...">` with one `<template>` inside | tabs for groups (menu sections, treatment groups); the template is drawn once per group, with `group` and `group.items` |
| `<g4d-cart label="Cart">` | the cart button (only when the vendor takes orders online) |

If a page has no `<g4d-header-nav>` the engine adds a plain header; if it has no `<g4d-footer>` the engine adds a footer. Other attributes: `data-g4d-open` (any element opens the popup), `data-g4d-quickview="{{item.id}}"` (opens a quick view of an item), `data-g4d-item`.

## 6. Rules the sanitiser applies

Allowed elements: a, abbr, address, article, aside, b, blockquote, br, button, caption, cite, code, col, colgroup, dd, del, details, dfn, div, dl, dt, em, figcaption, figure, footer, h1 to h6, header, hgroup, hr, i, img, ins, kbd, label, li, main, mark, nav, ol, p, picture, pre, q, s, samp, section, small, source, span, strong, sub, summary, sup, table parts, template, time, u, ul, var, wbr, and plain svg shapes.

Removed with their content: script, style, iframe, object, embed, form, input, select, textarea, link, meta, base, canvas, audio, dialog, math, and svg `foreignObject`, animation and `set`. Event handlers (`onclick`), `javascript:` and `data:` links, and any address outside the package are removed. Links must be `http`, `https`, `tel`, `mailto`, `#anchor`, or a page of the site (`about.html`).

CSS: write normal CSS in one `theme.css`; every rule is scoped to your theme automatically (`body` and `:root` become the theme's own wrapper). `@import`, `expression()`, `behavior`, outside `url()` are removed; `url()` may point only inside the package (`assets/...`). `@font-face`, `@media`, `@supports`, `@layer`, `@container` and keyframes are kept.

Pictures: refer to them as `assets/name.webp` (any depth). File names may not contain `~`. Give every `<img>` an `alt`.

## 7. Good practice (the lint warns)

One `<h1>` per page. Contrast at least 4.5 to 1. Home page with the hero title, the main action and the family's signature blocks (booking: items, team, testimonials, faqs, hours; menu: groups, gallery, hours; ...). Tap targets of at least 44 px. Lazy-load pictures below the top. A theme that is only a home page works but is thin: ship the standard pages.

## 8. Commands

```bash
node scripts/theme/lint.mjs path/to/my-theme            # read and report; exit 1 on a problem
node scripts/theme/lint.mjs path/to/my-theme --fix      # safe fixes, written to my-theme-fixed
node scripts/theme/lint.mjs my-theme.zip --json         # machine-readable
```

Upload the zip in Admin, Theme marketplace. The reference themes in `themes/reference/` (Clinic Calm, Restaurant Hearth) are complete examples.

## 9. Themes made by a generator (later)

A tool that writes themes for you (the v0 platform API, the Claude API, a designer's export script) uses the same door as a person: it produces the files in section 1 and the zip goes through the same checks. There is no private route. A generator must be given this page and the prompt in `THEME_PROMPTS.md` for the family, must write the manifest, and must run the lint (`node scripts/theme/lint.mjs`, or the same code through the admin upload with `?dryRun=1`) until it reports no problems; a package that fails is refused with plain sentences and nothing is stored. The result arrives as a DRAFT in Admin, Theme marketplace, where KSM looks at it on desktop and phone before setting it Live. Raw code that has not been through the sanitiser is never run on a vendor's site.

## 10. What the engine adds around a theme

The announcement bar (the vendor's own words), the phone's bottom bar, the popup, the quick view, the floating call and WhatsApp buttons on a computer, the privacy and terms pages, the form pages (`/book`, `/enquire`, `/order`), a plain header and footer when a page has none, and the per-host sitemap and robots. None of these can be styled by theme class names, because a theme's rules only reach the page content.
