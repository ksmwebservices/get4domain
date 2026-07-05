# Travel & Tours — Industry Reference: Implementation Notes
# Get4Domain Engineering Standard v1.1

---

## Purpose

Domain-specific and regulatory notes that don't fit neatly into the DB/API/
UI guides but recur across travel & tours engagements.

## Regulatory: GST (India)

- Tax invoices must show correct HSN/SAC codes and the correct tax
  breakup: CGST + SGST when the customer's state matches the agency's
  registered state, IGST otherwise (place-of-supply rule) — this is a
  computed decision per invoice, not a fixed configured rate. See
  `DB_GUIDE.md` for the split-logic reference.
- Applicable GST slab rates and HSN/SAC codes vary by service category and
  shift with regulation — confirm current rates with the client per
  engagement rather than hardcoding a rate here.
- Multi-branch/multi-GSTIN accounting is a materially larger scope than
  single-registration GST — treat it as a per-client scoping question, not
  an assumption.

## Regulatory: Compliance Documents

Vehicle documents (RC, insurance, permit, fitness) and driver documents
(license, ID proof) carry statutory expiry dates. The system's
responsibility is to track and gate on these expiry dates, not to renew
them — renewal remains a manual business process outside the application.

## Domain Note: Consolidation Over Proliferation

The most common design mistake in this industry vertical is proliferating
near-identical entities/modules for what is really one concept viewed
differently — e.g., separate "domestic package" and "international
package" tables instead of one `TourPackage` with a type field, or
separate booking tables per reservation type instead of one master booking
with typed detail tables. Consolidate first; split only when the fields or
business rules genuinely diverge.

## Domain Note: Financial Event Integrity

Any module that touches money (bookings, invoices, payments, expenses)
should be designed so that no financial event can occur without a
corresponding ledger entry — this is what makes the accounts/reports
category trustworthy. Treat "record a payment but forget the ledger" as a
correctness bug, not an edge case to defer.

## Domain Note: Scope Varies Materially by Client

Unlike some verticals, "travel & tours" spans very different business
shapes — a single-vehicle local operator, a full-service agency booking
flights/hotels/international tours, and a corporate-transport contractor
are all "travel" clients with very different module needs. Do not default
to either a minimal or a maximal scope; use `MODULE_CHECKLIST.md` to derive
scope from the specific client's actual business, and record the result in
that client's own `05_SCOPE.md`.

## Domain Note: Common Out-of-Scope Items (confirm per client, don't assume)

Items that recur as candidates for **out of scope** unless a client
specifically contracts for them: live GDS/airline/hotel inventory
integration, payment gateway auto-reconciliation, multi-branch/multi-GSTIN
accounting, native mobile apps, multi-language UI, automated bank
statement reconciliation, and AI-based lead scoring/chatbots. These are
candidates to raise during scoping, not a fixed exclusion list — a given
client may explicitly want any of them in scope.

## Dependencies

- `DB_GUIDE.md`, `API_GUIDE.md` for where these notes apply structurally.
- Client's own `02_BUSINESS_REQUIREMENTS.md` (business rules) and
  `05_SCOPE.md` for the authoritative, client-specific scope decision.
