# Travel & Tours — UI Guide
# Get4Domain Engineering Standard v1.0
# Status: TEMPLATE — Fill after MR_TRAVELS_001 P002 is complete

---

## Stack

```
Framework:    Next.js (App Router)
Language:     TypeScript
Styling:      Tailwind CSS
Components:   shadcn/ui
Icons:        Lucide React
Forms:        React Hook Form + Zod
State:        Zustand
Server state: TanStack React Query
HTTP:         Axios
```

---

## Page Map

### Public (no auth)
```
/              → Landing or redirect to /login
/login         → Login form
/forgot-password → Password reset
```

### Protected (auth required)
```
/dashboard              → Summary cards: bookings today, vehicles, drivers
/bookings               → Booking list + create
/bookings/:id           → Booking detail + actions
/packages               → Tour packages list + manage
/vehicles               → Fleet list + status
/vehicles/:id           → Vehicle detail + trip history
/drivers                → Driver list + status
/drivers/:id            → Driver detail + trip history
/tripsheets             → Trip sheet list
/tripsheets/:id         → Trip sheet detail
/corporate              → Corporate clients list
/corporate/:id          → Client detail + contracts
/invoices               → Invoice list + generate
/invoices/:id           → Invoice detail + PDF download
/accounts               → Income/expense list
/reports                → Reports dashboard
/settings               → System settings
/profile                → User profile
```

---

## Dashboard Cards (summary view)

```
Today's Bookings    (count + status breakdown)
Active Vehicles     (count + available vs on-trip)
Available Drivers   (count)
Revenue This Month  (INR amount)
Pending Invoices    (count + total amount)
Upcoming Trips      (next 7 days list)
```

---

## Standard Page Layout

```
Sidebar (desktop) / Drawer (mobile)
  └── Navigation links (icons + labels)
      └── Active state highlight

Top Header
  ├── Page title + breadcrumb
  ├── Action button (e.g. "New Booking")
  └── User avatar + dropdown (profile, logout)

Content Area
  ├── Filter bar (search + dropdowns + date range)
  ├── Data table (sortable columns + pagination)
  └── Empty state (when no data)
```

---

## Status Badge Colors

| Status        | Color  | Module       |
|---------------|--------|--------------|
| PENDING       | Yellow | Booking      |
| CONFIRMED     | Blue   | Booking      |
| IN_PROGRESS   | Purple | Booking      |
| COMPLETED     | Green  | Booking      |
| CANCELLED     | Red    | Booking      |
| AVAILABLE     | Green  | Vehicle, Driver |
| ON_TRIP       | Blue   | Vehicle, Driver |
| MAINTENANCE   | Orange | Vehicle      |
| LEAVE         | Yellow | Driver       |
| INACTIVE      | Gray   | All          |
| PAID          | Green  | Invoice      |
| UNPAID        | Red    | Invoice      |

---

## Notes (fill after MR_TRAVELS_001 P002)

- [ ] Document component patterns worth reusing
- [ ] Document form validation UX decisions
- [ ] Add screenshots of key screens
- [ ] Note mobile-specific layout decisions
- [ ] Document Tamil language support approach (if implemented)
