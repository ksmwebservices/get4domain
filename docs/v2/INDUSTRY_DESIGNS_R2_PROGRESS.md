# Industry designs round 2: progress (resume file)

Dispatch: `GET4DOMAIN_DISPATCH_V2_INDUSTRY_DESIGNS_R2_15OCT2026.md`. Started 16 Oct 2026 on top of round 1 (head `9f8f689`). To resume: read this file and the dispatch, continue from the first line not marked DONE, same rules, push to origin at the end.

| Phase | Status | Where |
|---|---|---|
| S0 Audit | DONE | `evidence/industry-designs/R2_AUDIT.md` |
| S1 Engine shell | DONE | components `get4domain_mvp/src/engine/shell/` (popup, quick view, phone bar, footer, social, hours, map, tabs, floating contact, cart button); wired into built-in designs by `shell/with-shell.ts` + `kit/KitRenderer.tsx`, and into themes by `themepack/site.tsx`; data in the category pack (`config.shell`), editable in Admin, Category packs (`packs-admin/ShellAdmin.tsx`) |
| S2 Package contract and renderer | DONE | `backend-api/src/themes/core/` (contract JSON, css, html, package sanitiser, lint, fix); renderer `engine/themepack/{render,site,data,context,actions}`; routes `site/[subdomain]/[[...rest]]`, `theme-pack/[id]/[[...rest]]`, per-host sitemap |
| S3 Import, lint and admin | DONE | `scripts/theme/lint.mjs` (+ `--fix`), admin screen `themes-admin/ThemesAdmin.tsx` at `/admin/themes`, import route `/admin/themes/import` |
| S4 Paid marketplace | DONE | migration `20261016100000_theme_packages`, `themes/theme-{catalog,purchase,expiry}.service.ts`, vendor tab `SiteShellTabs.tsx` (MarketplacePanel) |
| S5 Reference themes and prompt pack | DONE | `themes/reference/{clinic-calm,restaurant-hearth}`, `scripts/theme/register-reference.mjs`, `docs/v2/THEME_CONTRACT.md`, `docs/v2/THEME_PROMPTS.md` |
| S6 Editor and dashboard | DONE | Navigation, Popup form and Preview tabs, extra social links in About, marketplace under Template (`app/dashboard/my-website/SiteShellTabs.tsx`); Category packs edits the shell |
| S7 SEO and performance | DONE | measured in `backend-api/scripts/themes/verify-themes-render-2.js` (Slow 4G, 4x CPU, phone: LCP about 0.9 s, CLS 0) |
| S8 Existing vendors and deploy steps | DONE (local) | `flagged-vendors-dry-run.js` reports shell and themes; `scripts/industry-designs/ksm-before-after.mjs` evidence; DEPLOYMENT.md section 12 rewritten as the combined release with a recovery box |
| S9 Guards | DONE | `backend-api/scripts/themes/verify-themes-{pg,migration-pg,render}.js`, `get4domain_mvp/scripts/verify-themes.mjs`, wired into `scripts/bos-verify.mjs` |

Resume note: if this file says everything is DONE, only the final `npm run bos:verify`, the commit and the push can be left; check `git log` and `git ls-remote origin get4domain-site`.

## Decisions taken without asking

1. Themes are rendered by turning the sanitised HTML into React elements on the website (parse5), so engine tags become the real components and nothing outside the contract can run.
2. The sanitiser, lint and contract live once in the API (`themes/core`); the lint command line loads the same TypeScript with the TypeScript compiler, so KSM needs no build step.
3. Theme pictures are rows in `g4d_theme_assets` (no new volume); picture addresses are flat (`/themes/assets/<id>/img~a.webp`).
4. A theme is a design key `t:<key>`; a free-default theme replaces one of the four built-in slots of its categories (the vendor still sees exactly four); marketplace themes are listed in the Template tab with a yearly price (admin only) plus 18 percent GST.
5. Licences: one row per paid year (`g4d_theme_entitlements`), unique payment reference, renewal starts when the current year ends; the daily job (06:30 IST) reminds at 30, 7 and 1 days and marks expired; the public payload then falls back to the category's default free design.
6. The shell (words, five bottom-navigation slots, popup steps) is pack data (`config.shell`), per family with per-category overrides, editable in Admin.
7. The popup posts through the existing `engine.enquiry` and `engine.checkout.request` actions only. The vendor's notification contact (extras.popup.notifyPhone / notifyEmail) is read server-side from the vendor's own saved site when a lead arrives.

8. Reference themes replace the built-in design slots `warm` (Clinic Calm, for clinic and diagnostics) and `bold` (Restaurant Hearth, for restaurant), so each category keeps `classic` as its safe default. The artwork is original SVG drawn for the themes; vendors' own pictures (hero, items, gallery) are always shown first.
9. The theme class and colours sit on the outermost element of a themed page so the popup, cart and bottom bar (which sit beside the page) wear the theme's colours.
10. Phone-bar buttons never point nowhere: if a vendor has no team page, no gallery or a smaller plan, the button points at the nearest page that exists (finally the home page), so the bar always has five buttons.
11. A theme's own CSS class names can never restyle the engine's popup, phone bar or cart: the theme's scope class sits only on the page content; its colour variables (`:root` rules) are handed to the engine parts from outside the scope.
12. A retired theme that a vendor has paid for keeps working until their year ends; after that (or for anyone without a licence) the site falls back to a free design with a plain notice.
13. Notices about licences are sent after the lock-protected database step, never inside it.
14. When the plan allows fewer pages than the theme has, the contact page and the page that lists the items are kept first.
15. `puppeteer-core` is now declared as a dev dependency of the website (the guards use it; it was installed but undeclared).
16. Not done on purpose: backend/website `npm run lint` (no ESLint is installed or configured in either project; this predates this round). Type checks (`tsc --noEmit`) and both builds are the gate.
17. Pages that are streamed (every Get4Domain site page) need the browser to run its ordinary page script to reveal the late parts; this predates this round. The no-script form fallback was therefore proved with the browser's own native form post (multipart with the server action id) instead of a no-script browser.
