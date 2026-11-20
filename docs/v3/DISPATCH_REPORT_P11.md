# Dispatch report P11: theme design kit, industry packs, mobile app shell

Branch `v3-pub-fe19` (from `v3-pub-fe18`). Not pushed. No .env read, no staging, no API or backend file changed.

## Built
- `get4domain_mvp/src/lib/v3-public/site-kit/`: packs (derived from all 29 main categories in `data/industry-content.ts`, new ones get a pack automatically), flagship themes (one per pack + safe default), resolver, targets validator, nav, PWA helpers, view model (Free rules), kit CSS and hero art.
- `src/components/site-kit/SiteApp.tsx` (shell, section blocks: hero x5 variants, services x4, gallery x3, reviews, FAQ, pricing, map, contact) and `InstallButton.tsx`.
- Renderer: Free page and the generic (Pro) design now use the kit. `/app-manifest` and `/app-icon` routes per vendor host. Page title for Free `<name> | <real category> | Get4Domain`.
- `docs/v3/THEME_PACKAGE_SPEC.md` (for Bolt), screenshots in `docs/v3/p11-shots/`.

## Pack list and mapping (family = layout)
menu: restaurant. booking: clinic, salon, automobile, diagnostics, petcare, astrology, homeservices. shop: retail, agriculture, printing. packages: travel, gym, events, hotel. enquiry: construction, professional, finance, logistics, movers, pestcontrol, recruitment, government. portfolio: photography, technology, interior. listings: realestate, rentalservices. courses: education, coaching. Safe default: `general` (enquiry layout).
A business without its own theme: industry text goes to the closest pack (id, old name, word match); backend category keys `advocate`, `freelancer` go to professional, `home-services` to homeservices; nothing matches means the default. Example: "Home repair and trades" gives homeservices.

## Targets storage finding (step 4)
- Table is `g4d_theme_packages` (not `..._market_packages`). `manifest` is Json, plus `categories` Json (category-pack keys).
- `validateManifest` copies only known fields: `targets`, `pack`, `track`, `freeMode` are silently dropped, not rejected. Category level is storable today through `categories`; main and sub levels are not.
- Needed (not done): (1) `sanitise.ts` Manifest type and `validateManifest` read and validate the four fields (reuse `validateTargets` messages); (2) `PUT /admin/themes/:id` DTO `targets` (validated against the category data, plus an `isDefault` flag per target group); (3) admin upload and edit screen "Choose targets" field (main, category, sub pickers); (4) a public route listing live themes with targets for the renderer, and the vendor's chosen theme on the site answer. Migration: **no** (manifest JSON holds it). Optional later: an index column if querying by target is slow.

## Tests
`test:v3-public` 607 pass, 0 fail (24 new in `p11.test.ts`: every resolver level and tie-break, packs, shell, install rules, manifest, Free mode by rendering the real components). `tsc` clean, `next build` passes. `scripts/v3-public/p11-shots.mjs` ALL PASSED at 375, 768, 1280 (7 vendors, 7 packs, iOS guide sheet, Android prompt, no button on desktop, manifest, icon). Three existing tests were updated to the new markup (p8, p9, p9b).

## Not done / decisions
- Pro sites of the 20 industries that have a bespoke engine design, and imported package themes, still use their own shell, footers (several say "Powered by Get4Domain") and have no Install button or manifest. Next lane: same footer line, install button and manifest in `engine/shell`.
- `/vendor-site` (V3 relay) shows backend-built HTML; the Free flaws there (category H1, "Hours: Opening hours") need a backend fix. The flaws were fixed on the `/site/[subdomain]` renderer.
- Free: in-page anchor navigation and the Install button are allowed (read "no button links" as no call-to-action links); last tab is "Find us".
- Reviews/FAQ appear only from the vendor's own data; sample ones only in previews. Live pages never show starter service names.
- Old generic Pro page had a demo chatbot and contact form; both removed. Icon is the business initial on the accent colour (no logo image). ESLint is not configured in this folder, so lint was not run.
- Gallery reuses product pictures, so a picture can appear in Services and Gallery.

## API change needed
None made. Needed later: items 1 to 4 above.
