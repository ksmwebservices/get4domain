# See the public site on your computer

The Next.js public site (`get4domain_mvp`), branch `v3-pub-fe8`. Nothing here touches the live site, a database or a real provider. One command per block; the window each runs in is named above it.

Browsers resolve `localhost` and `anything.localhost` to your own computer, so no hosts-file edit is needed.

## A. Start it with sample data (mock mode)

**Window 1 (PowerShell).** Go to the folder:

```powershell
cd C:\Get4Domain\get4domain-pub\get4domain_mvp
```

**Window 1.** Set the names for this window only (they are not saved anywhere):

```powershell
$env:V3_PUBLIC_ENABLED='true'; $env:V3_PUBLIC_USE_MOCKS='true'; $env:MAIN_HOST='localhost'; $env:DIRECTORY_HOST='directory.localhost'; $env:V3_PUBLIC_DEV_VENDOR_VIEW='true'; $env:NEXT_PUBLIC_VENDOR_APP_URL='http://localhost:5173'
```

**Window 1.** Start the development server (use this, not `npm run start`, because the vendor viewer works only outside a production build):

```powershell
npm.cmd run dev
```

Wait for "Ready", then open the addresses below in the browser. The first visit to each page is slow while it compiles.

## B. Addresses to open

| What | Address |
|---|---|
| Home | http://localhost:3000/ |
| Product hub | http://localhost:3000/product |
| Website, Search visibility, Enquiries, Directory, Reports, AI Studio, Domains, Business tools | http://localhost:3000/product/website , `/product/search-visibility` , `/product/enquiries` , `/product/directory` , `/product/reports` , `/product/ai-studio` , `/product/domains` , `/product/business-tools` |
| How it works | http://localhost:3000/how-it-works |
| Pricing | http://localhost:3000/pricing |
| Industries hub | http://localhost:3000/industries |
| An industry page | http://localhost:3000/industries/food-service |
| A category page | http://localhost:3000/industries/food-service/restaurant-cafe |
| Partner programme | http://localhost:3000/partners |
| Guides | http://localhost:3000/guides , http://localhost:3000/guides/choosing-your-site-address |
| Register (industry and category chosen) | http://localhost:3000/register?pack=FOOD_SERVICE&category=restaurant-cafe |
| About, Contact | http://localhost:3000/about , http://localhost:3000/contact |
| Legal pages | http://localhost:3000/terms , `/privacy-policy` , `/refund-policy` , `/payments-and-billing` , `/delivery-policy` , `/acceptable-use` , `/cookie-notice` , `/disclaimer` , `/directory-listing-terms` , `/partner-terms` |
| Directory home | http://directory.localhost:3000/ |
| A state, a city | http://directory.localhost:3000/state/tamil-nadu , http://directory.localhost:3000/coimbatore |
| A city and category | http://directory.localhost:3000/coimbatore/plumbers , http://directory.localhost:3000/chennai/plumbers |
| A business page | http://directory.localhost:3000/business/kovai-plumbing-works |
| A vendor site (Pro, with buttons) | http://localhost:3000/_vendor/sample-pro |
| A vendor site (Free, listing only) | http://localhost:3000/_vendor/sample-free |
| Other vendor samples | `/_vendor/sample-draft` (not published), `/_vendor/sample-moved` (redirect), `/_vendor/sample-takedown`, `/_vendor/sample-down` |
| Vendor sitemap, robots | http://localhost:3000/_vendor/sample-pro/sitemap.xml , `/_vendor/sample-pro/robots.txt` |
| Sitemap of the new pages | http://localhost:3000/sitemap-industries.xml |

Regulated packs (clinic, lab, pharmacy, legal and finance) have no pages unless you also set `$env:V3_REGULATED_PACKS_PUBLIC='true'` before `npm.cmd run dev`.

Stop the server with Ctrl+C.

## C. The same with the real smoke API

**Window 2 (PowerShell).** Start the smoke API the way you did for the probe (backend folder, its own window). It must answer at the address you use below; this guide assumes `http://localhost:3008`.

**Window 1.** Stop the dev server with Ctrl+C, then switch to real mode and start again:

```powershell
$env:V3_PUBLIC_USE_MOCKS='false'; $env:API_BASE_URL='http://localhost:3008'
```

```powershell
npm.cmd run dev
```

Then open the same addresses. Pricing, categories, the directory and `/_vendor/{subdomain}` now ask the API; a vendor subdomain exists only if the API knows it, for example `http://localhost:3000/_vendor/<your-smoke-vendor-label>`. With no API address, or an API that is not running, real mode shows the error screens: it never guesses.

To check the API against the site's own parsers without the browser (GET only):

```powershell
npm.cmd run probe:v3-real -- http://localhost:3008
```

## D. Run the checks

```powershell
npx.cmd tsc --noEmit
```

```powershell
npm.cmd run build
```

```powershell
npm.cmd run test:v3-public
```

```powershell
npm.cmd run smoke:v3-public
```

(`npm run build` replaces the development build; stop the dev server first.)
