# Dispatch TM1 status (theme marketplace, backend lane)

Branch `v3-theme-mp` (from `v3-build-be`). Worktree `C:\Get4Domain\get4domain-w2`. Never pushed. Source dispatch: `C:\Get4Domain\get4domain-site\DISPATCH_TM1_THEME_MARKETPLACE_BACKEND.md`.

## STATUS

| Row | State | Commit | One line |
|---|---|---|---|
| PRE | DONE | b695d74 | vendor-gaps int test was stale (fixed, stricter); `GET /v3/me/overview` added; terms body confirmed and documented |
| M0 | DONE | (this commit) | findings below |
| M1 | DONE | (M1 commit) | theme package spec v1 = kit zip + optional marketplace block; schema, backend core, 22 new tests |
| M2 | DONE | (M2 commit) | package table (g4d_theme_market_packages), 8 admin routes, role matrix, 14 error codes, upload/validate/flow; migration applied to staging (rls-off 0, drift 2 documented); unit 18+7, int 6 |
| M3 | DONE | (M3 commit) | renderer loads PUBLISHED packages at run time (30 s cache, dropped on publish/archive); private visibility; archived keeps working for current users; render failure falls back to previous or default theme; 13 tests |
| M4 | TODO | | |
| M5 | TODO | | |
| M6 | TODO | | |
| M7 | TODO | | |

## M0 FINDINGS (investigation, no code)

### What a theme is today
- **A theme is a folder** in `themes/library/<id>/`: `theme.json` (the manifest), `templates/*.html` (page templates in the kit's own template language), `css/{tokens,base,motion,print}.css`, optional `presets/<kit-category>.json` (per business type colours, fonts, copy defaults) and optional `assets/` (png, jpg, webp, svg, woff2). Six folders exist: five served (`free-service-pro`, `free-practice`, `free-studio`, `free-hospitality`, `free-shop-lite`) and the internal `_starter` (`internal: true`, never served). All are tier `Standard`.
- **Manifest** (`theme.json`, schema built by `themes/lib/schema-build.mjs` into `themes/schema/theme.schema.json`, `additionalProperties: false`): `id, version, name, tier (Standard|Premium), tracks[], families[], categories[] (the 41 KIT category ids), layoutVariantRules, motion, settingsSchema, fonts[] (12 approved fonts, self-hosted by the platform), author, description`, plus `assets[]` and `contentHash` in a packaged zip.
- **Template language** (`themes/lib/vocabulary.mjs`): `{{binding}}` scalars (about 70), `<template data-g4d-each="items|groups|team|faqs|gallery|steps|stats|areas|blocks|products|offers|...">` repeaters, `data-g4d-if / if-not / section / optional` attributes, and platform slots as `<g4d-...>` custom elements (enquiry form, whatsapp float, bottom nav, map, reviews, social, open-now, share-qr, listed-on badge, action, header-nav, footer, cart, product-grid, booking, video, search...). Output is escaped by the renderer (`esc`, `safeUrl`).
- **The renderer** is `themes/lib/render.mjs` `renderPage()`: a PURE function (no network, file, clock, randomness). It is turned into CommonJS at BUILD time by `backend-api/scripts/build-renderer.js` into `dist/renderer` (entries render, theme, lint, pack, categories, schema, preset, fixtures; `themes/library` and `themes/data` are COPIED into the build). `renderer-loader.ts` `loadKit()` picks functions from that build.
- **How a vendor gets a theme**: `ThemeRenderService` (`src/site-publish/renderer/theme-render.service.ts`) is the one door. At module init it lints every folder theme (`kit.lintTheme`), keeps those that pass in an in-memory `served` Map (id, theme, content hash), logs the rest. `listThemes()` (sync, no vendor), `getTheme(id)` (throws `THEME_INVALID` for unknown), `defaultThemeFor(kitCategory)` (the theme whose manifest lists the category: the five served themes list DISJOINT categories covering all 41), `render()`. `resolveTheme()` (`site-publish/content/theme-resolution.ts`, pure) decides what a vendor gets: default theme on Free; any theme of its track on a paid plan (`site.themes = library`); a stored choice that is no longer in the list falls back to the default (`theme-fallback` note) when not strict. Callers of `listThemes()/getTheme()/defaultThemeFor()`: `site-build.service`, `site-settings.service`, `publish.service`, `site-pipeline.port` (theme switch), `website.service`, `renderer-draft-builder`, `seeded-adapters`, `theme-catalog.service`.
- **Pack and category mapping**: `v3-theme-catalog` (`GET /v3/public/themes?pack=`, `GET /v3/me/site/themes`, preview route) lists themes per pack by category overlap (`themesForPack`: CATEGORY, then KIT_FALLBACK via `PACK_KIT_FALLBACK`, then TRACK); G1 B6 added `KIT_ONLY_PACK` so the four kit ids missing from the catalogue (gym-yoga, salon-spa, tutor, auto-mechanic) still count for their pack, a `premium` flag and generated previews. The catalogue is 196 categories in 16 packs (`v3_pack_categories`); the kit has 41 categories in 12 families and 3 tracks (handyman, professional, ecommerce).
- **Switching**: `PUT /v3/me/site/theme`, `POST /v3/me/site/theme/switch` (idempotent, wallet fee from price book `THEME_SWITCH`, PENDING means refused `THEME_SWITCH_FEE_PENDING`), preview and history routes exist (`v3-theme-switch`).
- **`theme-uploads/`** holds ONE raw HTML demo site (`clinic-demo`: 9 pages, `css/styles.css`, `js/main.js`). It is not in the kit format, not served by V3, and contains a script file. It is legacy (audit 9.7) and is NOT used by this lane.
- **Catalogue tables**: V3 has no theme table at all (themes live only in files). The legacy V2 world has `ThemePackage` (manifest JSON, sanitised pages, scoped CSS, status DRAFT/LIVE/RETIRED, price) with `src/themes` and `src/website-themes` upload and sale routes; it is a different format (scoped CSS pages, google fonts) and a different store; not reused (see decisions).
- **Storage**: S3 public and private stores exist behind ports but every setting starts UNSET (`STORAGE_NOT_CONFIGURED`), so a theme package cannot depend on them. The database is the one dependable store.

### What already supports upload or hot loading
- **A theme package format and validator already exist in the kit**: `themes/lib/pack.mjs` `packFiles()` builds a zip with a content hash; `validatePackage(zipBuffer)` inspects the zip IN MEMORY (nothing extracted or run): unsafe path, symlink, duplicate path, executable extension AND executable magic bytes, zip bomb ratio, size and file count limits (5 MB package, 1 MB file, 400 files, 100 KB per html page, 40 KB layout css, 6 KB motion css), allow-listed layout (only `theme.json`, `templates/<known>.html`, `css/<4 names>.css`, `presets/<category>.json`, `assets/*.{png,jpg,jpeg,webp,svg,woff2}`), file signature check, SVG script/handler/outside-address check, unknown `<g4d-*>` slot, manifest schema, asset list and content hash. `themes/lib/lint.mjs` adds 40 rules (no script tag, no inline handler, no external request, iframe hosts allow-list, approved fonts, contrast, landmarks, reduced motion, all required slots...). `themeFromFiles(files)` in `themes/lib/theme.mjs` turns a file map into the renderer's theme object with no disk access.
- The renderer is pure and takes the theme object as an argument, so a theme that is not in `themes/library` can be rendered the moment the object exists.

### What is missing
1. The backend cannot LOAD a theme that is not in the build: `ThemeRenderService.served` is filled once from the folder library; `loadKit()` does not expose `themeFromFiles` or `validatePackage`.
2. No upload route, no table, no status flow (DRAFT, REVIEW, PUBLISHED, ARCHIVED), no versioning, no audit, no role matrix rows, no error codes for theme packages.
3. The manifest has no marketplace metadata (packs, combination tags, catalogue category ids, previews, licence, source vendor, starter mark) and `additionalProperties: false` rejects any extra field.
4. No private (one vendor only) theme: every listed theme is visible to every vendor of the track.
5. No cache with drop on publish/archive; no render-time fallback for a theme that throws (`site-build` would surface the error; `resolveTheme` only falls back when the id is unknown).
6. Only 5 served themes, each designed for disjoint categories, so most packs have exactly one theme (audit 9.3); the dispatch needs at least 4 per pack. `themes/library` themes can only be added by a developer and a rebuild.
7. No marketplace listing filtered by combination tag, no server-side preview with a strict content security policy for admin and vendor.

### Decisions taken from the findings (binding for M1 to M7)
- **Reuse the kit's package format** (zip with `theme.json`) as THE theme package format v1; do not invent a second one. The marketplace metadata goes in an optional `marketplace` object of `theme.json` (additive to the schema; the 6 library themes stay valid). Validation = kit `validatePackage` + kit `lintTheme` + the marketplace rules in a new pure core in the backend.
- **Store packages in PostgreSQL** (new tables, bytes in a `bytea` column, at most 5 MB, versioned, content hash unique per theme key and version) because object storage is unconfigured and a local disk path does not survive a redeploy or a second instance. RLS on, no policy (service role only), like the other `g4d_` tables.
- **Runtime loading**: `ThemeRenderService` gains a second source of themes (published packages) refreshed through a port with a short cache (30 s) that is dropped immediately on publish and archive; `listThemes(vendorId?)` hides private themes from every other vendor; archived themes stay renderable for the vendors using them.

## ASSUMPTIONS

1. `docs\v3` means the worktree-root folder `C:\Get4Domain\get4domain-w2\docs\v3` (as in G1).
2. "Category ids" in the marketplace manifest are the 196 CATALOGUE ids; the kit's own 41 category ids stay in `categories` (needed to render with a preset). A package must name both.
3. The overview route and terms confirmation requested before M0 were done first (commit b695d74).
4. Branch was already created and clean; the one-line `git checkout -b` in the dispatch was not repeated.

## QUESTIONS FOR THE OWNER

(none yet)
