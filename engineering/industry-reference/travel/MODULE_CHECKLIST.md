# Travel & Tours — Module Checklist
# Get4Domain Engineering Standard v1.0
# Use: Copy this checklist for every new travel industry client

---

## How to Use

1. Copy this file into the new client's P001 task tracker
2. Check off items as each phase is completed
3. Add client-specific notes in the Notes column
4. Update IMPLEMENTATION_NOTES.md with any deviations

---

## P001 — Project Initialization

- [ ] Next.js + TypeScript + Tailwind + shadcn/ui initialized
- [ ] NestJS strict TypeScript initialized
- [ ] Prisma configured (empty schema)
- [ ] Docker Compose (postgres, backend, frontend, pgadmin)
- [ ] Multi-stage Dockerfiles (backend + frontend)
- [ ] Nginx reverse proxy config
- [ ] Global exception filter wired
- [ ] Global response interceptor wired
- [ ] Global validation pipe wired
- [ ] Common decorators (CurrentUser, Roles, Public)
- [ ] Module shells: auth, users, roles, permissions
- [ ] Backend build: 0 errors
- [ ] Frontend build: 0 errors

---

## P003 — Backend Modules

### Foundation (always first)
- [ ] Prisma schema — all models per DB_GUIDE.md
- [ ] `npx prisma migrate dev`
- [ ] `npx prisma generate`

### Auth + Users (always before business modules)
- [ ] auth module — login, refresh, logout, me
- [ ] JWT access token (15m) + refresh token (7d)
- [ ] users module — CRUD + soft delete
- [ ] roles module
- [ ] permissions module
- [ ] JWT guard wired globally (APP_GUARD)

### Core Travel Modules
- [ ] packages module (tour package catalog)
- [ ] vehicles module (fleet + status)
- [ ] drivers module (profiles + status)

### Booking Flow
- [ ] bookings module (full lifecycle: pending → confirmed → in-progress → completed)
- [ ] booking assignment (vehicle + driver)
- [ ] booking number auto-generation (BK-YYYYMMDD-XXXX)
- [ ] tripsheets module (open → closed)
- [ ] trip odometer + expense tracking

### Revenue Modules
- [ ] corporate-clients module
- [ ] corporate contracts
- [ ] invoices module
- [ ] GST calculation (CGST/SGST intrastate, IGST interstate)
- [ ] invoice number auto-generation (INV-YYYYMMDD-XXXX)
- [ ] PDF generation for invoices
- [ ] accounts module (income/expense)

### Reports
- [ ] bookings report (date range, status filter)
- [ ] revenue report (daily/weekly/monthly grouping)
- [ ] vehicles report (utilization)
- [ ] drivers report (trips, earnings)
- [ ] corporate report (per client)

### Seed Data
- [ ] Default roles seeded
- [ ] Super admin user seeded
- [ ] Sample tour packages (3–5)
- [ ] Sample vehicles (3–5)
- [ ] Sample drivers (3–5)

### Verification
- [ ] Backend build: 0 errors
- [ ] Backend lint: 0 errors
- [ ] All endpoints visible in Swagger
- [ ] Auth endpoints tested (login, refresh, logout)
- [ ] CRUD tested for each module

---

## P002 — Frontend (Bolt)

- [ ] Login page
- [ ] Dashboard with summary cards
- [ ] Bookings list + create form + detail
- [ ] Packages list + manage
- [ ] Vehicles list + status management
- [ ] Drivers list + status management
- [ ] Trip sheets list + detail
- [ ] Corporate clients + contracts
- [ ] Invoices list + PDF download button
- [ ] Accounts list + summary
- [ ] Reports page
- [ ] Responsive layout (mobile + desktop)
- [ ] Status badges for all modules
- [ ] Frontend build: 0 errors

---

## P004 — Integration

- [ ] Auth flow wired (login, refresh, logout, protected routes)
- [ ] Booking CRUD connected
- [ ] Vehicle management connected
- [ ] Driver management connected
- [ ] Trip sheet connected
- [ ] Corporate module connected
- [ ] Invoice generation connected
- [ ] PDF download working
- [ ] Accounts connected
- [ ] Reports data loading
- [ ] Loading states on all pages
- [ ] Error handling on all forms
- [ ] Success toasts on all mutations

---

## P005 — Testing

- [ ] Backend build: 0 errors
- [ ] Backend lint: 0 errors
- [ ] Frontend build: 0 errors
- [ ] Frontend lint: 0 errors
- [ ] Auth unit tests
- [ ] GST calculation unit tests
- [ ] Booking service unit tests
- [ ] Invoice generation unit tests
- [ ] Docker build: both images
- [ ] Health check endpoint: 200 OK
- [ ] Security checklist complete

---

## P006 — Deployment

- [ ] Production .env configured
- [ ] Database migration on production
- [ ] Docker production build successful
- [ ] Nginx + SSL configured
- [ ] Dev URL working: {client}-dev.get4domain.com
- [ ] Production URL working
- [ ] Daily backup cron configured
- [ ] Admin credentials handed to client
- [ ] Client training completed
- [ ] Project marked complete in PROJECT_REGISTRY.json
