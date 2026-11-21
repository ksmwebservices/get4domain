# UrbanFix to Get4Domain kit theme: conversion report

Input: `C:\Get4Domain\theme-inbox\designs\urbanfix` (`index.html`, `services.html`, `styles.css`, `README.txt`; plain HTML and CSS, DM Sans and Manrope, stock photos and Google Fonts loaded from the internet).
Output package: `C:\Get4Domain\theme-inbox\t01-home-services-urbanfix\` (folder), zip `C:\Get4Domain\theme-inbox\t01-home-services-urbanfix-1.zip` (15,487 bytes, plus `t01-home-services-urbanfix-1.manifest.json` beside it), previews in `C:\Get4Domain\theme-inbox\previews\`.
Authority used: `docs\v3\THEME_VOCABULARY_FOR_DESIGNERS.md` and the kit in `C:\Get4Domain\get4domain-w2\themes` (`CONTRACT.md`, `lib/vocabulary.mjs`, `lib/render.mjs`, `cli.mjs lint`, `cli.mjs pack`). Nothing inside the three repos was edited, nothing was downloaded, `.env` files were not read.

## Package

```
t01-home-services-urbanfix/
  theme.json                 id t01-home-services-urbanfix, v1, Standard, handyman, family home-services, 11 categories,
                             fonts ["DM Sans","Manrope"], motion default Low, settingsSchema all six true
  templates/ home services item about gallery contact page   (all 7 are fragments: no doctype/html/head/body)
  css/ base.css tokens.css motion.css print.css
```

## What was changed to make it a kit theme

1. **Fragments.** The design's two documents became fragments. Each page starts with the skip link, `header` (with the platform header navigation and action slot), `main#main`, then a footer block. The kit wraps the output in `<div class="g4d-theme ...">`, so the design's `body` styles moved to `.g4d-theme`.
2. **Five pages added in the same visual language** (the design had two): `item` (service detail), `about` (story, stats, team, credentials, customer words), `gallery`, `contact`, `page` (free text). `home` and `services` come from the design's `index.html` and `services.html`.
3. **CSS split and scoped.**
   - `css/tokens.css`: design colours mapped to the kit tokens (ink `#17211f` = `--g4d-primary`, green `#176b52` = `--g4d-accent` read through `--g4d-pal-accent` so a vendor can change it, cream `#f7f7f2` = `--g4d-bg`, white = `--g4d-surface`, `#e7e9e2` = `--g4d-border`, radius 24px, Manrope heading, DM Sans body with Noto Sans Tamil behind them). Theme-only extras: mint, sage, lime, orange, panel colours, shadow (`--uf-*`). A full `prefers-color-scheme: dark` block was added (the design had no dark mode). The muted text colour was darkened from `#68736f` to `#5d6b66` so it reaches the 4.5:1 contrast the lint demands.
   - `css/base.css` (about 17 KB): every rule is under `.g4d-theme`; layout, components, breakpoints 900 and 620 px as in the design, plus the platform slot styles under `.g4d-slot--<name>` with reserved space.
   - `css/motion.css`: the three design animations (`rise`, `floatIn`, `float`, renamed `uf-rise`, `uf-float-in`, `uf-float`), a slide-up for the bottom navigation, motion tokens, the `prefers-reduced-motion: reduce` block, and a static mode for `data-motion=off`. No `!important` anywhere. `css/print.css` is new.
   - No external URL, no `@import`, no Google Fonts link. Fonts are only named; the platform self-hosts them.
4. **Data instead of text.** Every business name, phone, e-mail, address, price, area, FAQ, step, picture and tab is now a placeholder or a loop with the correct loop variable:
   - Hero: `{{hero.title}}`, `{{hero.subtitle}}`, `{{site.tagline}}`, `{{hero.badge}}` (floating tag), `{{hero.image}}` with `{{hero.imageAlt}}` over a CSS gradient.
   - Cards: loop `items` (`item.name`, `item.description`, `item.price`, `item.duration`, `item.badge`, `item.href`, `item.initial`). A picture is drawn only for `item.featured` (first three with a picture); every card has a gradient with the item's initial as fallback. Only `item.shown` (first eight) cards are drawn.
   - Steps (`step.n`, `step.title`, `step.desc`), areas (`area.name`), FAQ (`faq.q`, `faq.a`), gallery (`image.src`, `image.alt`, only `image.shown` on the home page), trust strip (`point.n`, `point.text`), credentials (`credential.title`, `credential.detail`), category blocks (`blocks` with nested `block.items`, drawn with `data-block="{{block.key}}"`), stats, team, testimonials.
   - **Service groups and tabs** (rule 7): the services page builds chips and sections from the `groups` loop and the nested `group.items` loop; if a vendor has no groups it falls back to the flat `items` loop. A plumber, an electrician and an AC vendor therefore each get their own groups, services and category blocks (price lists, AMC plans, packages) from their own data.
5. **Invented claims removed** (rule 4): the "4.8/5 ★★★★★" rating, "Trusted by 2,000+ happy homes", the three avatars, "Most booked", "On-time. Every time.", "Verified professionals / Careful work. Clear pricing.", the four strip claims (skilled technicians, upfront estimates, convenient slots, workmanship care), "Sample service network covers..." copy, the fixed prices (299, 249, 499, 899), the "hello@urbanfix.example" and phone, "Illustrative sample prices" notices, and the copyright line "Made for better everyday living". Blocks that remain are driven by data and hidden by `data-g4d-if` when the data is empty.
6. **Platform slots used** (rule 8), each with a `.g4d-slot--<name>` rule that reserves space: header navigation, action (header button, hero, every service card, FAQ), open-now (top bar), bottom navigation, WhatsApp float, enquiry form (styled as the dark contact box), map (inside the areas card), reviews, social links, hours, footer, listed-on badge, share QR, claim banner, booking (services and item pages).
7. **Image budget** (rule 3): the home page draws at most 12 pictures with Free limits (logo 1, hero 1, QR 1, three featured services, about 1, five gallery) and at most 19 with the largest Pro content; the lint rule `image-budget` passes.

## What differs from the original design, and why

| Original | Now | Why |
|---|---|---|
| H1 with the last word in green ("effortless.") | One colour | The title is vendor data; the theme cannot split a sentence. |
| Stock photos (Unsplash) in hero, cards, "how it works", gallery | `{{hero.image}}`, `{{item.image}}`, `{{about.image}}`, `{{image.src}}` over gradients | No external URLs; pictures belong to the vendor. |
| Emoji icons (🛠 ₹ ◷ ♡, 🔧 🚿 ...) | Numbers (`point.n`) and the item's initial | Icons would be invented per business. The tick and pin glyphs remain as decoration. |
| Header links "Services, How it works, Service areas, FAQs" (page anchors) | The platform's fixed menu (Home, Services, About, Gallery, Contact); a CSS-only full-screen menu below 620 px | The `header-nav` slot is drawn by the platform and cannot take custom links. The design had no mobile menu. |
| No bottom bar | The platform bottom navigation (Call, WhatsApp, Directions) fixed to the bottom below 620 px | Owner requirement: bottom navigation in every theme. |
| Section headlines ("Small fixes. Big peace of mind.", "Help is just three steps away.") | Platform words (`{{terms.items}}`, `{{ui.process}}`, `{{ui.faq}}`, `{{ui.gallery}}`, `{{ui.contact}}`) and the city name for the areas section | The contract says a theme never hard-codes visitor-facing words (Tamil). |
| Price table with "Service / Includes / Starting at" headers | Rows from the category `blocks` (price list, packages ...) without fixed column headers | The headers are fixed English words; the block rows are data. The "Includes" column has no equivalent. |
| Hover on buttons and cards also changed `box-shadow` and `background` | Lift (`transform`) kept; shadow drawn by a `::after` layer whose opacity fades, brightening by `filter` | The lint allows only `transform`, `opacity`, `clip-path`, `filter` to animate. The look is the same, the colour change is a brightness change. |
| `html{scroll-behavior:smooth}` | Dropped | Rules must live under `.g4d-theme`. |
| `prefers-reduced-motion` rule with `!important` | Same effect without `!important` | `css-hygiene` forbids it. |
| Step numbers "01 02 03" | "1 2 3" | `step.n` is a plain number. |
| Contact box with fixed prices and a "Call to book" button | The platform enquiry form (name, phone, message, consent) | The platform draws the form; it posts to `/enquire`. |
| Hero note "Verified professionals" | The first `credentials` entry (title and detail), clipped to one | Only real vendor data may appear. |
| Dark mode: none | Added | Contract requires a dark block when tokens are used. |
| Category presets | None shipped | Not needed to pass; vendors fall back to the kit defaults. |

## Lint result

Command, from `C:\Get4Domain\get4domain-w2\themes`: `node cli.mjs lint "C:/Get4Domain/theme-inbox/t01-home-services-urbanfix" --all-categories`.

- **40 rules checked: 38 passed, 2 failed.**
- Failed 1: `manifest-valid`, `theme.json:contentHash` is empty. Expected: `pack` computes it. The pack step printed `contentHash 1a337970078fb6976e94da5debd3d8aa36e0db8333dcf3562c6cf5450270268d`; it is written into the manifest next to the zip, not into the folder's `theme.json`, so the lint on the folder still reports it.
- Failed 2: `slots-required`, `product-grid` is not placed. It is demanded only for the 8 Ecommerce categories that `--all-categories` adds. On the theme's own 11 categories only `manifest-valid` fails (**39 passed, 1 failed**).
- Not run: `--browser` (rule `responsive-browser`, needs Playwright).

Pack: `node cli.mjs pack <folder> --out C:/Get4Domain/theme-inbox` ran without errors and wrote the zip and the manifest only into `theme-inbox`.

Fixes made on the way (so the next reader knows what the lint taught): the button hover shadow and the clipped note list were first drawn with `opacity: 0` and `display: none` on hero elements, which `hero-visible` rejects; they were rewritten with `filter: drop-shadow` and a fixed-height clipped list. The `claim-banner` slot needed a reserved size.

## Previews

Static HTML with the theme CSS inlined, made with the kit renderer (`renderPage` + `pageDocument`) and its sample content, English, all plan features on:

- `C:\Get4Domain\theme-inbox\previews\urbanfix-plumber.html` (home)
- `C:\Get4Domain\theme-inbox\previews\urbanfix-ac.html` (home, ac-appliance-repair)
- `C:\Get4Domain\theme-inbox\previews\urbanfix-pest.html` (home, pest-control)
- `C:\Get4Domain\theme-inbox\previews\urbanfix-plumber-services.html` (services page, plumber)

The renderer reported no warnings on any of them and left no `{{` behind. Notes on what the previews show: pictures are the kit's placeholder drawings (inline SVG); the share-QR image points at `/_qr.svg`, which only exists on a live host, so it shows broken when opened from disk; the enquiry form cannot submit from a file; the reviews box shows the kit's labelled sample reviews ("Sample", 4.7 from 128), which are fixture data, not theme text. I opened none of them in a browser.

## Engine gaps (what the theme cannot do today)

1. **Service request popup with the service pre-selected.** The `action` slot ignores its surroundings: it draws one link whose text is its `label` attribute or the global call-to-action label and whose address is the global `cta.href` (`lib/render.mjs:333-337`). It cannot take an item, so every "Book now" on every card goes to the same place, and nothing opens a popup. The `booking` slot is one fixed "Request a booking" link to `/book` (`render.mjs:408`). Needed: an action slot (or placeholder) that carries the item id/name into the enquiry form, and a CSS-only `:target` dialog or a slot for it. The enquiry form has no "service" field either.
2. **Five-item bottom navigation.** The `bottom-nav` slot draws exactly three fixed items: Call, WhatsApp, Directions, and drops any whose data is missing (`render.mjs` case `bottom-nav`). A theme cannot add Home, Services, Enquire or Menu. Needed: a slot option for the item list (Home, Services, Call, WhatsApp, Enquire) driven by the pages and contact data.
3. **Install button.** No slot, no script allowed, no manifest link. The renderer has no install or PWA element at all. Needed: a platform slot (for example `g4d-install`) and a per-vendor web app manifest served by the platform.
4. **Chatbot.** No slot. The only chat-like element is the WhatsApp float. Needed: a `g4d-chat` slot and the saved-conversation backend (owner requirement, Pro).
5. Smaller gaps found while converting:
   - No allowed word for "Service areas" or "Hours" headings (`ui.areas` exists in the renderer's dictionary but is not an accepted binding), so the areas heading shows the city name.
   - The header navigation menu is a fixed list; no anchors or extra links.
   - The `tabs` slot only stacks one panel per group (no switching); the theme uses chips with anchors instead.
   - No way to format `step.n` as "01", and no per-item alt text field (the item name is used).
   - Share-QR image path `/_qr.svg` is relative to the host; a file preview cannot show it.
   - `product-grid` placement is flagged only because `--all-categories` includes Ecommerce.

## Housekeeping note

While working I saw that `git status` in `get4domain-pub` shows `docs/v3/THEME_PACKAGE_SPEC.md` as deleted. I did not touch it; it was already so, or another session did.
