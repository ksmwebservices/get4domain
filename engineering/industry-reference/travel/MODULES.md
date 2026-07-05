# Travel & Tours — Module Reference
# Get4Domain Engineering Standard v1.0

---

## Module List (Standard MVP)

| # | Module       | Backend Path             | P003 Priority |
|---|--------------|--------------------------|---------------|
| 1 | auth         | modules/auth             | P3-1 (first)  |
| 2 | users        | modules/users            | P3-1          |
| 3 | roles        | modules/roles            | P3-1          |
| 4 | permissions  | modules/permissions      | P3-1          |
| 5 | packages     | modules/packages         | P3-2          |
| 6 | vehicles     | modules/vehicles         | P3-2          |
| 7 | drivers      | modules/drivers          | P3-2          |
| 8 | bookings     | modules/bookings         | P3-3          |
| 9 | tripsheets   | modules/tripsheets       | P3-3          |
| 10| corporate    | modules/corporate        | P3-4          |
| 11| invoices     | modules/invoices         | P3-4          |
| 12| accounts     | modules/accounts         | P3-5          |
| 13| reports      | modules/reports          | P3-5          |

---

## Module Details

### 1. auth
- POST /api/v1/auth/login
- POST /api/v1/auth/refresh
- POST /api/v1/auth/logout
- GET  /api/v1/auth/me
- JWT access token (15m) + refresh token (7d)

### 2. users
- CRUD /api/v1/users
- GET  /api/v1/users/me
- PATCH /api/v1/users/:id/status (activate/deactivate)
- Soft delete

### 3–4. roles / permissions
- CRUD /api/v1/roles
- CRUD /api/v1/permissions
- POST /api/v1/roles/:id/permissions

### 5. packages (Tour Packages)
- CRUD /api/v1/packages
- GET  /api/v1/packages?type=local|pilgrimage|corporate
- Fields: name, description, type, duration, inclusions, price, isActive

### 6. vehicles
- CRUD /api/v1/vehicles
- GET  /api/v1/vehicles?status=available|on-trip|maintenance
- PATCH /api/v1/vehicles/:id/status
- Fields: registrationNo, type, make, model, capacity, ac, status, insuranceExpiry, permitExpiry

### 7. drivers
- CRUD /api/v1/drivers
- GET  /api/v1/drivers?status=available|on-trip|leave
- PATCH /api/v1/drivers/:id/status
- GET  /api/v1/drivers/:id/trips
- Fields: name, licenseNo, licenseExpiry, phone, address, joiningDate, status

### 8. bookings
- CRUD /api/v1/bookings
- POST /api/v1/bookings/:id/confirm
- POST /api/v1/bookings/:id/assign (vehicle + driver)
- POST /api/v1/bookings/:id/cancel
- GET  /api/v1/bookings?status=pending|confirmed|in-progress|completed|cancelled
- Fields: bookingNo, customerName, phone, packageId, vehicleId, driverId,
          startDate, endDate, pickup, drop, passengers, amount, status, notes

### 9. tripsheets
- CRUD /api/v1/tripsheets
- POST /api/v1/tripsheets/:id/start
- POST /api/v1/tripsheets/:id/close
- Fields: bookingId, driverId, vehicleId, startOdometer, endOdometer,
          startTime, endTime, fuelExpense, tollExpense, otherExpense, notes, status

### 10. corporate
- CRUD /api/v1/corporate-clients
- CRUD /api/v1/corporate-clients/:id/contracts
- GET  /api/v1/corporate-clients/:id/bookings
- Fields (client): companyName, gstin, address, contactName, phone, email
- Fields (contract): startDate, endDate, vehicleType, monthlyRate, tripLimit

### 11. invoices
- CRUD /api/v1/invoices
- POST /api/v1/invoices/generate (from booking or contract)
- GET  /api/v1/invoices/:id/pdf
- PATCH /api/v1/invoices/:id/paid
- Fields: invoiceNo, type, bookingId|contractId, customerName, gstin,
          subtotal, cgst, sgst, igst, total, status, dueDate, paidAt

### 12. accounts
- CRUD /api/v1/accounts
- GET  /api/v1/accounts/summary?from=DATE&to=DATE
- Fields: date, type (income|expense), category, amount, reference, notes

### 13. reports
- GET /api/v1/reports/bookings?from=DATE&to=DATE
- GET /api/v1/reports/revenue?from=DATE&to=DATE&groupBy=day|week|month
- GET /api/v1/reports/vehicles?vehicleId=ID
- GET /api/v1/reports/drivers?driverId=ID
- GET /api/v1/reports/corporate?clientId=ID

---

## Module Dependencies

```
auth ──────────────────────── (no dependencies)
users ─────────────────────── auth
roles / permissions ────────── users
packages ──────────────────── (no business deps)
vehicles ──────────────────── (no business deps)
drivers ───────────────────── (no business deps)
bookings ──────────────────── packages + vehicles + drivers + users
tripsheets ────────────────── bookings + vehicles + drivers
corporate ─────────────────── (no business deps)
invoices ──────────────────── bookings | corporate
accounts ──────────────────── invoices
reports ───────────────────── all modules (read-only aggregation)
```

---

## Build Order for P003

```
Step 1:  Prisma schema (all models at once)
Step 2:  prisma migrate dev
Step 3:  auth + users + roles + permissions
Step 4:  packages + vehicles + drivers
Step 5:  bookings
Step 6:  tripsheets
Step 7:  corporate
Step 8:  invoices
Step 9:  accounts
Step 10: reports
Step 11: seed data
Step 12: build + lint verification
```
