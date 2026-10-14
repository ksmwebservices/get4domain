# Website Manager (dispatch of 14 Oct 2026)

Every vendor on every plan (LeadSpace, Essentials, Pro) gets the Website Manager, themes and layouts, preview and publish. A vendor never needs our team to change their site. Plans limit only **pages** (LeadSpace 1, Essentials 5, Pro 25; the home page counts as one) and **picture storage** (100 MB, 1 GB, 5 GB). The audit that explains why this was needed is `evidence/website-manager/AUDIT.md`; progress and decisions are in `WEBSITE_MANAGER_PROGRESS.md`.

## The one principle

**One site per vendor: the row `"VendorCMS"`.** The editor writes it. The public site, the readiness check, the sitemap and the WhatsApp bot read only it. Publish refreshes the public pages. If a field is in the editor, a test proves it reaches the page; a field that cannot be proven is removed from the editor.

- Published fields are the ordinary columns (`businessName`, `tagline`, `about`, `logo`, `banner`, `favicon`, `ogImage`, contact and social fields, SEO fields, `portfolio`, `testimonials`, `pages`, `layout`, `themeId`).
- `draft` (JSON) holds edits not yet published. It is never sent to the public (the public API strips it; the only way to see a draft is the vendor's own signed preview link, valid 30 minutes).
- `siteVersion`, `publishedAt` and the table `g4d_site_versions` hold the last 10 published versions (restore is itself a new version; nothing is deleted).
- A vendor is switched onto the draft/publish workflow and the new renderer one at a time with the add-on `site_doc_v2` (`node scripts/site-doc-flag.js --on --vendor <subdomain>`). Off (the default) = the old editor and the old public renderer, unchanged. **Nothing switches a vendor on by itself.**

## The public renderer (new path, flag on)

`/site/<subdomain>` (also the vendor's own `<subdomain>.get4domain.com` once nginx sends that host to the frontend) builds the page from: the vendor's content + the **category pack** (section order, wording, layouts) + a **theme**. Code: `get4domain_mvp/src/engine/sitedoc/build.ts` and the shared kit in `engine/kit/`.

- It never adds content the vendor did not write: no stock photo, no invented testimonial, statistic, team member or catalogue item. An empty field is hidden, or shows the pack's plain default wording; an empty banner is a plain theme-colour panel.
- 13 themes (design tokens as CSS variables, light and dark, all AA contrast, `site-themes.json`), and for the hero 3, about 3, items 4, gallery 3, customer quotes 3, contact 3 layouts. Changing a theme or layout never changes content.
- Pages are cached for a minute and tagged `site:<subdomain>`; **Publish** calls `POST /api/revalidate-site` (secret `REVALIDATE_SECRET`) so the change shows within seconds. A failed refresh still leaves the change published; it then appears within a minute.
- Shops: the cart works with order requests (the shop confirms by phone, no payment on the page) and with the vendor's own Razorpay.
- Extra pages (`/p/<slug>`), the Google Analytics script and schema.org structured data (the pack's search type) are rendered too.

## Uploads

One service for every picture (`backend-api/src/uploads/media.service.ts`): PNG, JPG, WebP (GIF kept as is; SVG only when script-free); the bytes decide the type; 5 MB; camera and location data removed; shrunk for the web with the original kept; a logo also makes a favicon and a share picture; counted against the plan. Every message says what to do. `scripts/website-manager/uploads-guard.js` fails if any endpoint stores a picture another way. The browser also shrinks big pictures before sending. The API host's nginx must allow bodies of at least 10 MB: see `DEPLOYMENT.md` section 11.

## Category packs: adding a category in 10 minutes, with no code

A pack is a row in `g4d_category_packs` (admin screen **Category packs**, `/admin/category-packs`; MARKETING can look and preview, admins change). It holds: keywords that match vendors, the goal (enquiry, booking, appointment, site visit or cart order) and the main button, the sections and their order, what the business lists (product, package, service, room, treatment, case or listing, with singular and plural), the default tagline, about text, headline, sub-line, trust points and questions (placeholders `{business}`, `{city}`, `{phone}`), the default theme and layouts, the search-engine type, and three AI Studio prompts.

1. Admin, **Category packs**, **New pack**. 2. Fill the form (or **Copy** the nearest pack and change what differs). 3. **Preview** to see it filled with sample details. 4. Save. The category now appears in every vendor's "Start from your category" list. 5. The vendor picks it, enters company details, and the site is generated as a draft (their own words always win over the pack's); they edit it in Website Manager and publish.

**Add starter packs** creates the 12 LeadSpace trades and the 20 website industries that do not exist yet; it never changes an existing pack. One engine powers both the free LeadSpace page and the full website.

**When code is needed:** only for a brand-new kind of section (for example a seat map or a room-availability calendar). Steps: add the section type to `engine/kit/model.ts`, its component in `engine/kit/sections.tsx`, one `case` in `KitRenderer.tsx`, one entry in `PACK_SECTIONS` (`backend-api/src/site-doc/pack.types.ts`) and the builder branch in `engine/sitedoc/build.ts`. Then packs can use it like any other section.

## Switching on, one vendor at a time

Order and commands are in `DEPLOYMENT.md` section 11. The backfill (`scripts/site-document-backfill.js`) copies what a hand-written public site shows today (`scripts/website-manager/standalone-seeds.json`, taken from that site's source) into the vendor's Website Manager, filling **only empty fields**, with an exact rollback. Allwin Tours (`allwintours`) is served by `allwin-tours/` today; its content, theme (`harbour-amber`) and layouts are seeded so the shared renderer shows the same look. Step N Rock (`stepnrock`) keeps its own storefront until KSM moves it: its text, logo and SEO are already in Website Manager, and the shared renderer now supports its order-request cart; compare the two sites side by side before switching.

## Tests (all in `npm run bos:verify`)

`website-manager.fields`, `.logo-png`, `.uploads`, `.publish-refresh`, `.versions`, `.plans`, `.themes`, `.layouts`, `.packs`, `.readiness`, `.migration`, `.no-fallback`, plus the migration rehearsal (no drift), the uploads guard and the draft-privacy checks. The rendered-page suite builds the frontend the first time it runs.
