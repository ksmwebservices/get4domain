# Industry designs (dispatch of 15 Oct 2026)

Every industry category has its own four designs, each built for how that kind of business is used (a clinic is not a shop is not a tour operator). A new website starts complete, with starter content that is clearly sample. Progress and decisions: `INDUSTRY_DESIGNS_PROGRESS.md`. What was wrong before: `evidence/industry-designs/AUDIT.md`.

## The model in one picture

- **Flow family**: 8 of them (shop and cart, booking and appointment, enquiry and services, packages and tours, menu and orders, portfolio and gallery, listings, courses and classes). A family decides the homepage section order, the navigation, what visitors do first, what an item looks like, the search-engine type and the four design templates. Code: `backend-api/src/site-doc/families.ts`.
- **Category**: one of 24 (the 20 launch industries, plus freelancer, home services, advocate and a general fallback; the older LeadSpace names such as `salon-beauty` or `tutor` are keywords of the same category). A category is a **pack** (a row in `g4d_category_packs`) that names its family, holds its four **designs** and its **starter content**. Adding a category is adding a pack in Admin, never code.
- **Design**: data inside the pack: an ordered list of sections, each with a layout, plus a theme (colours, shared with the older themes), a heading font, a corner radius, a button shape, a navigation style, a footer style and a mobile action bar. The four designs of a category differ in sections, layouts, navigation, footer and action bar, not only in colour.
- **Section library**: 17 section types with 3 or more layouts each (hero 5, announcement bar, trust strip, items in 14 layouts for products, packages, menus, services, projects and listings, about, pricing, process, stats, team, gallery, before and after, customer quotes, questions, working hours, enquiry, contact, call to action). Code: `get4domain_mvp/src/engine/kit/` (`design-sections.tsx`, `design-client.tsx`, `sections.tsx`). Only the product filter, the tabbed menu and the before/after slider run script; everything else is plain HTML.
- **The builder**: `get4domain_mvp/src/engine/sitedoc/design-build.ts` turns the vendor's own site and the active design into the page. It writes no business text. An empty field hides its section.

## Starter content

When a site is created (an admin creates one, or a vendor picks a category and enters company details), the category's starter content is copied **into the vendor's own site**: headline, sub-line, About, tagline, button label, an announcement, trust points, three questions, how-it-works steps, 6 to 8 items with sample descriptions and sample prices, 2 or 3 sample customer quotes, a hero picture and four gallery pictures. Every part is marked **sample** until the vendor changes it.

- **Sample text may show.** **Sample prices and sample customer quotes never reach the public page**: the server removes a sample price from the product data (the page says "Contact for price") and drops sample quotes; the pack's starter content itself never leaves the server. A site that still shows only starter text is `noindex`, has a closed `robots.txt` and an empty `sitemap.xml`.
- **Never overwrites an edit.** The server, not the browser, decides which parts are still sample: changing a field takes it off the list at once, even if a browser sends the old marks back. "Reset to starter" fills only what is empty or still sample, and adds items only when the vendor has none.
- **No invented facts.** Numbers (years, counts), team members and named customers are never seeded. Those sections appear only when the vendor adds them.
- **Pictures** are our own artwork (gradients, shapes and one outline icon from the Lucide icon set, ISC licence), made by `scripts/industry-designs/seed-images.js`, cleaned by the shared upload service's step, stored in `get4domain_mvp/public/starter/` with the licence in `LICENCE.md`. Vendors replace them with their own photographs.

## Website Manager (vendor)

New tabs: **Page content** (headline, sub-line, button label, announcement bar, trust points, questions, steps, numbers, team, before and after), **Items** (the catalogue as the design shows it, saved on its own), **Template** (the four designs of the vendor's own category, each previewed with the vendor's own content; switching never loses content and is saved as a draft until Publish), and a **Sample content** panel listing everything still starter text with a button to the place where it is edited, plus **Reset to starter**. A guard proves every field of every section is reachable in the editor and reaches the page.

## Admin

Admin, **Category packs**: per category the family, the four designs (name, theme, on or off, the default), the starter content, and Preview. **New pack**: choose a family and fill the starter content; the server builds the four designs. **Create one site**: category and business details create a site on the subdomain as `DRAFT`, hidden until it is published or claimed (visitors get the not-found page and a noindex; the HTTP code stays 200 because the root loading screen streams every page, exactly as for an unknown address today), with a private preview link. Bulk creation, the claim flow and promotion are a later dispatch and are not built.

## Search (per vendor address)

Title and description from the editor (the platform name is not added), one canonical link on the vendor's own address, one main heading per page, alt text on every picture, the share picture, structured data of the category's business type (name, address, phone, hours, the items by name, never a starter price), `sitemap.xml` and `robots.txt` per vendor host. A site is indexable only when it is live and shows content the vendor wrote (their own About text, a real item, or a real customer quote).

## Add a category in about 10 minutes, no code

1. Admin, Category packs, **New pack**. 2. Key, name, keywords. 3. Choose the **flow family** that matches how customers use this business. 4. Fill the starter content (headline, About, 3 to 12 items, 3 or more questions, steps, sample quotes). 5. Save: the four designs appear. 6. Optionally rename designs, switch themes, choose the default. 7. **Create one site** with it and open the private preview. Pictures: until you add artwork for the category, point its starter pictures at an existing set (`/starter/general/...`), or run `seed-images.js` after adding the category to the starter list.

Code is needed only for a brand-new **kind of section** (for example a seat map): add its type to `design-vocab.json` (both copies), the component in `design-sections.tsx`, one case in `KitRenderer.tsx` and the builder branch in `design-build.ts`.

## Review and scripts

| What | Command |
|---|---|
| Contact sheet of every category and design, desktop and mobile | `node scripts/industry-designs/contact-sheet.mjs` then open `evidence/industry-designs/contact-sheet/index.html` |
| Starter pictures (safe to re-run) | `node scripts/industry-designs/seed-images.js` (`--check`, `--force`) |
| Starter categories on a database | `backend-api/scripts/industry-designs/seed-starter-packs.js` (dry run by default) |
| What would change for flagged vendors (read only) | `backend-api/scripts/industry-designs/flagged-vendors-dry-run.js` |
| Change one vendor's category (dry run by default, undoable) | `backend-api/scripts/industry-designs/set-vendor-category.js` |
| Before and after of `ksm-webtech-services` | `node scripts/industry-designs/ksm-before-after.mjs` |

## Tests (all in `npm run bos:verify`)

`industry-designs.categories`, `.seed`, `.public-safety`, `.switch`, `.admin` (real Postgres through the real API), `.render`, `.speed`, `.seo`, `.editable`, `.no-hardcode` (a real server and headless Chrome, desktop and phone), `.contrast`, `.no-hardcode` and `.editable` again offline (`get4domain_mvp/scripts/verify-designs.mjs`). The last guard line of `bos:verify` fails if any of the eleven ids did not run and pass.
