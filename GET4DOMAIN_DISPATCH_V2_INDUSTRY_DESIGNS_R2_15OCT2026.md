# GET4DOMAIN DISPATCH V2: INDUSTRY DESIGNS ROUND 2 (engine shell + AI theme import + paid theme marketplace)

Date: 15 Oct 2026 · From: KSM (via Claude) · To: Claude Code · Branch: `get4domain-site`

This REPLACES the earlier version of this file. KSM's decision: do NOT hand-build 96 more designs in code. The designs come from AI design tools (Bolt, v0, Claude or any other) and are imported into the platform as theme packages. The platform builds the parts an AI design tool cannot provide: the working shell (popup booking, mobile bottom navigation, footer, tabs, cart), the safe import pipeline, the admin theme screen, and the paid marketplace.

Run on top of the Industry Designs build (head `9f8f689`, dispatch `GET4DOMAIN_DISPATCH_V2_INDUSTRY_DESIGNS_15OCT2026.md`, progress `docs/v2/INDUSTRY_DESIGNS_PROGRESS.md`). Round 1 is pushed, not deployed. Keep round 1's category packs, flow families, starter content, sample markers, siteStatus, SEO per host, editor tabs and admin screen. Its 96 built-in designs stay as the fallback until imported themes replace them; do not extend them further.

Ground rules from `GET4DOMAIN_DISPATCH_V2_FULL_BOS_09OCT2026.md` section 2 apply in full (additive migrations only, never touch live vendor data, dry-run defaults, MARKETING role 403 on money routes, plain-sentence errors, Open only with a test id). Prisma stays pinned 6.19.3. Both builds 0 errors before every commit. Never run `security-verify/run-all.js`; use `run-offline.js`. After any shell edit of a `.sql` file or a file with `$$`, re-read it. Do not stop to ask questions: take the most reasonable reading, write it in the progress file, carry on. Stage only your own files, never `git add -A`. Never apply a migration to production and never touch the VM; KSM runs the deploy.

## 0. HOW TO RUN THIS (KSM)

| # | Where | What |
|---|---|---|
| 1 | Windows PowerShell | `cd C:\Get4Domain\get4domain-site` then `git add GET4DOMAIN_DISPATCH_V2_INDUSTRY_DESIGNS_R2_15OCT2026.md` then `git commit -m "docs: industry designs round 2 dispatch"` then `git push origin get4domain-site` |
| 2 | Windows PowerShell | `claude` |
| 3 | Claude Code | `Read C:\Get4Domain\get4domain-site\GET4DOMAIN_DISPATCH_V2_INDUSTRY_DESIGNS_R2_15OCT2026.md completely and execute every phase end to end without stopping to ask questions. Keep docs/v2/INDUSTRY_DESIGNS_R2_PROGRESS.md updated after every phase so a restart can resume. Report in the checklist format at the end. Push to origin as the last step.` |
| 4 | Claude Code, new session if it stops early | `Read docs/v2/INDUSTRY_DESIGNS_R2_PROGRESS.md and GET4DOMAIN_DISPATCH_V2_INDUSTRY_DESIGNS_R2_15OCT2026.md, resume from the first unfinished phase, same rules. Push to origin as the last step.` |
| 5 | Paste the final checklist back to Claude as plain text (not an attachment) | |
| 6 | Then KSM generates designs with Bolt or v0 using `docs/v2/THEME_PROMPTS.md`, checks each with the lint script, and uploads in Admin, Theme marketplace | Phase S5 |
| 7 | VM terminal, only after Claude says the report is good | `docs/v2/DEPLOYMENT.md` section 12 (Claude Code updates it in Phase S8) |

## 1. WHY (evidence, 15 Oct 2026)

The contact sheet showed one skeleton for every category: hero, identical gradient rectangles, "How it works", FAQ, form at the bottom. KSM: "very simple and generic", "not industries categories flow". Booking needs a long scroll. Mobile has only a hamburger. Hand-coding better designs for 24 categories times 4 is slow and keeps ending generic. AI design tools make far better looking, industry-specific pages. What they do not give is a multi-vendor working system: the vendor's own data, editing, popup booking into the real lead and order flows, search-engine-safe pages, plan and payment rules. So the platform provides the engine and the safe door; AI tools provide the looks.

## 2. WHAT IS POSSIBLE (decisions, written for the record)

1. A **theme package** is plain HTML and CSS with data slots, a manifest and assets. No scripts. The engine renders it on the server from the vendor's site document, so the vendor's logo, text, items, prices, images, hours and social links fill the design automatically, and the vendor edits them in Website Manager. Nothing is re-typed per vendor.
2. Interactive parts are not drawn by the AI design. The design marks where they go using engine tags (`<g4d-action>`, `<g4d-bottom-nav>`, `<g4d-footer>`, `<g4d-tabs>`, `<g4d-cart>`, and so on). The engine supplies the real, tested behaviour: popup booking, bottom navigation, cart, tabs, social links, map.
3. Any tool that can output static HTML and CSS can produce a theme: Bolt (manual download of the project), v0, Claude, Figma-to-code, a human designer. KSM's prompt pack tells the tool the contract. A lint script tells him what is missing before he uploads.
4. Automation: Bolt has no confirmed public API or MCP server for generating apps, so for Bolt the step is manual (generate, download, lint, upload). v0 has a platform API, and Claude can generate packages through the API, so a later dispatch can add an admin button "Generate theme with AI" that calls one of them and drops the result into the same import pipeline. Build the pipeline now so that later work only adds a generator. Do not build the generator in this dispatch.
5. Raw React, Next or script-bearing exports are NOT accepted as marketplace themes (unsafe for a multi-tenant system and cannot map to vendor data). The lint script says exactly how to convert, and the prompt pack asks tools for static HTML and CSS from the start.

## 3. PHASE S0: AUDIT (evidence/industry-designs/R2_AUDIT.md)

1. What from round 1 stays (packs, families, seeds, sample markers, siteStatus, SEO, editor tabs, admin screens) and what the theme packages replace (the kit section renderer for imported themes only).
2. Where round 1's built-in designs are rendered, and the smallest change that lets a design be either a built-in one or an imported package, chosen per vendor by `designKey`.
3. Current mobile navigation, current booking and enquiry placement, current footer.
4. Write findings in plain sentences at the top.

## 4. PHASE S1: THE ENGINE SHELL (works with built-in designs and imported themes)

Build once in `engine/kit`, driven by pack and vendor data. Every imported theme gets these automatically.

**Primary action popup.**
- Desktop: centred dialog with a backdrop. Mobile: bottom sheet.
- Steps by family: Booking and appointment: service, date and time, details, confirm. Enquiry and services: need, details, preferred call time, confirm. Menu and orders: pickup or delivery order, or table reservation. Shop: cart drawer then checkout request. Packages and tours: package, dates and travellers, details. Listings: property, visit slot, details. Courses: course and batch, details. Portfolio: package, date, details.
- Reuse the existing public flows (enquiry, checkout.request, booking) and the Action Registry. No parallel flow. Leads, bookings and orders land where they land today.
- Every trigger anywhere on the page opens the same popup and can preselect the clicked item.
- Accessible: focus trap, ESC, focus return, labelled fields, plain-sentence errors, success step with next actions (call, WhatsApp, add to calendar for bookings).
- Crawlable fallback: each flow also exists as a real page (`/book`, `/enquire`, `/order`) with the same form, used when JavaScript is off.
- No layout shift, safe areas, iOS scroll lock handled.

**Mobile bottom navigation.** Fixed bar below the tablet breakpoint, five slots maximum, centre slot is the raised primary action. Slots are pack data per family, editable by the vendor (examples: Clinic: Home, Treatments, Book, Doctors, More; Restaurant: Home, Menu, Order, Offers, More; Shop: Home, Shop, Cart, Offers, More; Travel: Home, Packages, Enquire, Gallery, More; Real estate: Home, Properties, Visit, Amenities, More; Education: Home, Courses, Enrol, Results, More; Services and IT: Home, Services, Quote, Work, More; Photography: Home, Portfolio, Book, Packages, More). Icons with labels, active state, safe-area padding, 44 px targets, "More" sheet with the other pages, call, WhatsApp and socials. Reuse and extend `EngineBottomNav.tsx`.

**Header, footer, tabs, cart.**
- Header: sticky, nav items from the pack, primary action button, phone and WhatsApp chips. Three variants.
- Footer: business line, quick links, contact block, hours, social icons (Instagram, Facebook, YouTube, WhatsApp, LinkedIn, X, Google Maps, one custom slot), legal links generated per vendor. Empty links hide their icon. Three variants.
- Tabs component (desktop tabs, mobile scroll chips) for menu categories, treatment groups, plans, package types, property types, course streams, portfolio categories.
- Cart drawer and quick-view popup for the shop and menu families.
- Announcement bar, floating WhatsApp and call buttons on desktop, 404 page in the site's design.

## 5. PHASE S2: THEME PACKAGE CONTRACT AND RENDERER

Write the contract in `docs/v2/THEME_CONTRACT.md` and implement it. Claude Code finalises exact names, keeping this shape:

1. **Package (zip):** `theme.json` manifest, `home.html`, page templates (`about.html`, `services.html`, `gallery.html`, `contact.html`, plus family pages such as `menu.html`, `packages.html`, `properties.html`, `courses.html`, `doctors.html`, `portfolio.html`), a generic `page.html` (used for any page the vendor adds themselves, for example Offers, Careers, Policies, Blog post), an item detail template `item.html` (one page per service, product, package, property, course, treatment or menu item, with its own URL, title, description, gallery and a popup action), `theme.css`, `assets/` (images, fonts), `preview.png`. **Themes are multi-page websites, not single-page landing pages.** Every page has its own real URL (`/about`, `/services`, `/services/<item>`), its own title and description, shared header, footer and bottom navigation, and appears in the per-host sitemap. A theme that supplies only `home.html` is allowed (the engine renders the other pages with the theme's `page.html` or a built-in neutral page in the theme's CSS variables) but lint warns. Page count follows the plan limits (LeadSpace 1 page, Essentials 5, Pro 25; item detail pages and the popup flow pages do not count as pages). The vendor adds, renames, reorders and removes pages in Website Manager (Pages tab) and each new page uses the theme automatically. The free LeadSpace single page is the same engine with one page and the goal action; upgrading adds pages without changing the theme. Manifest: id, name, version, author, supported families, supported categories (a theme works only for the categories it declares), pages, default CSS variables (colours, fonts, radius), required slots.
2. **Data slots:** `{{site.name}}`, `{{site.tagline}}`, `{{site.logo}}`, `{{hero.title}}`, `{{hero.subtitle}}`, `{{hero.image}}`, `{{about.text}}`, `{{about.image}}`, `{{contact.phone}}`, `{{contact.email}}`, `{{contact.address}}`, `{{hours}}`, `{{social.instagram}}` and so on. Repeaters: `<template data-g4d-each="items">` with `{{item.name}}`, `{{item.description}}`, `{{item.price}}`, `{{item.image}}`, `{{item.duration}}`, `{{item.badge}}`, `{{item.href}}`; `data-g4d-each="groups"` for tab groups; `data-g4d-each="team"`, `"testimonials"`, `"faqs"`, `"gallery"`. Conditionals: `data-g4d-if="testimonials"` hides a block when there is no data (this is how sample reviews stay hidden publicly).
3. **Engine tags** a design may place: `<g4d-action label="Book now" item="{{item.id}}">`, `<g4d-header-nav>`, `<g4d-bottom-nav>`, `<g4d-footer>`, `<g4d-social>`, `<g4d-hours>`, `<g4d-map>`, `<g4d-tabs for="groups">`, `<g4d-cart>`. If a theme omits `<g4d-bottom-nav>` or the action popup, the engine injects them anyway (they are required for every site).
4. **Sanitiser (security, mandatory):** strip `<script>`, inline event handlers, `javascript:` URLs, iframes (except the engine map), forms (engine forms only), external CSS or JS, external images (assets must be inside the package or the vendor's media), `@import` to unknown hosts; allow Google Fonts only if listed in the manifest allowlist; scope all CSS under `.g4d-theme-<id>` so one theme can never style another site or the dashboard; size limits (package 5 MB, each image 1 MB, WebP or PNG or JPG or sanitised SVG); no remote fetch at render time.
5. **Renderer:** server-side, cached per vendor and published version, refreshed on publish through the existing revalidation. Sample prices render "Contact for price" and sample testimonials hide, exactly as in round 1. Image alt text from item names. One H1 per page. Page set limited by plan (LeadSpace 1, Essentials 5, Pro 25), and a vendor never needs to touch code.
6. **Mapping rule:** switching between a built-in design and an imported theme, or between themes, never loses content, because content lives in the site document, not the theme.
7. **Same contract for AI-generated themes later.** Document in the contract how a generator (v0 API, Claude API) produces a package and runs through the same sanitiser and lint.

## 6. PHASE S3: IMPORT, LINT AND ADMIN

1. **Lint script** `scripts/theme/lint.mjs <folder-or-zip>`: runs on KSM's own computer, no server needed. It prints, in plain sentences, what passes, what is stripped (scripts, external links), which slots are missing for each declared category, which engine tags are missing, contrast problems, oversized images, and, if the input looks like a React or Next project, how to ask the tool to produce static HTML. Exit codes for pass or fail. Also `--fix` for safe auto fixes (inline small assets, scope CSS, add manifest).
2. **Admin screen "Theme marketplace"** (extends round 1's designs admin): upload a zip, validate with the same sanitiser and lint, preview on desktop and mobile with sample data for every compatible category (shell included: popup open, bottom nav visible), set supported categories, set status (draft, live, retired), and choose its role: **free default design for a category** (up to 4 per category, replaces a built-in design in the 4 slots) or **marketplace theme** with a yearly price. No deploy to add a theme. MARKETING role can preview only. Rejected uploads show plain reasons.
3. A theme package can be duplicated, versioned, retired. Retiring a theme never breaks a vendor site that uses it (falls back, see S4).

## 7. PHASE S4: PAID THEME MARKETPLACE

KSM's model: four free designs per category (built-in until replaced by imported ones); more themes sold per theme per year as extra revenue.

1. **Tables (additive migration):** `ThemePackage` (id, name, version, manifest JSON, storage path, supported families and categories, role free or marketplace, `priceYearlyPaise` set by admin only, status, preview paths, createdBy) and `ThemeEntitlement` (vendorId, themeId, startsAt, endsAt, status active, expired or cancelled, paymentRef, invoiceRef). No prices in code. Vendor-scoped queries.
2. **Vendor marketplace tab (inside Template tab, all plans):** the free designs of the vendor's category plus compatible marketplace themes, live preview using the vendor's own content, yearly price, Buy, and for owned themes the expiry date and Renew. Preview is free; applying a paid theme needs an active entitlement.
3. **Purchase:** reuse the existing payment path (Razorpay, wallet where that is the existing mechanism for such charges), GST added on top like every other charge, invoice through the existing invoice flow. Amount only from the admin price. Idempotent webhook. No new payment system.
4. **Expiry:** reminders at 30, 7 and 1 days through the existing notification path. On expiry the live site falls back to the category's default free design on the next render, content untouched; the vendor sees a plain message and Renew. Renewing restores the choice. A retired theme behaves the same for vendors who do not own it.
5. **Prospect sites** (admin-created, DRAFT or UNCLAIMED) always use a free design.
6. **Admin report:** themes sold, active entitlements, revenue per theme, expiring soon.

## 8. PHASE S5: REFERENCE THEMES AND PROMPT PACK

1. Build two reference theme packages by hand to prove the pipeline end to end: one **Clinic** (booking family, with tabs, doctors, popup, bottom nav) and one **Restaurant** (menu family, with tabbed menu, cart, order or reserve popup). They must look like a real modern website for that industry (large type, confident layout, real imagery, not gradient boxes), pass the lint script and the sanitiser, and render with a vendor's data. Place them in `themes/reference/` and register them as free defaults for those categories through the admin import path (not by code).
2. `docs/v2/THEME_PROMPTS.md`: a ready-to-paste prompt per flow family (8 prompts) for Bolt, v0 or Claude. Each prompt asks for a **multi-page website** (home, about, the family's main listing page, gallery or portfolio, contact, one generic page, one item detail page), not a single landing page, all sharing one header, footer and one `theme.css`. Each prompt includes: the output rules (static HTML and CSS only, no scripts, no frameworks, one `theme.css`, assets in a folder), the slot and tag contract, the family's signature sections and flow (from section 9), design direction (modern, current UI, strong typography, real industry imagery, mobile first, leave the bottom navigation and the popup to the engine tags), the manifest to fill, and the instruction to run the lint script before delivering. Also a "make four different designs for this family" instruction (different hero, grid style, section order, header style, not just colour) so KSM can get the four free designs per category in one go. Include a short step-by-step for KSM: generate, download, run `node scripts/theme/lint.mjs <folder>`, fix with the tool, upload in Admin.
3. A plain-language "how to turn a Bolt export into a theme" page in the same doc for the case a tool only gives a React project.

## 9. FLOW FAMILY SIGNATURES (what each theme must contain, for lint and prompts)

Used by the lint script (warn when a declared category's page lacks these) and the prompt pack.

| Family | Signature sections and flow |
|---|---|
| Booking and appointment (clinic, diagnostics, salon, gym, spa) | Hero with inline "Book now" action, services or treatments in tabs with duration and price, doctor or stylist or trainer cards with "Book with", plans comparison (gym), availability strip, reviews, FAQ, map and hours |
| Enquiry and services (advocate, professional, finance, freelancer, technology, construction, home services, logistics, general) | Proof-point hero with "Get a quote", service areas as editorial cards, family-specific process timeline, case studies or projects, team, credentials, engagement models, FAQ |
| Packages and tours (travel, events, hotel) | Full-bleed destination hero with search-style action, package cards with inclusions, itinerary accordion, gallery, rooms or event types, testimonials |
| Menu and orders (restaurant, cafe, catering) | Food-first hero with open status, tabbed menu with veg marks and add-to-cart, specials and combos, reservation, gallery, hours and delivery area |
| Shop and cart (retail, agriculture, automobile parts) | Offer hero with category rail, category tiles, product grid with filters, search, quick view, offers strip, delivery info |
| Listings (real estate) | Search hero with filters, property cards, filter tabs, map, amenities, site-visit scheduler, agent profile |
| Courses and classes (education, coaching) | Outcome hero with next batch date, course cards with syllabus, batch calendar, faculty, results counters, fees, FAQ |
| Portfolio and gallery (photography) | Immersive gallery hero, category tabs and lightbox, packages, story, client stories, booking |

Add the missing item types to the pack schema where needed (doctor, stylist, trainer, faculty, room, plan, property, menu category, case study). They are editable in the Items tab with no code per category.

## 10. PHASE S6: EDITOR AND DASHBOARD

Website Manager tabs (extend what exists): Basic info, Logo and banner, About and Social (all social links, hours, map link), Page content, Items (every item type), Navigation (header items, bottom-nav slots and labels, primary action label), Popup form (fields, required or not, confirmation message, notification contact), SEO, Template (free designs plus marketplace), Preview (desktop and mobile toggle, popup and bottom nav visible), Publish. Every field a theme slot can show is reachable in the editor; a guard proves it. Admin Category packs screen edits family, bottom-nav slots, popup steps and fields, item schema and seeds; a new category needs no code.

## 11. PHASE S7: SEO AND PERFORMANCE

Carry round 1 SEO through imported themes (title, description, canonical, one H1, alt text, Open Graph, LocalBusiness subtype, per-host sitemap and robots, noindex while DRAFT, UNCLAIMED or sample-only). Popup flows have real URLs; bottom nav and footer are real links. Record page budget on mobile (LCP under 2.5 s in a throttled headless run on the production build, CLS under 0.1). Contrast AA is checked on every theme at import and shown to the admin.

## 12. PHASE S8: EXISTING VENDORS AND DEPLOY STEPS

1. Allwin Tours, Step N Rock and every vendor not on `site_doc_v2`: untouched. Update the flagged-vendor dry run to report what the new shell and themes would change.
2. On a local copy only, Reset to starter for `ksm-webtech-services` using a reference theme where its category applies; save before and after screenshots (desktop, mobile with bottom nav, popup open) in `evidence/industry-designs/ksm/`.
3. Update `docs/v2/DEPLOYMENT.md` section 12 for the combined release (round 1 plus this one): backup with the Docker postgres 17 image (never the VM's own pg_dump, never source `.env.local`), pull, migrate deploy (round 1 migration plus the theme tables), RLS script `cat` check for `DO $$` and `END $$;` then run in the Supabase SQL editor (new tables need it), rebuild backend then frontend, starter packs seed (dry run first), image check, theme storage location and any new env or volume, flagged-vendor dry run, KSM review steps, rollback. Each command labelled VM terminal or Supabase SQL editor.
4. Nothing is applied to a live vendor automatically.

## 13. PHASE S9: GUARDS (permanent)

Wire into `npm run bos:verify`. Keep every round 1 guard passing. New test ids:
- `theme.package-schema` (valid package accepted, invalid rejected).
- `theme.sanitiser` (scripts, handlers, external resources, iframes, unscoped CSS all stripped or rejected; a hostile sample package cannot affect another site or the dashboard).
- `theme.render` (both reference themes render for every declared category with vendor data on desktop and mobile; slots filled; sample prices and sample testimonials hidden publicly).
- `theme.lint` (lint finds missing slots, missing tags, React projects, oversized images; `--fix` safe).
- `theme.switch` (switching built-in or imported themes keeps all content).
- `theme.multipage` (every page template renders at its own URL with its own title and description; item detail pages render; a vendor-added page uses `page.html`; sitemap lists all pages; plan page limits enforced; pages and header, footer, bottom nav stay consistent across pages).
- `theme.marketplace` (admin creates and prices a theme without code; vendor sees only compatible themes; preview free; apply needs entitlement; purchase through the existing payment path with the admin price; idempotent webhook).
- `theme.expiry` (expiry falls back to the free default design, content untouched, renewal restores, reminders scheduled, retired theme safe).
- `industry-designs.shell` (header, footer, bottom nav in every design and theme; bottom nav only below the tablet breakpoint; slots from data).
- `industry-designs.popup` (every trigger opens the dialog or sheet; submit goes through the existing flow and creates the lead, booking or order; focus trap, ESC, focus return; fallback URL renders the same form).
- `industry-designs.footer-social` (icons from vendor links, empty ones hidden).
- `industry-designs.editable` extended to shell, popup and every theme slot; `.seo`, `.contrast`, `.speed`, `.no-hardcode` extended to themes.
- `industry-designs.dynamic` (a new category created only through the admin screen gets labels, bottom nav, popup fields and the family's signature requirements with no code).

## 14. MUST NOT DO

No raw AI-generated site code run in production. No scripts in themes. No render-time stock fallbacks. No sample prices or reviews shown as real. Do not switch any vendor on. Do not touch live vendor content or categories. Do not hand-build new built-in designs for the 24 categories. Do not build a parallel booking, order or payment system. Do not put prices in code. Do not hide important content behind a popup that search engines cannot reach. Do not leave a visible field that cannot be edited. Do not build the AI generator button in this dispatch. Do not deploy.

## 15. REPORT

Checklist format, one line per phase (S0 to S9) marked complete, partial or not done, commit hashes, test ids with assertion counts, S0 findings in plain sentences, the final theme contract summary (slots and tags), the two reference themes, the prompt pack location, decisions made without asking, anything not done and why. Push to origin as the last step and confirm the head with `git ls-remote`.
