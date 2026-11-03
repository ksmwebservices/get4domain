# SEO-0 log (branch `v3-seo0`, worktree `C:\Get4Domain\get4domain-seo0`)

Dispatch: `docs/v3/SEO_0_CC_PROMPT.md`, tasks 3.1 to 3.4 of `docs/v3/SEO_0_PLAN.md`. Only `get4domain_mvp/` (frontend) and `docs/v3/` changed. No backend change, no deploy, no server, Cloudflare, DNS or Search Console change, no production request.

## What was already there

The base branch `origin/v3-step0` already carried an earlier SEO-0 run (plan section 8: commits `5a6e49e`, `1073e7f`, `4839fcf`, `faf37a9`, `d3ca48a`): root and home metadata, `llms.txt`, the demo gate, canonicals and redirects, robots, `createPageMetadata` with a required `path`, and a 34-check `scripts/seo-check.mjs`. This run did not redo that work. It measured it against the dispatch, found the gaps below, and closed them with a failing check first each time.

## Per task

| Task | Commit | Red first | Result |
|---|---|---|---|
| 3.1 legacy text | `3db0755` | new `routes` group: 31 of 40 checks failed (banned words and prices in `/leadspace`, `/domain-app`, `/pricing`, `/features` metadata and in FAQPage JSON-LD; titles up to 96 characters; industry descriptions 320 to 430 characters; an industry `keywords` tag) | 40 of 40 pass |
| 3.2 demo handling | `62141b5` | 2 new checks failed: a demo page served with a pass said `index, follow` in its HTML and had a keywords tag; bare `/demo` and an unknown `/demo/<name>` had no `X-Robots-Tag` | 76 of 76 pass |
| 3.3 canonicals, redirects, links | `16ea19c` | 1 new check failed: the cart page and the navigation constants linked to `/products` and `/digital-growth` (308 redirects) | 77 of 77 pass |
| 3.4 seo-check | this commit | `--allow-remote` did nothing (the script printed its refusal) | 78 of 78 pass locally |

Everything else the dispatch lists for 3.2 and 3.3 was verified, not rewritten: noindex meta and header on every `/visit-demo` variant, server-rendered heading and own title and description, no sitemap entry for any demo URL, no `Disallow` for `/demo/` or `/visit-demo`, 301 from `get4domain.com/site/<sub>` to the vendor subdomain, 301 from `/site/<same-sub>/x` to `/x` on the vendor host, `vendorCanonical()` for every vendor renderer, Get4Domain structured data only in the marketing layout, the robots fixes, `path` required at compile time and checked at run time in `createPageMetadata`.

## Gates run for every commit

`npx tsc --noEmit` clean; `npm run build` ok (local build with the API variables pointed at an unreachable address, so no backend and no production service was contacted); full `seo-check` against `next start` on `127.0.0.1:3100`; staged list equal to the expected list; secret scan over the staged diff found nothing.
`npm run lint` is not run: the frontend has no ESLint configuration and `next lint` stops at an interactive setup prompt (already noted in `SEO_0_PLAN.md` section 8). The frontend has no unit-test runner either, so `seo-check` is the test suite, as the plan decided (section 4).

## How to run the check

Local build (what was done in this session):

```
cd get4domain_mvp
set NEXT_PUBLIC_API_URL=http://127.0.0.1:9
set INTERNAL_API_URL=http://127.0.0.1:9
set DEMO_ACCESS_SECRET=local
npm run build
npx next start -p 3100 -H 127.0.0.1
:: in a second window, with DEMO_ACCESS_SECRET=local set again:
npm run seo:check
npm run seo:check -- --group routes      :: only the per-route table
npm run seo:check -- --verbose           :: longer failure text
```

Exit code 0 = all pass, 1 = at least one failure, 2 = refused or could not reach the server.

## Owner: running it against production after the deploy (read-only)

Not done in this session (stop-line 1). After the release, from any machine with Node 20 or newer, in `get4domain_mvp`:

```
node scripts/seo-check.mjs --base https://get4domain.com --allow-remote
```

- It sends plain `GET` requests only, never follows redirects, and uses two user agents (a browser and Googlebot) for the demo checks. A few hundred small requests at most (the sitemap check fetches each of the 37 pages once).
- Without `--allow-remote` the script refuses any host except loopback.
- Checks that need the source tree, a forged `Host` header or the demo secret (the vendor-host and forged-pass checks, the source scans) are printed as `SKIP`. They are covered by the local run.
- A remote run adds one check that only makes sense live: `https://get4domain.com/site/zz-seo-check/about?x=1` must answer `301` to `https://zz-seo-check.get4domain.com/about?x=1`.
- The sitemap in production still lists the 37 pages; a failing "37 URLs" check means the sitemap changed on purpose and the number in the script needs updating.
- Then, in Search Console, use URL Inspection on `/visit-demo?to=/demo/clinic` and on one `/demo/...` URL: success is "noindex detected", and in time "Excluded by noindex". Do not add a `Disallow` for `/demo/` or `/visit-demo` until Search Console shows the pages gone (otherwise Google cannot see the noindex).

## Defaults taken where the plan left a question

- New titles and descriptions (neutral wording, no price, no product name):
  - `/leadspace` "Free Business Page for Indian Businesses"
  - `/domain-app` "Industry Website and Business Tools"
  - `/pricing` "Plans and Pricing"
  - `/features` "Features for Your Business Website"
  - `/managed-services` "Managed Services: Custom Software and Marketing"
  - `/industries` "20+ Industry Solutions for Indian Businesses"
  - `/book-demo` "Book a Free Demo"
  - each industry page "<Industry> Business Website" with "A free business website and directory listing for <industry> businesses in India."
- "Sane length" is title at most 60 characters and description 50 to 160, the plan's A6 numbers. The industry pages no longer use the 320 to 430 character marketing paragraph as their meta description.
- FAQPage structured data leaves out any question or answer that has a rupee amount, a retired name, the old tagline or a per-month price, so the visible FAQ is untouched (queue item Q-SEO-1) while the structured data is clean.
- `/talk-to-sales` is a post-demo page that is noindex and not in the sitemap; it is excluded from the "indexable public route" table and checked as noindex instead.
- URLs that contain the old product name (`/leadspace`, `/sitemap-leadspace.xml`) are left as they are. A URL is not user-visible copy and renaming it needs redirects and an owner decision.

## Not done, and open questions for the owner

1. **Visible page copy still names Workspace, BOS, LeadSpace and the old prices** on `/pricing`, `/domain-app`, `/features`, the home page and its FAQ, the navigation label "LeadSpace" in the header and the footer, and several components. The dispatch (stop-line 7) bans the words in user-visible text; the owner decision of 2026-11-03 (plan section 5, item 1) keeps the page copy until the V3 prices exist (queue item Q-SEO-1). This run cleaned everything a crawler reads from the head, structured data, `llms.txt` and the sitemaps. **Decision needed:** keep Q-SEO-1 as queued, or ask for the copy rewrite now with placeholder wording.
2. **`public/og-banner.jpg`**: the picture itself may have a price baked in. Not readable from here. Check by eye; replace the asset if it does.
3. **`sameAs` social profile URLs** for the Organization schema: none supplied, so none are emitted (a TODO is in `SiteJsonLd.tsx`).
4. **Founding date**: left as it was live; confirm it with the About page.
5. **Vendor pages are not rendered by the local check** (they need the API, which must never be started locally). Their canonical logic is covered by calling `vendorCanonical()` directly and by the middleware tests with a forged `Host`; the first real proof is the production run above on one real vendor address.
6. **Vendor-site links** inside the shared renderer carry a `/site/<sub>` prefix. On the vendor's own host each one costs one 301 hop to the clean address. This is correct and indexable, but a renderer change (a host-aware base path) would remove the hop; not done because the same links serve preview mode on the main host.
7. **After registration** the app sends a new vendor to `/site/<sub>` on the main host, which now 301s to `<sub>.get4domain.com`. That works only if the wildcard subdomain resolves for a brand-new vendor; confirm before release.
8. **Title shortening for pages outside the dispatch** (for example `/about`, `/how-it-works`) was not needed: the table shows all 37 pages inside the limits.
9. Staging-database, Cloudflare SSL mode, `www` redirect and HSTS (plan section 7) are untouched, as dispatched.

## Final table (local build, `--group routes`)

```
route                     status  title  desc  canon  robots  ld    words
------------------------  ------  -----  ----  -----  ------  ----  -----
/                         200     40     153   self   index   4 ok  clean
/leadspace                200     53     137   self   index   4 ok  clean
/managed-services         200     60     101   self   index   4 ok  clean
/domain-app               200     48     118   self   index   4 ok  clean
/pricing                  200     30     133   self   index   4 ok  clean
/industries               200     57     106   self   index   3 ok  clean
/features                 200     47     124   self   index   4 ok  clean
/how-it-works             200     25     116   self   index   3 ok  clean
/book-demo                200     29     138   self   index   3 ok  clean
/portfolio                200     22     90    self   index   3 ok  clean
/templates                200     22     112   self   index   3 ok  clean
/contact                  200     53     128   self   index   3 ok  clean
/support                  200     20     100   self   index   3 ok  clean
/about                    200     21     151   self   index   4 ok  clean
/terms                    200     31     64    self   index   3 ok  clean
/privacy-policy           200     27     72    self   index   3 ok  clean
/refund-policy            200     26     56    self   index   3 ok  clean
/industries/restaurant    200     47     88    self   index   4 ok  clean
/industries/travel        200     44     85    self   index   4 ok  clean
/industries/realestate    200     41     82    self   index   4 ok  clean
/industries/clinic        200     47     88    self   index   4 ok  clean
/industries/education     200     46     87    self   index   4 ok  clean
/industries/construction  200     53     94    self   index   4 ok  clean
/industries/retail        200     47     88    self   index   4 ok  clean
/industries/salon         200     41     82    self   index   4 ok  clean
/industries/gym           200     43     84    self   index   4 ok  clean
/industries/professional  200     56     97    self   index   4 ok  clean
/industries/events        200     52     93    self   index   4 ok  clean
/industries/finance       200     49     90    self   index   4 ok  clean
/industries/automobile    200     51     92    self   index   4 ok  clean
/industries/logistics     200     51     92    self   index   4 ok  clean
/industries/diagnostics   200     44     85    self   index   4 ok  clean
/industries/hotel         200     49     90    self   index   4 ok  clean
/industries/photography   200     50     91    self   index   4 ok  clean
/industries/technology    200     51     92    self   index   4 ok  clean
/industries/agriculture   200     48     89    self   index   4 ok  clean
/industries/coaching      200     48     89    self   index   4 ok  clean

```

All 37 pages: one title, one description, self canonical, indexable, JSON-LD parses with the expected types, no banned word or price. The full local run is 78 of 78 checks.
