# Travel & Tours — Industry Reference: Module Scoping Checklist
# Get4Domain Engineering Standard v1.1

---

## Purpose

A scoping worksheet for EP01 — a set of questions to ask about a new travel
client, organized by the categories in `MODULES.md`. This is a prompt for
discussion, not a required or excluded module list. The client's own
`05_SCOPE.md` and `00_ENGINEERING_INDEX.md` §3 (module registry) are the
authoritative, approved output of this scoping exercise — this checklist
never overrides them, and does not itself get copied into a client repo
(`REPOSITORY_RULES.md` Rule 3).

## Sales & CRM

- [ ] Does the client need lead source tracking, or do all customers arrive
      pre-qualified (e.g. purely referral/repeat business)?
- [ ] Is there a dedicated sales team needing lead assignment/reassignment,
      or is this a small team where every lead is visible to everyone?

## Product Catalog

- [ ] Does the client sell pre-defined tour packages, fully custom
      itineraries, fixed-departure group tours, or some combination?
- [ ] Domestic only, international only, or both?

## Reservations

- [ ] Which individual service types does the client actually book:
      flights? hotels? buses? trains? cabs? other ground transport?
      Only include what's actually sold — don't default to "all of them"
      or "none of them."

## Fleet & Operations

- [ ] Does the client own or contract its own vehicles/drivers, or does it
      purely resell third-party transport/accommodation?
- [ ] Is there a supplier directory need (multiple hotels/operators/
      airlines/visa agents/insurance providers/forex dealers)?

## Travel Services (ancillary)

- [ ] Does the client facilitate passports? Visas? Sell travel insurance?
      Handle forex? Each is independently optional.

## Sales Operations

- [ ] Quotation-to-booking conversion — almost always needed if there's any
      sales process at all before a booking is confirmed.

## Finance

- [ ] Is GST-compliant invoicing required (almost always, for India)?
- [ ] Is a full accounting ledger in scope, or just payment recording?
- [ ] Is expense tracking/approval needed, or handled outside the system?
- [ ] Is payment gateway integration in scope for v1, or manual recording
      only? (Manual recording is a common v1 default — see
      `IMPLEMENTATION_NOTES.md`.)

## Analytics

- [ ] Which reports does the business actually use to make decisions today
      (even informally, e.g. in a spreadsheet)? Scope reporting around
      those, not a generic "dashboard."

## Portals

- [ ] Does the client want customers to self-serve (view bookings/
      documents/payments), or is everything staff-mediated?
- [ ] Is there a need for the client to administer their own staff roles,
      or will Get4Domain manage role changes as a service?

## Platform

- [ ] Custom role/permission administration by the client, or fixed roles
      set at launch?
- [ ] Notification channels needed: email? SMS? WhatsApp? in-app only?
- [ ] Central document storage with expiry tracking (compliance documents,
      ID proofs, tickets)?

## Dependencies

- `MODULES.md` for the category definitions this checklist walks through.
- Client's own `05_SCOPE.md` and `00_ENGINEERING_INDEX.md` §3 for the
  authoritative, approved scope and module registry produced from this
  exercise.
