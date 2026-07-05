# Travel & Tours — Industry Reference: Module Categories
# Get4Domain Engineering Standard v1.1

---

## Purpose

Describes the *categories* of modules commonly relevant to a travel & tours
engagement, as a menu to scope from during EP01 — not a fixed list and not
a set of platform-wide module codes. Module codes (`MOD-01`, `MOD-02`, …)
are assigned per client, in that client's own `00_ENGINEERING_INDEX.md`,
and are never global across clients — two travel clients can and will have
different module counts and different code assignments depending on what
they actually need. (`MR_TRAVELS_001`, the reference implementation, uses
all nine categories below across 35 modules — see its own
`00_ENGINEERING_INDEX.md` §3 for that specific, approved registry.)

## Category: Sales & CRM

Lead capture with source tracking, interaction/activity logging, customer
records with consolidated history. Almost always in scope — this is the
funnel every other category feeds.

## Category: Product Catalog

Tour packages (domestic, international, customized, fixed-departure).
Commonly modeled as one core package entity differentiated by a type field,
plus a dedicated entity for fixed-departure seat inventory and one for
bespoke/customized requests — not four near-identical package tables.

## Category: Reservations

Individual travel services: flights, hotels, buses, trains, cabs, other
ground transport (e.g. tempo travellers). Only include the service types
the client actually books/sells — a client with no in-house fleet may not
need cab/tempo traveller detail tables at all; a client that never handles
flights doesn't need flight detail, and a full-service agency may need all
of them. Model each as a detail table attached to one master Booking
entity, not as independent booking entities.

## Category: Fleet & Operations

Vehicle management, driver management, supplier directory. Only relevant if
the client operates or sub-contracts its own transport; a pure
package/ticketing agency may not need this category at all.

## Category: Travel Services (ancillary)

Passport facilitation, visa facilitation, travel insurance, forex. Include
only what the client actually offers — these are frequently "Should" not
"Must" priority.

## Category: Sales Operations

Quotation management (itemized, time-bound, converts to booking) and
booking management (the master record). These two are almost always in
scope together — a quotation with no booking to convert into is incomplete.

## Category: Finance

Payment recording, GST/tax invoicing, an accounts ledger, and expense
tracking. Ledger and invoicing are usually "Must" for any business needing
compliant financial records; payment gateway integration (auto-capture) is
commonly a separate, larger scope — check the client's own `05_SCOPE.md`
before assuming it's included.

## Category: Analytics

Cross-module reporting (pipeline, revenue, utilization, collections). This
category typically has no entity of its own — it is a read/aggregation
layer over the categories above, and is usually scoped last since it
depends on everything else being defined first.

## Category: Portals

Customer self-service, staff (role-scoped), and admin (full visibility).
These are UI surfaces, not data entities — the data-level permission for
whatever a portal displays comes from the underlying module's own
permission row, not from the portal itself. Whether a customer-facing
portal is included is a per-engagement scoping decision.

## Category: Platform

Roles & permissions administration, notifications, document management,
settings. Usually "Must" once a client needs to self-administer roles
without a Get4Domain change request, and once any document (ID proof,
ticket, voucher, compliance doc) needs central storage tied to an entity.

## Dependencies

- `OVERVIEW.md` for the domain concepts these categories operate on.
- `MODULE_CHECKLIST.md` for a scoping worksheet using these categories.
- Client's own `00_ENGINEERING_INDEX.md` for the actual, approved module
  registry once EP01 scoping is complete.
