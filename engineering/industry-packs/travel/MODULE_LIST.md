# Travel Industry Pack — Module List

## MVP Modules (build in P003)

| Module              | Key Entities                              | Notes |
|---------------------|--------------------------------------------|-------|
| Tour Packages        | `TourPackage`                              | Itinerary, pricing, inclusions |
| Vehicle Management    | `Vehicle`, `VehicleType`                   | Ownership, capacity, availability |
| Driver Management     | `Driver`, `DriverDocument`                 | License/ID with expiry tracking |
| Booking Management     | `Booking`, `BookingPassenger`              | Date range, passenger manifest |
| Trip Sheet            | `TripSheet`                                | Odometer, route, fuel, allowance |
| Corporate Contracts    | `CorporateClient`, `CorporateContract`     | Rate cards, credit terms |
| GST Invoice           | `Invoice`, `InvoiceItem`                   | CGST/SGST/IGST breakup |
| Accounts              | `Account`, `AccountEntry`                  | Ledger, reconciliation |
| Reports               | (read models over the above)               | Booking/revenue/driver reports |

Plus the standard foundation modules from every P001 build: `User`, `Role`,
`Permission`.

## Explicitly Excluded from MVP

- Flight Booking
- Hotel Booking
- Overseas Tours
- GPS Tracking
- Payroll
- Multi-Branch

These may become future industry-pack extensions but must not be built
without an explicit scope change approved by ChatGPT (Business Analyst) and
the client.

## Suggested Roles

`SUPER_ADMIN`, `ADMIN`, `MANAGER`, `STAFF`, `DRIVER`, `CLIENT` (corporate
portal access, if in scope).
