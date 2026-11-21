# V3 support tickets (Block 4b, slice 4; Amendment 08 B5)

## Role naming decision

The staff roles that exist are `SUPER_ADMIN`, `MARKETING` and `OPERATIONS`. The amendment says "SUPER_ADMIN and SUPPORT". **Chosen: `OPERATIONS` plays the SUPPORT part.** Reasons: the legacy admin matrix already says "support tickets are OPERATIONS + SUPER_ADMIN", adding a `SUPPORT` value would change the `AdminRole` enum and the staff invite flow, and nothing in this block needs a role that is not OPERATIONS. MARKETING is refused on every ticket route. If the owner wants a separate SUPPORT role later it is one enum value plus the matrix lines.

## Tables (migration `20261214120000_v3_support_tickets`)

- `g4d_v3_tickets`: business (nullable for a visitor ticket that names no business), requester type `VENDOR` or `CUSTOMER`, subject, category, status `OPEN | IN_PROGRESS | WAITING_VENDOR | RESOLVED`, assignee, times. CHECK constraints: a vendor ticket names its business, a customer ticket names an email address, status and category are from their lists.
- `g4d_v3_ticket_messages`: author `VENDOR | STAFF | CUSTOMER`, body, optional attachment (a picture id). **Append-only**: a trigger refuses update, and refuses delete unless the ticket is already gone (cascade from a removed business). The legacy support-ticket table is not used.

## Routes

| Who | Route | Notes |
|---|---|---|
| Business (owner) | `POST /v3/me/tickets`, `GET /v3/me/tickets`, `GET /v3/me/tickets/:id`, `POST /v3/me/tickets/:id/messages` | every plan, no feature gate; creation rate limited per business per hour (setting) and throttled |
| Visitor | `POST /v3/public/support-tickets` | public form; **off until `ticketPublicPerHour` is set**; limited per address; no account |
| Staff (OPERATIONS, SUPER_ADMIN) | `GET /v3/admin/tickets`, `GET /v3/admin/tickets/:id`, `PUT /v3/admin/tickets/:id/assignee`, `PUT /v3/admin/tickets/:id/status`, `POST /v3/admin/tickets/:id/messages` | status change can carry `expectedStatus` (compare-and-set, `TICKET_STATE_CHANGED`) |

Settings (all start unset): `ticketCreatePerHour`, `ticketPublicPerHour`.

## Behaviour

- A business replying wakes a ticket that was `WAITING_VENDOR` or `RESOLVED` (back to `OPEN`). Staff replying on an `OPEN` or `IN_PROGRESS` ticket moves it to `WAITING_VENDOR`; a `RESOLVED` ticket stays resolved.
- Staff reply notice: a business gets a lane 1 `ACCOUNT_NOTICE` that points to the signed-in area and does NOT carry the reply text. A visitor has no account, so the reply text itself goes to their address. Both are behind `EMAIL_LIVE_SEND` (default OFF) and a failure never fails the reply.
- Attachments: only a picture of the same business already in the media library (so its upload limits and re-encoding applied).
- Activity log: every signed-in action is logged by the activity interceptor (routes under `/v3/me` and `/v3/admin`); the public form writes through the activity bus.
- No AI in this slice.

## Decision to confirm: "customer tickets"

Amendment 08 B5 defines business tickets only. "Customer ticket" is built as the visitor form above (a visitor of a business's site writes to Get4Domain support), because that is the only kind of customer who can reach support without an account. A visitor cannot read the thread afterwards: they get staff replies by email and send a new request to continue. A signed-link thread view would be a separate decision.

## Not run

Nothing was run against a real database: the migration, the triggers, the cascade delete and the cross-tenant checks are in `test/block4b-stores.int.spec.ts` for the owner's staging run. One of those tests (`CLEANUP DEPENDS ON THIS`) checks that deleting a business removes its tickets and their append-only messages; if it fails, `test:cleanup-staging` would leave tickets behind.
