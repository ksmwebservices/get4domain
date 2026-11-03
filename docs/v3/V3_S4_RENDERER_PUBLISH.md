# V3 slice 5.4: theme renderer, SEO layer and publish (design note)

Status: written first (S54.1), completed at the end of the slice (section 12). Spec: `docs/v3/SLICE_5_4_RENDERER_PUBLISH_SPEC.md`. Branch `v3-s54` on the pushed slice 5.3, with the theme kit (`origin/v3-themes`) merged in (S54.0). Only `backend-api/`, `themes/.gitattributes` and `docs/v3/` change. No frontend. Legacy billing, BOS, commercial and menu-gating tables are out of scope (decision D1); the legacy `VendorCMS` document is READ through a port only.

## 1. What it does

For one vendor: take the draft site content (the existing `VendorCMS` draft plus the vendor's items), pick a theme, render every page with the kit's renderer, wrap each page in a platform-written `<head>` (title, description, canonical, robots, Open Graph, Twitter, hreflang, JSON-LD), and store the result as a versioned snapshot in the database. Staff or the vendor then **publish** a snapshot or **roll back** to an older one. "Publish" means only that the snapshot becomes the one the read API serves. Nothing is exposed on any real host, no DNS or server changes (stop-line 2).

## 2. How the backend consumes the renderer (one source of truth)

The kit is plain ESM (`themes/lib/*.mjs`). The backend is CommonJS TypeScript. Options considered:

| Option | Verdict |
|---|---|
| Copy the renderer into `backend-api` | Rejected: can drift. |
| Commit a generated CommonJS copy and check it with a test | Rejected: it is still a second copy in the tree (the spec asks for a test that fails if one exists). |
| Dynamic `import()` of the `.mjs` files at run time | Rejected: works in Node but not under jest's VM (no ESM there), so the real renderer could not be unit tested. Node 20 images also differ on `require(esm)`. |
| **Build-time transform of the kit into `backend-api/dist/renderer/` (chosen)** | One source (`themes/`), the output is generated, git-ignored (`dist/`), never committed. |

How it works: `backend-api/scripts/build-renderer.js` starts from the kit entry modules (`render`, `theme`, `lint`, `pack`, `categories`, `schema`, `preset`), follows their relative imports, and transpiles each `.mjs` to a `.cjs` file with the TypeScript compiler already in `devDependencies` (`import.meta.url` is rewritten to the CommonJS equivalent; import specifiers `.mjs` become `.cjs`). It also copies `themes/library/` and `themes/data/` unchanged. The result mirrors the kit's folder layout, so the kit's own relative lookups (the library next to `lib/`) still work. `npm run build` runs it after `nest build`.

- **Loading.** `renderer-loader.ts` loads from `RENDERER_DIR` or `dist/renderer`. In development and tests (not production) a missing build is created on the fly in a hash-keyed cache folder from the same script, so the unit tests exercise the real renderer. In production a missing build is an error at start.
- **Docker.** The current `backend-api/Dockerfile` uses `backend-api` as the build context and cannot see `../themes`. The build script fails loudly in that case. A second file, `backend-api/Dockerfile.with-themes`, builds from the repository root. It is documented, not used by anything yet, and **not run** (no deploy in this slice). Switching the compose file to it is an owner decision at deploy time.
- **Tests.** The kit's own tests keep running in `themes/` (255). `site-single-copy.spec.ts` fails if `backend-api` (outside `node_modules` and `dist`) contains a renderer source (`export function renderPage`, a `themes/library`-style package, a `render.mjs`) or if the build script stops reading `../themes`. A contract test renders every theme x every category it lists through the backend service and runs the kit's own checks on the output.

`ThemeRenderService` loads the library read-only, validates every vendor theme at start with the kit's `lintTheme` (about 3 seconds for the five themes), refuses to serve a theme that fails (`THEME_INVALID`), caches by theme id and content hash, calls `renderPage` and returns the result with its warnings. No theme file is ever user supplied in this slice.

## 3. Content, theme and entitlements

- **ContentSource port.** `load(vendorId)` returns plain data (vendor, the published-plus-draft CMS fields, items, claim state). The Prisma implementation reads `Vendor`, `VendorCMS` (published columns with the `draft` overlay, via the existing `overlayDraft`), `VendorProduct` and the claim tokens. The mapping to the renderer's input (`content`, `settings`, `vendor`, `host`) is a pure function with fixtures. Slice 5.5 replaces the source; the port stays small.
- **Category.** The kit's category id is taken from the vendor's industry / pack key through the kit's category map (`packKey` to category, first match); a vendor with none, or an unknown one, cannot be built (`PUBLISH_BLOCKED`, missing `CATEGORY`).
- **Default theme.** The five Standard themes list disjoint categories that together cover all 41, so the default for a category is the one theme that lists it. This is derived from the theme manifests, not invented.
- **Theme resolution.** Stored choice in `g4d_site_settings`, else the category default. The plan feature `site.themes` decides: `assigned` (Free) allows only the category default, `library` (Pro) allows any vendor theme that lists the vendor's category. A theme the plan does not allow is refused with `FEATURE_LOCKED` and the plan's upsell text; an unknown theme id or one that does not list the category is `THEME_INVALID`; an `internal` theme (`_starter`) is `THEME_LOCKED`.
- **Entitlements input.** `toRenderEntitlements(resolved, hasVerifiedDomain)` from slice 5.1 (`hasVerifiedDomain` is false until slice 5.6). Languages: Tamil pages are rendered only when `site.language_ta` is ACTIVE and the site setting asks for it. Motion intensity is clamped: Free sites are at most LOW (no plan feature names a motion level, so this is a documented platform rule), Pro sites any level.
- **Rollback** needs `site.revisions` ACTIVE (Free shows it as a locked preview), publishing does not.

## 4. SEO layer (generated by the platform, never by a theme)

The renderer returns SEO *inputs* (`seo.title`, `description`, `canonical`, `structuredData`, `hreflang`). The platform layer in `src/site-publish/seo/` turns them into the final head. All functions are pure.

| Item | Rule |
|---|---|
| Title | `<=` 60 characters (cut at a word, ellipsis), never empty; fallback `<name> | <category label>`; text passes the safety filter below |
| Meta description | 50 to 160 characters; fallback built from name, category label and city; passes the safety filter |
| Canonical | self, on the vendor host (`https://<subdomain>.<site base>/<path>`; Tamil under `/ta/`); the custom domain only when the renderer says it is entitled |
| Robots | indexable: `index, follow, max-image-preview:large`; otherwise `noindex, nofollow`. The same value is stored in the publication as the header value. |
| Open Graph / Twitter | `og:type website`, `og:site_name`, `og:title`, `og:description`, `og:url`, `og:locale` (`en_IN` / `ta_IN`), `og:image` only when the vendor has a real http(s) image; `twitter:card` `summary_large_image` with an image, `summary` without |
| hreflang | only when more than one language is enabled (`en-IN`, `ta-IN`, `x-default`) |
| JSON-LD | the renderer's category subtype (`LocalBusiness` family from the category map) with name, address, phone, hours, geo; `sameAs` only from vendor-supplied profile URLs; plus `BreadcrumbList`; `Service`/`Product` entries only from real vendor items and **never an `offers` or `price`** |
| Safety filter | no rupee amount (`₹`, `Rs`, `INR` with a number, `/month`), no `Workspace`, `BOS`, `LeadSpace` and no old tagline in any generated SEO text; a violating string is replaced by its fallback, and the build reports it |
| `sitemap.xml` | built from the published page list when the site is indexable; empty `urlset` otherwise |
| `robots.txt` | allows everything (a noindex site must stay crawlable so the noindex can be read, the lesson of SEO-0); a `Sitemap:` line only when indexable |

## 5. Indexing rule (pure function `evaluateIndexing`)

A site is **noindex** (meta tag and stored header value) until all of these hold; the function returns `{ indexable, missing[] }`, `missing` holding stable codes the dashboard can show:

| Code | Meaning |
|---|---|
| `BUSINESS_NAME` | a business name |
| `CATEGORY` | a known category |
| `CLAIMED` | the owner has claimed the business (a USED claim token exists): free sites stay noindex until claimed |
| `VERIFIED_CONTACT` | a verified contact on the claim record. Until slice 5.7 (phone OTP) the verified contact is the owner's email, proved by using the emailed claim link; a USED claim token therefore satisfies both `CLAIMED` and `VERIFIED_CONTACT` |
| `ADDRESS_OR_SERVICE_AREA` | an address, or at least one service area |
| `HOME_CONTENT` | a tagline or an about text, and at least one service or gallery photo |
| `FORCE_NOINDEX` | staff switched the site to noindex |

Hard minimums that **block a publish** (`PUBLISH_BLOCKED`): `BUSINESS_NAME` and `CATEGORY` (nothing meaningful can be rendered). Everything else only makes the published site noindex.

## 6. Data dictionary (all additive, `g4d_` names via `@@map`, V3 prefix on model names, RLS on, no legacy table touched)

Enums: `V3MotionIntensity{OFF,LOW,MEDIUM,RICH}`, `V3PublicationStatus{DRAFT_PREVIEW,PUBLISHED,SUPERSEDED,ROLLED_BACK}`. `V3ActorType` is reused.

| Table | Columns | Notes |
|---|---|---|
| `g4d_site_settings` (`V3SiteSettings`) | vendorId UNIQUE (FK Vendor, cascade), themeId NULL, language (`en`, `ta`, `en,ta`), variant NULL (the layout variant id, derived and read-only), motionIntensity, forceNoindex, createdAt, updatedAt | tenant scoped |
| `g4d_site_publications` (`V3SitePublication`) | id, vendorId (FK), version (monotonic per vendor, UNIQUE with vendorId), status, themeId, themeHash, contentHash, indexable, indexHeader, missingFieldsJson, warningsJson, languages, totalBytes, rolledBackFromVersion NULL, createdByType, createdById, createdAt, publishedAt NULL, `currentVendorId` NULL UNIQUE | at most one PUBLISHED per vendor, enforced by the nullable unique (as in 5.1 and 5.3) |
| `g4d_site_publication_pages` (`V3SitePublicationPage`) | id, publicationId (FK, cascade), vendorId, path, lang, html (text), seoJson, bytes, sha256 | UNIQUE (publicationId, path, lang); also holds `/sitemap.xml`, `/robots.txt` and `/assets/site.css` (content type in `seoJson`) |
| `g4d_site_events` (`V3SiteEvent`) | id, vendorId (FK), publicationId NULL, type (`BUILT`, `PUBLISHED`, `ROLLED_BACK`, `THEME_CHANGED`, `NOINDEX_CHANGED`), actorType, actorId, detailJson, createdAt | "a site event" per action; ids and codes only |

Size guards: a page above the contract budget (100 KB) or the stylesheet above 46 KB (layout 40 KB + motion 6 KB) refuses the build with `SITE_BUDGET_EXCEEDED`. Stored pages link one shared stylesheet `/assets/site.css` instead of repeating the CSS in every page.

## 7. Services

- **SiteBuildService.build(vendorId, {themeId?, actor})**: resolves settings and theme, loads content, renders all pages for all enabled languages, builds the head, sitemap, robots and stylesheet, checks the budgets and the warning thresholds, writes a `DRAFT_PREVIEW` publication. Idempotent: if the newest publication has the same `themeHash`, `contentHash` and settings, it is returned and nothing is written. Warnings that make a build fail (`BLOCKING_WARNINGS`): `missing-template:*`, `unknown-category`, `missing:host.siteUrl`, `preset-ignored:invalid`. Other warnings (a vendor setting ignored, an empty optional field) are stored and shown, not blocking.
- **PublishService.publish(publicationId, actor)**: one transaction under `advisoryXactLock('site-publish:' + vendorId)`: re-checks the publication (hard minimums, budgets, entitlements), moves the previous PUBLISHED to SUPERSEDED, sets this one PUBLISHED with `currentVendorId`, writes an audit row and a site event. **rollback(vendorId, toVersion, actor)** copies the chosen older snapshot into a new version (status PUBLISHED, `rolledBackFromVersion` set, the superseded one keeps its history) in the same locked transaction.
- A concurrent double publish gives one PUBLISHED: the second waits for the lock, then finds a different current row and the database unique rule keeps one.

State machine (text):

```
build -> DRAFT_PREVIEW --publish--> PUBLISHED --(another publish or rollback)--> SUPERSEDED
                                       |
rollback(toVersion n): new row (version max+1) = copy of n, status PUBLISHED, rolledBackFromVersion = n, previous PUBLISHED -> SUPERSEDED
a DRAFT_PREVIEW that is never published stays as history; only the newest preview is shown in summaries
```

(`ROLLED_BACK` is kept in the status enum as the spec lists it: it marks the row that was published again as a rollback copy once a newer one replaces it, so the lineage reads PUBLISHED -> SUPERSEDED / ROLLED_BACK.)

## 8. API contract

Vendor routes (JWT; website-area members and the owner, `@RequireModule('website')`; theme change, publish and rollback are owner-only):

| Route | Notes |
|---|---|
| GET /v3/me/site | settings, current publication summary, newest preview summary, missing fields, allowed themes |
| PUT /v3/me/site/theme | `{ themeId }`, entitlement checked; owner only |
| POST /v3/me/site/build | build a preview |
| POST /v3/me/site/publish | `{ publicationId }`; owner only |
| POST /v3/me/site/rollback | `{ toVersion }`; owner only |
| GET /v3/me/site/preview/:publicationId/*path | stored html, `X-Robots-Tag: noindex, nofollow, noarchive`, `Cache-Control: no-store`; only the caller's own publications |

Staff routes (AdminGuard + matrix): `GET /v3/admin/sites` and `GET /v3/admin/vendors/:id/site` (summaries, **no html**) for all staff; `PUT .../site/theme`, `POST .../site/build`, `POST .../site/publish`, `POST .../site/rollback`, `GET .../site/preview/:publicationId/*path` (html) and `PUT .../site/noindex` (`{ forceNoindex }`) for OPERATIONS and SUPER_ADMIN.

Public read (internal use by the Next.js app and the future host mapper, read-only, rate limited): `GET /v3/public/site/by-host?host=&path=&lang=` returns the PUBLISHED html as `text/html` with `ETag` (the page's sha256), `Cache-Control`, `X-Robots-Tag` when not indexable and `Content-Language`; `If-None-Match` gives 304; one uniform 404 for an unknown host, an unpublished site, a suspended vendor, an unknown path. Preview rows are never reachable. The host lookup goes through a `HostResolver` port that uses the vendor `subdomain` today (domain tables arrive in 5.6).

Example summary:

```json
{ "success": true, "statusCode": 200, "data": {
  "settings": { "themeId": "free-service-pro", "language": "en", "variant": "bold-split", "motionIntensity": "LOW", "forceNoindex": false },
  "current": { "version": 3, "status": "PUBLISHED", "indexable": false, "publishedAt": "2026-11-05T09:00:00.000Z" },
  "preview": { "version": 4, "status": "DRAFT_PREVIEW", "warnings": [] },
  "missing": [ { "code": "CLAIMED", "label": "The owner has not claimed this business yet" } ] } }
```

Additive error codes (passed through the error filter; `PUBLISH_BLOCKED` carries `missing`): `THEME_INVALID` (400), `THEME_LOCKED` (403), `SITE_BUDGET_EXCEEDED` (422), `PUBLISH_BLOCKED` (409), `PUBLICATION_NOT_FOUND` (404). `FEATURE_LOCKED` (existing) is used for plan locks.

## 9. Provisioning seam

`siteDraftBuilderMode` (plan setting, `legacy` or `renderer`) chooses what CREATE_FREE_SITE_DRAFT does. `legacy` is the slice 5.3 adapter unchanged. `renderer` runs the same adapter first (so the `VendorCMS` draft exists), then creates the site settings with the category's default Standard theme and builds a `DRAFT_PREVIEW` publication. It never publishes. The code default is `legacy`; the owner switches staging to `renderer` with the plan-settings API (see `S54_LOG.md`).

## 10. Decision log

- D-1 Build-time transform, not a copy and not run-time ESM (section 2).
- D-2 Stored pages share one stylesheet asset.
- D-3 Verified contact = the used claim link until 5.7.
- D-4 Publishing an incomplete site is allowed and makes it noindex; only name and category block it.
- D-5 Staff MARKETING sees summaries only; html needs OPERATIONS or SUPER_ADMIN.
- D-6 `g4d_site_events` is a fourth table (the spec names three) because "a site event" needs somewhere to live.
- D-7 Free motion is clamped to LOW by a platform rule.
- D-8 Hours: `VendorCMS.businessHours` is free text, the renderer wants structured rows. The adapter does not guess; hours stay empty until slice 5.5 supplies structure.

## 11. Differences from the spec

(Completed at the end of the slice, section 12.)
