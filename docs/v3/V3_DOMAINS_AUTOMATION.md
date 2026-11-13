# V3 Domains: rules (Batch 11, Stage 15)

Frozen owner rules of 4 November 2026 that this run touches, plus Amendment 07 (vendor domain flows) and Amendment 10 Part D (real domain registration). Where this file and an earlier file differ, the owner overrides of the Stage 15 run win.

## Rules

1. Every vendor has a mandatory Get4Domain subdomain. A Pro vendor may add a custom domain; both can be live. Our promotion covers the subdomain only; promoting the custom domain is a paid add-on. The subdomain is the canonical host by default; while the custom-domain promotion add-on is active the custom domain is canonical. Only the canonical host is in the sitemap.
2. Never hide, hold or delete a business site for plan expiry, suspension or a lapsed domain. If a domain lapses the site stays live on its Get4Domain subdomain.
3. The wallet is V3's own: no cash-out, no refunds of any kind. A failed domain purchase releases its hold; that is a reversal of a failed purchase, not a refund.
4. Prices come from the effective-dated, approved price book. No price is invented. A domain sale price is the registrar cost plus an admin-set, effective-dated, approved margin, plus GST.
5. Tax: one rule chooses IGST or CGST plus SGST; rates come from tables, never code.
6. No timeframes in generated text. The names Workspace, BOS and LeadSpace never appear in generated or seeded product text.
7. Vendor action and staff action are written to the activity log. Domain changes raise `DOMAIN_CHANGED`.

## Registrar rules (Amendment 10 Part D, with the Stage 15 owner overrides)

- The vendor is the registrant and owner. At first purchase the vendor becomes a registrar customer and contact (registrant, admin, tech and billing) built from the vendor's verified details.
- No fake search in the product. The availability search is a real read-only call, behind `REGISTRAR_LIVE_SEARCH` (default OFF). Fakes exist only inside tests.
- Purchase is separate behind `REGISTRAR_LIVE_PURCHASE` (default OFF). A startup guard refuses either live flag unless the keys exist in the server environment.
- Keys (`auth-userid`, `api-key`) come from environment variables only, are never read, printed or logged by Claude Code, and the API works only from the whitelisted server IP. The base URL is a setting so the owner can point it at the test base first.
- Identity validation before the first purchase: email OTP, phone OTP, postal address, one government document (PAN, GST certificate, Udyam or business registration; Aadhaar only as a masked copy with the last 4 digits, never a full number, no e-KYC). Staff review. Documents encrypted at rest, every access logged. Retention is a setting with no default.
- Purchase from the wallet: hold, registrar call, charge. On failure the hold is released automatically. Idempotent: a domain is never bought or charged twice.
- Renewal is allowed before expiry only. Privacy protection, automatic name servers and DNS so the site works, expiry alerts.
- A daily reconciliation compares local orders with the registrar. A low reseller balance blocks purchases and alerts staff; the minimum is a setting with no default.
- Claude Code never makes a live call. Tests use the fake port and recorded fixtures only.

## Own-domain automation (slice 5.6c) rules

- Cloudflare custom hostnames are fake only in this run and never live.
- Flow: add domain, TXT verification, create the custom hostname (www first; the bare domain is flagged as needing the Cloudflare option), watch the certificate, then Connect mode (mapped) or Forward mode (redirect to the subdomain).
- The canonical switch is a controlled, recorded switch in both directions, only through the service.

## Forward mode with no active subdomain (Block 4b, slice 10)

Forward mode sends visitors of the business's own host to its Get4Domain subdomain. If the business has no ACTIVE subdomain, there is nowhere to send them. The connection used to go ACTIVE with no redirect and no warning (noted in `B11_LOG.md`). It now lands in `NEEDS_ATTENTION` with `failureReason = NO_ACTIVE_SUBDOMAIN`, no redirect is planned, and the existing `connection_lost` notice and activity row are raised. Connect mode is unaffected. Fixing it is the existing retry once the business has a subdomain. The check also now answers with the stored row after the mode is applied, so a `REDIRECT_NOT_APPLIED` result is no longer hidden behind a stale ACTIVE answer.
