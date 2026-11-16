# V3 Public Legal Pages: DRAFT FOR COUNSEL REVIEW

**Status: draft. Not reviewed by counsel. Do not turn the public site on in production until counsel has approved or replaced every text listed here.**

The five legal pages are plain-language drafts written from the product rules only. Each page shows a "draft for review" banner and is `noindex, nofollow` until they are approved.

| Page | Address | Text lives in |
|---|---|---|
| Terms | `/legal/terms` | `src/lib/v3-public/strings.ts`, `S.legal.docs.terms` |
| Privacy | `/legal/privacy` | `S.legal.docs.privacy` |
| Refunds and cancellation | `/legal/refund-and-cancellation` | `S.legal.docs.refund` |
| Wallet terms | `/legal/wallet-terms` | `S.legal.docs.wallet` |
| Directory listing terms | `/legal/directory-listing-terms` | `S.legal.docs.listing` |

The live marketing pages `/terms`, `/privacy-policy` and `/refund-policy` are unchanged and are not replaced by these.

## Product rules the drafts rely on (and nothing more)

- Free sites are informational listings. Pro means any paid plan. Prices exclude GST.
- No timeframes appear in any text (the wallet text says each top-up carries an expiry date shown with it, without a period).
- Wallet: no refunds of any kind, no cash-out, no transfer, the balance never goes below zero; a hold released on cancel or rejection and a charge reversed after a failure on our side are not refunds.
- The directory has one action, Visit site, through the click-out. It shows no phone number, email address or messaging link, and passes on no enquiry.
- A claim code goes to the contact held for the business, never to an address typed on the page. Removal requests are confirmed through the contact held.
- Visit and campaign counts hold no personal details and set no cookie (the backend states this for the visit and page-visit routes).
- No ranking claims, no guarantees, no ratings.

## What counsel needs to decide or supply

- Governing law, jurisdiction and dispute wording (none is written).
- Limits of liability and warranty wording (none is written).
- Data retention periods and the grievance contact (none is written; the drafts point to the registered address).
- The GSTIN (pending) and whether a different registered address line is needed.
- Whether the backend policy store (`/v3/admin/terms`, kinds `TERMS_OF_SERVICE`, `PRIVACY`, `REFUND_WALLET`, `DIRECTORY`) should serve these pages instead of the strings module; no public read route for the latest published version was used here.

## Firm identity

One typed object, `src/lib/v3-public/firm.ts`: name KSM QUANTUM TECHNOLOGIES, registered address Tidel Park, Chennai, GSTIN `null` (not shown while pending). An admin setting will replace `getFirm()`; the assumed route is in `PUBLIC_GAPS.md` (G6).
