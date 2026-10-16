# Industry designs round 2: progress (resume file)

Dispatch: `GET4DOMAIN_DISPATCH_V2_INDUSTRY_DESIGNS_R2_15OCT2026.md`. Started 16 Oct 2026 on top of round 1 (head `9f8f689`). To resume: read this file and the dispatch, continue from the first line not marked DONE, same rules, push to origin at the end.

| Phase | Status | Where |
|---|---|---|
| S0 Audit | DONE | `evidence/industry-designs/R2_AUDIT.md` |
| S1 Engine shell | IN PROGRESS | components DONE (`get4domain_mvp/src/engine/shell/`: popup, quick view, bottom nav, footer, social, hours, map, tabs, floating contact, cart button); built-in designs not yet wired to it |
| S2 Package contract and renderer | IN PROGRESS | backend DONE: `backend-api/src/themes/core/` (contract JSON, css, html sanitiser, package sanitiser, lint, fix); renderer DONE and typechecked (`engine/themepack/{render,site,data,context,actions}`, routes `site/[subdomain]/[[...rest]]`, `theme-pack/[id]/[[...rest]]`, sitemap); not yet run end to end |
| S3 Import, lint and admin | IN PROGRESS | backend DONE: `themes/themes-admin.service.ts`, `themes.controllers.ts`; lint command DONE (`scripts/theme/lint.mjs`, `--fix`); admin screen TODO |
| S4 Paid marketplace | IN PROGRESS | backend DONE: migration `20261016100000_theme_packages`, `theme-catalog/purchase/expiry` services, vendor tab API; vendor UI TODO |
| S5 Reference themes and prompt pack | IN PROGRESS | `themes/reference/clinic-calm` and `restaurant-hearth` DONE (pass lint with no warnings); `scripts/theme/register-reference.mjs` DONE (dry run by default); contract doc and prompt pack TODO |
| S6 Editor and dashboard | TODO | |
| S7 SEO and performance | TODO | |
| S8 Existing vendors and deploy steps | TODO | |
| S9 Guards | TODO | |

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
