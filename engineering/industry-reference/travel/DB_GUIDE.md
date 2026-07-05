# Travel & Tours — Industry Reference: Database Guide
# Get4Domain Engineering Standard v1.1

---

## Purpose

Recurring data-modeling patterns for travel & tours engagements, on top of
the platform-wide conventions in `C:\Get4Domain\CLAUDE.md` §9 (UUID PKs,
`createdAt`/`updatedAt`/`deletedAt` soft delete, Prisma transactions for
multi-table writes). These are patterns to apply where relevant, not a
schema to copy verbatim — a client's `09_DATABASE_DESIGN.md` is the
authoritative schema for that engagement (see `MR_TRAVELS_001/docs/09_DATABASE_DESIGN.md`
for a worked example applying every pattern below across 35 modules).

## Pattern: One Master Booking, Many Detail Tables

Model a customer's reservation as one `Booking` record carrying shared
fields (customer, status lifecycle, totals, dates), with a `bookingType`
discriminator and a 1:1 detail table per reservation type (e.g.
`FlightBookingDetail`, `HotelBookingDetail`) attached by `bookingId`. This
keeps one financial/status lifecycle per engagement instead of scattering
it across N independent booking tables.

## Pattern: Package Type as a Field, Not Separate Tables

Domestic, international, customized, and fixed-departure packages are
usually one `TourPackage` entity with a `packageType` enum, rather than
four near-identical tables — "domestic" and "international" views are query
filters on the same entity, not separate modules' worth of schema.

## Pattern: Seat Inventory Must Be Atomic

A `FixedDeparture`-style entity needs `totalSeats`/`availableSeats` with the
decrement-on-confirm / restore-on-cancel logic enforced inside a database
transaction alongside the booking status change — never as a
read-then-write from application code without a transaction, or concurrent
bookings can oversell the departure.

## Pattern: Money Fields

Always `Decimal` (mapped to PostgreSQL `numeric`), never `Float` — floating
point rounding artifacts are unacceptable in invoicing and ledger contexts.

## Pattern: Append-Only Ledger

Every payment, invoice, and expense should produce a `LedgerEntry` row via
the same transaction that creates/updates the source record — never a
separate, best-effort background job. The ledger should be treated as
append-only (reversals are new entries, not edits/deletes of prior ones).

## Pattern: Compliance-Gated Assignment

Where the client operates vehicles/drivers, expiry-dated fields
(`insuranceExpiry`, `licenseExpiry`, etc.) should be checked at the moment
of assignment (booking a vehicle/driver to a trip), not only surfaced as a
dashboard warning — an expired document should block the assignment at the
service layer.

## Pattern: Polymorphic Document Storage

A single `Document` entity with `ownerType`/`ownerId` (rather than a
separate document table per owning entity) works well for ID proofs,
tickets, vouchers, and compliance documents across customers, bookings,
drivers, vehicles, and suppliers — paired with an `expiryDate` for
compliance documents specifically.

## GST Calculation Reference (India)

```
Intrastate (customer state == agency's registered state):
    CGST + SGST, split evenly (e.g. 2.5% + 2.5% for a 5% slab,
    9% + 9% for an 18% slab) — the split is always half the total rate.
Interstate (customer state != agency's registered state):
    IGST at the full slab rate.
```

The applicable GST rate/slab itself is a commercial detail confirmed with
the client (varies by service category and current regulation) — the
CGST+SGST vs. IGST *split logic* above is the stable, structural part.
Store `placeOfSupply`/customer `state` and the agency's registered state as
fields the invoice service reads at generation time; never hardcode the
place-of-supply outcome.

## Dependencies

- `C:\Get4Domain\CLAUDE.md` §9 for the non-negotiable platform-wide
  conventions these patterns build on.
- `API_GUIDE.md` for how these entities are typically exposed.
- Client's own `09_DATABASE_DESIGN.md` for the authoritative schema.
