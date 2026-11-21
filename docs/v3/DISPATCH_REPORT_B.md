# Dispatch B report (frontend lane), for the owner's morning

Branches: `v3-pub-host` (Slice 6, K0) then `v3-pub-fe3` (Slice 7, K1, from `v3-pub-host`). **Nothing is pushed.** No database command, no backend started, no `.env` read, no real API call (mock layer on), no payment form anywhere. Everything new is behind `V3_PUBLIC_ENABLED` (default off); the host layer additionally needs `MAIN_HOST`.

## Result

| Job | State |
|---|---|
| K0 Slice 6 (hostnames), steps 0 to 5 | DONE |
| K1 Slice 7 (commercial public pages), steps 0 to 6 | DONE |
| BLOCKED steps | none |

## Checks (last run, after the final code change)

- `npx tsc --noEmit`: clean. (The app has no `typecheck` script; the existing docs use `tsc --noEmit`.)
- `npm run build`: clean.
- `npm run test:v3-public`: **216 unit tests pass.**
- `npm run smoke:v3-public`: **795 of 795 checks pass**, on three real built servers: flag off with all host names set, flag on without host names (the earlier staging setup), flag on with host names and samples. It covers every host class, every commercial page (one h1, landmarks, skip link, canonical, JSON-LD parses, copy rules on the rendered text), the pending price, the referral cookie, the register API, `robots.txt` and `sitemap.xml` per host, and the flag-off regression (new routes 404, live pages not replaced, `llms.txt` and `sitemap.xml` unchanged).
- Not run: lint (the app has no ESLint config, gap G19), Lighthouse, a browser click-through of the client forms (gap G20). The register form and term switch were checked through the server-rendered HTML and the API calls only.

## Slice 6: hostnames (`v3-pub-host`)

Commits: 14d827b plan, 64544b3 hostnames module, e9f4451 host routing, 91feaec robots and sitemap per host, 5e401d8 vendor website proxy, 27c8418 fixes and smoke, e80161a docs.

Host table as implemented (active only with the flag and `MAIN_HOST`):

| Host | Behaviour |
|---|---|
| main | marketing as before; `/directory...` is a 308 to the directory host; directory addresses and `/sitemaps/...` are not served; robots is the existing rules only |
| `www.` | 308 to the canonical main host |
| directory | `/` is the directory home, no prefix; `/directory...` redirects to the same address without it; `/sitemap.xml` is the directory index; robots from the backend text with the Sitemap line rewritten to this host; marketing routes are a real 404 |
| vendor name | V3 first (the backend's stored page, sitemap, robots, llms, assets relayed unchanged), then the V2 renderer for a host V3 does not know, otherwise a plain 404 |
| app, admin, api, media, reserved names, V2 client names | never handled here: plain 404 |
| anything else | real 404, never the marketing page |

**V3 vendor site renderer:** none existed in this app. It is a thin relay, not a content renderer, because the backend already stores complete pages (SEO head, JSON-LD, backlink block, Free listing-only rules, noindex, takedown, redirects). It relays `GET /v3/public/site/by-host` unchanged.

**Backend change still needed (blocking for the directory host):** `HOSTNAMES_PLAN.md` section (a), items A to F: a separate `directoryOrigin` setting (falling back to `publicAppUrl`), the brand crumb, WebSite JSON-LD and backlink brand link kept on the main origin, the home path `/` instead of `/directory`, the robots Sitemap line, and the reserved-name lists (`gapi` and `send` are missing from the domain setting; three other lists are shorter).

Decisions I made (flagged, easy to change): redirects are always `https` (the request scheme is not trusted; nginx `$scheme` can read http behind Cloudflare); a V3 404 on a vendor host falls through to V2 so V2 vendors keep working until cutover; a backend that cannot answer counts as V3 (503, not another system's 404); the main host does not serve directory addresses; V2 client names are a plain 404 here, so nginx must send them to V2 ahead of the wildcard (G24).

## Slice 7: commercial public pages (`v3-pub-fe3`)

Commits: 0f667f6 plan, 55f172d pricing, b8c8c29 register, e273155 referral, 61c5be4 marketing pages, b6c79b2 tests and smoke, aaf90cc docs (plus a status-file commit after each step).

Routes (main host; internal root `/v3-site`, not reachable by address): `/` home, `/pricing`, `/register`, `/login` (Slice 4 sign-in), `/r/{code}`, `/referral-link`, `/how-it-works`, `/industries`, `/features`, `/about`, `/contact`. Same-origin calls: `POST /directory-api/register`, `GET /directory-api/subdomain`.

**Important to confirm (G32):** these pages replace the live `/`, `/pricing`, `/about`, `/contact`, `/features`, `/industries`, `/how-it-works`, `/register` and `/login` on the main host once the flag and `MAIN_HOST` are set. The live pages are not edited; sub-paths such as `/industries/travel` stay live. Keep the flag off on the live server until this replacement is intended.

Assumed API shapes to confirm (`PUBLIC_GAPS.md`): G28 register extra fields and the subdomain check route; G29 the referral route; G30 price semantics (`taxInclusive`, tax rate, monthly rows ignored); G31 a public pack list and add-on pack status (the 16 packs and four add-on packs are data in the front end, from the backend pack summary sheet, without the retail tab named "offers"). Real and used as is: `GET /v3/plans`, `GET /v3/public/pack-categories`, `POST /auth/register`, `POST /v3/auth/handoff`.

Rules held: prices without GST with a GST line; Free is a trial; payment only in the business app; pending prices show no number; no discount, offer, coupon or deal wording (the API's `bundleDiscount` field is dropped, `upsellText` is never shown); no timeframes; no workspace, BOS or LeadSpace; "enquiries" not "leads"; no ranking, rating or review claims; the referral cookie holds the code only.

## Problems found and fixed on the way

- The first host-routing version redirected to `http://` (Next sets `x-forwarded-proto: http` on a bare server). Fixed: always https except localhost.
- The directory sitemaps were still answered on the main host (the middleware matcher skips dotted paths). Fixed in the route handler.
- An unknown vendor label served the marketing page when the V2 rewrite did not apply. Fixed: plain 404.
- A page I wrote (`referral-link`) was prerendered static and would have baked in a 404 regardless of the flag. Fixed (`force-dynamic`).
- The smoke check "an unknown /demo address behaves as with the flag off" failed on some first runs and passed on reruns, before any Slice 7 code. It compares two freshly started servers on the first request; I added a warm-up request to each. I did not find a root cause beyond cold start.
- Three smoke checks of mine were too loose or too strict while writing (a leftover vacuous assertion and two `|| true` guards, a regex matching "expiry" in the Pharmacy pack, the home canonical slash). All were corrected, none by weakening a real check.

## Skipped or not done

- No ESLint (none configured), no Lighthouse, no browser click-through.
- Sitemap: no change needed (the new indexable addresses equal the live ones, already listed; register and referral pages are noindex).
- The directory header link on directory pages and the mock page model still carry the old `/directory` crumb until the backend change ships (the redirect covers it).
- No `V3_PUBLIC_*` value or production address was written anywhere.

## Go-live checklist (combined)

1. Backend: `HOSTNAMES_PLAN.md` (a) A to F; G22 to G26 (vendor route use, assets, reserved lists); G28 to G31 (register, referral, prices, pack list).
2. Owner: G24 nginx order (V2 names ahead of the wildcard), G32 replacement of the live marketing pages, G33 contact address, G18 legal drafts.
3. DNS and nginx: names for `directory`, `app`, `admin`, `api`, `media`, `partner` and the wildcard; `www` redirected; SPA fallback and noindex on `app` and `admin` (checklist in `PUBLIC_SITE.md` section 9).
4. Environment: the six host names, `APP_HOST` (or `NEXT_PUBLIC_VENDOR_APP_URL`), `API_BASE_URL`, `V3_PUBLIC_USE_MOCKS=false` after the API shapes are confirmed, then `V3_PUBLIC_ENABLED=true` last. The visitor address must reach the API (G15).
5. Run `npm run test:v3-public` and `npm run smoke:v3-public`, then check on staging with the real API: a vendor site on its host, the directory host, `/pricing`, a registration, a referral link.

Stopped here as instructed. Not pushed.
