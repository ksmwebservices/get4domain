# Theme prompt pack

Ready-to-paste prompts for Bolt, v0 or Claude. One prompt per flow family (8). Each one asks for a **multi-page website** (home, about, the family's main listing page, gallery or portfolio, contact, one generic page, one item detail page) sharing one header, footer and one `theme.css`, and tells the tool exactly which parts of the page belong to the engine.

The contract these prompts rely on: [THEME_CONTRACT.md](THEME_CONTRACT.md). The finished examples: `themes/reference/clinic-calm` and `themes/reference/restaurant-hearth`.

## For KSM: step by step

1. Pick the family below and copy its whole prompt into Bolt, v0 or Claude. Add the industry if you want one design for one category (for example "for a dental clinic in Chennai"), or ask for **four different designs** with the extra instruction at the end of the prompt to fill the four free slots of a category in one go.
2. Ask the tool for **static HTML and CSS files, not a project**. If it gives you a React, Vite or Next.js project, use "How to turn a Bolt export into a theme" at the end of this page.
3. Download the result into a folder (or unzip it). It should contain `theme.json`, `home.html`, `theme.css` and `assets/`.
4. Run the lint on your own computer:
   ```bash
   node scripts/theme/lint.mjs path/to/the-folder
   ```
   Every line says PASS, WARN or FAIL in plain sentences. `--fix` repairs the safe things (index.html to home.html, a first theme.json, scripts removed). Paste the FAIL lines back into the tool and ask it to fix them. Repeat until the result says "no problems".
5. Zip the folder (theme.json at the top), open **Admin, Theme marketplace**, upload it, check the preview of every category on desktop and phone (the popup and the bottom bar are shown), then choose its role: a **free default design** for the category (replacing one of the four built-in designs) or a **marketplace theme** with a yearly price, and set it Live.

## The eight prompts

### Booking and appointments (family `booking`)

Categories this family serves: clinic, diagnostics, salon, gym, automobile.

```text
Build a complete, modern, multi-page WEBSITE THEME for a booking and appointments business (clinic, diagnostics, salon, gym, automobile). Not a single landing page: it must have these pages, all sharing one header, one footer and one theme.css: home, services, doctors, about, gallery, contact, page, item.
The main listing page is services.html (use slug "services"; also doctors.html for the people). The thing being listed is a service or treatment. People shown: doctors, stylists, trainers.

SIGNATURE SECTIONS AND FLOW
- Hero with an inline "Book now" action (<g4d-action>) and the trust points
- Services or treatments in <g4d-tabs> by group, each card with duration and price and a "Book this" action
- People cards (doctor, stylist, trainer) with a "Book with" action
- Plans comparison for gyms (items with a badge)
- Availability strip (hours, <g4d-hours variant="strip">)
- Reviews (hidden when there are none), FAQ, map and hours
- Popup steps come from the engine: choose a service, pick a date and time of day, your details, confirm. Do NOT draw a form.
Engine tags this family should use: g4d-action, g4d-tabs, g4d-hours, g4d-map. The home page must contain (as slots/lists): hero.title, hero.cta, items, team, testimonials, faqs, hours.

### Output rules (read first)
- A **multi-page website** as static files: one `.html` file per page, ONE shared `theme.css`, a `theme.json`, and an `assets/` folder. All pages share the same header and footer markup and the same class names.
- **Plain HTML and CSS only.** No JavaScript at all (no `<script>`, no `onclick`, no framework, no Tailwind CDN, no build step, no React, no Vite, no Next.js). No forms and no `<input>`: the engine draws every form.
- Every picture is a file in `assets/` (webp, jpg, png or svg, each under 1 MB), referred to as `assets/name.webp`. Fonts: only Google Fonts, listed in `theme.json` under `googleFonts`; never an `@import` or `<link>` in a page.
- Wrap each page in `<!doctype html><html lang="en"><body> ... </body></html>`. Put nothing important in `<head>`; the engine writes the head (title, description, canonical, social cards).
- Write normal CSS with class selectors. Use `:root{--g4d-bg:...;--g4d-fg:...;--g4d-muted:...;--g4d-accent:...;--g4d-accent-fg:...;--g4d-surface:...;--g4d-border:...;--g4d-radius:...}` and use those variables everywhere, so the popup, bottom bar and footer match your colours.
- Mobile first. Tap targets at least 44 px. One `<h1>` per page. Text contrast at least 4.5 to 1. Every `<img>` has an `alt`.

### Content comes from slots, never from your words
Do NOT invent the business name, services, prices, doctors, reviews, numbers or addresses. Use slots: `{{site.name}} {{site.tagline}} {{site.logo}} {{hero.title}} {{hero.subtitle}} {{hero.image}} {{about.text}} {{about.image}} {{contact.phone}} {{contact.phoneHref}} {{contact.email}} {{contact.address}} {{hours}} {{terms.items}} {{terms.team}} {{page.title}} {{page.body}}`.
Lists: `<template data-g4d-each="items">` with `{{item.name}} {{item.description}} {{item.price}} {{item.image}} {{item.duration}} {{item.badge}} {{item.href}} {{item.category}} {{item.includes}}`; `groups` (`{{group.name}}`, `{{group.count}}`, `group.items`), `team` (`member.name/role/note/image`), `testimonials` (`testimonial.quote/author`), `faqs` (`faq.q/a`), `gallery` (`image.src/alt`), `steps`, `trust` (`point.text`), `stats`.
Hide a block that has no data with `data-g4d-if="testimonials"` (reviews must always be wrapped like this: sample reviews never show publicly). Show a fallback picture with `data-g4d-if-not="hero.image"`.
Use the engine's parts by tag, and style the boxes around them: `<g4d-action class="btn" label="..." item="{{item.id}}">` (the main action), `<g4d-header-nav class="nav">`, `<g4d-footer variant="columns">`, `<g4d-bottom-nav>`, `<g4d-social>`, `<g4d-hours variant="card">`, `<g4d-map height="380">`, `<g4d-tabs for="groups" tab-class="tab" panel-class="panel"><template>...</template></g4d-tabs>` and `<g4d-cart>`. **Leave the popup and the mobile bottom navigation to these tags. Do not build your own.**
Links between pages are plain: `href="about.html"`, `href="services.html"`, home is `href="/"`. An item card links to `href="{{item.href}}"`.

### Design direction
Modern, current UI: large confident type (a display face plus a clean text face), generous white space, strong section rhythm, real photography for the industry (large images, never gradient boxes standing in for pictures), subtle depth, a restrained palette with one accent. Mobile first and fast. Original artwork only.

### Manifest to fill (`theme.json`)
Replace the values: `id` (lower-case, dashes), `name`, `version` (1), `author`, `description`, `families`, `categories`, `pages` (slug, template, title, navLabel), `itemsPage`, `googleFonts`, `colors` (bg, fg, muted, accent, accentFg as #hex).

### Before you deliver
Run `node scripts/theme/lint.mjs <folder>` (it needs no install other than backend-api's) and fix every FAIL and as many WARN lines as you can. Deliver the folder as a zip with `theme.json` at the top.
```

### Make four different designs for this family
If asked for four, produce **four separate theme folders** for booking and appointments (`<family>-one` to `<family>-four`, four different `id`s, all with `"families": ["booking"]` and the same categories). They must differ in structure, not only colour: a different hero (full-bleed image, split, centred text, card over image), a different grid style (cards, rows, mosaic, editorial), a different section order, a different header (bar, centred logo, minimal with large type) and a different type pairing. Each must pass the lint on its own.

### Enquiry and services (family `enquiry`)

Categories this family serves: advocate, professional, finance, technology, home-services, logistics, general.

```text
Build a complete, modern, multi-page WEBSITE THEME for a enquiry and services business (advocate, professional, finance, technology, home-services, logistics, general). Not a single landing page: it must have these pages, all sharing one header, one footer and one theme.css: home, services, about, portfolio, contact, page, item.
The main listing page is services.html and portfolio.html (case studies or projects). The thing being listed is a service or practice area. People shown: partners, advisers, engineers.

SIGNATURE SECTIONS AND FLOW
- Proof-point hero (numbers, credentials) with a "Get a quote" action
- Service areas as editorial cards
- A process timeline from the steps list
- Case studies or projects (portfolio.html, from the gallery)
- Team and credentials, engagement models, FAQ
- Popup steps: what do you need, your details, confirm. The enquiry goes into the vendor's CRM.
Engine tags this family should use: g4d-action, g4d-map. The home page must contain (as slots/lists): hero.title, hero.cta, items, steps, faqs.

### Output rules (read first)
- A **multi-page website** as static files: one `.html` file per page, ONE shared `theme.css`, a `theme.json`, and an `assets/` folder. All pages share the same header and footer markup and the same class names.
- **Plain HTML and CSS only.** No JavaScript at all (no `<script>`, no `onclick`, no framework, no Tailwind CDN, no build step, no React, no Vite, no Next.js). No forms and no `<input>`: the engine draws every form.
- Every picture is a file in `assets/` (webp, jpg, png or svg, each under 1 MB), referred to as `assets/name.webp`. Fonts: only Google Fonts, listed in `theme.json` under `googleFonts`; never an `@import` or `<link>` in a page.
- Wrap each page in `<!doctype html><html lang="en"><body> ... </body></html>`. Put nothing important in `<head>`; the engine writes the head (title, description, canonical, social cards).
- Write normal CSS with class selectors. Use `:root{--g4d-bg:...;--g4d-fg:...;--g4d-muted:...;--g4d-accent:...;--g4d-accent-fg:...;--g4d-surface:...;--g4d-border:...;--g4d-radius:...}` and use those variables everywhere, so the popup, bottom bar and footer match your colours.
- Mobile first. Tap targets at least 44 px. One `<h1>` per page. Text contrast at least 4.5 to 1. Every `<img>` has an `alt`.

### Content comes from slots, never from your words
Do NOT invent the business name, services, prices, doctors, reviews, numbers or addresses. Use slots: `{{site.name}} {{site.tagline}} {{site.logo}} {{hero.title}} {{hero.subtitle}} {{hero.image}} {{about.text}} {{about.image}} {{contact.phone}} {{contact.phoneHref}} {{contact.email}} {{contact.address}} {{hours}} {{terms.items}} {{terms.team}} {{page.title}} {{page.body}}`.
Lists: `<template data-g4d-each="items">` with `{{item.name}} {{item.description}} {{item.price}} {{item.image}} {{item.duration}} {{item.badge}} {{item.href}} {{item.category}} {{item.includes}}`; `groups` (`{{group.name}}`, `{{group.count}}`, `group.items`), `team` (`member.name/role/note/image`), `testimonials` (`testimonial.quote/author`), `faqs` (`faq.q/a`), `gallery` (`image.src/alt`), `steps`, `trust` (`point.text`), `stats`.
Hide a block that has no data with `data-g4d-if="testimonials"` (reviews must always be wrapped like this: sample reviews never show publicly). Show a fallback picture with `data-g4d-if-not="hero.image"`.
Use the engine's parts by tag, and style the boxes around them: `<g4d-action class="btn" label="..." item="{{item.id}}">` (the main action), `<g4d-header-nav class="nav">`, `<g4d-footer variant="columns">`, `<g4d-bottom-nav>`, `<g4d-social>`, `<g4d-hours variant="card">`, `<g4d-map height="380">`, `<g4d-tabs for="groups" tab-class="tab" panel-class="panel"><template>...</template></g4d-tabs>` and `<g4d-cart>`. **Leave the popup and the mobile bottom navigation to these tags. Do not build your own.**
Links between pages are plain: `href="about.html"`, `href="services.html"`, home is `href="/"`. An item card links to `href="{{item.href}}"`.

### Design direction
Modern, current UI: large confident type (a display face plus a clean text face), generous white space, strong section rhythm, real photography for the industry (large images, never gradient boxes standing in for pictures), subtle depth, a restrained palette with one accent. Mobile first and fast. Original artwork only.

### Manifest to fill (`theme.json`)
Replace the values: `id` (lower-case, dashes), `name`, `version` (1), `author`, `description`, `families`, `categories`, `pages` (slug, template, title, navLabel), `itemsPage`, `googleFonts`, `colors` (bg, fg, muted, accent, accentFg as #hex).

### Before you deliver
Run `node scripts/theme/lint.mjs <folder>` (it needs no install other than backend-api's) and fix every FAIL and as many WARN lines as you can. Deliver the folder as a zip with `theme.json` at the top.
```

### Make four different designs for this family
If asked for four, produce **four separate theme folders** for enquiry and services (`<family>-one` to `<family>-four`, four different `id`s, all with `"families": ["enquiry"]` and the same categories). They must differ in structure, not only colour: a different hero (full-bleed image, split, centred text, card over image), a different grid style (cards, rows, mosaic, editorial), a different section order, a different header (bar, centred logo, minimal with large type) and a different type pairing. Each must pass the lint on its own.

### Packages and tours (family `packages`)

Categories this family serves: travel, hotel, events.

```text
Build a complete, modern, multi-page WEBSITE THEME for a packages and tours business (travel, hotel, events). Not a single landing page: it must have these pages, all sharing one header, one footer and one theme.css: home, packages, about, gallery, contact, page, item.
The main listing page is packages.html. The thing being listed is a package, room or event type. People shown: guides, planners.

SIGNATURE SECTIONS AND FLOW
- Full-bleed destination hero with a search-style action
- Package cards with inclusions (item.includes), duration, price
- Itinerary accordion on the item page (<details>)
- Gallery, rooms or event types in <g4d-tabs>
- Testimonials (hidden when none)
- Popup steps: choose a package, dates, number of people, your details, confirm.
Engine tags this family should use: g4d-action, g4d-tabs. The home page must contain (as slots/lists): hero.title, hero.cta, items, gallery, testimonials.

### Output rules (read first)
- A **multi-page website** as static files: one `.html` file per page, ONE shared `theme.css`, a `theme.json`, and an `assets/` folder. All pages share the same header and footer markup and the same class names.
- **Plain HTML and CSS only.** No JavaScript at all (no `<script>`, no `onclick`, no framework, no Tailwind CDN, no build step, no React, no Vite, no Next.js). No forms and no `<input>`: the engine draws every form.
- Every picture is a file in `assets/` (webp, jpg, png or svg, each under 1 MB), referred to as `assets/name.webp`. Fonts: only Google Fonts, listed in `theme.json` under `googleFonts`; never an `@import` or `<link>` in a page.
- Wrap each page in `<!doctype html><html lang="en"><body> ... </body></html>`. Put nothing important in `<head>`; the engine writes the head (title, description, canonical, social cards).
- Write normal CSS with class selectors. Use `:root{--g4d-bg:...;--g4d-fg:...;--g4d-muted:...;--g4d-accent:...;--g4d-accent-fg:...;--g4d-surface:...;--g4d-border:...;--g4d-radius:...}` and use those variables everywhere, so the popup, bottom bar and footer match your colours.
- Mobile first. Tap targets at least 44 px. One `<h1>` per page. Text contrast at least 4.5 to 1. Every `<img>` has an `alt`.

### Content comes from slots, never from your words
Do NOT invent the business name, services, prices, doctors, reviews, numbers or addresses. Use slots: `{{site.name}} {{site.tagline}} {{site.logo}} {{hero.title}} {{hero.subtitle}} {{hero.image}} {{about.text}} {{about.image}} {{contact.phone}} {{contact.phoneHref}} {{contact.email}} {{contact.address}} {{hours}} {{terms.items}} {{terms.team}} {{page.title}} {{page.body}}`.
Lists: `<template data-g4d-each="items">` with `{{item.name}} {{item.description}} {{item.price}} {{item.image}} {{item.duration}} {{item.badge}} {{item.href}} {{item.category}} {{item.includes}}`; `groups` (`{{group.name}}`, `{{group.count}}`, `group.items`), `team` (`member.name/role/note/image`), `testimonials` (`testimonial.quote/author`), `faqs` (`faq.q/a`), `gallery` (`image.src/alt`), `steps`, `trust` (`point.text`), `stats`.
Hide a block that has no data with `data-g4d-if="testimonials"` (reviews must always be wrapped like this: sample reviews never show publicly). Show a fallback picture with `data-g4d-if-not="hero.image"`.
Use the engine's parts by tag, and style the boxes around them: `<g4d-action class="btn" label="..." item="{{item.id}}">` (the main action), `<g4d-header-nav class="nav">`, `<g4d-footer variant="columns">`, `<g4d-bottom-nav>`, `<g4d-social>`, `<g4d-hours variant="card">`, `<g4d-map height="380">`, `<g4d-tabs for="groups" tab-class="tab" panel-class="panel"><template>...</template></g4d-tabs>` and `<g4d-cart>`. **Leave the popup and the mobile bottom navigation to these tags. Do not build your own.**
Links between pages are plain: `href="about.html"`, `href="services.html"`, home is `href="/"`. An item card links to `href="{{item.href}}"`.

### Design direction
Modern, current UI: large confident type (a display face plus a clean text face), generous white space, strong section rhythm, real photography for the industry (large images, never gradient boxes standing in for pictures), subtle depth, a restrained palette with one accent. Mobile first and fast. Original artwork only.

### Manifest to fill (`theme.json`)
Replace the values: `id` (lower-case, dashes), `name`, `version` (1), `author`, `description`, `families`, `categories`, `pages` (slug, template, title, navLabel), `itemsPage`, `googleFonts`, `colors` (bg, fg, muted, accent, accentFg as #hex).

### Before you deliver
Run `node scripts/theme/lint.mjs <folder>` (it needs no install other than backend-api's) and fix every FAIL and as many WARN lines as you can. Deliver the folder as a zip with `theme.json` at the top.
```

### Make four different designs for this family
If asked for four, produce **four separate theme folders** for packages and tours (`<family>-one` to `<family>-four`, four different `id`s, all with `"families": ["packages"]` and the same categories). They must differ in structure, not only colour: a different hero (full-bleed image, split, centred text, card over image), a different grid style (cards, rows, mosaic, editorial), a different section order, a different header (bar, centred logo, minimal with large type) and a different type pairing. Each must pass the lint on its own.

### Menu and orders (family `menu`)

Categories this family serves: restaurant.

```text
Build a complete, modern, multi-page WEBSITE THEME for a menu and orders business (restaurant). Not a single landing page: it must have these pages, all sharing one header, one footer and one theme.css: home, menu, about, gallery, contact, page, item.
The main listing page is menu.html. The thing being listed is a dish. People shown: chefs.

SIGNATURE SECTIONS AND FLOW
- Food-first hero with the opening status and an order or reserve action
- Tabbed menu (<g4d-tabs for="groups">) with veg marks (item.veg) and a quick view on every dish
- Specials and combos (items with a badge)
- Gallery strip, hours and delivery area, map
- <g4d-cart> in the header
- Popup: with online orders on, the main action opens the cart; otherwise it asks what you want, when, your details.
Engine tags this family should use: g4d-action, g4d-tabs, g4d-cart, g4d-hours, g4d-map. The home page must contain (as slots/lists): hero.title, hero.cta, groups, gallery, hours.

### Output rules (read first)
- A **multi-page website** as static files: one `.html` file per page, ONE shared `theme.css`, a `theme.json`, and an `assets/` folder. All pages share the same header and footer markup and the same class names.
- **Plain HTML and CSS only.** No JavaScript at all (no `<script>`, no `onclick`, no framework, no Tailwind CDN, no build step, no React, no Vite, no Next.js). No forms and no `<input>`: the engine draws every form.
- Every picture is a file in `assets/` (webp, jpg, png or svg, each under 1 MB), referred to as `assets/name.webp`. Fonts: only Google Fonts, listed in `theme.json` under `googleFonts`; never an `@import` or `<link>` in a page.
- Wrap each page in `<!doctype html><html lang="en"><body> ... </body></html>`. Put nothing important in `<head>`; the engine writes the head (title, description, canonical, social cards).
- Write normal CSS with class selectors. Use `:root{--g4d-bg:...;--g4d-fg:...;--g4d-muted:...;--g4d-accent:...;--g4d-accent-fg:...;--g4d-surface:...;--g4d-border:...;--g4d-radius:...}` and use those variables everywhere, so the popup, bottom bar and footer match your colours.
- Mobile first. Tap targets at least 44 px. One `<h1>` per page. Text contrast at least 4.5 to 1. Every `<img>` has an `alt`.

### Content comes from slots, never from your words
Do NOT invent the business name, services, prices, doctors, reviews, numbers or addresses. Use slots: `{{site.name}} {{site.tagline}} {{site.logo}} {{hero.title}} {{hero.subtitle}} {{hero.image}} {{about.text}} {{about.image}} {{contact.phone}} {{contact.phoneHref}} {{contact.email}} {{contact.address}} {{hours}} {{terms.items}} {{terms.team}} {{page.title}} {{page.body}}`.
Lists: `<template data-g4d-each="items">` with `{{item.name}} {{item.description}} {{item.price}} {{item.image}} {{item.duration}} {{item.badge}} {{item.href}} {{item.category}} {{item.includes}}`; `groups` (`{{group.name}}`, `{{group.count}}`, `group.items`), `team` (`member.name/role/note/image`), `testimonials` (`testimonial.quote/author`), `faqs` (`faq.q/a`), `gallery` (`image.src/alt`), `steps`, `trust` (`point.text`), `stats`.
Hide a block that has no data with `data-g4d-if="testimonials"` (reviews must always be wrapped like this: sample reviews never show publicly). Show a fallback picture with `data-g4d-if-not="hero.image"`.
Use the engine's parts by tag, and style the boxes around them: `<g4d-action class="btn" label="..." item="{{item.id}}">` (the main action), `<g4d-header-nav class="nav">`, `<g4d-footer variant="columns">`, `<g4d-bottom-nav>`, `<g4d-social>`, `<g4d-hours variant="card">`, `<g4d-map height="380">`, `<g4d-tabs for="groups" tab-class="tab" panel-class="panel"><template>...</template></g4d-tabs>` and `<g4d-cart>`. **Leave the popup and the mobile bottom navigation to these tags. Do not build your own.**
Links between pages are plain: `href="about.html"`, `href="services.html"`, home is `href="/"`. An item card links to `href="{{item.href}}"`.

### Design direction
Modern, current UI: large confident type (a display face plus a clean text face), generous white space, strong section rhythm, real photography for the industry (large images, never gradient boxes standing in for pictures), subtle depth, a restrained palette with one accent. Mobile first and fast. Original artwork only.

### Manifest to fill (`theme.json`)
Replace the values: `id` (lower-case, dashes), `name`, `version` (1), `author`, `description`, `families`, `categories`, `pages` (slug, template, title, navLabel), `itemsPage`, `googleFonts`, `colors` (bg, fg, muted, accent, accentFg as #hex).

### Before you deliver
Run `node scripts/theme/lint.mjs <folder>` (it needs no install other than backend-api's) and fix every FAIL and as many WARN lines as you can. Deliver the folder as a zip with `theme.json` at the top.
```

### Make four different designs for this family
If asked for four, produce **four separate theme folders** for menu and orders (`<family>-one` to `<family>-four`, four different `id`s, all with `"families": ["menu"]` and the same categories). They must differ in structure, not only colour: a different hero (full-bleed image, split, centred text, card over image), a different grid style (cards, rows, mosaic, editorial), a different section order, a different header (bar, centred logo, minimal with large type) and a different type pairing. Each must pass the lint on its own.

### Shop and cart (family `shop`)

Categories this family serves: retail, agriculture.

```text
Build a complete, modern, multi-page WEBSITE THEME for a shop and cart business (retail, agriculture). Not a single landing page: it must have these pages, all sharing one header, one footer and one theme.css: home, services, about, contact, page, item.
The main listing page is services.html (use it as the product list; slug "services"). The thing being listed is a product. People shown: none.

SIGNATURE SECTIONS AND FLOW
- Offer hero with a category rail (groups as links)
- Category tiles (data-g4d-each="groups")
- Product grid with <g4d-tabs> as filters and a quick view button on each card
- Offers strip (items with a badge), delivery information
- <g4d-cart> in the header
- Popup: the main action opens the cart when the vendor takes online orders; otherwise an enquiry.
Engine tags this family should use: g4d-action, g4d-tabs, g4d-cart. The home page must contain (as slots/lists): hero.title, hero.cta, groups, items.

### Output rules (read first)
- A **multi-page website** as static files: one `.html` file per page, ONE shared `theme.css`, a `theme.json`, and an `assets/` folder. All pages share the same header and footer markup and the same class names.
- **Plain HTML and CSS only.** No JavaScript at all (no `<script>`, no `onclick`, no framework, no Tailwind CDN, no build step, no React, no Vite, no Next.js). No forms and no `<input>`: the engine draws every form.
- Every picture is a file in `assets/` (webp, jpg, png or svg, each under 1 MB), referred to as `assets/name.webp`. Fonts: only Google Fonts, listed in `theme.json` under `googleFonts`; never an `@import` or `<link>` in a page.
- Wrap each page in `<!doctype html><html lang="en"><body> ... </body></html>`. Put nothing important in `<head>`; the engine writes the head (title, description, canonical, social cards).
- Write normal CSS with class selectors. Use `:root{--g4d-bg:...;--g4d-fg:...;--g4d-muted:...;--g4d-accent:...;--g4d-accent-fg:...;--g4d-surface:...;--g4d-border:...;--g4d-radius:...}` and use those variables everywhere, so the popup, bottom bar and footer match your colours.
- Mobile first. Tap targets at least 44 px. One `<h1>` per page. Text contrast at least 4.5 to 1. Every `<img>` has an `alt`.

### Content comes from slots, never from your words
Do NOT invent the business name, services, prices, doctors, reviews, numbers or addresses. Use slots: `{{site.name}} {{site.tagline}} {{site.logo}} {{hero.title}} {{hero.subtitle}} {{hero.image}} {{about.text}} {{about.image}} {{contact.phone}} {{contact.phoneHref}} {{contact.email}} {{contact.address}} {{hours}} {{terms.items}} {{terms.team}} {{page.title}} {{page.body}}`.
Lists: `<template data-g4d-each="items">` with `{{item.name}} {{item.description}} {{item.price}} {{item.image}} {{item.duration}} {{item.badge}} {{item.href}} {{item.category}} {{item.includes}}`; `groups` (`{{group.name}}`, `{{group.count}}`, `group.items`), `team` (`member.name/role/note/image`), `testimonials` (`testimonial.quote/author`), `faqs` (`faq.q/a`), `gallery` (`image.src/alt`), `steps`, `trust` (`point.text`), `stats`.
Hide a block that has no data with `data-g4d-if="testimonials"` (reviews must always be wrapped like this: sample reviews never show publicly). Show a fallback picture with `data-g4d-if-not="hero.image"`.
Use the engine's parts by tag, and style the boxes around them: `<g4d-action class="btn" label="..." item="{{item.id}}">` (the main action), `<g4d-header-nav class="nav">`, `<g4d-footer variant="columns">`, `<g4d-bottom-nav>`, `<g4d-social>`, `<g4d-hours variant="card">`, `<g4d-map height="380">`, `<g4d-tabs for="groups" tab-class="tab" panel-class="panel"><template>...</template></g4d-tabs>` and `<g4d-cart>`. **Leave the popup and the mobile bottom navigation to these tags. Do not build your own.**
Links between pages are plain: `href="about.html"`, `href="services.html"`, home is `href="/"`. An item card links to `href="{{item.href}}"`.

### Design direction
Modern, current UI: large confident type (a display face plus a clean text face), generous white space, strong section rhythm, real photography for the industry (large images, never gradient boxes standing in for pictures), subtle depth, a restrained palette with one accent. Mobile first and fast. Original artwork only.

### Manifest to fill (`theme.json`)
Replace the values: `id` (lower-case, dashes), `name`, `version` (1), `author`, `description`, `families`, `categories`, `pages` (slug, template, title, navLabel), `itemsPage`, `googleFonts`, `colors` (bg, fg, muted, accent, accentFg as #hex).

### Before you deliver
Run `node scripts/theme/lint.mjs <folder>` (it needs no install other than backend-api's) and fix every FAIL and as many WARN lines as you can. Deliver the folder as a zip with `theme.json` at the top.
```

### Make four different designs for this family
If asked for four, produce **four separate theme folders** for shop and cart (`<family>-one` to `<family>-four`, four different `id`s, all with `"families": ["shop"]` and the same categories). They must differ in structure, not only colour: a different hero (full-bleed image, split, centred text, card over image), a different grid style (cards, rows, mosaic, editorial), a different section order, a different header (bar, centred logo, minimal with large type) and a different type pairing. Each must pass the lint on its own.

### Listings (real estate) (family `listings`)

Categories this family serves: realestate.

```text
Build a complete, modern, multi-page WEBSITE THEME for a listings (real estate) business (realestate). Not a single landing page: it must have these pages, all sharing one header, one footer and one theme.css: home, properties, about, contact, page, item.
The main listing page is properties.html. The thing being listed is a property. People shown: agents.

SIGNATURE SECTIONS AND FLOW
- Search-style hero with filters (use <g4d-tabs> for property types)
- Property cards (location, area, bedrooms, price)
- Map and amenities on the property page
- Site-visit action ("Schedule a visit")
- Agent profile (team)
- Popup steps: choose a property, pick a visit date, your details, confirm.
Engine tags this family should use: g4d-action, g4d-tabs, g4d-map. The home page must contain (as slots/lists): hero.title, hero.cta, items, team, gallery.

### Output rules (read first)
- A **multi-page website** as static files: one `.html` file per page, ONE shared `theme.css`, a `theme.json`, and an `assets/` folder. All pages share the same header and footer markup and the same class names.
- **Plain HTML and CSS only.** No JavaScript at all (no `<script>`, no `onclick`, no framework, no Tailwind CDN, no build step, no React, no Vite, no Next.js). No forms and no `<input>`: the engine draws every form.
- Every picture is a file in `assets/` (webp, jpg, png or svg, each under 1 MB), referred to as `assets/name.webp`. Fonts: only Google Fonts, listed in `theme.json` under `googleFonts`; never an `@import` or `<link>` in a page.
- Wrap each page in `<!doctype html><html lang="en"><body> ... </body></html>`. Put nothing important in `<head>`; the engine writes the head (title, description, canonical, social cards).
- Write normal CSS with class selectors. Use `:root{--g4d-bg:...;--g4d-fg:...;--g4d-muted:...;--g4d-accent:...;--g4d-accent-fg:...;--g4d-surface:...;--g4d-border:...;--g4d-radius:...}` and use those variables everywhere, so the popup, bottom bar and footer match your colours.
- Mobile first. Tap targets at least 44 px. One `<h1>` per page. Text contrast at least 4.5 to 1. Every `<img>` has an `alt`.

### Content comes from slots, never from your words
Do NOT invent the business name, services, prices, doctors, reviews, numbers or addresses. Use slots: `{{site.name}} {{site.tagline}} {{site.logo}} {{hero.title}} {{hero.subtitle}} {{hero.image}} {{about.text}} {{about.image}} {{contact.phone}} {{contact.phoneHref}} {{contact.email}} {{contact.address}} {{hours}} {{terms.items}} {{terms.team}} {{page.title}} {{page.body}}`.
Lists: `<template data-g4d-each="items">` with `{{item.name}} {{item.description}} {{item.price}} {{item.image}} {{item.duration}} {{item.badge}} {{item.href}} {{item.category}} {{item.includes}}`; `groups` (`{{group.name}}`, `{{group.count}}`, `group.items`), `team` (`member.name/role/note/image`), `testimonials` (`testimonial.quote/author`), `faqs` (`faq.q/a`), `gallery` (`image.src/alt`), `steps`, `trust` (`point.text`), `stats`.
Hide a block that has no data with `data-g4d-if="testimonials"` (reviews must always be wrapped like this: sample reviews never show publicly). Show a fallback picture with `data-g4d-if-not="hero.image"`.
Use the engine's parts by tag, and style the boxes around them: `<g4d-action class="btn" label="..." item="{{item.id}}">` (the main action), `<g4d-header-nav class="nav">`, `<g4d-footer variant="columns">`, `<g4d-bottom-nav>`, `<g4d-social>`, `<g4d-hours variant="card">`, `<g4d-map height="380">`, `<g4d-tabs for="groups" tab-class="tab" panel-class="panel"><template>...</template></g4d-tabs>` and `<g4d-cart>`. **Leave the popup and the mobile bottom navigation to these tags. Do not build your own.**
Links between pages are plain: `href="about.html"`, `href="services.html"`, home is `href="/"`. An item card links to `href="{{item.href}}"`.

### Design direction
Modern, current UI: large confident type (a display face plus a clean text face), generous white space, strong section rhythm, real photography for the industry (large images, never gradient boxes standing in for pictures), subtle depth, a restrained palette with one accent. Mobile first and fast. Original artwork only.

### Manifest to fill (`theme.json`)
Replace the values: `id` (lower-case, dashes), `name`, `version` (1), `author`, `description`, `families`, `categories`, `pages` (slug, template, title, navLabel), `itemsPage`, `googleFonts`, `colors` (bg, fg, muted, accent, accentFg as #hex).

### Before you deliver
Run `node scripts/theme/lint.mjs <folder>` (it needs no install other than backend-api's) and fix every FAIL and as many WARN lines as you can. Deliver the folder as a zip with `theme.json` at the top.
```

### Make four different designs for this family
If asked for four, produce **four separate theme folders** for listings (real estate) (`<family>-one` to `<family>-four`, four different `id`s, all with `"families": ["listings"]` and the same categories). They must differ in structure, not only colour: a different hero (full-bleed image, split, centred text, card over image), a different grid style (cards, rows, mosaic, editorial), a different section order, a different header (bar, centred logo, minimal with large type) and a different type pairing. Each must pass the lint on its own.

### Courses and classes (family `courses`)

Categories this family serves: education, coaching.

```text
Build a complete, modern, multi-page WEBSITE THEME for a courses and classes business (education, coaching). Not a single landing page: it must have these pages, all sharing one header, one footer and one theme.css: home, courses, about, contact, page, item.
The main listing page is courses.html. The thing being listed is a course. People shown: faculty.

SIGNATURE SECTIONS AND FLOW
- Outcome hero with the next batch date and an "Enquire" action
- Course cards with syllabus (item.includes), duration, fees
- Batch calendar and results counters (stats list)
- Faculty cards, FAQ
- Popup steps: choose a course, preferred batch, your details, confirm.
Engine tags this family should use: g4d-action, g4d-tabs. The home page must contain (as slots/lists): hero.title, hero.cta, items, team, stats, faqs.

### Output rules (read first)
- A **multi-page website** as static files: one `.html` file per page, ONE shared `theme.css`, a `theme.json`, and an `assets/` folder. All pages share the same header and footer markup and the same class names.
- **Plain HTML and CSS only.** No JavaScript at all (no `<script>`, no `onclick`, no framework, no Tailwind CDN, no build step, no React, no Vite, no Next.js). No forms and no `<input>`: the engine draws every form.
- Every picture is a file in `assets/` (webp, jpg, png or svg, each under 1 MB), referred to as `assets/name.webp`. Fonts: only Google Fonts, listed in `theme.json` under `googleFonts`; never an `@import` or `<link>` in a page.
- Wrap each page in `<!doctype html><html lang="en"><body> ... </body></html>`. Put nothing important in `<head>`; the engine writes the head (title, description, canonical, social cards).
- Write normal CSS with class selectors. Use `:root{--g4d-bg:...;--g4d-fg:...;--g4d-muted:...;--g4d-accent:...;--g4d-accent-fg:...;--g4d-surface:...;--g4d-border:...;--g4d-radius:...}` and use those variables everywhere, so the popup, bottom bar and footer match your colours.
- Mobile first. Tap targets at least 44 px. One `<h1>` per page. Text contrast at least 4.5 to 1. Every `<img>` has an `alt`.

### Content comes from slots, never from your words
Do NOT invent the business name, services, prices, doctors, reviews, numbers or addresses. Use slots: `{{site.name}} {{site.tagline}} {{site.logo}} {{hero.title}} {{hero.subtitle}} {{hero.image}} {{about.text}} {{about.image}} {{contact.phone}} {{contact.phoneHref}} {{contact.email}} {{contact.address}} {{hours}} {{terms.items}} {{terms.team}} {{page.title}} {{page.body}}`.
Lists: `<template data-g4d-each="items">` with `{{item.name}} {{item.description}} {{item.price}} {{item.image}} {{item.duration}} {{item.badge}} {{item.href}} {{item.category}} {{item.includes}}`; `groups` (`{{group.name}}`, `{{group.count}}`, `group.items`), `team` (`member.name/role/note/image`), `testimonials` (`testimonial.quote/author`), `faqs` (`faq.q/a`), `gallery` (`image.src/alt`), `steps`, `trust` (`point.text`), `stats`.
Hide a block that has no data with `data-g4d-if="testimonials"` (reviews must always be wrapped like this: sample reviews never show publicly). Show a fallback picture with `data-g4d-if-not="hero.image"`.
Use the engine's parts by tag, and style the boxes around them: `<g4d-action class="btn" label="..." item="{{item.id}}">` (the main action), `<g4d-header-nav class="nav">`, `<g4d-footer variant="columns">`, `<g4d-bottom-nav>`, `<g4d-social>`, `<g4d-hours variant="card">`, `<g4d-map height="380">`, `<g4d-tabs for="groups" tab-class="tab" panel-class="panel"><template>...</template></g4d-tabs>` and `<g4d-cart>`. **Leave the popup and the mobile bottom navigation to these tags. Do not build your own.**
Links between pages are plain: `href="about.html"`, `href="services.html"`, home is `href="/"`. An item card links to `href="{{item.href}}"`.

### Design direction
Modern, current UI: large confident type (a display face plus a clean text face), generous white space, strong section rhythm, real photography for the industry (large images, never gradient boxes standing in for pictures), subtle depth, a restrained palette with one accent. Mobile first and fast. Original artwork only.

### Manifest to fill (`theme.json`)
Replace the values: `id` (lower-case, dashes), `name`, `version` (1), `author`, `description`, `families`, `categories`, `pages` (slug, template, title, navLabel), `itemsPage`, `googleFonts`, `colors` (bg, fg, muted, accent, accentFg as #hex).

### Before you deliver
Run `node scripts/theme/lint.mjs <folder>` (it needs no install other than backend-api's) and fix every FAIL and as many WARN lines as you can. Deliver the folder as a zip with `theme.json` at the top.
```

### Make four different designs for this family
If asked for four, produce **four separate theme folders** for courses and classes (`<family>-one` to `<family>-four`, four different `id`s, all with `"families": ["courses"]` and the same categories). They must differ in structure, not only colour: a different hero (full-bleed image, split, centred text, card over image), a different grid style (cards, rows, mosaic, editorial), a different section order, a different header (bar, centred logo, minimal with large type) and a different type pairing. Each must pass the lint on its own.

### Portfolio and gallery (family `portfolio`)

Categories this family serves: photography, freelancer, construction.

```text
Build a complete, modern, multi-page WEBSITE THEME for a portfolio and gallery business (photography, freelancer, construction). Not a single landing page: it must have these pages, all sharing one header, one footer and one theme.css: home, portfolio, about, contact, page, item.
The main listing page is portfolio.html. The thing being listed is a project or package. People shown: photographers, designers.

SIGNATURE SECTIONS AND FLOW
- Immersive gallery hero
- Category tabs (<g4d-tabs>) over the gallery or projects
- Packages (items), story, client stories (hidden when none)
- A "Book a session" or "Start a project" action
- Popup steps: what kind of work, date, your details, confirm.
Engine tags this family should use: g4d-action, g4d-tabs. The home page must contain (as slots/lists): hero.title, hero.cta, gallery, items, testimonials.

### Output rules (read first)
- A **multi-page website** as static files: one `.html` file per page, ONE shared `theme.css`, a `theme.json`, and an `assets/` folder. All pages share the same header and footer markup and the same class names.
- **Plain HTML and CSS only.** No JavaScript at all (no `<script>`, no `onclick`, no framework, no Tailwind CDN, no build step, no React, no Vite, no Next.js). No forms and no `<input>`: the engine draws every form.
- Every picture is a file in `assets/` (webp, jpg, png or svg, each under 1 MB), referred to as `assets/name.webp`. Fonts: only Google Fonts, listed in `theme.json` under `googleFonts`; never an `@import` or `<link>` in a page.
- Wrap each page in `<!doctype html><html lang="en"><body> ... </body></html>`. Put nothing important in `<head>`; the engine writes the head (title, description, canonical, social cards).
- Write normal CSS with class selectors. Use `:root{--g4d-bg:...;--g4d-fg:...;--g4d-muted:...;--g4d-accent:...;--g4d-accent-fg:...;--g4d-surface:...;--g4d-border:...;--g4d-radius:...}` and use those variables everywhere, so the popup, bottom bar and footer match your colours.
- Mobile first. Tap targets at least 44 px. One `<h1>` per page. Text contrast at least 4.5 to 1. Every `<img>` has an `alt`.

### Content comes from slots, never from your words
Do NOT invent the business name, services, prices, doctors, reviews, numbers or addresses. Use slots: `{{site.name}} {{site.tagline}} {{site.logo}} {{hero.title}} {{hero.subtitle}} {{hero.image}} {{about.text}} {{about.image}} {{contact.phone}} {{contact.phoneHref}} {{contact.email}} {{contact.address}} {{hours}} {{terms.items}} {{terms.team}} {{page.title}} {{page.body}}`.
Lists: `<template data-g4d-each="items">` with `{{item.name}} {{item.description}} {{item.price}} {{item.image}} {{item.duration}} {{item.badge}} {{item.href}} {{item.category}} {{item.includes}}`; `groups` (`{{group.name}}`, `{{group.count}}`, `group.items`), `team` (`member.name/role/note/image`), `testimonials` (`testimonial.quote/author`), `faqs` (`faq.q/a`), `gallery` (`image.src/alt`), `steps`, `trust` (`point.text`), `stats`.
Hide a block that has no data with `data-g4d-if="testimonials"` (reviews must always be wrapped like this: sample reviews never show publicly). Show a fallback picture with `data-g4d-if-not="hero.image"`.
Use the engine's parts by tag, and style the boxes around them: `<g4d-action class="btn" label="..." item="{{item.id}}">` (the main action), `<g4d-header-nav class="nav">`, `<g4d-footer variant="columns">`, `<g4d-bottom-nav>`, `<g4d-social>`, `<g4d-hours variant="card">`, `<g4d-map height="380">`, `<g4d-tabs for="groups" tab-class="tab" panel-class="panel"><template>...</template></g4d-tabs>` and `<g4d-cart>`. **Leave the popup and the mobile bottom navigation to these tags. Do not build your own.**
Links between pages are plain: `href="about.html"`, `href="services.html"`, home is `href="/"`. An item card links to `href="{{item.href}}"`.

### Design direction
Modern, current UI: large confident type (a display face plus a clean text face), generous white space, strong section rhythm, real photography for the industry (large images, never gradient boxes standing in for pictures), subtle depth, a restrained palette with one accent. Mobile first and fast. Original artwork only.

### Manifest to fill (`theme.json`)
Replace the values: `id` (lower-case, dashes), `name`, `version` (1), `author`, `description`, `families`, `categories`, `pages` (slug, template, title, navLabel), `itemsPage`, `googleFonts`, `colors` (bg, fg, muted, accent, accentFg as #hex).

### Before you deliver
Run `node scripts/theme/lint.mjs <folder>` (it needs no install other than backend-api's) and fix every FAIL and as many WARN lines as you can. Deliver the folder as a zip with `theme.json` at the top.
```

### Make four different designs for this family
If asked for four, produce **four separate theme folders** for portfolio and gallery (`<family>-one` to `<family>-four`, four different `id`s, all with `"families": ["portfolio"]` and the same categories). They must differ in structure, not only colour: a different hero (full-bleed image, split, centred text, card over image), a different grid style (cards, rows, mosaic, editorial), a different section order, a different header (bar, centred logo, minimal with large type) and a different type pairing. Each must pass the lint on its own.

## How to turn a Bolt export into a theme

Some tools can only give you a React project (a `package.json`, a `src` folder, `.tsx` files). The platform cannot use that, because a theme is filled with each vendor's content on the server and cannot run scripts. You do not have to start again:

1. **Ask the same tool again, in the same chat**, with this sentence: *"Export this design as static HTML and CSS only: one .html file per page, one theme.css, an assets folder for pictures, no JavaScript, no framework, no build step. Use the slot and tag contract I give you."* Then paste the "Content comes from slots" and "Output rules" parts of the prompt for the family.
2. If it still gives a project, open the page in the tool's preview, and ask it for **"the final rendered HTML of each page and the compiled CSS in one file"**. Save each page as `home.html`, `about.html` and so on; save the CSS as `theme.css`.
3. Replace the words with slots: the business name becomes `{{site.name}}`, the headline `{{hero.title}}`, and a repeated group of cards becomes one `<template data-g4d-each="items">` with one card inside. Ask the tool to do this: *"Replace every piece of business text with the slots, and turn repeated cards into data-g4d-each lists."*
4. Replace the booking or contact form and the mobile menu with the engine tags (`<g4d-action>`, `<g4d-bottom-nav>`).
5. Run `node scripts/theme/lint.mjs <folder> --fix`, then without `--fix`, and follow the plain sentences until it says "no problems". Then upload.
