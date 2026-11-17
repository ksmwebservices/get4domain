# Dispatch C1 status (frontend lane, public site: real Wave 4 shapes, probe, theme rendering)

Branch `v3-pub-fe5` (from `v3-pub-fe4`), folder `get4domain-pub/get4domain_mvp`. Docs are at the repo root `docs/v3`. Nothing pushed.

| Job | State | Commit | Note |
|---|---|---|---|
| P0 Investigate | DONE | (this commit) | findings below |
| P1 Reconcile | DONE | see git log | register 400 now reads `data.fields`; 6 new tests (250 unit, smoke 1198 of 1198); every other row was already SAME |
| P2 Theme rendering | BLOCKED-BY-GAP | see git log | by-host returns a finished stored page drawn from the theme by the backend; no theme key and no render data reach this app; shape needed is in PUBLIC_GAPS G37; nothing built |
| P3 Real-API probe | TODO | | |
| P4 Quality | TODO | | |
| P5 Docs and report | TODO | | |

## P0 FINDINGS: the site against API_CONTRACT_WAVE3.md and API_CONTRACT_WAVE4.md (incl. the A3 additions)

| Area | Contract | Site today | Mark |
|---|---|---|---|
| Pricing `GET /v3/public/pricing` | terms, `state`, `price{priceMinor,gstMinor,totalMinor}`, `gst`, `free`, `addons` | `plans.ts` normaliser reads exactly this (B3) | SAME |
| Address check `GET /v3/public/subdomain-availability?name=` | reasons AVAILABLE, INVALID, RESERVED, UNAVAILABLE | `subdomainStateOf` maps all four | SAME |
| Referral `GET /v3/public/referral/:code` | `{valid:true,source}` or `{valid:false}` | reads `source` | SAME |
| Register request `POST /auth/register` | `name,email,password,businessName,industry` required; `phone,referralCode,subdomain,product,track` optional; unknown field is 400; `track` handyman/professional/ecommerce | sends exactly those (no `product`) | SAME |
| Register success | HTTP 201, `data:{accessToken,user{...}}`, no `termsAcceptanceRequired` on a first registration | `r.ok` covers 201; `accessTokenOf` reads `data.accessToken`; terms screen is the vendor app's (via `/auth/me` there) | SAME (no test pinned the 201 and the exact user shape: add) |
| Register errors, codes | 400 `SUBDOMAIN_INVALID`, 400 `SUBDOMAIN_RESERVED`, 409 `HOST_UNAVAILABLE`, 409 no code (email exists), 429 | all mapped | SAME |
| Register errors, validation 400 | no code; `message` is one sentence; `data.fields` lists field names (e.g. `["name","email"]`) when they can be named, else `data:null`; unknown field also 400 | only the message wording is read; `data.fields` ignored, so a message that names no field gives the general error although the API named the field | FIXED in P1 (was DIFFERENT) |
| Subdomain length | up to 63 | form allows 3 to 40 | SAME (stricter on purpose, kept) |
| Register replay | same email + business + right password signs in, also 201, includes `termsAcceptanceRequired` | treated as success | SAME |
| Handoff `POST /v3/auth/handoff` | not in Wave 3 or 4 contract | assumed `{code}` (G2) | MISSING (stays open) |
| Directory host (W1): canonical, breadcrumbs, pagination, JSON-LD urls, sitemap index, chunks, robots `Sitemap:` line, llms, click-out and backlink urls without `/directory` prefix when `DIRECTORY_PUBLIC_BASE_URL` is set | model carries host-correct values | model is rendered as given; host layer already serves the directory without the prefix and 308s `/directory/...`; sitemap routes read `/v3/directory/sitemaps/index.xml` and chunks | SAME |
| Brand stays on the main origin in the model | yes | rendered as given | SAME |
| Vendor-site model, theme key | `themeId` is in `GET /v3/me/site` and the admin site read ("published pages are drawn from it"). `GET /v3/public/site/by-host` returns the **stored finished page** (HTML, css, sitemap, robots) | `vendor-site.ts` relays that page byte for byte and by design never re-renders it. No theme key reaches this app | MISSING (and not needed: the backend already draws pages from the theme) |
| `GET /v3/public/themes?pack=KEY` | `{pack,matchedBy,items:[{id,name,tier,tracks,categories,access}]}` | not used by the site | MISSING (no render data in it: ids, names, tiers only) |
| Theme switch routes (A3-2), held payments, gateway credentials, GST rate, TDS | vendor owner and staff routes | not public-site routes | not applicable |

## ASSUMPTIONS
- Docs path is `get4domain-pub/docs/v3` (the dispatch says `docs\v3`; the files live at the repo root).
- `data.fields` names are the DTO field names: `name`, `email`, `password`, `businessName`, `industry`, `phone`, `subdomain`, `referralCode`, `track`, `product`. Mapped to the form fields owner, email, password, businessName, category, phone, subdomain; the rest are ignored.
- P2 reading: the dispatch rule "render the chosen theme" cannot be met in this app without breaking the frozen relay rule (a stored page is relayed unchanged). Decided in P2.

## QUESTIONS FOR THE OWNER
- none yet
