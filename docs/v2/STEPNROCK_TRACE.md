# Stepnrock storefront trace (read-only) — 2026-10-08

> Task 1 of the Stepnrock handover. Everything below is from reading code plus SELECT-only production counts; nothing was changed to produce it. Fixes made *after* this trace are listed in [STEPNROCK_HANDOVER.md](STEPNROCK_HANDOVER.md). Line numbers are for the commit this trace was taken on (`3d89a3d`).

## 1. Shape of the app

| Item | Fact | Evidence |
|---|---|---|
| Stack | Next.js **14.2.35**, `output: 'standalone'`, port **3015**, container `stepnrock` | `stepnrock/package.json:55`, `next.config.js`, `docker-compose.yml` |
| Host today | nginx vhost `stepnrock.get4domain.com` → `localhost:3015`, plain HTTP behind **Cloudflare Flexible SSL** (no origin certificate, no HTTP→HTTPS redirect, **do not run certbot**) | `nginx-stepnrock.conf:1-24` |
| Tenant | Hard-coded `STEPNROCK_SUBDOMAIN = 'stepnrock'` | `lib/site-data.ts:22` |
| API base | `NEXT_PUBLIC_API_URL` (build arg + env, default `https://gapi.get4domain.com`) | `lib/site-data.ts:21`, `Dockerfile:9-11`, `docker-compose.yml` |
| Images | `images.unoptimized = true` → plain `<img>` from **any** origin; no `remotePatterns` needed | `next.config.js` |
| Data it reads | Only products + categories (+ `paymentsEnabled`) from the public API. It **never reads any CMS text/SEO/contact field**; phone numbers are hard-coded | `lib/site-data.ts:3-17`; `CartView.tsx:326`, `contact/page.tsx:72,89,94` |

## 2. How products, categories, images, prices and availability get to the page

| Page | Rendering | Data call | Caching |
|---|---|---|---|
| `/` (home) | **server component** | `fetchSiteData()` → `GET {API}/cms/site/stepnrock` (`app/page.tsx:21-23`) | Next fetch cache `revalidate: 60` (`lib/site-data.ts:56`) → the page is ISR, up to **60 s stale** |
| `/shop`, `/shop/[category]`, `/product/[slug]` | **client components** (`'use client'`) | `useProducts()` → `fetchSiteData()` in the browser (`lib/use-products.ts:12-27`) | browser `cache: 'no-store'` (`site-data.ts:57`) — fresh on each visit, **but first paint is the hard-coded showcase catalogue** (`products.ts`) that is swapped when the fetch returns |
| shop sidebar chips | client | `fetchVendorCategories(vendorId)` → `GET /cms/vendor/:id/categories` (`site-data.ts:36-45`; server calls revalidate 60) | same |
| `/cart` | server shell + client `CartView` | none on load; checkout posts to the engine | — |

Findings that explain "not dynamic":

1. **Server-rendered pages are cached 60 s** (home). Client pages are fresh but flash the showcase products first (`use-products.ts:12-16`: initial state = `fallbackProducts`).
2. **A vendor with zero live products shows the showcase catalogue again** (`resolveProducts`, `site-data.ts:121-125`), so deleting products never empties the site.
3. **Availability is fake.** `adaptLiveProduct` sets `stock: stockQty ?? (cf.stock === 'Out of Stock' ? 0 : 10)` (`site-data.ts:96,115`) where `stockQty` is read from `customFields` — a JSON key the dashboard never writes. Product page prints "In Stock — N left" from that number (`product/[slug]/page.tsx:232-239`). **Nothing in the cart or the add-to-cart button checks it.**
4. **Colours set in the dashboard are ignored.** The dashboard saves colours as strings (`my-products/page.tsx` `customFields.colors = ['Black','Red']`) but `asColors` only accepts `{name, hex}` objects (`site-data.ts:93-95`), so dashboard colours fall back to a single "Default" swatch.
5. The public API returns **whole `VendorProduct` rows** (`cms.service.ts:231-270`: `findMany` with no `select`), including `stockQty`, `sku`, `reorderLevel`, `status`, `sourceModel`, `sourceId`, `operationKey`.

## 3. What "My Products" writes vs what the storefront reads

| Dashboard field (`my-products/page.tsx`) | Stored in | Storefront reads |
|---|---|---|
| name, description, price (string), category, main image | `VendorProduct.name/description/price/category(+categoryId)/image` | yes (`adaptLiveProduct`) |
| gallery (extra photos; add/remove only, **no ordering**) | `customFields.gallery` | yes (`gallery`) |
| sizes | `customFields.sizes` (string array) | yes |
| colours | `customFields.colors` (**strings**) | **no** — needs `{name,hex}` |
| tags/highlights | `customFields.tags` | no |
| Active/Hidden toggle | `VendorProduct.active` | hidden products are dropped by the API (`active: true` filter) |
| stock, SKU, low-stock level, status | **not editable** — the DTO rejects them (`cms/dto/create-product.dto.ts`; `main.ts:32-38` `forbidNonWhitelisted`) | `stock` is invented (see §2.3) |

Production shape (counts only): 14 stepnrock products; 12 carry the *column* `stockQty` (12–50) that **no code reads**; 0 have `sku`/`reorderLevel`; prices are strings like `"89.99"` (13 showcase values + one real `"650"`).

## 3b. Image upload path
Dashboard → `POST /uploads` (`uploads.controller.ts`: 5 MB, png/jpg/webp/gif/**svg**, written to `<cwd>/uploads`, URL `{PUBLIC_API_URL}/uploads/<name>`). Errors are **swallowed** in the dashboard (`uploadImage`/`uploadGalleryImage` catch with an empty block), so a failed upload looks like nothing happened. Persistence of `/app/uploads` across deploys was fixed with a named volume (follow-up A, `get4domain_public_uploads`).

## 4. Cart and checkout

| Step | Where | Behaviour |
|---|---|---|
| Cart state | `lib/cart-context.tsx` | `localStorage` key `snr_cart`; line id = `productId-size-colour`; **no stock awareness, no quantity cap** |
| Place order | `components/cart/CartView.tsx:52-110` | `POST {API}/engine/public/stepnrock/actions/engine.checkout.order` then Razorpay checkout then `…checkout.confirm`; form collects **name + 10-digit mobile only** (`:66-74`) — **no address** |
| Server | `engine/public-checkout.service.ts` | prices from DB; needs the vendor's Razorpay keys (`getKeys`); **0 of 5 live vendors have them**, so `paymentsEnabled` is false and checkout cannot start |
| Stock | `public-checkout.service.ts:84,164-170` | only `CatalogItem.stock`; `VendorProduct` is never checked or decremented |
| Enquiry | `components/contact/ContactForm.tsx` → `engine.enquiry` | creates a CRM lead (works) |

## 5. Hard-coded host assumptions

| Where | Value | Needs |
|---|---|---|
| `app/layout.tsx:23` `metadataBase`, `:40` canonical, `:52` OG url | `https://stepnrock.com` | `SITE_URL` |
| `app/about/page.tsx:11,15`, `app/cart/page.tsx:7,11`, `app/contact/page.tsx:12,16` | `https://stepnrock.com/...` | `SITE_URL` |
| sitemap / robots | **none exist** (`app/` has no `sitemap.ts`/`robots.ts`) | add, driven by `SITE_URL` |
| API base | `gapi.get4domain.com` default in code + Dockerfile arg | keep; configurable already |
| tenant | `STEPNROCK_SUBDOMAIN` constant | fine for a single-tenant app |
| nginx `server_name` | `stepnrock.get4domain.com` only | add apex + `www` of the custom domain |
| Backend CORS | `origin: true` — reflects **any** origin (`backend-api/src/main.ts:26-29`); no cookie auth, no redirect allowlists | custom domain already works; `CORS_EXTRA_ORIGINS` added for strict mode |
| Copy | "Free Shipping Over $75" (`product/[slug]/page.tsx`) — dollars on an INR shop | reword (handover doc: limits) |

## 6. Backend side of the loop

* Public API: `GET /cms/site/:subdomain` (`cms.service.ts:231-270`) — returns vendor, cms, **all product columns**, theme, `paymentsEnabled`.
* Dashboard writes: `POST/PUT/DELETE /cms/...products` (`cms.service.ts:195-229,273`).
* Orders list (vendor): `GET /engine/orders` → `PosSale` where `type='web'` (`public-checkout.service.ts:34-41`) — items, total, status only; no buyer/address.
* Stock: `RetailProduct` (POS) and `CatalogItem.stock` are other tables; `VendorProduct.stockQty/status/reorderLevel/sku` exist in the live schema and are unread/unwritten (audit §2).

## 7. Consequence for the handover
Suresh can manage products, photos and categories from the dashboard and see changes on the site (≤ 60 s today). He cannot manage stock or availability, the storefront shows a made-up stock number, orders cannot be placed (no payment keys) and an order, if it could be, would carry no address and would not touch stock. The tasks that follow close exactly those gaps.
