# Theme Marketplace — Upload Provision + Vendor Marketplace — Deploy & Verify

**Date:** 07 Sep 2026 · **Branch:** `get4domain-site` · **PRD:** §? (Theme marketplace)

## What shipped
- **Schema (additive):** `WebsiteTheme.description`, `WebsiteTheme.pages` (JSONB — multi-page
  static HTML `[{slug,title,html}]`), `WebsiteTheme.css` (shared CSS). Migration written, **not applied**.
- **Admin upload provision** (`/admin` → Content Library → **Website Themes**): create a theme with
  **title, category (industry), short description, price (₹), preview**, and **upload one or more
  `.html` files** (Bolt/designer export). First file = home page; extra files = extra pages. Optional
  shared CSS box. The existing JSON-template and colours-only options remain.
- **Vendor marketplace** (`/dashboard/my-website` → **Template** tab): themes filtered to the vendor's
  industry, each card shows **title, description, preview, price / Owned**, and buys through the
  existing one-time Razorpay unlock (+18% GST) → selecting applies it.
- **Live render:** when the selected theme has uploaded `pages`, the public site
  (`/site/<subdomain>/<page>`) renders that static HTML, injecting the vendor's own content via
  `{{tokens}}` and rewriting intra-theme page links to our routes. Multi-page nav is added automatically.
- **Admin purchasers view:** each premium theme lists who bought it (from the previous commit).

## Content tokens (put these in the HTML so each vendor's content fills the design)
`{{businessName}}` `{{tagline}}` `{{about}}` `{{logo}}` `{{banner}}` `{{phone}}` `{{email}}`
`{{address}}` `{{whatsapp}}` `{{whatsappLink}}` (ready-made `https://wa.me/…`) `{{mapsLink}}` `{{year}}`.
Unknown tokens are left untouched. Product/catalogue loops are **not** token-mapped in raw HTML
(that's a known limit — use a JSON section-kit theme if you need the live product grid).

## KSM — apply on the VM
```bash
cd /srv/get4domain-site/backend-api
git pull origin get4domain-site
npx prisma migrate deploy      # applies 20260907000000_theme_marketplace_html (additive, safe)
npx prisma generate
docker compose build backend && docker compose up -d backend
cd /srv/get4domain-site/get4domain_mvp
docker compose build frontend && docker compose up -d frontend
```

## Verify end-to-end (no real money — use a test theme)
1. Admin → Website Themes → New theme: title "Test Salon Pro", category `salon`, description "Clean
   one-pager", price `499`, upload the sample below as one `.html`, Add theme.
2. As a `salon` vendor → Website Manager → Template: the theme appears with its description + "₹499".
   Buy via Razorpay **test** keys → it flips to Owned → select it → Save.
3. Visit the vendor's site (`https://<subdomain>.get4domain.com` or `/site/<subdomain>`): the uploaded
   design renders with the vendor's real business name/tagline/phone, no re-entry.

### Sample single-file theme (save as `sample.html`, upload it)
```html
<!doctype html><html><head><meta charset="utf-8"><title>Home</title>
<style>body{font-family:system-ui;margin:0;color:#0f172a}.hero{background:#0ea5e9;color:#fff;padding:64px 24px;text-align:center}.wrap{max-width:800px;margin:0 auto;padding:32px 24px}</style>
</head><body>
<section class="hero"><h1>{{businessName}}</h1><p>{{tagline}}</p>
<a href="{{whatsappLink}}" style="background:#22c55e;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none">Chat on WhatsApp</a></section>
<div class="wrap"><h2>About us</h2><p>{{about}}</p>
<p>📞 {{phone}} &nbsp; ✉️ {{email}}</p><p>📍 {{address}}</p>
<footer>© {{year}} {{businessName}}</footer></div>
</body></html>
```
For a multi-page test, upload `sample.html` + a second `about.html` (with its own `<title>About</title>`);
the site gets a Home/About nav automatically.

## Honest notes
- Raw-HTML themes render admin-authored markup verbatim (first-party, AdminGuard-gated). Content
  auto-map covers business-identity fields via tokens; it does **not** loop the product catalogue —
  themes needing the live product grid should use the JSON section-kit path.
- Multi-page assumes one `.html` file per page; internal links like `about.html`/`/about` are rewritten
  to our routes only when a page with that slug exists in the theme. Asset links (images/fonts) inside
  the HTML must be absolute URLs (data: or https://) — relative asset paths won't resolve.
- Next.js source cannot be uploaded as a theme (would need a per-theme build/redeploy); export to static HTML.
