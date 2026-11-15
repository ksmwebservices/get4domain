# V3 SEO block: directory pages, keyword targets, vendor-site SEO

> Branch `v3-seo1` (backend only: `backend-api/src/seo-directory/` and small, optional hooks in `site-publish` and `v3-website`). Written 2026-11-15 at the end of slice 7; extended the same day after the line-by-line check against `SEO_BLOCK_PROMPT.md` sections 6 and 8 (section 16 below).
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
| 7 | `d782ff1` | `test/seo-directory.int.spec.ts` (written, **not run**) and this file |
| 5b | `99f9330` | backlink block with nearby-locality links and the owner's anchor wordings; badge text link; vendor and staff badge routes (prompt 8e, 8f) |
| 6b | `59210d4` | vendor sites: locality and city from the directory listing, services in the description, Organization, WebSite and FAQPage, directory links as data (prompt 6a, 6b, 8e) |
| 6d | `933b74e` | llms.txt per vendor site and a global llms.txt (prompt 6d) |
| 6e | `bbd56e0` | Stage 14 report: MISSING_LOCALITY, TITLE_NO_KEYWORD, DUPLICATE_DESCRIPTION (prompt 6e) |
| 8d | `e05cf73` | keyword research list, modifiers setting, Keyword Planner volume import (prompt 8d) |
| 8c | this commit | the four-title example test, and this document brought up to date |

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
| same table, two columns | 8d | `20261218100000_v3_seo_keyword_volume` | `volume` (average monthly searches) and `competition` (LOW, MEDIUM, HIGH), both nullable, both filled only from an imported Keyword Planner file or typed by staff |
| `g4d_seo_utm_daily` | 5 | same | day × page type × source × medium × campaign × keyword target → count |

The templates, the crawler list and the research modifiers live in `g4d_plan_settings` (keys `seoPageTemplates`, `seoCrawlerAgents`, `seoKeywordModifiers`), not in new tables. The slice 5 migration was checked against `prisma migrate diff` output (tables and indexes identical); its two `CHECK` constraints (status, priority) are deliberate extras that Prisma does not model. `verify:migrations` and `verify:raw-sql` pass. Both slice 5 migrations are hand-written, additive, and pass `verify:migrations`; the volume one adds two nullable columns, two `CHECK`s and an index. **No migration has been applied anywhere.**

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
| `GET /v3/directory/llms.txt` | 6d | the directory's llms.txt; 404 while `directoryPagesIndexable` is OFF |
| `GET /v3/directory/badge/{businessId}.svg`, `GET /v3/directory/badge-embed/:businessId` | 5 | fixed-text SVG, sandboxed; embed snippet and the plain text link |
| `GET /v3/me/directory/badge` | 8f | the signed-in owner's own snippet and text link (owner only; the vendor comes from the principal) |

Staff, under `/v3/admin/seo-directory` (the role matrix `auth/guards/admin-role-matrix.ts` is the single place that says who):

| Route | SALES (MARKETING) | ADMIN | SUPER_ADMIN | OPERATIONS, SUPPORT |
|---|---|---|---|---|
| `GET category-keywords`, `…/:slug`, `GET templates`, `GET crawlers`, `GET vendor-sites` | read | read | read | none |
| `PUT category-keywords/:slug`, `PUT templates` | no | yes | yes | none |
| `PUT crawlers` | no | **no** | yes | none |
| `GET keyword-targets` (`?sort=volume`), `…/export.csv`, `…/:id`, `GET keyword-plan`, `…/export.csv`, `GET keyword-plan/research` (counts), `…/research.csv`, `…/planner.csv`, `GET modifiers`, `GET utm-report`, `GET businesses/:id/badge`, `POST links` (a calculation) | yes | yes | yes | none |
| `POST keyword-targets`, `PUT keyword-targets/:id`, `POST keyword-targets/import`, `POST keyword-targets/import-volumes`, `PUT modifiers` | no | yes | yes | none |

There is **no delete route** anywhere: a target no longer wanted is set to PAUSED. Every write leaves an audit row (`seo.*` actions).

## 6. Click-out (slice 3)

`/v3/go/{id}` counts the Visit-site click on the existing daily counter, adds one row to `g4d_seo_click_daily`, and answers 302. The target is built **only** from the stored subdomain label and our base domain, then checked (one DNS label, https, no port, no credentials), so nothing in the request can choose where it goes. **Decision: the click-out stays subdomain-only even when the custom-domain add-on is active.** The subdomain itself answers with its own redirect to the custom domain while that add-on is active; the click-out never consults the custom domain or the canonical switch. A failed aggregate write never blocks the visitor.

## 7. Keyword targets (slice 5)

**Target** = a keyword and the directory page it is aimed at. `PLANNED` and `PAUSED` do nothing. An `ACTIVE` target gives that exact page its own title, description and H1 (still capped, and refused if it carries a price, markup, a retired product name or a ranking claim), and its id rides on every card's click-out as `kw=`, so the click report says which keyword a click came from. When several ACTIVE targets name one page the lowest priority number wins, then the oldest; the id comes from that one, the text from the best target that has any. Page overrides are cached for 60 seconds and every write drops the cache.

**CSV import** (`POST keyword-targets/import`, body `{ csv, apply }`). Columns: `keyword`, `path` (required), `status`, `priority`, `title`, `description`, `h1`, `notes`, `source` (optional). It is a **dry run unless `apply` is true**; it reports every problem with its row number and **one problem anywhere blocks the whole apply**; an apply is one transaction; importing the same file twice changes nothing. For a row that exists already only the filled columns change; a **blank cell never clears a value** (clear through `PUT`). At most 5,000 rows. Cells that a spreadsheet would run as formulas are written with a leading apostrophe on export and restored on import.

**Keyword plan** (`GET keyword-plan`, `…/export.csv`). For every city + category and locality + category page the sitemap would list, it proposes `{plural} in {place}` (priority 1), `{singular} in {place}` (2) and each staff-entered synonym (3). It reads the same page list as the sitemap, so it never proposes a thin or empty page, and it stores nothing. Edit the CSV, import it back: rows arrive `PLANNED` with source `PLAN`. **A plan changes no page until a row is made ACTIVE.** The plan does not cover city, state, category or pincode pages (a category-only keyword is too broad to propose without staff judgement).

**Link builder** (`POST links`). `{ path, source, medium, campaign, keywordTargetId? }` gives the canonical address plus `utm_source`, `utm_medium`, `utm_campaign` and `kw`. The three values are short lower-case tokens only (`a-z`, `0-9`, `-`, `_`, up to 30), so a link can never carry free text or a URL. A target id must exist and belong to the same page.

**Research list for Keyword Planner** (prompt 8d). `GET keyword-plan/research` is the dry run: counts only, per kind. `research.csv` (keyword, the page it maps to, kind) and `planner.csv` (one keyword per row under the header `Keyword`, each once) are the files; `node scripts/seo-keyword-research.js` is the same dry run by default and writes the two CSV files only with `--apply` (it never writes a database row). Built only from our own data and only for pages that exist: category words and staff synonyms × city, × locality, × pincode; the **modifiers** from the setting (default `best`, `top`, `near me`, `24 hours`, `in {locality}`, `services`: the first, second and fourth go in front of the word, `services` after it, `near me` is mapped to the category page once, an entry with `{locality}` applies to locality pages only); service × city where at least `directoryThinPageMinBusinesses` listed businesses offer that service in that city; business name × locality and × city mapped to the profile. At most 50,000 rows. **Modifiers are for research only**: they are never written into a page title or description, and a ranking word ("best") is allowed in this one setting and refused everywhere else (templates, overrides, anchors).

**Volumes back in** (`POST keyword-targets/import-volumes`, body `{ csv, apply }`). Upload the research file to Keyword Planner, export the result **as CSV** (comma separated, UTF-8; the title lines above the header are skipped), and import it. A dry run unless `apply`; one transaction; an audit row. Only a **whole number** of monthly searches counts: a range such as "1K - 10K", a blank or a decimal is skipped and listed with its row, never guessed. Competition is Low, Medium or High (case ignored) or nothing. A keyword that is already a target gets the volume on every target of it; one of **our** research keywords that is not yet a target becomes `PLANNED` targets (source `PLAN`) for the pages it maps to, so the whole list never has to be imported first (a volume of 0 creates nothing); any other keyword is ignored (it is not ours, so it maps to no page). `GET keyword-targets?sort=volume` lists the most searched first.

## 8. UTM capture (slice 5)

The Next.js page sends one `POST /v3/directory/page-visits` **after the page loads, only when the URL carried `utm_*` or `kw`** (so crawlers and ordinary visits are never counted). The server reduces it to day, page type, three tokens and a target id and adds one to a counter with a single atomic `INSERT … ON CONFLICT` statement. The controller reads no address and no header. A value that is not a valid token is dropped, a visit with no campaign information is ignored, and a per-process guard folds new combinations into `other` after 2,000 in one day (approximate across processes; the beacon is also rate limited per IP). Staff read it at `GET utm-report` (default last 30 days).

## 9. Backlink block and badge (slice 5)

**Block**: one brand link (`Get4Domain`) and **up to four** plain follow links to directory pages, in this order: the business's own **locality + category** page, its **city + category** page, **one nearby locality** of the same city for the same category (a different neighbour for different businesses), then its **city** page; the bare category page only if room is left. Only pages in the sitemap list are linked, and **none while the directory pages are not indexable** (a link to a noindex page helps nobody): the block is then the brand link alone. The anchor of each link is chosen from several honest wordings by a stable hash of the business id (and an optional period), for example "Plumbers in Perambur, Chennai", "Find more Plumbers in Chennai on Get4Domain", "Perambur Plumber directory", so a page does not change wording on every render while two businesses in one city do not all use the same words. A wording that would claim a rank is dropped. The route also returns escaped HTML. **In the publish pipeline** (prompt 8e) the vendor site build attaches the same block to the renderer input as `host.directoryLinks` (`{ brand, links[] }`, data only) when the vendor has a listing; it is part of the settings hash, so a change in the directory rebuilds the site.

**Badge** (prompt 8f): `…/badge/{businessId}.svg` is fixed text, "Listed on Get4Domain": no business name, number, rating or claim, so nothing a business controls can enter the picture. Served with a `default-src 'none'; sandbox` policy, `nosniff`, `noindex`, cross-origin allowed and cacheable. `badge-embed/{id}` returns the snippet (the badge image, linked to the profile) **and the plain text link** "Find {business name} on Get4Domain" with the profile address, as text and as an escaped anchor, for a bio or a profile that cannot hold an image. The owner reads their own at `GET /v3/me/directory/badge`, staff at `GET /v3/admin/seo-directory/businesses/:id/badge`. No tracking script: a link and an image. The picture is served from the API host (the media host and its storage credentials are not set up yet; see section 13). **A business that is unknown, removed or a draft gets the same 404 on all three routes**, so a removed business stops showing them at once.

**Not drawn by the themes.** The block is data (`host.directoryLinks`); drawing it in a theme footer is theme-kit work (section 15b).

## 10. Vendor-site SEO (slice 6 and prompt 6, 8e)

The site build reads the staff-editable `vendorHome` and `vendorPage` templates and the crawler list through a read-only port (`VendorSeoSettings`), and the vendor's **directory listing** through a second one (`VendorDirectoryFactsPort`, provided by the small global `SeoVendorFactsModule`), so `site-publish` imports nothing from the SEO module; without a port nothing changes, and a vendor with no listing builds as before. **The vendor site model has no service-area field and `contact.area` is always blank, so the listing's location is the one real source of the locality.**

- **Title**: the vendor's own title wins when it is safe and fits in 60; otherwise the template. Home: `{vendorName} | {category} in {locality}, {city}`; inner pages `{pageName} | {vendorName}, {category} in …`. Each falls back to a shorter form when a value is missing or the whole would pass 60 (a long business name drops the locality, never the brand).
- **Brand suffix**: a site on a `get4domain.com` subdomain gets ` | Get4Domain`; a site on its own custom domain does not.
- **Description**: the vendor's own override, then the vendor's own sentences (≥ 50 characters), then the template (with the locality, the city and up to **three of the vendor's own, non-sample services** via the `{services}` placeholder), then the old bare line. The vendor's words always lead.
- **Structured data**: the theme's `LocalBusiness`, `BreadcrumbList`, `Service` and `Product` blocks are kept (offers, prices and ratings are still stripped). Added: **Organization** (name, url, logo, `sameAs` only from the profile links the vendor supplied) and **WebSite** (no search action) on the home page; **FAQPage** on the home page **only from FAQ items the vendor entered** (the FAQ list already exists in the site document with a validator and the plan limit `site.faqs`; an item carrying a price or a banned word is left out; none entered means no block); `areaServed` naming the locality and the city, and a postal address, only where the theme's own block lacks them.
- **robots.txt**: every crawler staff named (SUPER_ADMIN edits the list) gets its own group with `Allow: /`, then the catch-all group; the `Sitemap` line only when the site is indexable. A site is never disallowed (a noindex page must stay crawlable so its tag can be read).
- **llms.txt** (prompt 6d): written at publish into `/llms.txt` for an **indexable** site (none otherwise): its name, what it is and where, address, services (no prices), its pages with the one-line text each already carries, the sitemap link. **Phone, email and opening hours only where the plan lets the site show them (Pro)**, so a Free site says nothing the Free site does not; a line with a price or a banned word is dropped; links stay on the site's host; at most 30 services and 40 pages. The directory's own `llms.txt` lists what the directory is, the categories and cities that have a page, and the sitemap link.
- **Rebuilds**: the templates, the crawler list, the brand rule and the listing facts go into the settings hash. **After this ships, every vendor site is rebuilt on its next build or publish** (its hash differs once), and again whenever staff edit a template or the crawler list, or the vendor's directory location changes. An unchanged site with unchanged settings is still reused.
- **Not done**: no `lastmod` in the vendor sitemap (builds are byte-for-byte deterministic and the build has no trustworthy change time); no vendor-entered service-area field (it does not exist in the site model).

### 10b. The Stage 14 SEO report (prompt 6e)

The existing four issues (`DEFAULT_TITLE`, `DEFAULT_DESCRIPTION`, `DUPLICATE_TITLE`, `SHORT_DESCRIPTION`) are unchanged. Added: **`DUPLICATE_DESCRIPTION`** (pages of one site sharing a description, case and spacing ignored), **`MISSING_LOCALITY`** (the vendor's listing has no neighbourhood; reported once, on the home page) and **`TITLE_NO_KEYWORD`** (the home or services title holds none of the category's own words: name, singular, plural, staff synonyms). The last two need the vendor's listing, read through the optional directory facts port: **a vendor with no listing is not judged on place or keyword** (the report never guesses). The route's `issue` filter accepts all seven codes.

## 11. What the Next.js site must do (not in this branch)

Render the page models at the paths in section 4 (the 301 from `www` to the bare host is in section 15c) (the JSON already carries title, description, canonical, robots, JSON-LD, breadcrumbs, facets, cards, pagination and FAQ); serve `/sitemap.xml`, `/sitemaps/directory-{n}.xml` and `/robots.txt` from the raw routes; add the `page-visits` beacon (client side, only with `utm_*` or `kw`); keep the card's `visitUrl` as the Visit-site link. Until then nothing is public: the backend has no effect on the live site.

## 12. Owner commands for staging, in order

`npm.cmd`, from `C:\Get4Domain\get4domain-seo1\backend-api` unless stated. **Nothing below has been run.**

1. Copy `.env.staging` into `C:\Get4Domain\get4domain-seo1\` (not in git).
2. `npm.cmd ci`, then `npx.cmd prisma generate`.
3. `npm.cmd run db:staging:migrate-status`. Expect `20261216100000_v3_seo_geo_keywords`, `20261216110000_v3_seo_click_daily`, `20261217100000_v3_seo_keyword_targets` and `20261218100000_v3_seo_keyword_volume` pending (plus anything else this branch has that staging lacks). Then `npm.cmd run db:staging:migrate-deploy`, then `migrate-status` again (none pending).
4. `npm.cmd run db:staging:rls-off` (no table without RLS), then `npm.cmd run db:staging:drift` (the 2 documented allowed items only).
5. `npm.cmd run build` (includes the renderer), then `npm.cmd run test:ci` (expect all green).
6. Keyword sets: `node scripts/seo-category-keywords-load.js` (a **dry run**; read the counts), then `node scripts/seo-category-keywords-load.js --apply`. Run the dry run again: nothing to create.
6b. Optional dry run of the research list (counts only, writes nothing, reads staging): `node scripts/seo-keyword-research.js`. Add `--apply` only to write the two local CSV files.
7. The new suite alone first: `npm.cmd run test:int -- --runTestsByPath test/seo-directory.int.spec.ts`. It switches `directoryPagesIndexable` ON and the thin-page minimum to 3 for its run and **restores both, and the templates, crawler and modifiers settings, in `afterAll`**. Then the full `npm.cmd run test:int`.
8. `npm.cmd run test:cleanup-staging -- --count` (must print 0). The suite removes its own places, category, businesses, keyword row, targets and aggregate rows; the audit rows of its staff writes stay (the log is append-only).
9. Check staging is back to its settings: `GET /v3/admin/seo-directory/templates` and `…/crawlers` show what they showed before step 7, and `directoryPagesIndexable` is still OFF.
10. **Do not push without asking**: a push creates a Vercel Preview deploy. When ready: `git push origin v3-seo1`.

## 13. Open questions and known limits

1. **Same-slug cities**: first by sort order wins (section 4). Revisit with a state-qualified URL when a real duplicate exists.
2. **Backlink block, FAQ and answer blocks in themes**: the data is there (`host.directoryLinks`, the FAQ list); drawing them is theme work (section 15b). Say if you want it started.
3. **Vendor titles change on rebuild** (section 10), including the ` | Get4Domain` suffix on subdomain sites. Confirm the suffix is wanted on vendor pages, not only on the directory.
4. **`directoryPagesIndexable` stays OFF** until counsel approves the wording. Nothing in this branch switches it on outside the staging suite.
5. **Ranking-claim list** is a regular expression (best, top, first rank, number one, guaranteed, leading, cheapest, rank…). A place called "Top Slip" loses only the anchor wordings that contain it; extend the list in `core/ranking-claims.ts` if counsel names more words.
6. **UTM cap** is per process. Behind several instances the true cap is the cap times the number of instances.
7. **Badge image host**: the prompt says the image should come from our media host. The badge is a fixed SVG served from the API host with a long cache; the media host and its storage credentials are not set up yet. Moving it is a one-line change of the image address.
7b. **Volumes**: Keyword Planner shows ranges for accounts with no spend; those rows are skipped and listed rather than turned into numbers. Say if you would rather store the lower bound.
7c. **No keyword target delete** and no bulk status change; PAUSED is the removal.
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
| vendor site `ranjith.get4domain.com/` | `Ranjith Plumber \| Plumber in Perambur, Chennai \| Get4Domain` | on a custom domain: no ` \| Get4Domain`; with empty text fields the description reads `Ranjith Plumber, Plumber in Perambur, Chennai. Services include Tap repair, Pipe fitting, Leak detection.` |
| vendor site `…/services` | `Services \| Ranjith Plumber, Plumber in Perambur \| Get4Domain` | the four titles and descriptions of the example are asserted together: unique, within 60 and 160, branded |

Backlink block for Ranjith: brand link `Get4Domain`; links to `/chennai/plumbers-in-perambur`, `/chennai/plumbers`, a neighbouring locality such as `/chennai/plumbers-in-adyar`, and `/chennai`, with anchors such as "Plumbers in Perambur, Chennai", "Find more Plumbers in Chennai on Get4Domain", "Adyar Plumber directory". No page, anchor or badge says best, top or first.

## 14b. Tests

Unit (run by `test:ci`): `seo-keywords`, `seo-templates`, `seo-pages`, `seo-click-out`, `seo-sitemaps`, `seo-targets` (slice 5), `seo-research` (8d), `seo-vendor-site` (slice 6 and 6b), `seo-llms` (6d), `website-seo` and `website-seo-core` (6e), `seo-ranjith-example` (slices 8 and 8c), the role-matrix oracle, the route baseline and `staging-harness-compile` (which compiles the slim app with the SEO providers, so a missing provider fails without staging). Staging (`test:int`, **written, not run**): `seo-directory.int.spec.ts`: migration objects (RLS, unique keys, status and priority checks), roles over HTTP, target create, duplicate and edit, the CSV round trip, an override reaching a page model and the click-out, exact daily aggregates under 30 and 25 parallel calls, the sitemap and plan reading real rows, the backlink block, the badge and the 404 for a removed business, and the templates and crawler list the build reads.

## 15. Notes for the themes work, the www host, and rankings

### 15a. Rankings are not promised
**No ranking promises, in code or here.** Where a page ranks depends on the quality of its content, on backlinks and on time; nothing in this block can or does promise a position. Repeating the same anchor text across thousands of sites can be treated by a search engine as a link scheme, which is exactly why the backlink anchors rotate, vary in wording and are capped at four per site. Platform-written text never says best, top, first, number one, guaranteed or rank (`core/ranking-claims.ts`); the research modifiers are the one place such a word may appear, and only as a thing to search for.

### 15b. For the themes work (not built here)
Drawing is a theme task and out of scope for this block. Data a theme can use today: `host.directoryLinks` (the brand link and up to four directory links with their anchors; render as plain follow links, the brand link as "Powered by Get4Domain.com"), the vendor's FAQ list (render a visible FAQ section: the FAQPage structured data is already written from it, and structured data should match visible content), and the page descriptions. Visible "answer blocks" (a short, factual who-where-what block near the top of the home page) and FAQ sections are theme changes; this block only supplies the data.

### 15c. One host: www to the bare host
The page models treat `www` as non-canonical (every canonical is the bare host). The redirect itself is infrastructure, written up in `docs/v3/SEO_0_PLAN.md` section 7 (A4), summarised here for the owner: create a **Cloudflare Redirect Rule** (hostname equals `www.get4domain.com` → `https://get4domain.com` + the path and query, status 301) **before** touching nginx, so the origin stays unchanged; under Cloudflare SSL **Flexible** do not add an origin http→https redirect (it loops); turn on "Always Use HTTPS" at the edge; HSTS only after SSL has run on Full (strict) for a week, starting with a short `max-age`. Vendor sites live at `{name}.{SITE_BASE_DOMAIN}` and have no `www`. Check live before and after with `curl -sI http://get4domain.com`, `https://www.get4domain.com` and `https://get4domain.com` and record the status and `Location`.

## 16. Coverage of `SEO_BLOCK_PROMPT.md` sections 6 and 8

Checked line by line on 2026-11-15; the table is in the hand-over report of that day and is kept here in short.

| Item | State |
|---|---|
| 6a titles and descriptions from templates, locality, top services | built (slice 6, then 6b: the locality had no source until the listing was read) |
| 6a service area | **skipped**: the vendor site model has no service-area field; the listing's locality and city are used |
| 6b Organization, WebSite | built (6b) |
| 6b FAQPage only from the vendor's own items; FAQ list with validator and limit | FAQ list, validator and plan limit already existed; FAQPage built (6b) |
| 6b areaServed from locality | built (6b) |
| 6c crawler list and per-site robots.txt | built (slice 4 list, slice 6 per site) |
| 6d llms.txt per site and global | built (6d) |
| 6e three new Stage 14 issue codes | built (6e) |
| 6f visible answer blocks and FAQ sections are theme work | noted (15b) |
| 8a brand in every title | built (slices 1, 2, 6) |
| 8b pagination, canonical host, www redirect described | built (slice 2); redirect written up (15c) |
| 8c example test, four titles | built (slice 8, completed in 8c) |
| 8d keyword plan, modifiers, volume import | built (slice 5, completed in 8d) |
| 8e backlink block in the publish pipeline | built (5b, 6b); drawing is theme work |
| 8f badge and text link, staff and vendor endpoints | built (5b); image served from the API host, not a media host |
| 8g no ranking promises, anchors rotate and are capped | built (slice 8); stated in 15a |
