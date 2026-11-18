# See the new portal on your computer (dispatch J1)

Branch `v3-pub-fe9`, folder `get4domain-pub\get4domain_mvp`. Sample data only: nothing here touches the live site, a database or a real provider. One command per block; the window each runs in is named above it. Browsers resolve `localhost` and `anything.localhost` to your own computer, so no hosts-file edit is needed.

## A. Start it

**Window 1 (PowerShell).** Go to the folder:

```powershell
cd C:\Get4Domain\get4domain-pub\get4domain_mvp
```

**Window 1.** Set the names for this window only (they are not saved anywhere):

```powershell
$env:V3_PUBLIC_ENABLED='true'; $env:V3_PUBLIC_USE_MOCKS='true'; $env:MAIN_HOST='localhost'; $env:DIRECTORY_HOST='directory.localhost'
```

**Window 1.** Start the development server and wait for "Ready" (the first visit to each page is slow while it compiles; the first build also downloads the Inter font once, so be online):

```powershell
npm.cmd run dev
```

## B. Addresses to open

The main site is `http://localhost:3000`. The directory is its own host: `http://directory.localhost:3000`. On your computer the links that jump from one host to the other drop the port number (the host layer writes `http://directory.localhost`), so when a link between the two hosts shows an error page, type the address from the table by hand.

| What | Address |
|---|---|
| New home: two-mode search, category grid, product previews, plans, directory preview, domain search, questions | http://localhost:3000/ |
| Directory home with the search box, cities and categories | http://directory.localhost:3000/ |
| A search with results (sample data) | http://directory.localhost:3000/search?what=plumber&where=chennai |
| A search with no result (honest empty state, List your business and Claim a listing) | http://directory.localhost:3000/search?what=dentist&where=Chennai |
| A place we do not have | http://directory.localhost:3000/search?what=plumber&where=Atlantis |
| A directory city page and a business page | http://directory.localhost:3000/chennai/plumbers , http://directory.localhost:3000/business/anand-electricals |
| Business areas, one area, one category | http://localhost:3000/industries , http://localhost:3000/industries/food-service , http://localhost:3000/industries/food-service/restaurant-cafe |
| Pricing, product, how it works, partners, guides, about, contact, features | http://localhost:3000/pricing , `/product` , `/product/website` , `/how-it-works` , `/partners` , `/guides` , `/about` , `/contact` , `/features` |
| Register (a website name typed in the home search arrives prefilled) | http://localhost:3000/register?subdomain=myshop |
| Legal pages | http://localhost:3000/terms , http://directory.localhost:3000/legal/terms |

Things to try: on the home page open **Categories** in the header (hover or click; Escape closes it); type "plu" in the first search box and "chen" in the second and pick the suggestions; open the **Find a domain or website name** tab and type a name; make the window narrow (375 px) and open **Menu**.

## C. Checks and pictures (one command each)

**Window 2 (PowerShell), same folder.** The unit tests (379 at the time of writing):

```powershell
npm.cmd run test:v3-public
```

**Window 2.** Screenshots at 375, 768 and 1280 px into `docs\v3\j1-shots` (not committed). It also reports any element that sticks out sideways at 375 px. Needs the server of block A running; it uses the Chromium that Playwright installs (puppeteer-core is already a dev dependency, nothing new was added):

```powershell
node scripts/j1-shots.mjs http://localhost:3000/ http://localhost:3000/pricing http://directory.localhost:3000/ "http://directory.localhost:3000/search?what=plumber&where=chennai"
```

**Window 2.** The browser check of the mega menu, the shared search with suggestions, the domain tab, the phone drawer and the focus ring:

```powershell
node scripts/j1-interact.mjs --base http://localhost:3000
```

**Window 2.** The full smoke run (stop the server of block A first; it builds nothing itself, so build once before):

```powershell
npm.cmd run build
npm.cmd run smoke:v3-public
```
