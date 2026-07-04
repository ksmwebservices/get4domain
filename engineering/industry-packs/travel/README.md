# Industry Pack — Travel & Tour

Reference pack for travel/tour operator clients (e.g. `MR_TRAVELS_001`).

## Typical Business Model

A travel & tour operator arranges vehicles, drivers, and packaged tours for
individual and corporate customers, invoices in line with GST, and tracks
trip-level operational detail (trip sheets) for accounting and driver
settlement.

## Core Domain Concepts

- **Tour Package** — a pre-defined itinerary/offering sold to customers.
- **Vehicle** — owned or contracted vehicle available for bookings, typed by
  `VehicleType` (sedan, SUV, tempo traveller, bus, etc.).
- **Driver** — assigned to bookings/trips; holds documents (license, ID
  proof) with expiry tracking.
- **Booking** — a customer's reservation of a vehicle/package for a date
  range, with one or more passengers.
- **Trip Sheet** — the operational record of an actual trip (odometer
  readings, route, fuel, driver allowance) used for costing and driver
  settlement.
- **Corporate Client / Contract** — a company with a standing agreement
  covering rates, credit terms, and invoicing cadence.
- **Invoice** — GST-compliant billing document generated from bookings.
- **Account / Account Entry** — ledger entries for payments, expenses, and
  reconciliation.

## MVP Scope (see `MODULE_LIST.md`)

Included: Tour Packages, Vehicle Management, Driver Management, Booking
Management, Trip Sheet, Corporate Contracts, GST Invoice, Accounts, Reports.

Excluded from MVP: Flight Booking, Hotel Booking, Overseas Tours, GPS
Tracking, Payroll, Multi-Branch.

## Regulatory Notes (India / Tamil Nadu)

- GST invoicing must show correct HSN/SAC codes and tax breakup
  (CGST/SGST or IGST depending on place of supply).
- Driver documents (license, permit) have statutory expiry — the system
  should support tracking expiry dates, not enforcing renewal itself.
