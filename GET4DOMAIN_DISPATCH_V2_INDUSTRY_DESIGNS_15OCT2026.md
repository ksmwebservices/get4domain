# GET4DOMAIN DISPATCH V2: INDUSTRY DESIGNS (4 designs per category, real flows, starter content)

Date: 15 Oct 2026 · From: KSM (via Claude) · To: Claude Code · Branch: `get4domain-site`

Run after the Website Manager dispatch (`GET4DOMAIN_DISPATCH_V2_WEBSITE_MANAGER_14OCT2026.md`, already built and deployed). It builds on that work: `VendorCMS` site document, category packs, `site-themes.json`, the shared renderer in `get4domain_mvp/src/engine/kit`, and the `site_doc_v2` per-vendor flag.

The ground rules in `GET4DOMAIN_DISPATCH_V2_FULL_BOS_09OCT2026.md` section 2 apply in full (additive migrations only, never touch live vendor data, dry-run defaults, MARKETING role 403 on money routes, plain-sentence errors, Open only with a test id). Prisma stays pinned 6.19.3. Both builds 0 errors before every commit. Never run `security-verify/run-all.js`; use `run-offline.js`. After any shell edit of a `.sql` file or a file with `$$`, re-read it. Do not stop to ask questions: take the most reasonable reading, write it in the progress file, and carry on. Stage only your own files, never `git add -A`.

## 0. HOW TO RUN THIS (KSM)

| # | Where | What |
|---|---|---|
| 1 | Windows PowerShell | `cd C:\Get4Domain\get4domain-site` then `git add GET4DOMAIN_DISPATCH_V2_INDUSTRY_DESIGNS_15OCT2026.md` then `git commit -m "docs: industry designs dispatch"` then `git push origin get4domain-site` |
| 2 | Windows PowerShell | `claude` |
| 3 | Claude Code | `Read C:\Get4Domain\get4domain-site\GET4DOMAIN_DISPATCH_V2_INDUSTRY_DESIGNS_15OCT2026.md completely and execute every phase end to end without stopping to ask questions. Keep docs/v2/INDUSTRY_DESIGNS_PROGRESS.md updated after every phase so a restart can resume. Report in the checklist format at the end. Push to origin as the last step.` |
| 4 | Claude Code, new session if it stops early | `Read docs/v2/INDUSTRY_DESIGNS_PROGRESS.md and GET4DOMAIN_DISPATCH_V2_INDUSTRY_DESIGNS_15OCT2026.md, resume from the first unfinished phase, same rules. Push to origin as the last step.` |
| 5 | Paste the final checklist back to Claude as plain text | |
| 6 | VM terminal only after Claude says the report is good | Section 12 |

## 1. WHAT KSM SEES TODAY (15 Oct 2026)

`ksm-webtech-services.get4domain.com` is served by the shared engine, and it looks generic: a pale gradient, the business name, "Tell us what you need and we will get back to you", one button. Nothing about the industry, no sections, no flow, no images. Causes to confirm in Phase 0:
1. The vendor's category is stored as `retail`, but it is an IT and web services business, so the wrong flow applies.
2. A new site has no starter content. After the Website Manager fix removed stock fallbacks at render time (correct: no other business's content may ever appear), nothing replaced them, so an empty vendor gets an empty site.
3. The engine has few section types and few designs per industry.

KSM's requirement: **every industry category has its own 4 designs, each built for that industry's flow** (a clinic is not a shop is not a tour operator). Layouts are per category family, not global. Themes (colours, fonts) may be shared, layouts and navigation may not. A vendor sees only the 4 designs of their own category. The vendor dashboard stays common and controls all content. No coding per category.

## 2. PRINCIPLES

1. **Layout belongs to the flow family.** Each category belongs to one flow family (shop, booking, enquiry, packages, menu, portfolio, listings, courses). A design = family layout variant + style tokens. Categories in the same family share section code, not content.
2. **Starter content is seeded into the vendor's own site at creation**, editable, marked sample. Never a render-time fallback. A new site must look complete in the first view.
3. **No code per category.** A category is a pack (config + seeds). Code only for a new section type, built once and reused.
4. **Everything visible is editable** from Website Manager. Every field of every section appears in the editor, and a guard proves it.
5. **Never mislead customers.** Sample prices and sample reviews are not shown publicly as real. Public pages show "Contact for price" and hide sample testimonials until the vendor edits them.

## 3. PHASE 0: AUDIT (evidence/industry-designs/AUDIT.md)

1. List every category in the system: the 14 kit industries, the 12 LeadSpace trade templates, every category used by a live vendor, and the registry categories. Union them, de-duplicate, and give each a stable key. Mark which are live today.
2. Map each category to a flow family. Propose the families (expected about 8): Shop/cart; Booking and appointment; Enquiry and services; Packages and tours; Menu and orders; Portfolio and gallery; Listings (property); Courses and classes. Add a family if a category does not fit; do not force it.
3. List every existing section type, its variants, and which categories use it. Take a screenshot of every existing kit render with current sample data (headless browser) and save to `evidence/industry-designs/before/`.
4. Confirm or reject the three causes in section 1 with evidence. Check how `ksm-webtech-services` got `retail` and whether the category list has an IT and web services category.
5. Write findings in plain sentences at the top of the file.

## 4. PHASE 1: FLOW FAMILIES

For each family define, as data in the pack system:
- Homepage section order, navigation items, and the page set within the free page limit (5), for example Home, About, Services or Products, Gallery, Contact.
- The primary goal and its flow: cart order request, booking or appointment form, enquiry form, site visit request, or call or WhatsApp. Reuse the existing public flows (enquiry, checkout.request, booking); do not build parallel ones.
- Item schema (product, package, service, treatment, room, menu item, listing, course) and what the editor asks for.
- SEO type (schema.org LocalBusiness subtype or Product or Service as fits).
- Default imagery mood and an image set size.

## 5. PHASE 2: SECTION LIBRARY

Build or extend reusable sections, each with at least 3 variants, mobile-first, accessible (contrast AA), no layout shift, fast:
Hero (split, full-width banner, centred, with booking or enquiry card), trust strip, services grid, product grid with categories and search, package cards, menu list with veg marks, booking or appointment widget, pricing table, process steps, stats, team, gallery, before and after, testimonials, FAQ, map and contact, working hours, WhatsApp and call buttons, sticky mobile action bar, footer variants, announcement bar.

Visual quality bar: distinct, intentional, not templated defaults. Real typography pairings, spacing, imagery with purpose, per-family hero compositions. Use the frontend design guidance if it is available. Each variant must look different, not just a recolour.

## 6. PHASE 3: FOUR DESIGNS PER CATEGORY

1. Every category pack has exactly 4 enabled designs. A design = the family's section arrangement variant + style tokens (palette, fonts, radius, button style, imagery mood), with a name (for example Classic, Bold, Minimal, Warm). The four must differ in layout, not only colour.
2. Designs are data (admin-managed), reusing `site-themes.json` for tokens where it fits and extending it where not. One default design per category is chosen for new vendors.
3. A vendor sees only the 4 designs of their category in the Template tab, with thumbnails rendered from their own content. Switching design never loses content (sections map by type).
4. Cover every category found in Phase 0 (at least 20). Target at least 80 designs, built from shared sections and config, not 80 hand-written pages.
5. Generate a **contact sheet**: `scripts/industry-designs/contact-sheet.mjs` renders every category and design, desktop and mobile, with starter content, into `evidence/industry-designs/contact-sheet/` plus an `index.html` KSM can open to review all of them.

## 7. PHASE 4: STARTER CONTENT

For every category, seed into the new vendor's site document, editable and marked `sample`:
- Headline, subheadline, About, 6 to 8 items (services, products, packages, menu items or listings as the family needs) with sample descriptions and sample prices, 3 FAQs, a trust strip, a call to action, 2 or 3 sample testimonials, a hero banner and a small gallery.
- Text should be category-specific and written for the Indian small business market. Keep it generic enough to be true of any business in that category.
- Images: use the existing AI image path (AI Studio) or openly licensed images with the licence recorded in a file. Do not use copyrighted images. Process through the shared upload and media service and store in our own storage. Provide a script `scripts/industry-designs/seed-images.js` that is safe to re-run.
- Public rendering: sample prices show "Contact for price", sample testimonials are hidden, until the vendor edits them. Sample text may show.
- Readiness and editor show a "Sample content" panel listing every section still using sample text with a one-click edit.
- Seeding happens at site creation and in a "Reset to starter" action. It never overwrites vendor-edited values.

## 8. PHASE 5: EDITOR AND ADMIN

1. Website Manager Template tab: the 4 designs of the vendor's category, live preview with the vendor's own content, switch, publish. Every field of every section is editable somewhere in the tabs.
2. Admin Category packs screen: per category, the family, the 4 designs, the default design, enable or disable, preview with sample data, edit seeds. Create a new category by choosing a family and filling the seeds, no code.
3. Admin single-site creation: from category and business details, create a site on the subdomain with status DRAFT, hidden until published or claimed. (Bulk creation, claim flow and promotion are a later dispatch; do not build them here.)

## 9. PHASE 6: EXISTING VENDORS

1. Correct `ksm-webtech-services`: set the right category (add an IT and web services category if none exists), then re-seed through "Reset to starter". Show a before and after screenshot.
2. Allwin Tours, Step N Rock and every other live vendor: untouched. New designs apply only to vendors with `site_doc_v2` on. Dry-run script reports, per flagged vendor, what would change when its category's designs arrive; nothing is applied automatically.
3. Do not switch any vendor on. Do not edit live vendor content.

## 10. PHASE 7: SEO PER DESIGN

Per subdomain: title and description from the editor fields, canonical link, one H1 per page, image alt text, Open Graph image, schema.org LocalBusiness subtype by family with name, address, phone, hours, and items where relevant, `sitemap.xml` and `robots.txt` per host. A site is `noindex` while it is DRAFT or UNCLAIMED, or while it still shows only sample content; it becomes indexable once the vendor has published real content. Test with a headless fetch of each design.

## 11. PHASE 8: GUARDS (permanent)

Wire into `npm run bos:verify`. Test ids: `industry-designs.categories` (every category has a family and exactly 4 enabled designs), `.render` (every design renders without error for every required section on desktop and mobile), `.switch` (switching design keeps all content), `.seed` (starter content present, marked sample, never overwrites edits), `.public-safety` (sample prices and testimonials hidden publicly), `.editable` (every section field is reachable in the editor), `.seo` (canonical, structured data, sitemap, robots, noindex rules), `.contrast`, `.speed` (page budget), `.no-hardcode` (no business text outside seeds), `.admin` (a new category created through the admin screen only produces a working site with 4 designs). Keep every earlier guard passing.

## 12. VM DEPLOY STEPS AND KSM REVIEW

Add a section "Industry designs" to `docs/v2/DEPLOYMENT.md`: backup (use the Docker postgres 17 image, the VM's own pg_dump is version 14 and fails), git pull, migrate deploy, RLS script check and run in the Supabase SQL editor, rebuild backend then frontend, run the seed script, then the dry-run for flagged vendors. Each command labelled VM terminal or Supabase SQL editor. Never source `.env.local`.

KSM review: open the contact sheet, mark designs to change, then check `ksm-webtech-services` after Reset to starter.

## 13. MUST NOT DO

No raw AI-generated website code. No render-time stock fallbacks. No sample prices or reviews shown as real. Do not switch any vendor on. Do not touch live vendor content. Do not build a separate page set per category in code. Do not leave any visible field that cannot be edited.

## 14. REPORT

Checklist format, one line per phase marked complete, partial or not done, commit hashes, test ids with assertion counts, the Phase 0 findings in plain sentences, the category list with family and the four design names, decisions made without asking, and anything not done and why. Push to origin as the last step and confirm the head with `git ls-remote`.
