# V3 Activity, alerts, trust and safety (Batch 4B)

Rules frozen by the owner on 4 November 2026. They are written here as given, and the slices 5.20, 5.21 and 5.22 are built to them.

## Owner rules this batch depends on

**Rule 6. Never hide, hold or delete a business site or listing for plan expiry or suspension.** After grace, or on suspension, it becomes a Free listing-only site and stays listed; stored Pro theme and data are kept and return with Pro. A site is hidden or deleted only at the vendor's own request, or when staff delete an empty listing with no business details. The only other exception is the Legal takedown state (SUPER_ADMIN, written reason, audit) when it exists. A removed business is never listed again.

**Rule 8. Theme switch is self-service (no admin approval).** The first Pro theme is included, each later switch is the Theme Switch Service fee. Every vendor action is written to the activity log and staff see alerts afterwards.

**Rule 11. Prohibited businesses and conduct are set by the Acceptable Use terms.** Terms are versioned with recorded acceptance. Legal text is supplied by counsel and a placeholder body cannot be published.

## What follows from them

- The activity log is append-only. One service, `ActivityService.record()`, writes it, and every V3 module that changes vendor data calls it.
- An alert is a notice to staff, raised after the event. An alert never hides, deletes, freezes or blocks anything by itself.
- A suspension reuses the listing and site state machine of slice 5.1d: Pro features stop and the site stays listed as a Free listing-only site.
- A legal takedown is the one other way a site is hidden. Only SUPER_ADMIN may create or reverse it, a written reason is required, it is audited, the site serves a plain notice page, the listing leaves the directory and is never listed again, and the vendor sees the reason.
- The prohibited-term scan runs on publish and on a request. A match raises an alert and never blocks publishing.
- Business proof is optional at Pro activation. Missing proof raises an attention item, never a refusal.
- No threshold, cap or limit is invented. Alert rules are seeded disabled with no thresholds; staff set them and enable them.

## Alert table

| Rule key | Level | Fires when |
|---|---|---|
| PAYMENT_METHOD_CHANGED | HIGH | a vendor's payment method (UPI or gateway) is added, changed or removed |
| BUSINESS_IDENTITY_CHANGED | HIGH | the business name or the GST number changes |
| CAMPAIGN_SPIKE | HIGH | the daily cap, a complaint count or a STOP count passes the staff-set threshold |
| PAYMENT_FAILURES | HIGH | payment failures for one vendor pass the staff-set threshold |
| PROHIBITED_TEXT | HIGH | the prohibited-term scan matches published or requested text |
| DOMAIN_CHANGED | MEDIUM | a custom domain is added, changed or removed |
| LARGE_IMPORT | MEDIUM | an import passes the staff-set row count |
| PLAN_STATE_CHANGED | MEDIUM | a vendor's plan state changes (grace, lapse, suspension, restore) |
| LISTING_DELETION_REQUESTED | MEDIUM | a vendor asks for their listing or site to be deleted |
| THEME_SWITCHED | LOW | a vendor or staff switches a theme (log only, no alert row is needed to act on it) |

Statuses of an alert: NEW, LOOKING, RESOLVED, NOT_AN_ISSUE. Levels: HIGH, MEDIUM, LOW.

---

# Design of slices 5.20 and 5.21 (as built)

Slice 5.22 (vendor 360, search, saved views, bulk actions) was cut by the owner on 7 November 2026 and moves to Release 2. Nothing of it is built.

## Data dictionary

### Slice 5.20 (migration `20261123100000_v3_activity_alerts`)

| Table | Holds | Notes |
|---|---|---|
| `g4d_activity_log` | one row per thing a vendor, staff member or the system did | append-only (trigger), no foreign key, summary masked, address kept as a keyed hash |
| `g4d_alert_rules` | one row per alert rule: key, level, optional numbers, roles told, on switch | seeded **disabled** with **no numbers** |
| `g4d_alerts` | a notice to staff raised after an event | status NEW, LOOKING, RESOLVED, NOT_AN_ISSUE; a closed alert has a closing time |
| `g4d_v3_notifications` | in-app notice for one person or a role | named so because `g4d_notifications` is the legacy table |

### Slice 5.21 (migration `20261124100000_v3_trust_safety`)

| Table | Holds | Notes |
|---|---|---|
| `g4d_business_proofs` | a registration number or document a vendor offers (GST, UDYAM, SHOP_LICENCE, PROFESSIONAL_REGISTRATION, OTHER) | one row per vendor and kind; a new submission replaces it and resets it to SUBMITTED; CHECKED and MISMATCH need a checker (CHECK) |
| `g4d_trust_blocklist` | values we refuse to deal with (PHONE, EMAIL, DOMAIN, UPI, NAME) | **hash only**, keyed with the existing pepper over the normalised value; unique per kind |
| `g4d_business_reports` | a public report about a listing or a site | no personal data required; contact optional; status NEW, LOOKING, CLOSED |
| `g4d_prohibited_terms` | the phrases the scan looks for | **starts empty**; stored folded (lower case, single spaces); SUPER_ADMIN fills it |
| `g4d_takedowns` | a Legal takedown | no foreign key (outlives the vendor); reason, decider, time and target never change; no delete while the vendor or listing exists; a reversal records who, when and why |

Row-level rules are on for all five tables (the backend role bypasses them, like every other table).

## Rules in force

1. **Suspension never hides.** A suspended vendor's listing stays listed as a Free listing-only site (carry-over C1, commit `03e1790`): the directory search, the detail page and the Visit link keep serving it; it is kept out of the sitemap (a suspended listing is not indexable). Only a removed business, the vendor's own request, or a Legal takedown hides a site.
2. **Legal takedown.** SUPER_ADMIN only (route matrix, and the service checks the role again), a written reason is required to create and to reverse, the site serves a plain notice (HTTP 451, no cache, noindex, no business content, no link, no form), the listing goes to REMOVED in the **same database transaction**, the public requests gate answers the same plain 404 as any hidden site, and the vendor can read the reason at `GET /v3/me/takedown`.
3. **Prohibited-term scan.** Runs after a publish (on the text of the pages just published) and after a public request is accepted (on the customer's words). A match writes `prohibited_text.matched` to the activity log, which the PROHIBITED_TEXT rule turns into a HIGH alert when staff have switched it on. It **never blocks**, never throws, and stores the matched phrases and categories, never the text.
4. **Business proof is optional.** A Pro vendor with no proof is counted on the attention board as `BUSINESS_PROOF_MISSING` (MEDIUM). Nothing is refused for lacking one.
5. **PayeeNameCheckPort (fake).** Compares the name on a UPI handle with the business name and the owner name. A mismatch writes `payee_name.mismatch`, which the new PAYEE_NAME_MISMATCH rule (HIGH, seeded disabled) turns into an alert. It never blocks. The payment slice will call it; the real port will ask the provider.
6. **No invented value.** The prohibited-term table, the alert thresholds and every cap ship empty. A rule that needs a number refuses to switch on without it.
7. **Terms and Acceptable Use** (rule 11) are unchanged: versioned, acceptance recorded, a placeholder body cannot be published (slice 5.15).

## API contract

All answers use the standard envelope `{ success, statusCode, message, data, timestamp }`. Errors carry `code`.

### Public

| Route | Notes |
|---|---|
| `POST /v3/public/report-business` | body `{ subjectType: "LISTING" or "SITE", subject, reason, contact? }`; rate limited 5 per minute per address; **always** `202 { received: true }`, whether or not the subject exists |

```http
POST /v3/public/report-business
{ "subjectType": "SITE", "subject": "shop.example.in", "reason": "looks like a copy of another shop" }
-> 202 { "success": true, "data": { "received": true } }
```

### Vendor (owner only; a team member gets 403)

| Route | Notes |
|---|---|
| `POST /v3/me/business-proof` | `{ kind, number, documentRef? }`; replaces the same kind |
| `GET /v3/me/business-proofs` | my proofs and their status |
| `GET /v3/me/takedown` | `{ active, reason, at }` |

### Staff (AdminGuard + role matrix)

| Route | Roles | Notes |
|---|---|---|
| `GET /v3/admin/business-reports?status` | OPERATIONS, SUPER_ADMIN | contact masked, address hash never shown |
| `PATCH /v3/admin/business-reports/:id` | OPERATIONS, SUPER_ADMIN | `{ expectedStatus, status?, note? }`; 409 `TRUST_STALE` if it moved |
| `GET/POST /v3/admin/trust-blocklist`, `DELETE .../:id` | OPERATIONS, SUPER_ADMIN | `{ kind, value, reason }`; the value is normalised and hashed, never returned; 409 `BLOCK_EXISTS` |
| `GET /v3/admin/business-proofs?status&vendorId` | OPERATIONS, SUPER_ADMIN | |
| `PATCH /v3/admin/business-proofs/:id` | OPERATIONS, SUPER_ADMIN | `{ expectedStatus, status: CHECKED or MISMATCH, note? }` |
| `GET/POST /v3/admin/prohibited-terms`, `PUT/DELETE .../:id` | SUPER_ADMIN | `{ term, category, enabled? }`; 409 `TERM_EXISTS` |
| `GET /v3/admin/takedowns?status&vendorId` | OPERATIONS, SUPER_ADMIN | |
| `POST /v3/admin/takedowns` | SUPER_ADMIN | `{ vendorId or listingId, reason, documentRef? }`; 400 `TAKEDOWN_REASON_REQUIRED`, 409 `TAKEDOWN_ALREADY_ACTIVE`, 404 `TAKEDOWN_TARGET_UNKNOWN` |
| `POST /v3/admin/takedowns/:id/reverse` | SUPER_ADMIN | `{ reason }`; 409 `TAKEDOWN_NOT_ACTIVE` |

MARKETING is refused on every staff route. `GET /v3/admin/attention` (slice 5.20) now also returns `items: [{ key: "BUSINESS_PROOF_MISSING", level: "MEDIUM", count }]` and the queues `reportsNew`, `proofsToCheck`, `proofsMissing`.

## Decision log

| # | Decision | Why |
|---|---|---|
| D1 | The trust block list is `g4d_trust_blocklist` (kinds PHONE, EMAIL, DOMAIN, UPI, NAME) at `/v3/admin/trust-blocklist` | `g4d_blocklist` and `/v3/admin/blocklist` already exist (the do-not-contact register, kinds `*_HASH`); migrations are additive only, so the old one is not altered |
| D2 | The report table is new (`g4d_business_reports`, route `/v3/public/report-business`); the older `POST /v3/public/reports` (slice 5.14) stays | different table, different status words; removing the old route is a separate decision |
| D3 | An eleventh alert rule, `PAYEE_NAME_MISMATCH` (HIGH), seeded disabled | the dispatch says a payee mismatch "raises an alert"; the owner's table had ten rules. The loader only creates rules that are missing, so re-running `seed-v3-alert-rules.js --apply` adds it |
| D4 | A takedown reversal restores the listing as it was | the dispatch has a REVERSED status and says "never relisted"; read as: only a SUPER_ADMIN reversal with its own written reason can bring a taken-down business back. **OPEN QUESTION** |
| D5 | The takedown guard trigger allows a delete only when the vendor and the listing are gone | same exception as the activity log, so staging test tenants can be cleaned (cleanup count must reach 0) |
| D6 | The scan hooks sit behind optional ports (`ProhibitedScanPort`, `TakedownPort`), injected `@Optional()` | the publisher and the requests service build and behave exactly as before without the trust module; no import cycle |
| D7 | The takedown route row (written by the 5.20 interceptor) has no vendor; the service writes a second row `takedown.created` / `takedown.reversed` with the vendor, without the reason | the vendor's own history shows it; the legal wording stays only in `g4d_takedowns` |
| D8 | Contact on a report is optional free text, masked in staff lists | "no personal data required" |

## Differences from the dispatch

- Table `g4d_trust_blocklist` instead of `g4d_blocklist` and the route `/v3/admin/trust-blocklist` (D1).
- Table `g4d_v3_notifications` instead of `g4d_notifications` (5.20).
- Takedown has `priorListingStatus` and `priorIndexable` so a reversal restores exactly what was there.
- The vendor-facing `GET /v3/me/takedown` and the staff `GET /v3/admin/takedowns` were added (the vendor "sees the reason"; staff need to see what is in force).
- The payee check is a port plus a fake; it is not wired to any payment route yet (the payment slice calls it).
- Slice 5.22 not built (owner cut).

## OPEN QUESTIONS for the owner

1. Takedown reversal (D4): keep it, or make a takedown permanent and drop the REVERSED path?
2. The wording of the takedown notice page is neutral and placeholder-grade; counsel should supply the final text.
3. A suspended vendor cannot sign in (Batch 2 rule), so a vendor under takedown who is also suspended cannot read the reason; is a support route needed?
4. The prohibited phrases and categories: counsel and the owner supply them; the table ships empty and the scan does nothing until then.
5. Which alert rules staff switch on first, and with which numbers (CAMPAIGN_SPIKE, PAYMENT_FAILURES, LARGE_IMPORT need numbers).
6. Whether the older `POST /v3/public/reports` (slice 5.14) should be retired now that `report-business` exists.
7. Personal-data erasure beyond the retention list is not built (carry-over C3): counsel decides what must be erased and when.
