# Dispatch D1 report: legal and company pages

Branch `v3-pub-fe6` (from `v3-pub-fe5`), folder `C:\Get4Domain\get4domain-pub`. **Nothing is pushed.** Written for the owner, who was away.

## Done

All six jobs are done. Nothing is blocked.

| Job | State | Commit | What |
|---|---|---|---|
| L0 | DONE | `e01f704` | Investigation: live pages and routes, footers, the firm route, strings and metadata. Table in `DISPATCH_STATUS_D1.md`. |
| L1 | DONE | `1f495f4` | Page framework (`LegalDocument`, route `v3-site/[doc]`), firm facts module, constants for effective date and version, footer links, sitemap entries (flag on only), tests, smoke. Disclaimer as the first page. |
| L2 | DONE | `d7752e4` | Terms of Service, Privacy Policy, Refund and Cancellation, Payments and Billing, Delivery Policy, Acceptable Use, Cookie Notice, Disclaimer, with copy-rule and decided-fact tests. |
| L3 | DONE | `703263f` | About Us and Contact (firm facts, Organization JSON-LD from the facts, grievance section only when data exists), Partner Programme Terms, Directory and Listing Terms. |
| L4 | DONE | `d43e94b` | Register and pricing accept notice with links, footer to every policy, accessibility and structured-data smoke checks over all new pages, five server modes. |
| L5 | DONE | this commit | `LEGAL_REVIEW.md`, `PUBLIC_SITE.md` section 14, `PUBLIC_GAPS.md` G38 to G41, this report. |

## Pages and routes (main host, flag on and `MAIN_HOST` set)

| Path | Page | Live twin replaced |
|---|---|---|
| `/terms` | Terms of Service | yes (live `/terms`) |
| `/privacy-policy` | Privacy Policy | yes |
| `/refund-policy` | Refund and Cancellation Policy | yes |
| `/payments-and-billing` | Payments and Billing | no |
| `/delivery-policy` | Delivery Policy (digital service) | no |
| `/acceptable-use` | Acceptable Use Policy | no |
| `/cookie-notice` | Cookie Notice | no |
| `/disclaimer` | Disclaimer | no |
| `/directory-listing-terms` | Directory and Listing Terms | no |
| `/partner-terms` | Partner Programme Terms | no |
| `/about`, `/contact` | About Us, Contact | the slice 7 pages |

Every page is server rendered with one H1, breadcrumbs, a canonical on the main host, a title of at most 60 characters with the brand, a description and BreadcrumbList JSON-LD. The policy pages show an effective date and version (one constant) and a table of contents. About and Contact carry one Organization block written from the firm facts only. All are linked from the footer. They are listed in `/sitemap-industries.xml` only with the flag on; `sitemap.xml`, `robots.txt`, `llms.txt`, the middleware's existing behaviour and all existing metadata are unchanged.

`/pricing` and `/register` say "By continuing, you accept the Terms of Service and the Privacy Policy." with links; the register checkbox logic is untouched.

## How the live site is protected

Flag off, or no `MAIN_HOST`: the new addresses are 404 (or, for `/terms`, `/privacy-policy`, `/refund-policy`, `/about`, `/contact`, `/pricing`, `/register`, the live page answers exactly as before). The smoke script checks this in the flag-off server (with the host names set) and in the flag-on server without host names.

## Tests and smoke

- `npx tsc --noEmit`: clean. `npm run build`: clean.
- `npm run test:v3-public`: **293 of 293** pass (was 251 before D1). One existing host-routing test was changed on purpose: it listed `/terms` as a live page that passes untouched on the main host; with this dispatch it is rewritten to the new page (flag on), so `/terms` was removed from that list. Nothing was weakened.
- `npm run smoke:v3-public`: **1633 of 1633** checks pass over five real servers (flag off with host names set; flag on without host names; flag on with host names; regulated packs on; flag on with every contact value set).
- Lint was not run: the app has no ESLint configuration (G19).
- No browser pass; no backend, database or provider was started or called.

## Please decide or supply (full list: `LEGAL_REVIEW.md`)

1. A lawyer in India must review every text before the flag is turned on. The text is a plain-language draft.
2. Refund windows and amounts, cancellation notice, trial length, end-of-term behaviour, wallet scope and expiry, retention, response and grievance timelines. The drafts state none and say "as shown at checkout or as agreed in writing".
3. Partner numbers: slabs, payout day, minimum, TDS rate, commission reversal.
4. CA: GST invoice wording while the GSTIN is pending, wallet and commission GST, TDS wording.
5. Arbitration: none is included, as instructed.
6. Replacement of the live `/terms`, `/privacy-policy`, `/refund-policy`, `/about`, `/contact` on the main host at go-live (G41), and whether to retire the older `/legal/*` drafts (G40).
7. Set the effective date in `lib/v3-public/legal-meta.ts` on the day the flag goes on (today it is the drafting date, 17 November 2026).

## Firm-profile fields the admin must fill

- In the backend firm profile (`PUT /v3/admin/firm-profile`, read publicly through `GET /v3/public/firm`): legal name, registered address (full street address and PIN), GSTIN. The public route sends only these three.
- In the public site's server environment (names in `.env.local.example`; empty means nothing is printed): `V3_PUBLIC_SUPPORT_EMAIL`, `V3_PUBLIC_SUPPORT_PHONE`, `V3_PUBLIC_GRIEVANCE_OFFICER_NAME`, `V3_PUBLIC_GRIEVANCE_OFFICER_EMAIL`, `V3_PUBLIC_GRIEVANCE_OFFICER_PHONE`, `V3_PUBLIC_FIRM_CIN`. The backend does not expose the registered email and phone publicly, so they cannot come from the API (G38).

Until these are set, the Contact page prints the firm name and the Tidel Park, Chennai address only, with no support email or phone, and the old slice 7 contact page's support email (from `constants/site.ts`) is **not** shown, as instructed. Set the support email before the flag goes on, or the Contact page gives a visitor no way to write except by post.

## Assumptions made (also in `DISPATCH_STATUS_D1.md`)

- Docs live in the repo root `docs\v3`, not under `get4domain_mvp`.
- Pages are reachable only with the flag and `MAIN_HOST` (the slice 7 mechanism).
- The older `/legal/*` drafts were left untouched.
- Policy text carries no digits or time words by rule; the brand name Get4Domain is the one exception to the digit rule.
- The Cookie Notice names only what the code is known to set (the first-party referral cookie), plus sign-in and security cookies in general words, and the gateway's own cookies. It is the least certain page.

## How to review

`npm run build`, then `V3_PUBLIC_ENABLED=true MAIN_HOST=localhost DIRECTORY_HOST=directory.localhost npx next start` and open `/terms`, `/privacy-policy`, `/refund-policy`, `/payments-and-billing`, `/delivery-policy`, `/acceptable-use`, `/cookie-notice`, `/disclaimer`, `/directory-listing-terms`, `/partner-terms`, `/about`, `/contact`, `/pricing`, `/register`. To see contact values, also set the `V3_PUBLIC_SUPPORT_*`, `V3_PUBLIC_GRIEVANCE_OFFICER_*` and `V3_PUBLIC_FIRM_CIN` names.

## Files

New: `lib/v3-public/{legal-meta,legal-docs,legal-paths,legal-strings,company-strings,firm-facts}.ts`, `lib/v3-public/legal-text/*.ts` (ten policies), `components/site/{LegalDocument,AcceptNotice}.tsx`, `app/(v3site)/v3-site/[doc]/page.tsx`, tests `legal-framework.test.ts` and `legal-copy-rules.test.ts`. Edited (flag guarded or additive): `v3-site/layout.tsx` (footer), `v3-site/about` and `contact` pages, `v3-site/pricing/page.tsx`, `RegisterForm.tsx`, `host-routing.ts`, `site-strings.ts`, `site-jsonld.ts`, `sitemap-industries.xml/route.ts`, `.env.local.example`, `scripts/v3-public/smoke.mjs`, `host-routing.test.ts`. Docs: `LEGAL_REVIEW.md`, `PUBLIC_SITE.md`, `PUBLIC_GAPS.md`, `PUBLIC_LEGAL_DRAFTS.md`, `DISPATCH_STATUS_D1.md`, this report.
