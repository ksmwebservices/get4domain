# Theme package spec (for designers and design tools such as Bolt)

Give this file to a design tool and ask it to produce **one `.zip`**. If it follows this file, the admin upload (Admin, Themes, Import) accepts it. Nothing here is a new format: it is the existing marketplace package (`backend-api/src/themes/core`, contract `theme-contract.json`, validated by `sanitise.ts` and `lint.ts`) plus four manifest fields this lane defines (`pack`, `track`, `freeMode`, `targets`).

> **Status of the four new fields.** The current admin validator **ignores them without an error** (it copies only the fields it knows, so they are dropped, not rejected). A package that carries them still uploads. They only take effect once the backend lane in section 9 is done. Until then a theme is attached to categories with the existing `categories` field (section 3) and the admin screen.

## 1. What a package is

Plain static HTML and CSS, filled with each vendor's own content on the server. No JavaScript, no framework, no build step, no forms, no external scripts. A React, Vite or Next project is rejected.

```
my-theme.zip
  theme.json            required: the manifest (section 2)
  theme.css             required in practice: all styles, one file
  home.html             required: the home page
  services.html  about.html  gallery.html  contact.html   the pages you list in theme.json
  item.html  page.html  recommended (an item page, and a page for vendor-written pages)
  preview.png           optional: the preview picture (png, jpg or webp)
  assets/               pictures and fonts used by the pages and the CSS
```

A top-level folder around everything is removed automatically.

## 2. `theme.json`

| Field | Required | Rule |
|---|---|---|
| `id` | yes | 3 to 40 characters, lower-case letters, numbers and dashes (`clinic-calm`). Becomes the CSS scope `.g4d-theme-<id>`. |
| `name` | yes | 2 to 80 characters. Shown to vendors. |
| `author` | yes | Up to 80 characters. |
| `version` | yes | Whole number from 1. Raise it for every new upload of the same `id`. |
| `description` | no | Up to 300 characters. |
| `families` | yes | One or more of `shop booking enquiry packages menu portfolio listings courses`. |
| `categories` | yes | Category-pack keys this theme is for (`["clinic","diagnostics"]`). Each must exist, and each category's family must be in `families`. |
| `pages` | no | `[{ "slug", "template", "title", "navLabel", "nav" }]`. `template` is one of `services about gallery contact menu packages properties courses doctors portfolio`, and `<template>.html` must be in the zip. If omitted, pages are taken from the files. |
| `itemsPage` | no | The slug of the page that lists items. |
| `colors` | recommended | `{ "bg","fg","muted","accent","accentFg" }`, plain `#hex`. Used for the contrast check. |
| `cssVars` | no | `--name: value` pairs (`--g4d-radius`, `--g4d-surface`, `--g4d-border`). No `url()`, braces or angle brackets. |
| `googleFonts` | no | Addresses that start with `https://fonts.googleapis.com/css`. |
| **`pack`** | new | The industry pack id the theme is the design of (`clinic`, `restaurant`, ...). One of the main category ids. |
| **`track`** | new | `"free"`, `"pro"` or `"both"`. Which plans may use it. |
| **`freeMode`** | new | `true` when the theme is safe to draw in Free (information only) mode: no form, no chat, no call-to-action link, no mailto or tel link. |
| **`targets`** | new | Where the theme applies (section 3). |

### Design tokens
Tokens are `colors`, `cssVars` and the fonts. Use them in `theme.css` as variables (`var(--g4d-accent)`), so a vendor's brand colour or an admin can change a theme without touching the HTML. Required contrast (WCAG AA, 4.5:1): `fg` on `bg`, `muted` on `bg`, `accentFg` on `accent`, `accent` on `bg`. The kit's own type scale is a modular scale (ratio 1.2 to 1.414) from a 1 rem body, with system font stacks; a package may use Google Fonts or `assets/fonts/*.woff2`.

## 3. Targets

`targets` says which businesses get the theme. Each entry names a **main category**, a **category** or a **sub category**, by `id` or `slug` (one is enough):

```json
"targets": [
  { "level": "main",     "id": "clinic" },
  { "level": "category", "id": "dental-clinic" },
  { "level": "sub",      "slug": "clinic/dental" }
]
```

* `main`: a main category id from the category data (`restaurant`, `clinic`, `realestate`, ... all 29, and any added later).
* `category`: a category-pack key (`clinic`, `advocate`, `home-services`, ...). Today this is exactly what `categories` already holds.
* `sub`: a sub category id, or `<main>/<sub>` (`clinic/dental`).

Resolution for a vendor (implemented in `get4domain_mvp/src/lib/v3-public/site-kit/resolver.ts`): a theme targeting the vendor's **sub category** wins, then **category**, then **main category**, then the flagship of the **closest industry pack**, then the **safe default**. If several themes target the same level, the vendor's own choice wins if it is one of them, else the theme the admin marked default, else the lowest `id`.

## 4. Section templates and data slots

A page is HTML with slots. A slot is `{{name}}`; a list is an element with `data-g4d-each="list"` that repeats for each entry (`data-g4d-as="x"` renames the loop variable); `data-g4d-if="list"` / `data-g4d-if-not="list"` show or hide a block.

* Slots: `site.name site.tagline site.logo site.favicon site.year site.url hero.title hero.subtitle hero.image hero.cta about.title about.text about.image contact.phone contact.phoneHref contact.whatsapp contact.email contact.address contact.mapUrl hours social.instagram social.facebook social.youtube social.linkedin social.x social.whatsapp social.maps social.custom social.customLabel page.title page.body page.slug terms.team terms.teamOne terms.items terms.itemOne terms.groups cta.label`.
* Lists (`data-g4d-each`) and their fields: `items` (`id name description price image duration badge href category tags includes location area bedrooms veg slug`), `groups` (`name slug count items`), `team` (`id name role note image`), `testimonials` (`quote author note`), `faqs` (`q a`), `gallery` (`src alt title`), `steps` (`title desc n`), `trust` (`text`), `stats` (`value label`), `pages` (`title href`).
* Engine tags (the engine draws these): `<g4d-action>`, `<g4d-header-nav>`, `<g4d-bottom-nav>`, `<g4d-footer>`, `<g4d-social>`, `<g4d-hours>`, `<g4d-map>`, `<g4d-tabs>`, `<g4d-cart>`. The header, bottom navigation, footer and main action are always added by the engine even if missing.
* Allowed HTML: structural and text elements, `img`, `picture`, `details`, `table`, simple inline `svg`; links only to `http`, `https`, `tel`, `mailto`. Scripts, styles, iframes, forms and inputs are removed.

### Design-kit section blocks
The built-in kit draws these sections for every theme, in the theme's own order: **hero** (variants `split centered fullbleed overlap band`), **services** (`rows cards products numbered`), **gallery** (`mosaic strip grid`), **reviews**, **faq**, **pricing**, **map** (address and hours), **contact**. A package theme provides the same blocks as page sections using the lists above: hero = `hero.*`; services = `items`; gallery = `gallery`; reviews = `testimonials` (always inside `data-g4d-if="testimonials"`, because sample reviews are never shown to the public); faq = `faqs`; pricing = `items` with `item.price`; map = `<g4d-map>` and `<g4d-hours>`; contact = `contact.*`. Make themes differ in layout, section order, typography and imagery, not only colour.

## 5. Preview image
`preview.png` (or `.jpg`, `.webp`) at the zip root, at most 1 MB, ideally 1200 x 800. It is stored with the theme and shown in the admin list.

## 6. Limits
Whole zip 5 MB (upload read limit 6 MB). At most 400 files and 40 pages. Each picture and each font at most 1 MB; each HTML and the CSS at most 400 KB. Allowed assets: PNG, JPG, WebP, SVG without scripts, WOFF2, WOFF. Inline data pictures under 20 KB. A file name in `assets/` must not contain `~`. Unused pictures are dropped.

## 7. Worked example (a tiny valid package)

`theme.json`
```json
{
  "id": "dental-bright",
  "name": "Dental Bright",
  "version": 1,
  "author": "Studio Example",
  "description": "A bright, clean theme for dental and skin clinics.",
  "families": ["booking"],
  "categories": ["clinic"],
  "pages": [
    { "slug": "services", "template": "services", "title": "Treatments", "navLabel": "Treatments" },
    { "slug": "contact", "template": "contact", "title": "Contact" }
  ],
  "itemsPage": "services",
  "colors": { "bg": "#ffffff", "fg": "#10302e", "muted": "#47615e", "accent": "#0f766e", "accentFg": "#ffffff" },
  "cssVars": { "--g4d-radius": "16px", "--g4d-surface": "#eef7f5", "--g4d-border": "#cfe3df" },
  "pack": "clinic",
  "track": "both",
  "freeMode": true,
  "targets": [ { "level": "main", "id": "clinic" }, { "level": "sub", "slug": "clinic/dental" } ]
}
```
`home.html`
```html
<section class="hero">
  <h1>{{hero.title}}</h1>
  <p>{{hero.subtitle}}</p>
  <g4d-action></g4d-action>
</section>
<section data-g4d-if="items">
  <h2>{{terms.items}}</h2>
  <ul><li data-g4d-each="items"><h3>{{item.name}}</h3><p>{{item.description}}</p><span>{{item.price}}</span></li></ul>
</section>
<section data-g4d-if="testimonials">
  <h2>Reviews</h2>
  <blockquote data-g4d-each="testimonials">{{testimonial.quote}} <cite>{{testimonial.author}}</cite></blockquote>
</section>
<g4d-hours></g4d-hours>
```
`services.html` and `contact.html` follow the same pattern (one `<h1>`, `data-g4d-each="items"`, `<g4d-map>`). `theme.css` styles everything with `var(--g4d-*)`.

## 8. Validation messages and how to fix them

| Message (shortened) | Fix |
|---|---|
| Choose a zip file to upload. | Send the file in the `file` field. |
| theme.json is not a JSON object. | Fix the JSON (no comments, no trailing commas). |
| theme.json "id" must be 3 to 40 letters, numbers and dashes, in lower case | Rename, for example `dental-bright`. |
| theme.json "name" / "author" is missing | Add them. |
| theme.json "version" must be a whole number from 1 | Use `1`, then `2`, ... for each upload. |
| theme.json "families" must list at least one of: ... | Add a valid family. |
| theme.json "categories" must list the categories this theme is for | Add category-pack keys. |
| The category "x" in theme.json does not exist. | Use a real category key (the message lists them). |
| The category "x" is a booking business, but this theme declares only ... | Add the family to `families`, or remove the category. |
| theme.json lists a page template "x" that is not one of the standard ones | Use a template from section 2. |
| theme.json lists the page "x" but x.html is not in the package. | Add the file or remove the page. |
| Two pages in theme.json use the same address (slug). | Make each slug unique. |
| A page address (slug) in theme.json is not allowed | Not `book enquire order legal p api`; lower case and dashes only. |
| theme.json "itemsPage" (x) is not one of the pages. | Point it at a listed slug. |
| theme.json "googleFonts" may only hold addresses that start with ... | Use Google Fonts css addresses only. |
| This looks like a React, Vite or Next.js project. | Export plain HTML and CSS, one file per page, no JavaScript. |
| The package has N files / is N MB; the limit is ... | Remove files or shrink pictures (WebP, 1600 px wide). |
| x is not an allowed picture or font. | Use PNG, JPG, WebP, clean SVG, WOFF2 or WOFF; the file's real type must match its extension. |
| x is N KB; the limit is ... | Resize or compress. |
| x is rejected: (svg problem) | Export the SVG again as plain shapes, no scripts. |
| x.html / theme.css is larger than ... KB. | Split or simplify. |
| theme.css has a mistake on line N | Fix the CSS syntax. |
| data-g4d-each="x" names a list that does not exist. | Use a list from section 4. |
| data-g4d-as must be a plain lower-case word. | Rename. |
| `<x>` is not an engine tag. | Use only the tags in section 4. |
| A file name in assets/ contains "~". | Rename the file. |
| Version N of "id" is already in the marketplace. | Raise `version`. |
| Warnings (do not block): no `page.html`, no `item.html`, home-only theme, no `<h1>`, pictures without alt text, testimonials without `data-g4d-if`, contrast below 4.5:1 | Fix for a better theme; the upload still works. |

Messages for `targets` (checked by the kit today in `validateTargets`, and by the admin once the backend lane exists): `"targets" must be a list`; `"level" must be "main", "category" or "sub"`; `give an "id" or a "slug"`; `not a valid id or slug`; `does not exist in the category data`; `is listed twice`; `at most 60 entries`. Fix each by editing the entry.

## 9. What the backend and admin still need (not built in this lane)
See the P11 report: the validator must read `pack`, `track`, `freeMode` and `targets`; the admin update route must accept `targets`; the admin upload screen needs a "choose targets" field; no database migration is needed (the manifest is stored whole as JSON).
