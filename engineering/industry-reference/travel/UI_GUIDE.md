# Travel & Tours — Industry Reference: UI Guide
# Get4Domain Engineering Standard v1.1

---

## Purpose

Recurring UI/portal patterns for travel & tours engagements, for Bolt to
consult alongside a client's own `11_UI_SPECIFICATION.md` (authoritative)
during P002. Framework is fixed platform-wide: Tailwind CSS + shadcn/ui
(`C:\Get4Domain\CLAUDE.md` §5) — not revisited per industry.

## Common Portal Shape

- **Customer Portal** (if in scope for the engagement) — self-service: own
  bookings, quotations, invoices, payment status (view only, no payment
  gateway unless separately scoped), documents, and a way to request
  custom packages or track passport/visa requests if those services are
  offered.
- **Staff Portal** — one shell, role-filtered navigation and data; sales,
  operations, and accounts roles typically see different modules, not a
  stripped-down copy of each other's screens.
- **Admin Portal** — superset of the Staff Portal plus user/role
  administration, notification templates, and system settings.

## Pattern: Permission-Driven Navigation

Generate sidebar navigation from the authenticated user's permission set
(the client's own `/auth/me`-equivalent endpoint), not hardcoded per role
in the frontend — this keeps the UI in sync when an admin creates a custom
role at runtime without requiring a frontend deploy.

## Common Shared Components

- **DataTable** — sort/filter/paginate, used by nearly every list screen.
- **StatusBadge** — color-coded by enum value (lead status, booking status,
  invoice status, quotation status, expense status). Exact enum values and
  colors are defined per client, matching that client's own database enums
  — do not assume a fixed status set across engagements.
- **FormField** — wraps input/select/date-picker with validation, used by
  every create/edit form.
- **ConfirmDialog** — for destructive/irreversible actions (cancel booking,
  issue invoice, delete).
- **FileUploader** — document upload, showing an expiry-date field when the
  document type requires one (RC, insurance, license, etc.).
- **SeatMeter** — availability indicator for fixed-departure inventory,
  where fixed departures are in scope.
- **Timeline** — chronological activity/interaction history for a lead or
  customer.

## Dependencies

- `MODULES.md` for which categories typically need a portal surface.
- Client's own `11_UI_SPECIFICATION.md` and `06_USER_ROLES.md` for the
  authoritative screen list and role-to-screen mapping.
