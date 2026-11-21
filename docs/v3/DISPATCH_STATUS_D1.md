# Dispatch D1 status: legal and company pages (branch v3-pub-fe6)

Repo root `C:\Get4Domain\get4domain-pub`, app `get4domain_mvp`. Docs live in `docs\v3` at the repo root.

## L0 finding table (pages)

All new pages are internal routes under `src/app/(v3site)/v3-site/` reached only by the main-host rewrite in `host-routing.ts` (`MAIN_PAGES`). They need `V3_PUBLIC_ENABLED=true` and `MAIN_HOST`, the same switch as the Slice 7 pages (PUBLIC_SITE.md section 10). Flag off: nothing changes, the live page answers.

| Page | Existing path (live site) | New path | Action |
|---|---|---|---|
| Terms of Service | `/terms` (marketing group) | `/terms` | replace only with flag on (rewrite to `/v3-site/terms`) |
| Privacy Policy | `/privacy-policy` | `/privacy-policy` | replace only with flag on |
| Refund and Cancellation | `/refund-policy` | `/refund-policy` | replace only with flag on |
| Payments and Billing | none | `/payments-and-billing` | new, flag on |
| Delivery policy (digital service) | none | `/delivery-policy` | new, flag on |
| Acceptable Use | none | `/acceptable-use` | new, flag on |
| Cookie notice | none | `/cookie-notice` | new, flag on |
| Disclaimer | none | `/disclaimer` | new, flag on |
| About Us | `/about` (V3 slice 7 page at same path) | `/about` | rewrite the slice 7 page body (firm facts, Organization JSON-LD from firm facts) |
| Contact | `/contact` (slice 7 page) | `/contact` | rewrite the slice 7 page (firm facts, support and grievance fields) |
| Partner Programme Terms | none | `/partner-terms` | new, flag on |
| Directory and Listing Terms | `/legal/directory-listing-terms` (draft, noindex) | `/directory-listing-terms` | new top-level page; the `/legal/*` drafts stay untouched (see ASSUMPTIONS) |

Other findings:

- Existing drafts: `/legal`, `/legal/{terms,privacy,refund-and-cancellation,wallet-terms,directory-listing-terms}` (directory group, `noindex`, strings in `lib/v3-public/strings.ts`). They stay. The register form links to `/legal/terms` and `/legal/privacy`; L4 repoints that to the new pages.
- Footer: the V3 shell footer is in `v3-site/layout.tsx` (Features, About, Contact, Terms, Privacy, Refunds, all `/legal/*` for the last three). The live `Footer.tsx` is not touched.
- Firm profile route: `GET /v3/public/firm` exists in the backend (`v3-firm`): answers `{ legalName, registeredAddress, gstin? }`, cache 5 minutes. It does NOT carry support email, phone, grievance officer or CIN (the backend keeps registered email and phone private, SUPER_ADMIN only). So those fields come from one config module with empty values.
- Strings and metadata: `site-strings.ts` (SITE) for the commercial pages, `site-metadata.ts` (`siteMetadata`, `brandedTitle`, canonical on the main host), `Crumbs` (breadcrumb UI + BreadcrumbList JSON-LD), `JsonLd` component.
- Live `terms`, `privacy-policy`, `refund-policy` are client-heavy `LegalPage` pages in `(marketing)`; they are not edited.

## Job table

| Job | State | Commit | Note |
|---|---|---|---|
| L0 | DONE | e01f704 | investigation, table above |
| L1 | DONE | 1f495f4 | legal framework, firm facts module, `[doc]` policy route, footer, sitemap, tests, smoke |
| L2 | DONE | d7752e4 | terms, privacy, refund, payments, delivery, acceptable use, cookies, disclaimer; copy-rule and fact tests |
| L3 | DONE | 703263f | About, Contact (firm facts, grievance only when set, Organization JSON-LD from facts), partner terms, directory and listing terms |
| L4 | DONE | d43e94b | footer to every policy, register and pricing accept notice with links to /terms and /privacy-policy, a11y and structured-data smoke over all new pages, three server modes plus a contact-values server |
| L5 | DONE | (L5 commit) | LEGAL_REVIEW.md, PUBLIC_SITE.md section 14, PUBLIC_GAPS.md G38 to G41, DISPATCH_REPORT_D1.md |

## ASSUMPTIONS

1. Docs folder is `C:\Get4Domain\get4domain-pub\docs\v3` (repo root), not under `get4domain_mvp`.
2. The legal pages are reachable only with the flag on AND `MAIN_HOST` set (rewrite mechanism of the slice 7 pages). With the flag on and no `MAIN_HOST` the live `/terms`, `/privacy-policy`, `/refund-policy` answer as before and the new-only paths are not served (the directory gate treats them as unknown addresses and answers 404).
3. The effective date and version come from one constant (`legal-meta.ts`). The date is the drafting date and must be set again by the owner when the flag is turned on.
4. Support email, phone, grievance officer and CIN come from environment variables read by one config module, empty by default (the firm route does not carry them). The old slice 7 contact page showed the support email from `constants/site.ts`; the new contact page prints it only when `V3_PUBLIC_SUPPORT_EMAIL` is set (instruction: empty values print nothing).
5. The existing `/legal/*` drafts are left as they are (noindex). They overlap the new pages; the owner or counsel should retire them at go-live (listed in LEGAL_REVIEW.md).
6. Policy text uses no digits and no time words; where a number is normally needed the text says "as shown at checkout or as agreed in writing".

## QUESTIONS FOR THE OWNER

The full list, page by page, is in `docs/v3/LEGAL_REVIEW.md`. Short form:

1. Lawyer review of every text before the flag goes on (the text is a plain-language draft).
2. Refund windows and amounts, cancellation notice, trial length, end-of-term behaviour, wallet scope and expiry, retention, response and grievance timelines.
3. Partner programme numbers: slabs, payout day, minimum payout, TDS rate, commission reversal.
4. CA: GST invoice wording with the GSTIN pending, GST on wallet top-ups and on commission, TDS wording.
5. Support email, support phone, grievance officer, CIN: set the environment names listed in the report.
6. Replace the live /terms, /privacy-policy, /refund-policy, /about, /contact on the main host at go-live? Retire the older /legal/* drafts?
7. Set the effective date on the day the flag goes on.
