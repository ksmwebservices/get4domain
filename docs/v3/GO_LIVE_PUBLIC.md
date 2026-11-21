# Go-live: public site environment (dispatch D2)

Names only. No value is written here and none is hard-coded in the app. Set these on the server that runs the public site (`get4domain_mvp`), then restart it. All are read at request time except where noted. The legal text is an OWNER DEFAULT draft: a lawyer in India should review it (`LEGAL_REVIEW.md`) before the flag is turned on in production.

## Switches

| Name | Meaning |
|---|---|
| `V3_PUBLIC_ENABLED` | The flag. Exactly `true` turns the new public site on. Anything else, or unset, keeps every new route a 404 and the live site unchanged. |
| `V3_PUBLIC_USE_MOCKS` | Exactly `false` makes the pages ask the real API. Unset or any other value uses sample data and never touches the network. Set to `false` for go-live. |
| `V3_REGULATED_PACKS_PUBLIC` | Leave unset (off). Only the exact value `true` publishes the four regulated industry pages (clinic, lab, pharmacy, legal and finance practice). |

## Host names (host name only: no scheme, no path, no port)

| Name | Meaning |
|---|---|
| `MAIN_HOST` | The marketing site host. Needed for the policy, About, Contact and pricing pages to be served. `www.` of it is the same site but never canonical. With it unset, the live pages answer as before. |
| `DIRECTORY_HOST` | The public business directory host. |
| `APP_HOST` | The business app host (sign-in and register hand-off links). |
| `ADMIN_HOST`, `API_HOST`, `MEDIA_HOST` | Reserved hosts this app never handles; set them so their names are protected from vendor subdomains. |

## API and canonical origin

| Name | Meaning |
|---|---|
| `API_BASE_URL` | Server-only address of the backend API (http or https). Used first. |
| `NEXT_PUBLIC_API_BASE_URL` | Public fallback for the same address, used when `API_BASE_URL` is unset. |
| `NEXT_PUBLIC_VENDOR_APP_URL` | Optional full address of the business app; if unset it is built from `APP_HOST`. |
| `V3_PUBLIC_SITE_ORIGIN` | Canonical origin for sitemap and robots lines. A leading `www.` is dropped. |
| `V3_PUBLIC_REVALIDATE_SECONDS` | Optional cache time of page data, between 10 and 86400. Default 300. |

## Firm contact (empty means the page prints nothing for it)

| Name | Meaning |
|---|---|
| `V3_PUBLIC_SUPPORT_EMAIL` | Support email on Contact and in the company details of every policy page. |
| `V3_PUBLIC_SUPPORT_PHONE` | Support phone, same places. |
| `V3_PUBLIC_GRIEVANCE_OFFICER_NAME` | Grievance officer name. |
| `V3_PUBLIC_GRIEVANCE_OFFICER_EMAIL` | Grievance officer email. |
| `V3_PUBLIC_GRIEVANCE_OFFICER_PHONE` | Grievance officer phone. |
| `V3_PUBLIC_FIRM_CIN` | Company identification number, printed in the company details. |

The grievance block (with the 48 hours and one month timelines) appears on Contact, Terms and the Refund page only when at least one grievance value is set. Set at least the name and the email before go-live, or the pages promise a complaint route that is not shown.

Legal name, registered address and GSTIN come from the firm profile in the backend admin (`GET /v3/public/firm`), not from the environment. Until it answers, the pages use "KSM QUANTUM TECHNOLOGIES, Tidel Park, Chennai, Tamil Nadu, India".

## Before turning the flag on

1. Set the effective date in `legal-meta.ts` (`LEGAL_EFFECTIVE_DATE`) to the go-live day. It is shown from one place, the policy page layout.
2. Have the lawyer review the texts; decide the open questions in `PUBLIC_GAPS.md`.
3. Run the smoke script against a staging copy with the same names set.
