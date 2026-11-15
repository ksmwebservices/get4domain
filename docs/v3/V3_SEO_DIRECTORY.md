# V3 SEO block: directory pages, keyword targets, vendor-site SEO

> Branch `v3-seo1` (backend only: `backend-api/src/seo-directory/` and a small, optional hook in `site-publish`). Written 2026-11-15 at the end of slice 7.
> **Nothing here is pushed, migrated or run on staging.** Every command that touches staging is in section 12, for the owner, in order.
> The Next.js pages that render these models are **not** part of this branch (section 11).

## 1. What the block does

It makes the public directory searchable, in four parts that share one rule set:

1. **Directory pages** for every state, city, category, city + category, locality + category, pincode + category and business profile, as JSON page models the Next.js site renders (slices 1 and 2).
2. **Crawl plumbing**: the click-out `/v3/go/{id}`, sitemaps, a `robots.txt` text, a vendor-site monitoring list (slices 3 and 4).
3. **Keyword work for staff**: keyword targets, CSV import, a generated keyword plan, a tracked-link builder, UTM capture, backlink blocks and an embeddable badge (slice 5).
4. **Vendor-site SEO**: the vendor's own pages use staff-editable templates and a crawler list (slice 6).

Slices 7 (this document and the staging suite) and 8 (brand suffix, pagination, no ranking promises, the worked example) close it out.

| Slice | Commit | What |
|---|---|---|
| 1 | `4ff3ddd`, fix `028a01d` | geo and keyword model as data, page templates as data, category keyword loader |
| 2 | `4761e60` | page models and path resolver; `directoryPagesIndexable` OFF by default |
| 3 | `259616e` | click-out with a daily aggregate |
| 4 | `ebf6cb3` | sitemap index and chunks, `robots.txt` text, crawler list, vendor monitoring list |
| 5 | `ee8da37` | keyword targets, CSV, plan, link builder, UTM, backlink block, badge |
| 6 | `563bf2e` | vendor-site templates, brand suffix rule, vendor `robots.txt`, structured-data facts |
| 8 | `2f4ad60` | no ranking promises, H1 cap, Ranjith Plumber worked example |
| 7 | this commit | `test/seo-directory.int.spec.ts` (written, **not run**) and this file |

## 2. Rules that hold everywhere

- **Directory pages are noindex until staff switch them on.** The setting `directoryPagesIndexable` is **OFF by default**: every page model says `noindex, follow`, the sitemaps are empty and `robots.txt` has no `Sitemap` line. Counsel approves the wording first. Thin pages (fewer than `directoryThinPageMinBusinesses`, default 3) and empty pages stay noindex even when it is ON.
- **No price, no retired product name, no markup** in any text the platform writes (`isUnsafeSeoText`).
- **No ranking promises.** Platform-written text never says best, top, first, number one, guaranteed or rank (`core/ranking-claims.ts`). Enforced on: template save (refused) and read (a stored template that breaks it is ignored whole), keyword target texts, backlink anchors; the badge is fixed text. A business's own name and its own words are never checked (a shop may be called "Best Bakery").
- **Caps.** Title ≤ 60 and always ends ` | Get4Domain` (a `- Page N` marker comes before the brand); description ≤ 160; H1 ≤ 120 including `- Page N`. A cut happens at a word boundary and never removes the marker or the brand.
- **Canonical host** is the non-www main host. Page 1 has no `/page/1`; page N has a self canonical.
- **Platform-level data, staff only**: every table of the block has no tenant column and has RLS on with no policy. None holds an IP, user agent, referrer, visitor or business id.
- **Nothing here writes a Vendor row.** The block has its own module.

## 3. Data (all additive)

| Table | Slice | Migration | Purpose |
|---|---|---|---|
| `g4d_seo_category_keywords` | 1 | `20261216100000_v3_seo_geo_keywords` | singular, plural, synonyms, specialisations per category slug; STAFF rows are never overwritten by the loader |
| `g4d_seo_click_daily` | 3 | `20261216110000_v3_seo_click_daily` | day × page type × category × location × keyword target → count |
| `g4d_seo_keyword_targets` | 5 | `20261217100000_v3_seo_keyword_targets` | keyword + page path, status PLANNED / ACTIVE / PAUSED, priority 1 to 3, own title, description, H1 |
| `g4d_seo_utm_daily` | 5 | same | day × page type × source × medium × campaign × keyword target → count |

The templates and the crawler list live in `g4d_plan_settings` (keys `seoPageTemplates`, `seoCrawlerAgents`), not in new tables. The slice 5 migration was checked against `prisma migrate diff` output (tables and indexes identical); its two `CHECK` constraints (status, priority) are deliberate extras that Prisma does not model. `verify:migrations` and `verify:raw-sql` pass. **No migration has been applied anywhere.**

## 4. URL scheme

`/` · `/state/{state}` · `/{city}` · `/category/{category}` · `/{city}/{category-plural}` · `/{city}/{category-plural}-in-{locality}` · `/pincode/{pincode}/{category}` · `/business/{slug}`. Page N is a `/page/N` suffix from 2. Slugs are lower case with no ids.

Decisions kept as built: **the business profile stays `/business/{slug}`**, and **when two cities share a slug the first by sort order wins** (then by name). That means a second "Chennai" is simply not reachable at `/chennai`; the sitemap, the backlink block and the plan all follow the same choice, so they never list a page under the wrong city. **This is a known limitation to revisit** (a state-qualified city URL), not a settled design.

## 5. Routes

Public (rate limited, read only apart from the beacon):

| Route | Slice | Notes |
|---|---|---|
| `GET /v3/directory/pages/resolve?path=` and `GET /v3/directory/pages/:type` | 2 | page models, ETag, cacheable; 404 unknown, 410 removed business |
| `GET /v3/go/:businessId?src=&kw=` | 3 | 302 to the business **subdomain**; `noindex`, `no-store` |
| `GET /v3/directory/sitemaps/index.xml`, `/sitemaps/directory-{n}.xml`, `GET /v3/directory/robots.txt` | 4 | raw bodies, ETag |
| `POST /v3/directory/page-visits` | 5 | UTM beacon; always answers `{ ok: true }`; unknown body fields are refused (400) |
| `GET /v3/directory/backlink-block/:businessId` | 5 | brand link + up to four directory links |
| `GET /v3/directory/badge/{businessId}.svg`, `GET /v3/directory/badge-embed/:businessId` | 5 | fixed-text SVG, sandboxed; embed snippet |

Staff, under `/v3/admin/seo-directory` (the role matrix `auth/guards/admin-role-matrix.ts` is the single place that says who):

| Route | SALES (MARKETING) | ADMIN | SUPER_ADMIN | OPERATIONS, SUPPORT |
|---|---|---|---|---|
| `GET category-keywords`, `…/:slug`, `GET templates`, `GET crawlers`, `GET vendor-sites` | read | read | read | none |
| `PUT category-keywords/:slug`, `PUT templates` | no | yes | yes | none |
| `PUT crawlers` | no | **no** | yes | none |
| `GET keyword-targets`, `…/export.csv`, `…/:id`, `GET keyword-plan`, `…/export.csv`, `GET utm-report`, `POST links` (a calculation) | yes | yes | yes | none |
| `POST keyword-targets`, `PUT keyword-targets/:id`, `POST keyword-targets/import` | no | yes | yes | none |

There is **no delete route** anywhere: a target no longer wanted is set to PAUSED. Every write leaves an audit row (`seo.*` actions).

## 6. Click-out (slice 3)

`/v3/go/{id}` counts the Visit-site click on the existing daily counter, adds one row to `g4d_seo_click_daily`, and answers 302. The target is built **only** from the stored subdomain label and our base domain, then checked (one DNS label, https, no port, no credentials), so nothing in the request can choose where it goes. **Decision: the click-out stays subdomain-only even when the custom-domain add-on is active.** The subdomain itself answers with its own redirect to the custom domain while that add-on is active; the click-out never consults the custom domain or the canonical switch. A failed aggregate write never blocks the visitor.

## 7. Keyword targets (slice 5)

**Target** = a keyword and the directory page it is aimed at. `PLANNED` and `PAUSED` do nothing. An `ACTIVE` target gives that exact page its own title, description and H1 (still capped, and refused if it carries a price, markup, a retired product name or a ranking claim), and its id rides on every card's click-out as `kw=`, so the click report says which keyword a click came from. When several ACTIVE targets name one page the lowest priority number wins, then the oldest; the id comes from that one, the text from the best target that has any. Page overrides are cached for 60 seconds and every write drops the cache.

**CSV import** (`POST keyword-targets/import`, body `{ csv, apply }`). Columns: `keyword`, `path` (required), `status`, `priority`, `title`, `description`, `h1`, `notes`, `source` (optional). It is a **dry run unless `apply` is true**; it reports every problem with its row number and **one problem anywhere blocks the whole apply**; an apply is one transaction; importing the same file twice changes nothing. For a row that exists already only the filled columns change; a **blank cell never clears a value** (clear through `PUT`). At most 5,000 rows. Cells that a spreadsheet would run as formulas are written with a leading apostrophe on export and restored on import.

**Keyword plan** (`GET keyword-plan`, `…/export.csv`). For every city + category and locality + category page the sitemap would list, it proposes `{plural} in {place}` (priority 1), `{singular} in {place}` (2) and each staff-entered synonym (3). It reads the same page list as the sitemap, so it never proposes a thin or empty page, and it stores nothing. Edit the CSV, import it back: rows arrive `PLANNED` with source `PLAN`. **A plan changes no page until a row is made ACTIVE.** The plan does not cover city, state, category or pincode pages (a category-only keyword is too broad to propose without staff judgement).

**Link builder** (`POST links`). `{ path, source, medium, campaign, keywordTargetId? }` gives the canonical address plus `utm_source`, `utm_medium`, `utm_campaign` and `kw`. The three values are short lower-case tokens only (`a-z`, `0-9`, `-`, `_`, up to 30), so a link can never carry free text or a URL. A target id must exist and belong to the same page.

## 8. UTM capture (slice 5)

The Next.js page sends one `POST /v3/directory/page-visits` **after the page loads, only when the URL carried `utm_*` or `kw`** (so crawlers and ordinary visits are never counted). The server reduces it to day, page type, three tokens and a target id and adds one to a counter with a single atomic `INSERT … ON CONFLICT` statement. The controller reads no address and no header. A value that is not a valid token is dropped, a visit with no campaign information is ignored, and a per-process guard folds new combinations into `other` after 2,000 in one day (approximate across processes; the beacon is also rate limited per IP). Staff read it at `GET utm-report` (default last 30 days).

## 9. Backlink block and badge (slice 5)

**Block**: one brand link (`Get4Domain`) and **up to four** directory links, in this order: the business's own city + category page, its locality + category page, its category page, its city page. Only pages in the sitemap list are linked, and **none while the directory pages are not indexable** (a link to a noindex page helps nobody): the block is then the brand link alone. The anchor of each link is chosen from several honest wordings by a stable hash of the business id (and an optional period), so a page does not change wording on every render while two businesses in one city do not all use the same words. A wording that would claim a rank is dropped. The route also returns escaped HTML.

**Badge**: `…/badge/{businessId}.svg` is fixed text, "Listed on Get4Domain": no business name, number, rating or claim, so nothing a business controls can enter the picture. Served with a `default-src 'none'; sandbox` policy, `nosniff`, `noindex`, cross-origin allowed and cacheable. `badge-embed/{id}` returns the snippet (the badge, linked to the profile). **A business that is unknown, removed or a draft gets the same 404 on all three routes**, so a removed business stops showing them at once.

**Not wired into the vendor themes.** The block and the snippet are data; putting them into the footer of a theme is renderer and theme-kit work and an owner decision (section 13).

## 10. Vendor-site SEO (slice 6)

The site build reads the staff-editable `vendorHome` and `vendorPage` templates and the crawler list through a read-only port (`VendorSeoSettings`), so `site-publish` does not depend on this module; without the port nothing changes.

- **Title**: the vendor's own title wins when it is safe and fits in 60; otherwise the template. Home: `{vendorName} | {category} in {locality}, {city}`; inner pages `{pageName} | {vendorName}, {category} in …`. Each falls back to a shorter form when a value is missing (the locality is `contact.area`, often empty).
- **Brand suffix**: a site on a `get4domain.com` subdomain gets ` | Get4Domain`; a site on its own custom domain does not.
- **Description**: the vendor's own override, then the vendor's own sentences (≥ 50 characters), then the template, then the old bare line. The vendor's words always lead.
- **Structured data**: `areaServed` (the city) and a postal address (city, `IN`) are added **only** when the theme's own block lacks them; never an offer, price, rating or review.
- **robots.txt**: every crawler staff named (SUPER_ADMIN edits the list) gets its own group with `Allow: /`, then the catch-all group; the `Sitemap` line only when the site is indexable. A site is never disallowed (a noindex page must stay crawlable so its tag can be read).
- **Rebuilds**: the templates, the crawler list and the brand rule go into the settings hash. **After this ships, every vendor site is rebuilt on its next build or publish** (its hash differs once), and again whenever staff edit a template or the crawler list. An unchanged site with unchanged settings is still reused.
- **Not done**: no `lastmod` in the vendor sitemap (builds are byte-for-byte deterministic and the build has no trustworthy change time).

## 11. What the Next.js site must do (not in this branch)

Render the page models at the paths in section 4 (the JSON already carries title, description, canonical, robots, JSON-LD, breadcrumbs, facets, cards, pagination and FAQ); serve `/sitemap.xml`, `/sitemaps/directory-{n}.xml` and `/robots.txt` from the raw routes; add the `page-visits` beacon (client side, only with `utm_*` or `kw`); keep the card's `visitUrl` as the Visit-site link. Until then nothing is public: the backend has no effect on the live site.

## 12. Owner commands for staging, in order

`npm.cmd`, from `C:\Get4Domain\get4domain-seo1\backend-api` unless stated. **Nothing below has been run.**

1. Copy `.env.staging` into `C:\Get4Domain\get4domain-seo1\` (not in git).
2. `npm.cmd ci`, then `npx.cmd prisma generate`.
3. `npm.cmd run db:staging:migrate-status`. Expect `20261216100000_v3_seo_geo_keywords`, `20261216110000_v3_seo_click_daily` and `20261217100000_v3_seo_keyword_targets` pending (plus anything else this branch has that staging lacks). Then `npm.cmd run db:staging:migrate-deploy`, then `migrate-status` again (none pending).
4. `npm.cmd run db:staging:rls-off` (no table without RLS), then `npm.cmd run db:staging:drift` (the 2 documented allowed items only).
5. `npm.cmd run build` (includes the renderer), then `npm.cmd run test:ci` (expect all green).
6. Keyword sets: `node scripts/seo-category-keywords-load.js` (a **dry run**; read the counts), then `node scripts/seo-category-keywords-load.js --apply`. Run the dry run again: nothing to create.
7. The new suite alone first: `npm.cmd run test:int -- --runTestsByPath test/seo-directory.int.spec.ts`. It switches `directoryPagesIndexable` ON and the thin-page minimum to 3 for its run and **restores both, and the templates and crawler settings, in `afterAll`**. Then the full `npm.cmd run test:int`.
8. `npm.cmd run test:cleanup-staging -- --count` (must print 0). The suite removes its own places, category, businesses, keyword row, targets and aggregate rows; the audit rows of its staff writes stay (the log is append-only).
9. Check staging is back to its settings: `GET /v3/admin/seo-directory/templates` and `…/crawlers` show what they showed before step 7, and `directoryPagesIndexable` is still OFF.
10. **Do not push without asking**: a push creates a Vercel Preview deploy. When ready: `git push origin v3-seo1`.

## 13. Open questions and known limits

1. **Same-slug cities**: first by sort order wins (section 4). Revisit with a state-qualified URL when a real duplicate exists.
2. **Backlink block in themes**: wiring it into the footer of the five themes needs theme-kit work. Say if you want it.
3. **Vendor titles change on rebuild** (section 10), including the ` | Get4Domain` suffix on subdomain sites. Confirm the suffix is wanted on vendor pages, not only on the directory.
4. **`directoryPagesIndexable` stays OFF** until counsel approves the wording. Nothing in this branch switches it on outside the staging suite.
5. **Ranking-claim list** is a regular expression (best, top, first rank, number one, guaranteed, leading, cheapest, rank…). A place called "Top Slip" loses only the anchor wordings that contain it; extend the list in `core/ranking-claims.ts` if counsel names more words.
6. **UTM cap** is per process. Behind several instances the true cap is the cap times the number of instances.
7. **No keyword target delete** and no bulk status change; PAUSED is the removal.
8. Directory JSON-LD carries stored facts only: address, position and opening hours appear only for a **claimed** profile (the owner's consent); a telephone, price, offer, rating or review never appears.

## 14. Worked example: Ranjith Plumber

A claimed plumber in Perambur, Chennai (`test/seo-ranjith-example.spec.ts` asserts every line):

| Page | Title | Notes |
|---|---|---|
| `/business/ranjith-plumber` | `Ranjith Plumber \| Plumber in Perambur, Chennai \| Get4Domain` (59) | description `Ranjith Plumber: Plumber in Perambur, Chennai. Address, services and website on get4domain.com.` |
| `/chennai/plumbers-in-perambur` | `Plumbers in Perambur, Chennai \| Get4Domain` | cards click out with `?src=localityCategory` (and `&kw=<id>` once a target is ACTIVE) |
| `/chennai/plumbers` | `Plumbers in Chennai \| Get4Domain` | |
| `/category/plumber` | `Plumbers Near You \| Get4Domain` | |
| `/chennai/plumbers-in-perambur/page/2` | `Plumbers in Perambur, Chennai - Page 2 \| Get4Domain` | self canonical; `prevPath` page 1, `nextPath` page 3 |
| vendor site `ranjith.get4domain.com/` | `Ranjith Plumber \| Plumber in Perambur, Chennai \| Get4Domain` | on a custom domain: no ` \| Get4Domain` |

Backlink block for Ranjith: brand link `Get4Domain`; links to `/chennai/plumbers`, `/chennai/plumbers-in-perambur`, `/category/plumber`, `/chennai` with anchors such as "Plumbers in Chennai", "Perambur Plumbers", "Find a plumber in Perambur". No page, anchor or badge says best, top or first.

## 15. Tests

Unit (run by `test:ci`): `seo-keywords`, `seo-templates`, `seo-pages`, `seo-click-out`, `seo-sitemaps`, `seo-targets` (slice 5), `seo-vendor-site` (slice 6), `seo-ranjith-example` (slice 8), the role-matrix oracle, the route baseline and `staging-harness-compile` (which compiles the slim app with the SEO providers, so a missing provider fails without staging). Staging (`test:int`, **written, not run**): `seo-directory.int.spec.ts`: migration objects (RLS, unique keys, status and priority checks), roles over HTTP, target create, duplicate and edit, the CSV round trip, an override reaching a page model and the click-out, exact daily aggregates under 30 and 25 parallel calls, the sitemap and plan reading real rows, the backlink block, the badge and the 404 for a removed business, and the templates and crawler list the build reads.
