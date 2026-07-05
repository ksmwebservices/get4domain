# Travel & Tours — Industry Reference: Overview
# Get4Domain Engineering Standard v1.1

---

## Purpose

Master knowledge base for travel & tours engagements (`REPOSITORY_RULES.md`
Rule 3). This is background reference consulted during EP01 for a new
travel client — it does **not** fix a client's final scope, module list, or
entity names. Each client's own `docs/00_ENGINEERING_INDEX.md` (generated
during EP01, approved by ChatGPT) is the authoritative scope for that
engagement, not this file.

This directory is never duplicated into a client repository
(`REPOSITORY_RULES.md` Rule 3) — client repos reference it by path, they do
not copy it.

## Typical Business Model

A travel & tours business sells and/or operates some combination of: tour
packages (domestic/international, fixed-departure or customized), individual
travel services (flights, hotels, buses, trains, cabs, other ground
transport), and adjacent services (passport/visa facilitation, travel
insurance, forex). Revenue flows from lead → quotation → booking → GST
invoice → payment, with vehicles/drivers/suppliers as operational
dependencies for any self-operated transport.

Engagement size and scope vary widely — a small operator may need only a
handful of the categories in `MODULES.md`, while a full-service agency may
need most of them. Do not assume a fixed "standard" scope for every travel
client; scope is decided per engagement (`MODULE_CHECKLIST.md`).

## Core Domain Concepts

- **Lead / Customer** — a prospective or converted buyer; leads carry a
  source and status funnel, customers carry a consolidated booking/payment
  history.
- **Tour Package** — a pre-defined itinerary/offering sold to customers,
  typically differentiated by type (domestic, international, customized,
  fixed-departure) rather than as separate entities.
- **Fixed Departure** — a scheduled group tour instance with finite seat
  inventory that must never be oversold.
- **Booking** — the master record of a customer's engagement; individual
  reservation types (flight, hotel, bus, train, cab, package, etc.) are
  best modeled as detail tables attached to one master booking record
  rather than as independent, disconnected booking entities — this keeps
  a single financial and status lifecycle per customer engagement.
- **Vehicle / Driver** — owned or vendor-sourced transport assets, relevant
  whenever the business operates its own cabs, tempo travellers, or buses;
  compliance documents (RC, insurance, permit, fitness, license) carry
  expiry dates that should gate assignment, not just display a warning.
- **Supplier** — external vendor directory (hotels, transport operators,
  airlines, visa agents, insurance providers, forex dealers) with payment
  terms.
- **Quotation** — an itemized, time-bound offer that converts directly into
  a Booking without re-entry of line items.
- **GST Invoice** — India-specific tax document; CGST+SGST vs. IGST is
  determined by comparing customer state to the agency's registered state,
  not a flat rate (see `IMPLEMENTATION_NOTES.md`).
- **Ledger** — every financial event (payment, invoice, expense) should
  produce exactly one ledger entry; a system with financial events that
  don't reach the ledger cannot produce a trustworthy accounts view.
- **Portals** — most travel platforms need at least a staff-facing surface
  and a customer self-service surface; a distinct admin surface is common
  once role/permission administration becomes a client-managed feature
  rather than a Get4Domain-only capability. Whether a customer-facing
  portal is in scope is a per-engagement decision, not a default
  inclusion or exclusion.

## Reference Implementation

`MR_TRAVELS_001` (M.R. Travels & Tours) is the first travel engagement built
on this standard — a full-service agency covering all categories in
`MODULES.md` (35 modules spanning CRM, product catalog, all reservation
types including flights and hotels, fleet operations, travel services,
sales operations, finance, analytics, and all three portal types). See that
client's own `docs/00_ENGINEERING_INDEX.md` and `docs/07_MODULE_SPECIFICATION.md`
for the concrete, approved detail.

Per `REPOSITORY_RULES.md` Rule 4, **MR_TRAVELS_001 is not a template** — its
scope, entity names, and module count are specific to that client's
engagement and must not be copied wholesale into a new client's Engineering
Package, and a future, smaller-scope travel client is equally valid. Use it
as one illustration of the pattern, not as a checklist or a floor/ceiling on
scope.

## Dependencies

- `MODULES.md` — module categories typically relevant to this industry.
- `DB_GUIDE.md`, `API_GUIDE.md`, `UI_GUIDE.md` — implementation patterns.
- `IMPLEMENTATION_NOTES.md` — regulatory and domain-specific notes.
- `MODULE_CHECKLIST.md` — a scoping aid for EP01, not a fixed module list.
