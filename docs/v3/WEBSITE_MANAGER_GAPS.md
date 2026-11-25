# Website Manager: what exists, what is missing, the smallest change (lane A, step 1)

Read only, 25 Nov 2026. Code read in this worktree (`backend-api`, same backend as `release-v3-26nov`; the diff between them has no `backend-api` change). Hour figures are build plus tests for one engineer, no staging deploy.

Where the pieces live: the vendor's draft is the **managed document** (`backend-api/src/v3-website/core/managed-doc.ts`), edited through `PUT /v3/me/site/draft/*` (`v3-website/api/website.controllers.ts`), laid over the legacy site document by `site-publish/content/content-adapter.ts`, rendered by `SiteBuildService`. Staff reach the same routes through an **act-on-behalf session** (`v3-website/act-on-behalf`).

## 1. hero.image stays empty until set

- **Exists:** field `hero.image` (image, https, 500) in `FIELD_DEFS`, alt `hero.imageAlt`; adapter reads `cms.banner` (`content-adapter.ts:111`). Staff and vendor banner routes exist: `GET/POST /v3/me/site/banner(s)`, `GET/POST /v3/admin/vendors/:id/site/banner(s)`, and a `banner-library` (staff).
- **Missing:** the trial site **writes a placeholder**: `v3-trial/module-trial-site.ts:60-79` puts `GENERATED_BANNER = '/starter/generic/hero.svg'` into `VendorCMS.banner` and the draft (marked a sample) when the pack has no pictures. So the field is not empty, and a staff-created vendor (`v3-admin-vendor-site`) shows a placeholder as if it were a banner.
- **Smallest change:** stop writing the generated file (delete the fallback branch, keep the pack's own starter pictures only if you want them; owner rule says empty), and add a theme/adapter test that an empty `hero.image` renders the hero scene without a broken image. **About 3 h** (change is small, the work is checking all themes under `themes/` handle empty `hero.image`; I have not verified that yet).

## 2. Vendor profile fields, editable by vendor and staff

| Field | Exists | Missing |
|---|---|---|
| logo | `brand.logo` (`PUT draft/brand`); `cms.logo` read by the adapter | none (check the staff path) |
| banner | `hero.image` | see item 1 |
| opening hours | `draft` hours rows (`hours-core.ts`) | none |
| phone, WhatsApp, email | `contact.phone`, `contact.whatsapp`, `contact.email` | none |
| Google Maps link | `location.mapLinkInput` (`PUT draft/location`, parsed for coordinates) | none |
| social links | instagram, facebook, youtube, linkedin, x, one custom link | none |
| **owner name** | `Vendor.name` exists, not in the site document | field and display |
| **organisation name** | not stored (only `businessName`) | field |
| **established year** | none | field |
| **Google Business Profile link** | none | field (and `sameAs` for JSON-LD later) |

Staff edit the same fields through act-on-behalf; a separate profile route (`v3-profile-fields`: `GET/PUT /v3/me/profile`, `.../seeded-sites/:id/profile`) holds the common set (`profile-core.ts:27`) with no owner, organisation, year or GBP link either.

- **Smallest change:** four new text/url keys in `FIELD_DEFS` (`about.ownerName`, `about.organisation`, `about.established` (4-digit year check), `social.googleBusiness`), pass them through `content-adapter.ts` (`about` and `social` blocks), add rows to `COMMON_FIELDS` and `COMMON_MAP`. Themes only draw them if they read the new keys; drawing is a theme task and out of this lane except the founding line. **About 5 h.**

## 3. Branches (several locations per vendor)

- **Exists:** one location per vendor: `Location` (`addressLine1/2`, `city`, `state`, `pincode`, coordinates, `mapLinkInput`) in `location-core.ts`, `PUT draft/location`.
- **Missing:** a list of locations; the fields locality/village and area (the content has `contact.area: ''` hard-coded, `content-adapter.ts` contact block), and any theme field for several addresses.
- **Smallest change:** a `branches` list in the managed document (name, addressLine, locality, area, city, pincode, mapLink), validated with the existing location rules, written through `PUT draft/list/branches`, mapped to a `content.branches` array. No migration (the document is JSON). Plan limit: use the payload ceiling. **About 7 h.** The first branch stays the main `location`.

## 4. Editable lists: groups, areas, offers, blocks

- **Exists:** `LIST_DEFS` has faqs, gallery, steps, trust, stats, team, credentials, pages. Anything else returns `FIELD_LOCKED: That list is not editable.` (`managed-doc.ts:160`, and the same text at `website.service.ts:185`).
- **Missing:** `groups`, `areas`, `offers`, `blocks` are hard-coded empty arrays in the adapter (`content-adapter.ts:121,127`). `areas` also feeds the indexing check `ADDRESS_OR_SERVICE_AREA`, so today a vendor can only satisfy it with an address.
- **Smallest change:** four new entries in `LIST_DEFS` and `ListName` (areas: name; groups: title, summary, items text; offers: title, text, valid-until; blocks: title, text, image), and read them in the adapter in place of `[]`. Existing validation code is reused. **About 6 h** (themes that do not draw offers/blocks ignore them).

## 5. Items with full detail (own landing page)

- **Exists:** `VendorProduct` (name, description, price, image, category, `customFields` JSON, active), edited by `GET/POST/PUT /v3/me/items`. The site already plans an **item page per item** (`/services/<slug>`, `content-adapter.ts:147-154`, SEO key `item:<id>`).
- **Missing:** the adapter's item has only id, slug, name, description, price, image, category (it hard-codes `duration`, `tags`, `includes`, `location`, `area` empty). No summary, details, gallery, FAQ, status (ongoing, upcoming, completed) or area.
- **Smallest change:** no migration: store `summary`, `details`, `gallery[]`, `faqs[]`, `status` (enum), `area` in `customFields` (validated in the items service), extend `SourceItem` and the adapter item, and let the item template read them. **About 9 h**, the largest item.

## 6. Staff edit any vendor draft; staff reset a vendor's password

- **Exists:** staff edit a vendor's draft in an **act-on-behalf session** (`POST /v3/admin/vendors/:id/act-on-behalf`, reason required, vendor told, expires by setting, logged). Staff also have `vendors/:id/site/build`, `.../publish`, `.../noindex`, `.../site/media`, `.../site/banner`, `.../business-name`.
- **Missing:** a staff password reset. By design `act-on-behalf-core.ts` forbids staff changing a password inside a session; the only reset is the vendor's own `POST /auth/password/forgot` by e-mail.
- **Smallest change:** a staff route `POST /v3/admin/vendors/:id/send-password-reset` that **sends the vendor the existing reset link** (reusing `AccountSecurity` token issue), audited, rate limited. Staff never see or set a password. **About 4 h.** *(decision below)*

## 7. Image upload for logo, banner and gallery end to end

- **Exists:** `POST /v3/me/media` (multipart `file` + `alt`; `GET /v3/me/media/limits`, `GET`, `DELETE :id`) in `v3-media-upload`; `POST /v3/me/site/media` and `/banner` in `v3-website`; staff `POST /v3/admin/vendors/:id/site/media|banner`. Checks in order: switched on, within the byte cap, **real bytes** an allowed type matching the declared one, no active content in SVG or PDF, alt text for a picture, then decode and re-encode (metadata dropped). The key is built from ids and the content hash; the same file twice is one row.
- **What it needs to work (settings and env names, no values):**
  - Staff plan settings (`g4d_plan_settings`, `StorageSettings`): `storagePublicEndpoint`, `storagePublicBucket`, `storagePublicBaseUrl` (https custom media domain, **not** r2.dev), `storagePublicRegion`, `mediaUploadMaxBytes`, `mediaUploadMaxPixels`, `mediaUploadAllowedTypes`. All default to **null = uploads refused**, no invented defaults.
  - Server env: `STORAGE_PUBLIC_ACCESS_KEY_ID`, `STORAGE_PUBLIC_SECRET_ACCESS_KEY` (public store), `STORAGE_PRIVATE_ACCESS_KEY_ID`, `STORAGE_PRIVATE_SECRET_ACCESS_KEY` (private), and `MEDIA_STORAGE_MODE=fake` selects an in-memory store (tests, not real).
- **Missing:** I cannot see from code whether staging has these settings and keys; the three screens (logo, banner, gallery) must be proven by one real upload on staging. A returned upload `url` must pass the `https` image check to be saved into `hero.image`, `brand.logo` or a gallery item.
- **Smallest change:** none in code if staging has the settings; otherwise an owner action (settings, keys). Add one end-to-end test with the fake store (upload, then write the url into `hero.image`, `brand.logo`, `gallery`, then build). **About 3 h.**

## 8. Indexing readiness checklist for staff

- **Exists:** the rule `evaluateIndexing` and the API `GET /v3/admin/vendors/:id/site` returns `missing: [{code, label}]` per vendor (`site-settings.service.ts:status`); `GET /v3/admin/sites` lists summaries with `forceNoindex` but **not** the missing list. Vendor side: the same status in the vendor's site summary.
- **Missing:** a checklist in the admin screen (that part is the UI repo), a missing list on the sites list, and two mismatches: `status()` does not pass the seeded mode (a seeded vendor shows `CLAIMED` missing instead of `SEEDED_INDEXING_OFF`), and `serviceAreas` is always 0 until item 4 lands. Also, **`claimed` is read when the site is built**, so the checklist can say "ready" while the published page is still noindex until a rebuild.
- **Smallest change:** backend: add the seeded branch to `status()`, return `missing` and an `indexable` flag with `publishedIndexable` (from the current publication) on `GET /v3/admin/sites`. UI: one checklist component on the vendor's site page (ticks and the label text from `MISSING_LABELS`). **About 5 h** (3 backend, 2 UI).

## Claim and rebuild (needed for the final test)

A claim by token does **not** build a site by itself. A site is rebuilt by: the owner's **approve** in `claim-setup` (`buildAndPublish`, `claim-setup.service.ts:101`), `draft/publish`, the staff `site/build` and `site/publish`, and the canonical switch. So after a plain claim the page stays noindex until the owner approves or someone builds. **Smallest fix: 3 h** (after a claim, call the same `buildAndPublish`, or rebuild when the claim record turns used). To be proven on staging in step 4.

## Total and order

| # | Item | Hours |
|---|---|---|
| 1 | hero.image empty | 3 |
| 2 | profile fields | 5 |
| 3 | branches | 7 |
| 4 | lists | 6 |
| 5 | item detail | 9 |
| 6 | staff reset link | 4 |
| 7 | upload end to end | 3 |
| 8 | indexing checklist | 5 |
| + | claim triggers rebuild | 3 |
| | **Total** | **45 h** |

Order: 1, 7, 2, 4, 3, 5, 8, claim rebuild, 6 (small first, risk last).

## Decisions needed

1. **Staff password reset:** build a staff "send reset link" (recommended), or allow staff to set a password (the code forbids it today by design).
2. **Staging:** I do not have the staging address, the old staging image tag or how staging is deployed in this repo's docs for the current backend; I need them, or approval to find them from the server files, before step 3.
3. **Storage:** are the upload settings and keys set on staging (item 7), or do you set them?
4. **Rebuild after a claim:** rebuild at once on claim (recommended), or keep the owner's approve as the only trigger.
