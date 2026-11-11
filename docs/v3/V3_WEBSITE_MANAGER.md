# V3 Website Manager: rules document (B9.0)

Status: written first (B9.0), completed at the end of the run (sections 11 to 16: gaps, data dictionary, rules, decision log, differences, open questions). The API contract is in `V3_API_DOCUMENTATION.md`, section Batch 9. Branch `v3-b9`, worktree `C:\Get4Domain\get4domain-b9`, on `origin/v3-b5` (Stage 9, `8d9ca51`). Sources: `STAGE_13_WEBSITE_MANAGER_BATCH_9.md` (with the banner library addendum and Amendments 06 and 07), `AMENDMENT_08` Part B items B1 to B4, and `AMENDMENT_09` (read for context only, nothing built from it).

Only `backend-api`, `docs/v3` and `backend-api/prisma/seed` change. No frontend, no themes repo, no Stage 9 code.

## 1. Owner overrides for this run (they win over the stage file)

1. Base is `origin/v3-b5`, not `origin/v3-b8` (Release 1 skips Stages 10 to 12).
2. Batch 8 (theme zip, theme library) does not exist. Nothing of it is built. The Website Manager works against the renderer, the publish pipeline and the editable-field map that exist now. Each gap is listed in section 11 and in OPEN QUESTIONS.
3. No theme and no frontend is touched. A theme that does not expose every page and section is listed as a gap.
4. Amendment 08 backend items are extra slices after 5.5 and before 5.13b: B1 per-page SEO, B2 location and directions, B3 Google review link, B4 testimonials.
5. No Stage 9 code changes.
6. No push.

## 2. Owner rules that this run touches (frozen 4 November 2026, restated from the stage file)

- Rule 1: the subdomain is the canonical host by default; edits never change the canonical host or the sitemap rules; only the canonical host is in the sitemap.
- Rule 2: a Free site is an informational listing: business details and the phone number as plain text, no button, form or call to action. Pro features are LOCKED_PREVIEW. Pro sites carry the full call-to-action set for their tier.
- Rule 4: the bridge model; we promise promotion effort, not ranking, leads or sales.
- Rule 6: a site is never hidden or deleted because a plan lapses; stored Pro content is kept and returns with Pro.
- Rule 7: self-service in the dashboard is free within the plan; anything our team does for a vendor is a paid service done only on request.
- Rule 8: every vendor action is written to the activity log and staff see alerts afterwards.
- Rule 11: the prohibited-term scan is alert-only and never blocks.
- Rule 13: no timeframes in generated or seeded product text; the words Workspace, BOS and LeadSpace never appear in generated or seeded text.

## 3. Amendments applied (where they win)

- **Amendment 06** wins over the original Free rule: a Free vendor may edit, but every Free edit is a submission (DRAFT, SUBMITTED, APPROVED, REJECTED with a reason). Nothing reaches the live site until staff approve. The live site keeps the last approved content. Pro edits go live at once, with the activity log and staff alerts afterwards.
- **Amendment 07** wins over the page list: the manager edits every page. The vendor SEO tab and the Directory listing tab are removed from the vendor UI; the SEO APIs stay for staff and reports.
- **Amendment 08** wins over Amendment 07 for B1 to B4: the vendor edits per-page SEO text and slug (B1); the fixed markup (structured data, canonical, hreflang) stays automatic and locked.
- **Banner library addendum**: a Banner Library per category with a licence manifest, for staff and for the vendor.

## 4. Roles

The staff roles that exist today are `SUPER_ADMIN`, `OPERATIONS` and `MARKETING` (`admin-role-matrix.ts`). The stage file names `SUPPORT`, `Website Developer` and `Customer Support`, which do not exist. Decision D-1: wherever the stage names a support or developer role, the matrix gives `OPERATIONS` and `SUPER_ADMIN`; `MARKETING` is denied on anything that carries personal or money data. Listed in OPEN QUESTIONS (Q1).

## 5. Architecture in one page

- **Live content is the snapshot of the current publication.** Each build of the manager stores the content document it was built from, keyed by the publication id (`g4d_site_snapshots`). The live document is therefore always a function of which publication is PUBLISHED. A rollback needs no second write: the new version resolves to the source version's document. This removes the need for a "promote the draft" step that could succeed while the publish fails.
- **Draft overlay.** One draft document per vendor (`g4d_site_drafts`), saved field by field with a revision counter and a base version; autosave is a patch of one field.
- **ContentSource** gains a second layer: legacy `VendorCMS` (read only, unchanged) overlaid with the managed document. The renderer input mapping (`content-adapter.ts`) is not changed; the overlay is applied to the source document before it.
- **Publish (Pro)**: validate fields, wording check, build with the draft as the overlay, publish through the existing `PublishService`, store the snapshot, scan for prohibited terms (alert only), purge the public cache, write the activity row.
- **Submit (Free)**: validate, wording check, prohibited-term scan at submit time, store a `content_submissions` row with the payload. Staff approve (build with the payload as the overlay, publish, snapshot) or reject (reason required). Old content stays live.
- **Services and products are the same records as the vendor's Offerings or Catalogue** (`VendorProduct`); the site reads them, the manager never writes them.
- **Locked fields.** Titles, structured data, canonical links, hreflang and the SEO, GEO and AEO markup are generated by the platform and cannot be written by a vendor. The write path accepts only the typed fields of the editable-field map and rejects every other key.

## 6. Editable-field map

Derived from the kit at run time, never invented: the page templates of the chosen theme, each `data-g4d-section` (id, label, optional) in those templates, and the typed fields the renderer binds for that section. The map is pure data returned by `GET /v3/me/site/editor/map`.

## 7. Slices and migrations (each slice has its own migration folder, RLS on every table, cross-tenant tests)

| Slice | What | Migration |
|---|---|---|
| 5.5a | Content document, draft overlay, publish, snapshots, restore, compare, brand, navigation | `20261128100000_v3_website_manager` |
| 5.5b | Media library and Banner Library (manifest, StoragePort, re-encoding) | `20261129100000_v3_website_media` |
| 5.5c | Free edits to review (`content_submissions`) and staff review routes | `20261130100000_v3_content_submissions` |
| B1 | Per-page SEO | `20261201100000_v3_page_seo` |
| B2 | Location and directions | `20261202100000_v3_site_location` |
| B3 | Google review link | `20261203100000_v3_review_link` |
| B4 | Testimonials | `20261204100000_v3_testimonials` |
| 5.13b | Act on behalf and the onboarding queue | `20261205100000_v3_act_on_behalf` |

## 8. Per-task protocol (every slice)

Failing tests first with the red result shown; smallest change to green; lint, build, unit tests, `verify:migrations`, `verify:migrations-additive`, `verify:raw-sql`, the legacy static check, the route classification and role matrix tests; every new route classified and in the matrix; every new table has row-level rules and a cross-tenant test; staging integration tests written and marked NOT RUN; stage only the slice's paths; secret scan; path-only commit; append to `B9_LOG.md`.

## 9. Stop-lines in force

No production access, no live provider call, no deploy, no DNS change. Staging database only; additive migrations only. No secrets read or printed. No checkout, restore, stash, reset, clean, rebase or amend; path-only commits; no push. V3 code never reads or writes legacy billing, wallet, BOS, commercial, domain-campaign, vendor-payments or menu-gating tables. No invented business values (limits, caps, thresholds come from settings; loaders refuse to enable a feature until staff set them). No Redis or BullMQ; any per-vendor lock waits in the KeyedQueue before a transaction opens. Three distinct failed attempts: stop and report.

## 10. Wording and scan rules for this run

- **Wording check** (`wording-core.ts`, pure): refuses vendor text in SEO fields, testimonials, review wording and landing text that promises a result or a ranking (guarantees, "number one", "first page of Google", "top ranking", guaranteed leads or sales). It also refuses a rupee price in SEO text and the retired product names. It is a validation error for the vendor (`WORDING_NOT_ALLOWED`, names the field, never echoes the text into logs).
- **Prohibited-term scan** (Batch 4b, `TrustScanService`): runs after publish and at submit time for Free; alert only; never blocks.
- Generated or seeded text written by this run is scanned by a test for the retired names and for timeframes.

## 11. Gaps (what could not be built against what exists now; each is a Release 2 or theme-kit item, none blocks Release 1)

1. **Landing pages per service and area** have no renderer template. The editor map lists `landing-pages:no-template` on every theme; the API and the document model do not store landing text yet (nothing is half-built). Needs the kit (Batch 8 or the themes repo).
2. **Navigation labels and order**: the renderer's header menu is fixed (`navigation:renderer-menu-fixed`). The menus are validated and stored (`navigation` in the document) and returned by the API; they are not drawn. Custom page titles and the vendor's own social links are drawn.
3. **Opening hours** stay free text in the legacy document; the renderer wants rows (`hours:free-text-only`, decision D-8 of Stage 5.4).
4. **Theme pages and sections** (checked by deriving the map from each of the five vendor themes, `free-hospitality`, `free-practice`, `free-service-pro`, `free-shop-lite`, `free-studio`). Every theme exposes the five standard pages: home, about, services, gallery and contact, plus the service or product page (`item`) and the extra-page template (`page`). Real gaps against Amendment 07, listed so nothing is assumed: (a) **no theme has a FAQ page**: the FAQ is a section of the home page in all five, so the vendor edits the questions (the `faqs` list) and shows or hides the section, but there is no page of its own; (b) **`free-shop-lite` has no `services` section**: its services list and home grid are `products` (the Ecommerce equivalent, read from the vendor's Catalogue, never written here); (c) the extra page templates some themes add (`menu`, `packages`, `properties` in `free-hospitality`, `doctors` in `free-practice`, `courses` in `free-studio`) are driven by the vendor's Offerings and the platform's blocks: the vendor can show or hide their sections but there is no page text to edit, and they have no per-page SEO; (d) sections drawn by the platform (reviews, videos, booking, hours, share, price blocks) offer show or hide only; (e) the "Products list and each product page" and "Services list and each service page" of Amendment 07 are the same `services` and `item` templates; the page text of an item is the vendor's Offerings record, edited in Offerings, not here.
5. **Page slug**: the slug of a standard page is fixed by the kit (read only); only an extra page's slug is editable, in the Pages list.
6. **Testimonial label**: the kit's heading is "Customer testimonials"; "Words shared by the business owner" travels in each item's note, in English only. A kit term (English and Tamil) is needed.
7. **Review button wording** is the kit's "Write a review on Google" (English and Tamil), not "Review us on Google".
8. **Picture storage** has no real adapter (no provider call is allowed): uploads and the loader's `--apply` stop with `STORAGE_NOT_CONFIGURED`; the loader's dry run works.
9. **Theme zip and theme library (Batch 8)** do not exist; nothing of them was built. The Banner Library "themes use the chosen banner in the hero and fall back to their own illustration when none is set" works through `hero.image`: an empty value leaves the kit's own illustration.
10. **Acting on behalf covers `/v3/admin/vendors/:id/...` routes.** Staff editing a vendor's draft fields through a session has no admin route yet (only banners, pictures, approval and the existing vendor-admin routes); adding admin pass-through routes is a later slice.
11. **The vendor has no route to read the in-app notice rows** (the activity module owns them); the decision and its reason are readable on `GET /v3/me/site/submissions` and the sessions on `GET /v3/me/act-on-behalf`.

## 12. Data dictionary (all additive; `g4d_` names via `@@map`; RLS on every table; no legacy table read or written)

| Table (model) | Columns | Notes |
|---|---|---|
| `g4d_site_drafts` (`V3SiteDraft`) | vendorId PK (FK, cascade), docJson, rev, baseVersion, updatedBy, createdAt, updatedAt | the working copy; every save is a compare-and-set on `rev` |
| `g4d_site_snapshots` (`V3SiteSnapshot`) | id, vendorId (FK), publicationId UNIQUE, version, docJson, docHash, createdAt; UNIQUE (vendorId, version) | the document each publication was built from; the live document is the snapshot of the current publication |
| `g4d_site_pictures` (`V3SitePicture`) | id, vendorId (FK), storagePath, url, contentType, bytes, width, height, altText, sha256, uploadedByType, uploadedById, createdAt, deletedAt; UNIQUE (vendorId, sha256) | not `g4d_media_assets` or `g4d_site_media`, which are legacy |
| `g4d_banner_images` (`V3BannerImage`) | id, categoryId, storagePath, url, contentType, bytes, width, height, altText, hasPeople, sourceUrl, author, licenceName, obtainedOn, sha256, active, createdAt, updatedAt; UNIQUE (categoryId, sha256) | platform data (no vendor) |
| `g4d_content_submissions` (`V3ContentSubmission`) | id, vendorId (FK), scope, payloadJson, payloadHash, changedJson, status (DRAFT, SUBMITTED, APPROVED, REJECTED), submittedById, reviewerId, reason, submittedAt, decidedAt, openVendorId UNIQUE, createdAt, updatedAt | one SUBMITTED per vendor through `openVendorId` |
| `g4d_page_seo` (`V3PageSeo`) | id, vendorId (FK), pageKey, seoTitle, seoDescription, shareImageRef, customTitle, customDescription, version, updatedAt; UNIQUE (vendorId, pageKey) | projection of the live document, for staff reports |
| `g4d_site_locations` (`V3SiteLocation`) | vendorId PK (FK), address lines, city, state, pincode, latitude, longitude, mapLinkInput, directionsUrl, version, updatedAt | projection |
| `g4d_review_links` (`V3ReviewLink`) | vendorId PK (FK), url, host, version, updatedAt | projection |
| `g4d_testimonials` (`V3Testimonial`) | id, vendorId (FK), position, name, text, date, version, updatedAt; UNIQUE (vendorId, position) | projection; no rating column exists |
| `g4d_act_on_behalf_sessions` (`V3ActOnBehalfSession`) | id, staffId, vendorId (FK), reason, startedAt, expiresAt, endedAt, endedBy (STAFF, SUPER_ADMIN, AUTO), vendorNotifiedAt, activeStaffId UNIQUE, createdAt | one live session per staff member through `activeStaffId` |

The managed content document (JSON, `v: 1`): `fields`, `lists` (`faqs, gallery, steps, trust, stats, team, credentials, pages`), `sections { hidden, order }`, `brand`, `navigation { header, footer }`, `seo`, `location`, `reviewUrl`, `testimonials`. Business name, GST and every identity field are NOT in it; services and products are the vendor's Offerings.

## 13. Rules that the code enforces (and the test that proves each)

- A vendor write reaches only typed fields of the editable-field map; SEO, canonical, structured data, hreflang and every other key are `FIELD_LOCKED` (`website-doc-core`, `website-service`).
- Draft never leaks to the public site; publish creates one snapshot; a double publish is harmless; restore recreates the earlier version byte for byte (`website-service`).
- Free edits are submissions; nothing is live before approval; a rejection keeps the old content and records the reason; the prohibited-term scan runs at submit time; two staff cannot both decide (`website-review`).
- Pro-only values (call-to-action wording, review link, testimonials) are Pro-only to WRITE, are kept after a downgrade, are not drawn on Free, and never block a Free edit (owner rule 6) (`website-reviewlink`, `website-testimonials`).
- Free shows the address as plain text with no directions link; Pro shows Get directions; no network call is made for location, review link or parsing (`website-location`).
- No rating field, aggregate or review markup exists anywhere (`website-testimonials`).
- Uploads are refused until staff set the caps; the bytes, not the label, decide the type; SVG never; metadata is dropped; one folder per vendor; alt text is required (`website-media-service`, `website-sharp`).
- The Banner Library loader refuses an image with no manifest row, loads nothing when the manifest has an error, and is idempotent; healthcare and legal-finance default to banners without identifiable people (`website-media-core`, `website-media-service`).
- Acting on behalf needs a reason and a staff setting, tells the vendor, ends by itself, refuses payment method, bank, UPI, payee and password changes, and shows every action in the vendor's activity (`act-on-behalf`).
- Cross-tenant: every store names the vendor in every query; every new vendor table is classified in the tenant registry; `b9-isolation` scans the module for legacy tables, Redis, console output, raw SQL, retired names, prices and timeframes.

## 14. Decision log

- D-1 Roles: SUPPORT, Website Developer and Customer Support do not exist; OPERATIONS and SUPER_ADMIN, MARKETING denied.
- D-2 The live document is the snapshot of the current publication (no "promote the draft" step that could succeed while the publish fails).
- D-3 Every build records its snapshot, whichever route started it, so the older build and publish routes stay consistent.
- D-4 SEO, location, review link and testimonials live in the document (draft, review, restore and compare come for free); a small projection table per slice gives staff something to query; projections are rebuilt after every version that goes live and a fault never undoes a publish.
- D-5 The editor map is derived from the theme's templates, never written by hand.
- D-6 Field and list sizes are payload-validation sizes, not business limits; business limits come from the plan features and the staff settings, all unset by default.
- D-7 A Free vendor's "publish" is a submission; the vendor's one route returns `mode` LIVE or SUBMITTED.
- D-8 Approval builds from the submitted payload, not from a later draft.
- D-9 Free directions: the adapter gives the theme no directions link when the plan has no calls to action (the kit draws the link whenever it is given one). This also changes the old behaviour for the legacy map text, in line with owner rule 2.
- D-10 Stored Pro-only values are kept and never block a Free edit; the check is at write time only.
- D-11 No real storage adapter is bound; the module refuses uploads instead of pretending.
- D-12 The act-on-behalf header is accepted only on one vendor's admin routes; a refused attempt is logged for the vendor.
- D-13 The onboarding queue is a read model with no table of its own; a vendor appears once, as its most advanced kind.
- D-14 Table names avoid the legacy `g4d_media_assets` and `g4d_site_media`.

## 15. Differences from the dispatch (every one)

1. Base is `origin/v3-b5`, not `origin/v3-b8` (owner override 1); Batch 8 content is not built.
2. Roles (D-1).
3. Amendment 06 wins over the original Free rule (Free edits are reviewed), as the dispatch says; DRAFT is the working copy in the draft table, not a stored submission row.
4. Amendment 07's vendor SEO tab is removed from the vendor UI, but Amendment 08 B1 gives the vendor per-page SEO text; both are honoured (B1 wins for those items); the staff SEO APIs are kept.
5. "Review us on Google" is the kit's "Write a review on Google" (gap 7).
6. The testimonial label is carried in each item's note (gap 6).
7. Landing pages, navigation drawing and opening-hours rows are gaps, not built (gaps 1 to 3).
8. The stage's `/v3/me/site/*` publish and restore are owner-only, like the existing 5.4 routes.
9. The loader's real run needs storage that does not exist yet (gap 8).
10. Several slices of the stage are one commit each (5.5 was split into 5.5a, 5.5b and 5.5c, each with its own migration), as the dispatch asks for own migration folders.
11. The first red run of 5.5a was lost (a wrong jest invocation); the log says so.

## 16. OPEN QUESTIONS for the owner

1. Which staff roles should act on behalf and review Free edits? The matrix has only SUPER_ADMIN, OPERATIONS and MARKETING; this run uses the first two.
2. The values staff must set before each feature turns on: `mediaMaxBytes`, `mediaAllowedTypes`, `mediaMaxPixels`, `testimonialMaxCount` (Amendment 08 asks for a maximum testimonial count) and `actOnBehalfMaxMinutes`. No default exists for any.
3. Should Free vendors ever be allowed the review link and testimonials? This run says no (Amendment 08, owner rule 2).
4. Counsel: wording for the testimonial label and for the consent confirmation text the vendor ticks; whether "Write a review on Google" is acceptable as the button wording.
5. A kit term for "Words shared by the business owner" (English and Tamil) and for a "Review us on Google" button; landing-page templates; editable menu labels; structured opening hours (the themes repo).
6. Which storage provider and bucket rules for pictures (a real adapter is a Release 2 item); the Banner Library folder and manifest to load.
7. Should staff be able to edit a vendor's draft fields through a session (an admin pass-through route), beyond banners, pictures and approvals?
8. A vendor-facing route for the in-app notice rows (decision and session notices).
9. The Banner Library: is "no identifiable people" also wanted for other families (for example wellness)?
10. Do seeded sites in the onboarding queue need an "assigned to" column (the seeded record already has an outreach owner)?
