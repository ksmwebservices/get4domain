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
