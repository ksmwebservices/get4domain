# V3 policy text store (Block 4b, slice 12; Amendment 12 Q6)

No legal text is written here and none is published. The store only holds what counsel supplies.

## What already existed (slice 5.15) and is reused

Admin-managed versions per document kind (`g4d_terms_documents`: DRAFT, PUBLISHED, RETIRED, a version number per kind), staff routes under `/v3/admin/terms` (list, read, edit a draft, publish with a written note), public reads of the latest published version, and acceptances (`g4d_terms_acceptances`) that store the **document id and version**, **who** (business, customer request or user) and **when**, with a hash of the address. A placeholder body cannot be published (`TERMS_PLACEHOLDER`, 422).

## What this slice changes

1. **Kinds.** The enum had 8 kinds. Eight are added (migration `20261214160000_v3_policy_kinds`, new enum values only): `TERMS_OF_SERVICE`, `REFUND_WALLET`, `DOMAIN_TERMS`, `ENQUIRY_CONSENT`, `IDENTITY_NOTICE`, `MESSAGING`, `TESTIMONIAL`, `DIRECTORY`. Mapping of the legal pack onto the 16:

| Legal pack document | Kind |
|---|---|
| Terms | `TERMS_OF_SERVICE` (`CUSTOMER_TERMS` stays the customer-facing terms of a site) |
| Privacy | `PRIVACY` |
| Acceptable Use | `ACCEPTABLE_USE` |
| Vendor Agreement | `VENDOR_TERMS` |
| Refund and Wallet | `REFUND_WALLET` (`REFUND_POLICY_TEMPLATE` stays the per-business template) |
| Domain Terms | `DOMAIN_TERMS` |
| Enquiry Consent | `ENQUIRY_CONSENT` |
| Identity Notice | `IDENTITY_NOTICE` |
| Grievance | `GRIEVANCE` |
| Messaging | `MESSAGING` |
| Testimonial | `TESTIMONIAL` |
| Directory | `DIRECTORY` |
| Cookie | `COOKIE` |

   `DATA_PROCESSING` is kept as it was. The existing idempotent loader (`scripts/seed-v3-terms.js`, dry run by default) creates a placeholder DRAFT for each missing kind and cannot publish.

2. **Square-bracket placeholders block publishing.** Counsel's drafts carry placeholders such as `[Company name]` until they are filled in (Amendment 12 Q6: "Placeholders in square brackets remain"). A body containing one now counts as a placeholder and cannot be published. A markdown link `[text](url)` and a bare number `[1]` do not count.

3. **Enquiry Consent is wired to held enquiries.** `TermsConsentGate` answers whether a version of `ENQUIRY_CONSENT` is published. Because publishing refuses placeholders, a published version is text a person approved. Held enquiries (slice 6) stay off until this is true and SUPER_ADMIN's switch is on.

## Not changed

Which acceptances each flow requires (vendor, claim, checkout) is unchanged: `VENDOR_REQUIRED_KINDS` and `CLAIM_REQUIRED_KINDS` still name the original documents. Requiring the new documents (for example Domain Terms before a domain purchase, Messaging before lane 3) is a decision for after counsel signs off.
