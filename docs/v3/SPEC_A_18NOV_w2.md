# Theme package specification, version 1

For the team that builds themes and for the admin who uploads them. A theme package is **a zip**. The platform checks it, stores it, and (after an admin publishes it) draws vendor sites with it, with no developer and no redeploy. This is the theme kit's own package format (`themes/lib/pack.mjs`, contract `themes/CONTRACT.md`) plus one optional block in `theme.json` called `marketplace`. There is no second format.

Machine schema: `themes/schema/theme.schema.json` (generated from `themes/lib/schema-build.mjs`, a test fails if the file and the code differ). Backend rules: `backend-api/src/v3-theme-market/core/theme-package-core.ts`. Tests: `themes/test/marketplace-manifest.test.mjs`, `backend-api/test/theme-package-core.spec.ts`.

An uploaded theme is **untrusted input**. Nothing in it is ever run, extracted to disk, or fetched.

## 1. File layout (allow-list: anything else is refused)

```
theme.json                      required   the manifest (section 2)
templates/home.html             required   page templates, one per page type (section 4)
templates/<page>.html           optional   about services gallery contact page item menu packages properties courses doctors portfolio
css/base.css                    required   layout (at most 40 KB)
css/tokens.css                  required   the design tokens (colour, type, radius)
css/motion.css                  required   animation (at most 6 KB, must honour reduced motion)
css/print.css                   required   print rules
presets/<kit-category>.json     optional   per business type colours, fonts, copy defaults
assets/<file>.png|jpg|jpeg|webp|svg|woff2   optional   pictures and fonts the theme ships
assets/previews/<name>.png|jpg|jpeg|webp    optional   preview pictures named in marketplace.previews
```

No other file type is accepted: no `.js`, no `.html` outside `templates/`, no `.php`, no executable of any kind, no zip inside the zip, no symbolic link, no hidden file.

## 2. Manifest (`theme.json`)

Fields the kit already defines (unchanged):

| Field | Rule |
|---|---|
| `id` | the theme **key**: lower case letters, digits and single hyphens, 3 to 40 characters. Unique per marketplace; never changes |
| `version` | integer, 1 or more. A new upload of the same `id` needs a higher version than every stored one |
| `name` | 2 to 80 characters |
| `description` | up to 400 characters |
| `author` | up to 80 characters |
| `tier` | `Standard` or `Premium` (a price class, not a plan; a theme has no price of its own) |
| `tracks` | `handyman`, `professional`, `ecommerce` (at least one) |
| `families`, `categories` | kit families and the **kit** category ids the theme has designs for (41 ids). A package names at least one |
| `layoutVariantRules`, `motion`, `settingsSchema`, `fonts` | as in the kit contract; fonts only from the approved list (the platform self-hosts them) |
| `assets`, `contentHash` | filled by the pack step: every file under `assets/` with size and sha256, and the hash of the whole package |

The `marketplace` block (new, optional for the kit, **required** to upload to the marketplace):

| Field | Rule |
|---|---|
| `packs` | 1 to 16 industry pack keys: PROPERTY, CLINIC, LAB, PHARMACY, RETAIL, FOOD_SERVICE, FIELD_SERVICE, VEHICLE_SERVICE, LOGISTICS, MEMBERSHIP_WELLNESS, EDUCATION, PRACTICE_LEGAL_FINANCE, AGENCY_CONSULTING, HOSPITALITY_EVENTS, RENTAL_FLEET, B2B_DEALER. The theme must declare the track each pack is drawn on |
| `addons` | add-on packs the theme also draws: SHOP, ONLINE_ORDERING_DELIVERY, PHARMACY_COUNTER, HOME_SAMPLE_COLLECTION |
| `capabilities` | capability keys the theme also draws (SERVICES, APPOINTMENTS, MEMBERSHIPS, LISTINGS, BROKERAGE, RENTALS, MADE_TO_ORDER, DISPATCH, DELIVERY, PHARMACY, LAB, FOOD_SERVICE, VEHICLE_RENTAL, STORE) |
| `tags` | combination tags, from the list in `COMBINATION_TAGS` (data): `service-plus-shop`, `handyman-plus-shop`, `vehicle-service-plus-shop`, `cloud-kitchen-plus-delivery`, `restaurant-plus-delivery`, `shop-plus-delivery`, `clinic-plus-pharmacy`, `clinic-plus-lab`, `clinic-pharmacy-lab-home-sample`, `lab-plus-home-sample`, `pharmacy-plus-delivery`, `wellness-plus-shop`, `education-plus-shop`, `hospitality-plus-shop`. A tag is only accepted when the theme lists one of its packs and every add-on and capability the tag needs |
| `catalogueCategories` | ids from the **196-category catalogue** the theme is for; each must belong to one of the listed `packs`. (The kit ids in `categories` are what the renderer uses; these are what vendors pick at registration.) |
| `previews` | up to 6 `{ path, alt, page }`: `path` is `assets/previews/<name>.png/.jpg/.webp` and must exist in the package; an SVG is never a preview |
| `licence` | 3 to 300 characters, a plain note on who may use the theme. Not legal wording |
| `starter` | `true` for a starter theme built by the Get4Domain team; it is said honestly in the listing |
| `sourceVendorId` | `null` or absent for a marketplace theme. For a theme made for one customer it is that vendor's id, **set by the upload route**; a package that names a different business is refused |

Not allowed in the block (the shape is closed): any price, discount, offer, rating, review, count or ranking field. A theme has no price; the only charge is the existing wallet-paid switch fee.

## 3. Rules every package must pass

1. **Zip safety (kit):** at most 5 MB, 400 files, 1 MB per file; no path with `..`, an absolute path or a backslash; no duplicate path; no symbolic link; no file that expands more than 50 times (zip bomb); no executable by extension or by its first bytes.
2. **Allow-list (kit):** only the layout in section 1. A raster picture must really be that type; an SVG may not hold a script, an event handler, `foreignObject`, an animation element, a `javascript:` address, an outside address or an embedded object.
3. **Manifest (kit):** the schema above, the asset list equals the files, the content hash equals the content.
4. **Marketplace (backend):** every name in the block is real, every tag is coherent, the theme is designed for the track each pack is drawn on, every preview exists, the source vendor is right, the package is not marked internal.
5. **Content-free (backend):** no e-mail address, no phone number, no outside address (only the platform's own, the map hosts and the video hosts) in `theme.json` or a template. Use the placeholders (`{{contact.phone}}`). For a theme made for one customer that is later published: the vendor's name, domain, phone, e-mail and any of the vendor's own media files (by hash) may not appear (M4).
6. **Lint (kit, 40 rules, every template rendered for every category):** no `<script>`, no inline event handler, no `<style>` or `<link>` to outside, no outside request, iframe hosts allow-listed, approved fonts only, contrast, landmarks, one `h1`, skip link, form labels, alt text, touch targets, reduced motion, all required platform slots present and reserving space, no SEO output of its own.

A rule that fails reports **the file and the rule name**, for example `templates/home.html [no-script-tag]`. Every problem is reported at once, not one at a time. Rejection text never repeats file content.

## 4. The template language the renderer supports

Plain HTML plus the kit's placeholders. The renderer escapes every value (`esc`, `safeUrl`) and is a pure function: no network, no file access, no clock, no randomness. Full list: `themes/lib/vocabulary.mjs` and `themes/CONTRACT.md`.

- **Scalars:** `{{site.name}}`, `{{hero.title}}`, `{{about.text}}`, `{{contact.phone}}`, `{{hours}}`, `{{social.*}}`, `{{ui.*}}` (platform wording in English and Tamil), `{{cta.label}}` and the rest of the list in the contract.
- **Lists:** `<template data-g4d-each="items">...{{item.name}}...</template>` for `items groups team testimonials faqs gallery steps trust stats pages areas credentials blocks products offers`; each loop also gives `n`, `featured`, `shown`, `initial`.
- **Conditions and sections:** `data-g4d-if`, `data-g4d-if-not`, `data-g4d-section` (a vendor may hide or reorder a section where the theme allows it), `data-g4d-optional`.
- **Platform slots** (custom elements the platform fills, never the theme): `g4d-action g4d-header-nav g4d-bottom-nav g4d-footer g4d-hours g4d-tabs g4d-map g4d-social g4d-cart g4d-enquiry-form g4d-whatsapp-float g4d-reviews g4d-video g4d-booking g4d-product-grid g4d-search g4d-claim-banner g4d-listed-on-badge g4d-open-now g4d-share-qr`. A `<g4d-...>` tag that is not in this list is refused. Slots that are calls to action are drawn only when the vendor's plan allows them (a Free site is a listing with none).
- **Design tokens** (in `css/tokens.css`): `--g4d-primary --g4d-primary-contrast --g4d-accent --g4d-bg --g4d-surface --g4d-text --g4d-muted --g4d-border --g4d-radius --g4d-font-heading --g4d-font-body`, and for motion `--g4d-motion-speed --g4d-motion-ease --g4d-motion-distance`.
- **No JavaScript.** The renderer supports no script set, so a theme has none; interaction is CSS and platform slots only.

## 5. Sample content for previews

A package carries **no content**. A preview is drawn by the real renderer from the sample business of the pack (`src/v3-packs/pack-demo/pack-demo-content.json` laid over the kit's sample content for the pack's kit category), with every price field emptied, no offer, no number that could read as a claim, no review. The sample picture placeholders are the renderer's own generated pictures. The preview route (M5) answers HTML with a strict content-security policy and no cookies.

## 6. Lifecycle

`DRAFT` (stored, validated) then `REVIEW` (submitted) then `PUBLISHED` (an ADMIN or SUPER_ADMIN publishes; only now does it appear to vendors) then `ARCHIVED` (no longer offered; vendors already using it keep it until they switch). A new version of the same key is a new row; publishing it archives the previous published version of that key for new choices. A package that fails validation is never stored. Visibility is `PUBLIC` (the marketplace) or `PRIVATE` (one vendor only, M4).

## 7. How the team builds a package

```
cd themes
node cli.mjs lint <folder> --all
node cli.mjs pack <folder>          # fills assets and contentHash, writes the zip
```

Then an admin uploads the zip (`POST /v3/admin/theme-market/themes`, section M2 of the contract). Use `POST /v3/admin/theme-market/validate` first to see every problem without storing anything.
