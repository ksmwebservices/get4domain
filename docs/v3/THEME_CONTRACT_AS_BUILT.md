# Theme Contract — As Built

> Date: 2026-11-03 · Branch `v3-step0` · **Read-only static audit.** Source read only: no server started, no database touched, no test run, no `.env*` opened. Nothing in the repo was changed.
> Sources: `backend-api/src/themes/**`, `backend-api/src/site-doc/{families,packs.controller,theme-vendor.service}.ts`, `get4domain_mvp/src/engine/themepack/**`, `get4domain_mvp/src/app/site/[subdomain]/[[...rest]]/page.tsx`, `docs/v2/THEME_CONTRACT.md`, `backend-api/prisma/schema.prisma`, `themes/reference/**`, `scripts/theme/**`.
> "Verified" means I read it in code. Things I did not read in full are marked **not read**. Nothing here says what is live in production.

## 1. Summary

- There are **four different "theme" mechanisms** in the repo. Only one is the contract documented in `docs/v2/THEME_CONTRACT.md` (the "theme package", round 2, 16 Oct 2026). The other three are older and still wired in (section 8).
- The theme package contract is **version 1**: a zip of plain HTML + one CSS file + pictures/fonts, with `{{slots}}`, `data-g4d-each` lists, nine engine tags, and a sanitiser that removes everything else. Themes cannot run script.
- One JSON file is the vocabulary. The API holds `backend-api/src/themes/core/theme-contract.json`; the website holds a **byte-identical copy** at `get4domain_mvp/src/engine/themepack/theme-contract.json`. `get4domain_mvp/scripts/verify-themes.mjs` fails if they differ (line 44).
- A vendor's chosen design is a string. `t:<key>` means an imported theme; any other value is one of the built-in designs (`classic`, `bold`, `minimal`, `warm`).
- Themes are **per category** (a theme lists the category keys it works for). The contract has no concept of V3 tracks (Handyman / Professional / Ecommerce).

## 2. Package format (contract v1)

```
theme.json  home.html  theme.css            required
services|menu|packages|properties|courses|doctors|portfolio .html, about, gallery, contact, page, item   optional/recommended
assets/     png jpg webp svg  woff2 (woff accepted by the file sniffer)
```

| Limit | Value | Limit | Value |
|---|---:|---|---:|
| Package | 5 MB (upload endpoint reads 6 MB: `theme-limits.ts`) | Page HTML | 400 KB |
| Picture | 1 MB | Stylesheet | 400 KB |
| Font | 1 MB | Files / pages | 400 / 40 |
| Inline `data:` asset | 20 KB | | |

**Manifest (`theme.json`)** — `Manifest` in `themes/core/sanitise.ts`: `id` (3–40 chars, `^[a-z0-9]+(-[a-z0-9]+)*$`), `name`, `version` (integer), `author`, optional `description`, `families[]` (at least one of the 8), `categories[]`, `pages[] {slug, template, title, nav?, navLabel?}`, optional `itemsPage`, `cssVars`, `colors {bg, fg, muted, accent, accentFg}`, `googleFonts[]` (only `https://fonts.googleapis.com/css…`). Reserved page slugs: `book enquire order legal p api`.

**Page templates (13):** `home about services gallery contact page item menu packages properties courses doctors portfolio`. Item pages exist for 7 of them. Standard slugs in `contract.standardSlugs`.

**Vocabulary counts (from the JSON):** 38 slots · 10 repeaters (`items groups team testimonials faqs gallery steps trust stats pages`) · 16 item fields · 9 engine tags (`g4d-action g4d-header-nav g4d-bottom-nav g4d-footer g4d-social g4d-hours g4d-map g4d-tabs g4d-cart`) · 4 required tags (`g4d-header-nav g4d-footer g4d-bottom-nav g4d-action`; the engine adds any missing one) · 7 `data-g4d-*` attributes · 90 allowed elements · 64 allowed attributes · 4 allowed URI schemes (`http https tel mailto`).

**Family signatures** (`contract.familyPages`) — per family, the expected pages, the home-page blocks and the engine tags. These only drive lint warnings, not rejections.

## 3. What the sanitiser guarantees (`themes/core/{sanitise,html,css}.ts`)

- `dropWithContent` (28 names): script, style, iframe, object, embed, form, input, select, textarea, link, meta, base, canvas, audio, dialog, math, svg `foreignObject`/`animate`/`set`, head, and others — removed with their content.
- Event handlers, `javascript:`/`data:` links, and any address outside the package are removed.
- CSS is rewritten so every rule is scoped to `.g4d-theme-<id>`; `@import`, `expression()`, `behavior` and outside `url()` are removed; `url()` may only point inside the package.
- Pictures/fonts are identified by **file signature** (PNG, JPEG, WEBP, WOFF/WOFF2, SVG), not by extension; SVG is refused if it holds script, `foreignObject`, event handlers, outside references or animation elements (`svgProblem`).
- Script-type files (`js mjs cjs ts tsx jsx map vue svelte`) are rejected; a React/Vite project gets a plain-language "how to continue" note (`REACT_ADVICE`).
- The same function runs in the admin upload, in `scripts/theme/lint.mjs`, and again at render time (`render.tsx` re-checks the element and attribute lists).

## 4. Lint (`themes/core/lint.ts`)

Levels `pass / warn / error / info`; any `error` blocks the upload. Warnings include: missing family pages, missing signature blocks, unused signature tags, no business name/logo slot, testimonials listed without `data-g4d-if="testimonials"` (sample quotes are never public), missing or multiple `<h1>`, images without `alt`, and **contrast below 4.5:1** on four pairs (text/page, muted/page, button text/button, accent/page). `--fix` (`fixPackage`) renames `index.html`, writes a first `theme.json`, strips scripts, scopes the CSS and inlines very small pictures.

## 5. Data model (`schema.prisma`, lines ~345–420)

| Model | Table | Key facts |
|---|---|---|
| `ThemePackage` | `g4d_theme_packages` | `key`+`version` unique; `manifest`, `pages` (already sanitised, JSON), `css` (scoped text), `assetIndex`, `googleFonts`, `families`, `categories` (admin may narrow what the manifest declared), `role` = `FREE_DEFAULT` \| `MARKETPLACE`, `replacesDesign` (which built-in design slot a free theme replaces), `priceYearlyPaise` (**admin-set only**, ex-GST), `status` = `DRAFT`/`LIVE`/`RETIRED`, `previewPath`, `lint`. IDs are `cuid()`. No `vendorId`. |
| `ThemeAsset` | `g4d_theme_assets` | Picture/font **bytes stored in Postgres** (`data Bytes`), unique `(packageId, path)`, cascade delete. |
| `ThemeEntitlement` | `g4d_theme_entitlements` | `vendorId`, `themeKey`, `startsAt`, `endsAt`, `status` ACTIVE/EXPIRED/CANCELLED, `paymentRef` **unique** (same payment can never grant twice), `invoiceRef`, `amountPaise`, `gstPaise`, `remindersSent`. The only vendor-scoped theme table. |
| `CategoryPack` | `g4d_category_packs` | Holds each category's four designs and default design (see `CATEGORY_FAMILIES_AS_BUILT.md`). |
| `VendorCMS` | — | Holds `designKey` (`t:<key>` or built-in key) and `packKey`; the draft/published split lives here. **Not read in full.** |

## 6. Who can use which theme (`theme-catalog.service.ts → resolve`)

1. A design key not starting with `t:` is a built-in design (no theme row involved).
2. No row for the key → notice `unavailable`. No LIVE row and no active entitlement → `retired`.
3. Category not in the theme's `categories` → `incompatible`.
4. `FREE_DEFAULT` → usable by everyone in those categories.
5. `MARKETPLACE`: allowed in a private **preview** without paying; a site that is not `LIVE` always gets a free design (`prospect`); an active entitlement → allowed; a lapsed one → `expired`; none → `not-owned`.
6. Whenever a theme cannot be used, the site **falls back to the category's default free design** and the vendor's content is untouched. A renewal restores the theme.

`ThemeCatalogService.freeSlots` lets a live free theme **replace** one of the four built-in designs, so the vendor still sees exactly four designs (`site-doc/starter.service.ts → designsOf`).

## 7. API surface

| Route | Guard | Purpose |
|---|---|---|
| `GET admin/themes`, `GET admin/themes/:id`, `GET :id/preview-links` | `LeadspaceStaffGuard` (any staff) | list / detail / private desktop+mobile preview links |
| `GET admin/themes/report` | `CommercialAdminGuard` | sold, active licences, revenue, ending soon |
| `POST admin/themes/import` (`?dryRun=1`), `PUT :id`, `POST :id/duplicate` | `CommercialAdminGuard` | upload a zip, set categories/role/price/status, copy as a DRAFT |
| `GET themes/package/:id` | `@Public` | live package for the renderer (pages, scoped CSS, asset index) |
| `GET themes/sample/:id?category=&token=` | `@Public` | theme filled with starter content for previews |
| `GET themes/assets/:id/:name` | `@Public` | one picture/font; `immutable` 1-year cache, `nosniff`, `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox` |
| Vendor tab: `GET themes`, `POST themes/:key/order`, `POST themes/:key/confirm`, `GET designs`, `POST design`, `POST reset-starter`, `GET categories`, `POST generate` | vendor JWT (declared in `site-doc/packs.controller.ts`; route prefix **not read**) | marketplace list with price+GST, buy, switch design |

**Purchase (`theme-purchase.service.ts`)** — price is read from the admin's row, never from the browser; GST is 18% (`GST_RATE`); a Razorpay order is created server-side with notes `{purpose:'theme_year', vendorId, themeKey, base, gst}`; the confirm path calls `payments.assertCaptured` with the expected amount and notes; the webhook handler `handleCaptured` recomputes and ignores a mismatch; a renewal starts when the current year ends; a GST invoice is created best-effort (`source:'theme'`); the site cache is refreshed.
**Expiry (`theme-expiry.service.ts`)** — daily cron 06:30 IST; reminders at 30, 7 and 1 days (each once, recorded in `remindersSent`); on expiry the licence becomes EXPIRED and the site's cached pages refresh.

## 8. Rendering and the other theme mechanisms

The vendor site route (`site/[subdomain]/[[...rest]]/page.tsx`) chooses, in this order:

| # | Mechanism | Trigger | Output |
|---|---|---|---|
| 1 | **Legacy uploaded static-HTML theme** (older marketplace, `website-themes` module, `site.theme` pages/css/js) | `themePages(site.theme).length > 0` | `RawThemeFrame`: `<iframe srcDoc>`; the theme's own JS runs inside the frame |
| 2 | **Kit template** (data-driven layout chosen from a theme row) | `templateFromThemeRow(site.theme)` and home page | `renderKitTemplate` |
| 3 | **Theme package (round 2)** | `site.docV2 && site.themeRef` and the package loads | `ThemeSite` (`engine/themepack/site.tsx`) — server-rendered React from sanitised HTML; `render.tsx` parses with `parse5`, never injects raw HTML; routes: home, standard page, item, vendor page `/p/<slug>`, form flow `/book /enquire /order`, legal |
| 3b | Built-in design (docV2, no theme) | `site.docV2` | `KitRenderer` with `buildSiteDocModel` |
| 4 | **Engine industry site** | `getEngineIndustry(industry)` and home page | bespoke Real Estate and Retail; 18 kit builders |
| 5 | Generic fallback | otherwise | inline page (home / listings / contact) |

A theme package that fails to load falls through to 3b. `fetchThemePackage` reads `GET {API}/themes/package/:id` with a 5-minute cache and a `theme:<id>` tag.

**Three further "theme" vocabularies, not the contract:**
- **Site theme keys** (`SITE_THEME_KEYS`, 13 colour schemes such as `clean-teal`, `warm-sand`; tokens in `get4domain_mvp/src/engine/kit/site-themes.ts`, a guard keeps both lists equal).
- **Engine `ThemeScope`** (`engine/theme/ThemeScope.tsx`): `--eng-*` CSS variables from `ThemeTokens` for the industry engine.
- **Dashboard skin** (`.vendor-ui` overrides): unrelated to vendor websites.

## 9. Tooling and examples

`scripts/theme/lint.mjs` (+ `lib-core.mjs`, `register-reference.mjs`); reference themes `themes/reference/clinic-calm` and `themes/reference/restaurant-hearth` (complete: home, services/doctors or menu, about, gallery, contact, page, item, CSS, assets). `docs/v2/THEME_PROMPTS.md` holds generator prompts per family. A generator uses the same door as a person and its result arrives as a DRAFT.

## 10. Observations for V3 planning (facts, not decisions)

1. **Category-keyed, not track-keyed.** `categories` holds pack keys (the 24 launch categories); `families` holds one of eight flow families. Amendment 01's tracks do not appear anywhere in the contract.
2. **Assets live in Postgres.** Every picture and font is a `Bytes` row; the public asset route serves them with a one-year immutable cache.
3. **Public package endpoint holds no vendor data**, but `themes/sample` accepts an optional `token`; the check behind it is in `themes-admin.service.ts` (**not read**).
4. **Mechanism 1 still wins first** in the route, so a vendor with a legacy raw-HTML theme never reaches the round-2 renderer. This is the iframe path flagged in `SEO_AUDIT_AS_BUILT.md` §2.
5. **Prices are admin data** (`priceYearlyPaise`), consistent with the "one source of truth" rule; the GST rate is a code constant (18%) in `theme-catalog.service.ts`.
6. **Tenant isolation:** `ThemeEntitlement` is the only table keyed by `vendorId`; vendor tab routes rely on the JWT principal. `TenantGuard`/`@UseTenant` is defined but unused (`EXISTING_UI_AND_DATA_INVENTORY.md` §8).
7. **Not verified:** which themes are LIVE in production, how many exist, and whether the daily expiry cron has ever run — these need the live database, which this session does not touch.
