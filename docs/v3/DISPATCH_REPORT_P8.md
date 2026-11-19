# Dispatch report P8: "This site is being set up" and Free sites show information only

Branch `v3-pub-fe16` (from `v3-pub-fe15`). Not pushed. No backend change, no .env read, no server touched. The route shape is as given in the brief: `GET /cms/site-state/:subdomain` returns `{ exists, status }` with status LIVE, DRAFT or NOT_FOUND.

## Done
- **Being set up.** In the vendor-site renderer (`src/app/site/[subdomain]/[[...rest]]/page.tsx`), when the site data cannot be fetched (the old code called `notFound()`), the page now asks the site-state route. `exists: true` gives a plain page "This site is being set up" (a short sentence, no link, form, button, e-mail or chat) and the page metadata says `noindex`. `exists: false`, NOT_FOUND, or an API that cannot answer keeps the normal not-found page. An unknown inner page of a site that does exist still gives the normal 404 (that is a real not-found, not a site being set up).
- **Free sites.** A new `FreeSiteView` is returned before any design, template, theme or industry renderer. It shows the business name, tagline, about, logo and banner pictures, offered items (name, price, description, picture), address and the phone number as plain text. It has no contact form, no chat widget, no button, no link (the footer is text), no e-mail, no WhatsApp and no phone link. The old contact page and its form are never reached for a Free site.
- Code: `src/lib/v3-public/site-state.ts` (`siteStateOf`, `fetchSiteState`, `isFreeSite`, `freeViewOf`), `components/site/SiteBeingSetUp.tsx`, `components/site/FreeSiteView.tsx`.

## Choices
- **How a site is known to be Free:** the renderer's data must say it: `plan: 'FREE'` (or an object with `kind`, `tier` or `key` FREE) or `isFree: true`. Anything else counts as not Free. I chose this (not "unknown means Free") so existing paid sites on this renderer do not silently lose their contact forms.
- The setup page is served with the page's normal status (Next streams the page); it is `noindex`. It is not a 503 with Retry-After.
- Only http(s) pictures are shown on a Free site; the items list is capped at 24.
- The V3 host route (`vendor-site`) relays the backend's stored page unchanged and was not touched; its Free rules stay the backend's.

## What the backend still needs (the main gap)
1. **`GET /cms/site/:subdomain` does not send the plan today** (the copy of the code in this repo has no plan field), so until it sends `plan: 'FREE'` or `isFree: true` the Free page is never chosen. This is the one thing to add for the Free rule to take effect. Say which field name you prefer and the frontend reads it.
2. The same route returns 404 for a draft; that is why the setup page needs the site-state route. Nothing else needed there.
3. A sandbox site (`isSandbox`) answers NOT_FOUND on the site route; confirm site-state agrees with that.

## Verification
`npm.cmd run test:v3-public`: 538 pass, 0 fail (new `p8.test.ts`: state shapes, fetch rules, the 404 kept when the site does not exist, plain setup page, Free detection, no forbidden element or word in the Free page file, Free page placed before every other renderer). `tsc --noEmit` clean. `next build` passes. `scripts/v3-public/p8-shots.mjs` (a small fake API on 127.0.0.1:3199; build with `NEXT_PUBLIC_API_URL` pointing at it, read at build time) ALL PASSED at 375, 768 and 1280: a draft address shows "This site is being set up" with no link, form or button and `noindex`; an unknown address shows the not-found page; a Free site shows its facts with no form, button, input, link, e-mail, WhatsApp or chat; no sideways scroll; no page errors. Note: Next answers the unknown-address page with status 200 in this setup (same as before P8); the script reports the status and asserts the page. Screenshots in `docs/v3/p8-shots/`.
