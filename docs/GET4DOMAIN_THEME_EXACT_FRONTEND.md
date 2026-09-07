# Exact-frontend theme rendering (your HTML/CSS/JS, backend-wired)

**Date:** 07 Sep 2026 · **Branch:** `get4domain-site`

## What this delivers (KSM's ask: "I want my EXACT frontend, wired to your backend")
Uploaded static themes (Bolt/designer HTML + CSS + JS, multi-page) now render **pixel-identical
to the source** across the live vendor site, the marketplace preview, and the demo — because they
render in an **isolated iframe** as their own full document (their CSS + JS run natively, no clash
with the app shell). A small injected bridge wires the theme's **forms/booking buttons to the real
engine** (creates a CRM lead), fills vendor content via `{{tokens}}`, and routes intra-theme page
links to `/site/<sub>/<slug>`. No redesign, no Next.js in the theme.

- Renderer: `get4domain_mvp/src/engine/raw-theme-frame.tsx` (`buildThemeSrcDoc` + `RawThemeFrame`).
- Wired into the live site route and the admin theme Preview.
- Admin upload (Content Library → Website Themes): **select ALL the theme's files at once** —
  every `.html` page (index.html = home), `css/styles.css`, `js/main.js`. Pages, CSS, JS and Google
  Font links are parsed and stored; choose **Static (raw HTML)** to keep it verbatim.

## See it immediately (no upload/migration needed)
After you rebuild the frontend, open **`https://get4domain.com/theme-local-test`** — it renders your
real `clinic-demo` theme through this exact engine pipeline (proof it's pixel-identical to your file).

## Schema / migrations (additive — apply on the VM)
Two pending migrations for the marketplace theme storage:
```bash
cd /srv/get4domain-site/backend-api && git pull origin get4domain-site
npx prisma migrate deploy    # 20260907000000_theme_marketplace_html (pages/description/css)
                             # 20260907010000_theme_js_fonts        (js/fonts)
npx prisma generate
docker compose build backend && docker compose up -d backend
cd /srv/get4domain-site/get4domain_mvp && docker compose build frontend && docker compose up -d frontend
```

## Verified
- Your clinic theme renders **pixel-identical** through the iframe pipeline (parsed body + inlined
  `styles.css` + your `main.js` + bridge) — confirmed by screenshot vs your source.
- Folder ingest parses correctly: pages home/services/orthopedic-…/neuro-… (slugs match filenames so
  your inter-page links resolve), 27KB CSS, 4KB JS, the Fraunces+Inter Google-Font link.
- Backend + frontend typecheck clean.

## To verify live after deploy (creates a real record)
1. Admin → Website Themes → select all clinic-demo files → Static → set price/category → Add theme → **Preview**.
2. Assign to a `clinic` vendor (or buy in the marketplace) → open their site → submit the **Book
   Assessment** contact form → confirm a lead appears in that vendor's CRM.

## Honest limits / next
- Themes whose design references **local image/font files** (not inline SVG / absolute URLs / Google
  Fonts) need those assets hosted — your clinic theme uses inline SVG + Google Fonts, so it's fully
  self-contained. An asset store for image-heavy themes is the next step if a theme needs it.
- The theme's own demo form handler and our engine wiring both fire; ours sets the final "reached the
  clinic" message after the real submit. For a live product cart (retail/restaurant), tag the grid/
  buttons or use the catalog path — this pass covers the enquiry/booking operation.
