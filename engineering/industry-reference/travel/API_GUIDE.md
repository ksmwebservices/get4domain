# Travel & Tours — Industry Reference: API Guide
# Get4Domain Engineering Standard v1.1

---

## Purpose

Recurring REST API patterns for travel & tours engagements, on top of the
platform-wide conventions (base path `/api/v1`, standard response envelope,
pagination shape — `C:\Get4Domain\CLAUDE.md` §9, restated per-client in that
client's own `10_API_SPECIFICATION.md` §2). Patterns here are illustrative;
a client's own `10_API_SPECIFICATION.md` is the authoritative contract
(see `MR_TRAVELS_001/docs/10_API_SPECIFICATION.md` for a worked example).

## Pattern: Reservation Detail as Sub-Resources of Booking

Expose reservation types as nested resources under the master booking,
e.g. `POST /bookings/:bookingId/flight`, `POST /bookings/:bookingId/hotel`,
rather than top-level `/flight-bookings`, `/hotel-bookings` resources —
this mirrors the one-master-record data pattern (`DB_GUIDE.md`) and keeps
authorization checks (can this caller act on this booking?) in one place.

## Pattern: System-Invoked Endpoints Are Not Client-Facing

Some state changes should only ever be triggered by another service, never
called directly by the frontend — e.g. seat-count adjustment on a fixed
departure, or notification creation on a business event. Document these
explicitly as "system-invoked" in the API spec so P004 integration doesn't
accidentally wire a UI button directly to them.

## Pattern: Ownership Filtering Is a Service-Layer Concern

"Own" scoping (a sales executive sees only their assigned leads/bookings; a
customer sees only their own records) is implemented as a `where` filter
added by the service layer from the authenticated principal — never as a
query parameter the client supplies and the server trusts.

## Pattern: Role-Gated State Transitions

Status transitions with financial or compliance consequences (issuing or
cancelling a GST invoice, confirming a booking, voiding a payment) should
be dedicated action endpoints (`POST /invoices/:id/issue`) with their own
role restriction, distinct from the general `PATCH` used for field edits —
this keeps the audit trail and the permission model precise.

## Pattern: Reports as a Read-Only Aggregation Layer

Cross-module reporting endpoints (`/reports/...`) typically have no owned
entity — they aggregate over the transactional entities. Scope them last,
after the entities they read from are finalized.

## Dependencies

- `DB_GUIDE.md` for the entity patterns these endpoints expose.
- Client's own `10_API_SPECIFICATION.md` for the authoritative contract.
- Client's own `12_SECURITY_SPECIFICATION.md` for auth/authz detail.
