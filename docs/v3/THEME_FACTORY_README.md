# Theme Factory README
Goal: one distinct, premium, responsive theme plus a default content pack for each vendor type, so the admin team only changes the client's own details.

Per pack (folder packs/<family>/<type>, mirror the structure of route-board-travels): theme.json (kit SPEC A with marketplace block), templates (home, services, item, about, gallery, contact, page, plus a list page per item kind), css (base under 40KB, tokens, motion under 6KB, print), assets (original SVG art only), content.json (default content pack).

Design rules:
1. Distinct identity for the type: palette, type, hero scene and layout specific to that trade. A dentist, a skin doctor, a mechanic and a garage must not look alike.
2. Hero variants: A animated or cartoon-style scene, B banner image with a service-link row under the headline that falls back to scene. No video.
3. Mobile app feel: S1 shell, five-item bottom nav, 44px touch targets, install button, WhatsApp float, no horizontal scroll. Check at 360, 768 and 1280 widths.
4. Every item (service, product, property, project, treatment, course, vehicle) gets a full landing page from the item template: headline, summary, details, highlights, gallery, FAQ, price or enquiry, related items, enquiry carrying the item. Never an overview only.
5. About and Contact: owner name, organisation, address, Google Map slot (mandatory), WhatsApp, phone, hours, area served, branches.
6. SEO, AEO and GEO: one h1 with vendor name, town and main service; placeholders for vendor name, owner, town, area and branches; FAQ block for answer engines; canonical to the vendor subdomain; at least 3 wording variants for each default paragraph so many vendors do not share identical text.
7. Default content pack (content.json): services, treatments or property types, indicative "from" prices in INR at plausible market rates marked indicative, FAQs, trust points, default headline and banner text. Never invent testimonials, awards, licence numbers or facts about real businesses. Vendor edits only: logo, banner, poster, images, names, phone, map link.
8. Handyman types (individual, door-step): call-first, areas served, quick quote. Professional types (shop, firm, clinic, garage): team, credentials, booking.
9. Lint green with no waivers: one h1, image budget, touch targets, no !important, 4.5:1 contrast, text stretch, hero visible, slots reserve space.

---

# Working notes added by the factory (the text above is the owner's and is not edited)

## Which document wins
`themes/CONTRACT.md` plus `lint` and `validate-package` are the spec ("kit SPEC A"). Where the text above and the kit disagree, the kit wins. The disagreements found so far, and what the factory does:

| Rule above | Kit says | Factory does |
|---|---|---|
| content.json inside the pack folder | a package may only hold `theme.json`, `templates/`, `css/`, `presets/`, `assets/`; `validate-package` refuses any other file (`unknown-file`) | `content.json` lives in the pack folder (`packs/<family>/<type>/content.json`) but is left out of the zip. `packs/_tools/stage.mjs` copies the theme files to a staging folder, and lint, pack and validate-package run on that copy. |
| install button | no script, no form or input; no install slot exists | The theme styles the platform's `g4d-bottom-nav` and `g4d-action` slots. The install button itself is a platform feature, not something a theme can draw. Recorded in the ledger notes as "install: platform". |
| five-item bottom nav | the `g4d-bottom-nav` slot is drawn by the platform with three items (call, WhatsApp, directions); a theme only styles it | The theme styles the bar as a fixed app bar with 64px targets. Five items need a platform change. Recorded in the ledger notes as "bottom nav: platform, 3 items". |
| list page per item kind | extra page templates are limited to `menu packages properties courses doctors portfolio` | The list page for each kind uses the closest of those names (for example `portfolio` for projects, `properties` for property listings, `packages` for plans). |
| per-item gallery, FAQ, related items | the `item` template binds one `item.*`; `faqs`, `steps`, `gallery` and `items` are page-level lists | The item template draws the item's own fields plus the page-level lists; related items are the other items of the same group. |
| Google Map slot | `<g4d-map>` is a platform slot, required in every theme | Placed on home, about and contact, with a CSS rule that reserves its size. |
| presets | optional, but a theme with any preset needs one for every category it lists | Packs ship no presets (the pack itself is the preset). |

## Added rules
- The animated hero scene must be visible on the first screen at 360 and at 1280 for every pack (the first-screen preview images `assets/previews/home-360.png` and `home-1280.png` must show the moving subject, not only sky or empty space). Use a split or overlapping hero; a centred hero that pushes the scene below the headline is not allowed. If the headline is long, cap the scene height so the subject sits inside 800px at 1280.
- The ledger records, for each pack, the wall-clock start (date and HH:MM) and the push time (HH:MM).

## Pack folder
```
packs/<family-id>/<type-id>/
  theme.json  templates/  css/  assets/        the theme (this part is zipped)
  content.json                                 the default content pack (not zipped)
  pack.mjs                                     the design spec the generator reads (palette, type, scene, labels, content)
```
`<family-id>` and `<type-id>` are kebab-case (for example `real-estate-property/builder-developer`). The theme id in `theme.json` is unique across the repo.

Tools (plain Node, no dependencies, in `packs/_tools/`): `gen.mjs` writes the theme files from `pack.mjs`; `stage.mjs` makes the clean copy; `check.mjs` runs lint (only the categories the pack lists, never `--all-categories`), pack, validate-package, the content.json check and the three-width screenshots, one step at a time (never two heavy commands in parallel).

## content.json schema (`g4d-pack-content/1`)
Plain JSON, UTF-8, no comments. Kept simple so an importer can be written later.

```
{
  "schema": "g4d-pack-content/1",
  "type": "builder-developer",
  "family": "real-estate-property",
  "kitCategories": ["real-estate-agent"],
  "language": "en",
  "placeholders": { "vendor_name": "...", "owner": "...", "town": "...", "area": "...", "branches": "...", "phone": "..." },
  "seo": { "title": [v1, v2, v3], "description": [v1, v2, v3] },
  "hero": { "title": [v1, v2, v3], "subtitle": [v1, v2, v3], "bannerText": [v1, v2, v3], "serviceLinks": ["item-slug"] },
  "cta": { "label": "...", "secondary": "..." },
  "about": { "title": "...", "text": [v1, v2, v3] },
  "groups": [ { "slug": "...", "name": "..." } ],
  "items": [ {
    "slug": "...", "name": "...", "group": "group-slug",
    "summary": [v1, v2, v3], "description": [v1, v2, v3],
    "priceFrom": { "amount": 0, "unit": "per visit", "currency": "INR", "indicative": true },
    "highlights": ["..."], "details": [ { "label": "...", "value": "..." } ],
    "faqs": [ { "q": "...", "a": [v1, v2, v3] } ],
    "related": ["item-slug"]
  } ],
  "blocks": [ { "key": "...", "title": "...", "items": [ { "title": "...", "detail": "...", "price": "..." } ] } ],
  "faqs": [ { "q": "...", "a": [v1, v2, v3] } ],
  "trust": ["..."],
  "steps": [ { "title": "...", "desc": "..." } ],
  "team": [ { "name": "...", "role": "...", "note": "..." } ],
  "credentials": [ { "title": "...", "detail": "..." } ],
  "areas": ["[[area]]"],
  "contact": { "hours": "...", "areaServed": "...", "branches": "[[branches]]" },
  "notes": "free text for admins"
}
```
`priceFrom` is `null` for "enquire for a quote". Strings may use `[[placeholder]]` tokens (never double curly braces, which are the template syntax). The check enforces: every paragraph field shown as `[v1, v2, v3]` has at least three different variants; every price is `indicative: true`; no testimonial, award or licence-number field; every `related` and `hero.serviceLinks` slug exists; every item has at least 2 highlights, 2 details and 2 FAQs.

## Look signature
No two packs may share both palette hue family and hero layout. `pack.mjs` declares `look: { hue, heading, body, hero, card, header }` and `check.mjs` compares it with every other pack.
