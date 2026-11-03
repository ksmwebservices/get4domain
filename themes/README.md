# Get4Domain theme kit

The shared kit for website themes: the **package format**, **one renderer**, a **lint**, **sample content for all 41 categories** (English and Tamil), a **local preview**, and a **screenshot** command. Plain Node (ES modules), **no dependencies**, Node 20 or newer. Nothing here touches `backend-api` or `get4domain_mvp`.

Vendors choose themes from a library in their dashboard; the team does not build one-off themes for vendors. The only theme in this folder today is the internal `_starter`, which exists to prove the pipeline. **No library theme has been built yet.**

Read `CONTRACT.md` first: it is the reference for the format, the bindings, the slots, the settings, the 41 categories and every lint rule.

## Commands

Run from the repository root (`C:\Get4Domain\get4domain-themes` in the themes worktree).

| Command | What it does |
|---|---|
| `node themes/cli.mjs lint _starter --all-categories` | Lints a theme folder under `themes/library/` (or a path). Add `--category plumber,dentist` for some categories, `--browser` for the real-browser overflow check at 360, 414, 768, 1024, 1280 and 1536 px, `--accent #rrggbb` to test a vendor accent colour, `--json file` to choose the JSON report (default `themes/.reports/lint.json`). Exit code 1 on any failure. |
| `node themes/cli.mjs pack _starter` | Builds `themes/dist/<id>-<version>.zip` and `.manifest.json` with a content hash. The zip is byte-identical every time. |
| `node themes/cli.mjs validate-package file.zip` | Checks a zip **without extracting or executing anything**: path traversal, size, zip bombs, executables, unknown slots, manifest, hash. |
| `node themes/cli.mjs preview` | Local review server at `http://127.0.0.1:4173` (this computer only). Pages: Coverage, Motion lab, Variant picker, Performance, Contrast. |
$1. `--entitlements all` draws the video, cart and booking slots. |
| `node themes/cli.mjs contract-table [--check]` | Regenerates (or checks) the tables inside `CONTRACT.md`. |
| `node themes/cli.mjs category-map [--check]` | Writes (or checks) `themes/data/category-map.json`: the category to flow family to as-built pack map for the backend importer (an inference, drift-checked). |
| `node --test "themes/test/*.test.mjs"` or `npm test` inside `themes/` | The whole test suite (102 tests). |

Screenshots and `--browser` use the Playwright and Chromium **already on the machine** (looked up in the global npm folder, `PLAYWRIGHT_MODULE`, and `%LOCALAPPDATA%\ms-playwright`); nothing is installed. Without them these two features report that they are unavailable and the rest still works.

## Folder map

```
themes/
  CONTRACT.md            the contract (generated tables inside)
  cli.mjs  commands/     the command line
  lib/                   vocabulary, categories, schema, zip, pack, theme loader, render, html, css, contrast, lint, motion, preview, shots, browser, document
  schema/theme.schema.json
  data/category-map.json   category -> flow family -> as-built pack (generated; for the backend importer)
  fixtures/              sample content for 41 categories x English/Tamil, plus extreme fixtures
  library/_starter/      the internal reference theme
  library/<theme-id>/    real themes go here
  test/                  node:test suite
  reference/             the two older as-built reference themes (not part of the kit, not edited)
  .shots/ .reports/ dist/   generated, git-ignored
```

## Adding a theme

1. Copy `library/_starter/` to `library/<your-id>/` and change `theme.json` (`id` 3-40 lower-case letters, numbers and dashes; `version` a whole number; `tier` Standard or Premium; the families, tracks and categories it is designed for; remove `"internal": true`).
2. Edit `templates/*.html` (HTML fragments with `{{bindings}}`, `<template data-g4d-each="...">`, `data-g4d-if`, and platform slot tags such as `<g4d-reviews>`) and `css/*.css`. Everything is scoped under `.g4d-theme`. No script, no outside address, no `<form>`/`<input>`, no `<title>`/`<meta>`, no `!important`.
3. `node themes/cli.mjs lint <your-id> --all-categories --browser` until it passes. Look at it with `preview` and `shots`.
4. `node themes/cli.mjs pack <your-id>` then `validate-package` on the zip.

**Tier is a price class of a theme, not a plan.** `Standard` and `Premium` only say what a theme costs. A Free-plan vendor is given an assigned Standard layout; a Pro-plan vendor may choose any Standard or Premium theme. **Any theme may place the `video`, `cart` and `booking` slots**; the platform decides at render time from the vendor's **entitlements** (`video`, `cart`, `booking`, `customDomain`, all false by default, passed to `renderPage`). A slot whose entitlement is off draws nothing at all, so hide any section that only hosts such a slot with `data-g4d-if="entitlements.<name>"`; the lint renders every category with the entitlements all on and all off. The layout variant is chosen by the category's family, never by the theme or the vendor. Vendors can change only the accent colours, approved fonts (twelve, self-hosted by the platform, including Noto Sans Tamil and Noto Serif Tamil), logo, section order and visibility, and motion intensity (Off, Low, Medium, Rich).

## How the rest of the platform will use the kit (not built yet)

- **Admin upload** (Themes, Requests tab): call `validatePackage(zipBuffer)` on the uploaded bytes (it needs no disk), then `lintTheme(themeFromFiles(result.files), { categories })`; show the findings (they are plain sentences with the file and rule id) and refuse on any error. Packages arrive as drafts, as today.
- **Backend renderer**: import `renderPage` from `themes/lib/render.mjs` (it has no imports outside this folder, no Node-only APIs and no I/O) and call it with the vendor's content mapped to the content model in `fixtures/index.mjs`, **the vendor's entitlements computed from their plan**, and the host (`siteUrl`, `customDomain`); then add the platform's `<head>` from `result.seo` (title, description, canonical, JSON-LD, hreflang). The same function renders previews, screenshots and the lint, so what staff approve is what visitors get. The importer can read `themes/data/category-map.json` for the category to pack mapping.
- **Theme Studio** (staff only): an AI draft is just a set of files; it goes through the same `validatePackage` and `lintTheme` loop, the findings are fed back as instructions, and a passing result is saved as a draft theme.

The new `g4d-*` slot tags and the extra bindings (`ui.*`, `n`, `blocks`, ...) are a **superset** of the as-built contract; the backend sanitiser and `theme-contract.json` must learn them first (see `docs/v3/THEMES_KIT_HANDOVER.md`).
