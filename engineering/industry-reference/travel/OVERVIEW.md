# Travel & Tours — Industry Reference
# Get4Domain Engineering Standard v1.0
# Location: get4domain repo — master knowledge base (not duplicated in client repos)

---

## Industry Summary

Travel & Tour operators in India (particularly Tamil Nadu) manage:
- Local sightseeing and pilgrimage tour packages
- Vehicle rental (car, van, tempo traveller, bus)
- Corporate employee transport contracts
- Driver management and trip assignment
- GST-compliant invoicing
- Booking lifecycle from inquiry to trip closure

---

## Typical Client Profile

| Attribute     | Detail                                              |
|---------------|-----------------------------------------------------|
| Business size | Small to medium (5–50 vehicles)                     |
| Location      | Tamil Nadu, South India                             |
| Language      | Tamil + English                                     |
| GST           | Registered, requires GST invoices                   |
| Users         | Owner, Manager, Booking Staff, Drivers              |
| Pain points   | Manual booking on paper/WhatsApp, no trip tracking, |
|               | no GST invoice generation, no driver accountability |

---

## Standard MVP Scope

### Included
- Tour Package Management
- Vehicle Management (fleet)
- Driver Management
- Booking Management (full lifecycle)
- Trip Sheet (per-trip documentation)
- Corporate Client Contracts (monthly billing)
- GST Invoice Generation
- Basic Accounts (income/expense)
- Reports (bookings, revenue, fleet)

### Excluded from Standard MVP
- Flight booking integration
- Hotel booking integration
- Overseas / international tours
- GPS / live vehicle tracking
- Driver payroll
- Multi-branch operations
- Online payment gateway
- Customer-facing booking portal

---

## Reference Implementation

**MR_TRAVELS_001** — M.R. Travels & Tours, Tamil Nadu

This is the first Get4Domain Travel industry build.
All patterns, decisions, and learnings from this project
are documented here for future travel clients.

After MR_TRAVELS_001 is complete:
- Reusable modules will be documented in MODULE_CHECKLIST.md
- Database patterns documented in DB_GUIDE.md
- API patterns documented in API_GUIDE.md
- UI patterns documented in UI_GUIDE.md

---

## User Roles (Standard)

| Role        | Access                                              |
|-------------|-----------------------------------------------------|
| SUPER_ADMIN | Full access, system configuration                   |
| ADMIN       | Full business access, no system config              |
| MANAGER     | Bookings, drivers, vehicles, reports                |
| STAFF       | Create bookings, view schedules                     |
| DRIVER      | View own trips, update trip status                  |
| CLIENT      | Corporate client portal (contracts, invoices)       |

---

## Future Clients Using This Reference

| Client ID    | Name | Status  |
|--------------|------|---------|
| MR_TRAVELS_001 | M.R. Travels & Tours | In Progress |
| TRAVEL_002   | TBD  | Reserved |
