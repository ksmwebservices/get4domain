# Lane A1 report: vendor address rule, host-relative links, one canonical, head identity

Branch `v3-pub-a1` (from `v3-pub-fe19`). Not pushed. No backend, .env, staging or V2 file touched.
Note: `docs/v3/WEBSITE_ENGINE_AUDIT.md` does not exist in this repo or any sibling worktree, so sections E, L, M were not read; the work is from the code.

## Fixed per renderer
- Middleware: GET/HEAD `/site/<name>[/...]` on any host -> 301 to `https://<name>.<base>/<same path>` (query kept, `/home` -> `/`); 404 + noindex when the vendor does not exist (site-state route); 404 for an impossible name; 503 if the API cannot answer; POST untouched; localhost exempt (dev). Matcher now includes `/site/:path*`. `/directory` untouched.
- Links (base is now "" on a vendor host): theme design kit (already relative), imported theme packs (`themepack/*`), built-in designs + engine shell (`sitedoc/*`, `shell/*`), uploaded static themes (`raw-theme-frame`, `raw-html-site`). Home is `/`. The `/theme-pack/<id>` preview route keeps its own base.
- Head, all renderers, one builder `site-kit/head.ts` (`buildHead`): title `<page> | <name> | <category> in <city>` (home without page), description (vendor's seoDesc, else about, else a sentence from own fields only, <=160), favicon via `/app-icon` (route now draws the vendor logo when it is png/jpeg/gif <=1 MB, else initials), Apple icon, manifest, one absolute canonical on the subdomain (docV2 condition removed), Open Graph + Twitter (share image: page image, ogImage, banner, logo, icon route; `/starter/` and SVG are skipped), `<html lang="en-IN">` already in the root layout.

## Decisions / caveats
- City is derived from the vendor's address text (no backend city field); left out when unknown.
- Canonical host: the backend sends no custom-domain field, so the subdomain is always used.
- The vendor's own `seoTitle` is no longer used (the dispatch pattern replaces it); P11's Free title `... | Get4Domain` is replaced by the new pattern.
- Root layout still adds the Get4Domain marketing keywords and site-wide JSON-LD to vendor pages (not changed here).

## Backend changes needed (none made)
- Relayed `/vendor-site` pages (backend HTML): any link built as `/site/<name>/...` is now fixed at request time by the 301, but should be written host-relative. Not inspected here (backend not touched).
- Optional fields: `city`, custom-domain/canonical host (`canonicalHost`), plan on every site response.

## Robots finding (rule unchanged)
- Free and Pro generic kit, built-in designs, uploaded themes, templates, bespoke engine designs: emit `robots: noindex,nofollow` only for a preview, or `docV2 && indexable === false`. A Free site that is not docV2, or an incomplete profile on a non-docV2 site, emits NO robots tag and inherits the root layout `index, follow`.
- Imported theme packs: noindex for preview, `indexable === false`, and the book/enquire/order (nofollow too) and legal pages.
- "Being set up" page: noindex,nofollow. Relayed backend pages: backend decides (not checked).

## Tests
`npm run test:v3-public`: 636 pass, 0 fail (28 new in `a1.test.ts`; p8, p9, p10, p11 adjusted). `tsc` clean, `next build` passes, `p11-shots.mjs` ALL PASSED at 375/768/1280 incl. real-HTTP 301/404 checks.
