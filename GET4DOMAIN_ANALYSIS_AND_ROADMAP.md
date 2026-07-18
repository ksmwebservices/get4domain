# GET4DOMAIN — Current State Analysis & Development Roadmap

**Prepared for:** ksmwebtech / Get4Domain  
**Date:** July 2026  
**Status:** Phase 0 — Foundation Assessment  

---

## 1. WHAT YOU HAVE TODAY

### Existing Infrastructure (MR Travels — DO NOT TOUCH)
- **Frontend:** `mrtravels.get4domain.com` — Next.js 16, fully live
- **Backend:** `api.get4domain.com` — NestJS 11 + Prisma 6.19.3 + PostgreSQL (Supabase)
- **Server:** Google Cloud VM `asia-south1-c` (34.14.130.68), Docker + Nginx + Cloudflare SSL
- **Repos:** `ksmwebservices/get4domain` and `ksmwebservices/mr-travels-001`

### Get4Domain Frontend (Uploaded Bolt Project)
The uploaded zip contains a **Next.js 15 + Tailwind marketing frontend** with:

| File | Status |
|---|---|
| Home page (`/`) | ✅ Built — Hero, TrustBar, Industries, Pricing CTA, Portfolio, Testimonials, FAQ |
| `/industries` | ✅ Built — 12 industry cards with Pexels images |
| `/pricing` | ✅ Built — Comparison table (static, ₹4,999 placeholder) |
| `/digital-growth` | ✅ Built — Add-on marketplace |
| `/how-it-works` | ✅ Built — Static steps |
| `/portfolio` | ✅ Built — Static cards |
| `/templates` | ✅ Built — Static grid |
| `/contact` | ✅ Built — Static form |
| `/support` | ✅ Built — Static FAQ |
| `/login` | ✅ Built — UI only, no API |
| `/register` | ✅ Built — UI only, no API |
| `/cart` | ✅ Built — UI only, no backend |
| `/checkout` | ✅ Built — UI only, no Razorpay |
| `/order-success` | ✅ Built — Static page |
| Legal pages | ✅ Built — Static content |

**Key observation:** Every page is a beautiful, well-structured static shell. **Zero backend integration exists.** All data is hardcoded in `src/data/content.ts`. Forms do nothing. Login does nothing. Cart holds nothing. Checkout fires nothing.

---

## 2. THE GAP (What Needs to Be Built)

### Gap 1 — No Backend for Get4Domain Itself
The `api.get4domain.com` backend is 100% MR Travels code. Get4Domain needs its own NestJS backend (separate Docker service or separate repo) with:
- Auth (JWT, refresh tokens)
- Organization / Tenant creation
- Plan & Pricing management
- Razorpay payment integration
- Auto-provisioning (subdomain, welcome email, WhatsApp)
- CMS content APIs (so pricing/industries/testimonials come from DB, not hardcoded)
- Vendor dashboard APIs
- Super Admin APIs

### Gap 2 — No Vendor Dashboard
After a customer buys a plan, there's no logged-in area. The spec requires:
- My DomainApp dashboard
- My DomainCampaign dashboard
- CMS editor (manage their website content)
- Users, Employees, CRM, HR, Finance, Marketing modules (DomainApp Enterprise)

### Gap 3 — No Multi-Tenancy
Each vendor needs their own subdomain (`vendorname.get4domain.com`) with their own CMS-powered website. This entire tenant website engine is absent.

### Gap 4 — No Super Admin Panel
The Super Admin (you) has no dashboard to manage customers, plans, orders, campaigns, leads, developers, support, analytics.

### Gap 5 — No DomainCampaign Backend
The managed digital marketing platform needs campaign management, content scheduling, report delivery — none of this exists.

---

## 3. ARCHITECTURE DECISION

### Critical Rule: Do NOT disturb MR Travels
MR Travels lives in `mr-travels-001` repo and runs on the same VM. The Get4Domain platform must be:
- A **separate repo**: `ksmwebservices/get4domain-platform`
- A **separate Docker Compose stack** on the same VM (different ports)
- A **separate Nginx config** pointing `get4domain.com` and `*.get4domain.com` to the new stack
- MR Travels continues unchanged at `mrtravels.get4domain.com`

### Proposed Folder Structure (New Repo)
```
get4domain-platform/
├── frontend/                    ← Your existing Bolt frontend (moved here)
│   ├── src/
│   │   ├── app/
│   │   │   ├── (marketing)/    ← Existing pages (keep as-is)
│   │   │   ├── (vendor)/       ← NEW: Vendor dashboard after login
│   │   │   │   ├── dashboard/
│   │   │   │   ├── cms/
│   │   │   │   ├── crm/
│   │   │   │   ├── hr/
│   │   │   │   ├── finance/
│   │   │   │   └── settings/
│   │   │   ├── (admin)/        ← NEW: Super admin panel
│   │   │   │   ├── dashboard/
│   │   │   │   ├── customers/
│   │   │   │   ├── plans/
│   │   │   │   ├── orders/
│   │   │   │   └── campaigns/
│   │   │   └── [tenant]/       ← NEW: Tenant public websites
│   │   └── components/         ← Existing components (keep as-is)
│   └── package.json
├── backend/                     ← NEW: NestJS backend
│   ├── src/
│   │   ├── auth/
│   │   ├── organizations/
│   │   ├── plans/
│   │   ├── payments/
│   │   ├── subscriptions/
│   │   ├── cms/
│   │   ├── tenants/
│   │   ├── campaigns/
│   │   ├── notifications/
│   │   └── admin/
│   └── prisma/
├── docker-compose.yml
└── nginx/
    └── get4domain.conf
```

---

## 4. PHASED DEVELOPMENT PLAN

### ✅ Phase 0 — THIS DOCUMENT (Done)
Read existing code, understand the gap, produce this plan.

---

### 🔴 Phase 1 — Foundation & Deployment (Week 1)
**Goal:** Get the existing Bolt frontend live at `get4domain.com`

1. Create new repo `get4domain-platform`
2. Move Bolt frontend into `frontend/` subfolder
3. Update `package.json` — pin Next.js to 15.x, add `axios`, `js-cookie`, `zustand`
4. Set up Docker Compose with:
   - `frontend` service (Next.js, port 3001)
   - `backend` service (NestJS, port 3002) — skeleton only
5. Add Nginx vhost for `get4domain.com` → port 3001
6. Add Nginx vhost for `api-g4d.get4domain.com` → port 3002 (separate from MR Travels `api.get4domain.com`)
7. Deploy and verify existing static pages go live

**Deliverable:** Static Bolt frontend live at `get4domain.com`

---

### 🔴 Phase 2 — Backend Core + Auth (Week 2)
**Goal:** Working registration, login, JWT auth

**NestJS modules:**
- `AuthModule` — register, login, refresh token, forgot password
- `UsersModule` — user profile, roles
- `OrganizationsModule` — tenant record, subdomain, plan

**Frontend wiring:**
- `/register` → calls `POST /auth/register`
- `/login` → calls `POST /auth/login`, stores JWT
- Protected routes via Next.js middleware

**Database (Supabase — new schema, separate from MR Travels):**
```sql
User, Organization, Plan, Subscription, Invoice
```

**Deliverable:** Real auth working end-to-end

---

### 🔴 Phase 3 — Plans, Cart & Razorpay (Week 3)
**Goal:** Customer can buy a plan and get auto-provisioned

**Backend:**
- `PlansModule` — DomainApp Startup/Enterprise, DomainCampaign Starter/Business
- `PaymentsModule` — Razorpay order creation, webhook handler
- `SubscriptionsModule` — activate on payment success
- `NotificationsModule` — welcome email + WhatsApp (via existing pattern from MR Travels)
- `TenantsModule` — create subdomain record on subscription

**Frontend wiring:**
- `/pricing` → loads plans from API (not hardcoded)
- `/cart` → real cart state (Zustand)
- `/checkout` → Razorpay checkout SDK
- `/order-success` → subscription confirmed page

**Deliverable:** End-to-end purchase flow works

---

### 🔴 Phase 4 — Vendor Dashboard (Week 4–5)
**Goal:** Logged-in vendor can manage their account

**New frontend routes under `(vendor)/`:**
- `/dashboard` — overview, stats, quick actions
- `/cms` — edit their website (company info, pages, gallery, blog)
- `/subscriptions` — active plans, renewal dates
- `/invoices` — download invoices (PDF)
- `/support` — raise tickets

**Backend:**
- `CmsModule` — vendor edits their own website content
- `InvoicesModule` — PDF generation (reuse PDF pattern from MR Travels)

**Deliverable:** Vendor can log in and manage their profile + CMS

---

### 🔴 Phase 5 — Tenant Websites (Week 6)
**Goal:** Each vendor gets their own `vendorname.get4domain.com` website

**Architecture:**
- Next.js dynamic route `app/[tenant]/page.tsx`
- Nginx wildcard `*.get4domain.com` → frontend port 3001
- Frontend reads `host` header, fetches tenant CMS data, renders public website

**Deliverable:** `mrtravels.get4domain.com` pattern replicated for all Get4Domain customers

---

### 🔴 Phase 6 — Super Admin Panel (Week 7)
**Goal:** You can manage all customers, plans, orders from admin dashboard

**New frontend routes under `(admin)/`:**
- `/admin/dashboard` — revenue, new signups, active subscriptions
- `/admin/customers` — list, view, suspend accounts
- `/admin/plans` — manage pricing (no more hardcoded ₹4,999)
- `/admin/orders` — all purchases, payment status
- `/admin/campaigns` — DomainCampaign assignments

**Deliverable:** Full visibility and control over the platform

---

### 🔴 Phase 7 — DomainApp Enterprise Modules (Week 8–10)
**Goal:** Enterprise subscribers get full Business OS

Priority modules (in order):
1. CRM (Lead + Customer)
2. Quotation & Invoice
3. HR (Employees, Attendance, Leave)
4. Finance (Income, Expense, P&L)
5. Marketing (Poster Designer, WhatsApp Bot)
6. Inventory

---

### 🔴 Phase 8 — DomainCampaign (Week 11–12)
**Goal:** Managed marketing dashboard for campaign clients

- Campaign assignments by admin
- Content calendar view
- Report uploads (PDF)
- Lead tracking from landing pages

---

## 5. IMMEDIATE NEXT STEPS (What to Do Right Now)

**Step 1:** Confirm the new backend port. Since `api.get4domain.com` is taken by MR Travels, pick either:
- `api.get4domain.com/g4d/...` (path prefix on same Nginx)
- `gapi.get4domain.com` (new subdomain)

**Step 2:** Create `get4domain-platform` repo on GitHub under `ksmwebservices`

**Step 3:** Tell me which phase to start implementing now — I recommend starting with **Phase 1** (deploy the frontend) so the site goes live quickly, then **Phase 2** (auth) right after.

---

## 6. WHAT NOT TO CHANGE

| Item | Reason |
|---|---|
| MR Travels frontend code | Production client, fully live |
| `api.get4domain.com` (NestJS) | MR Travels backend, must not be touched |
| Supabase MR Travels schema | Live production data |
| Existing Bolt frontend UI/design | You said keep it, it's good |
| Prisma 6.19.3 pin | Breaking changes in v7 |
| Docker CMD `node dist/src/main` | Hard-won learning |
| Supabase pooler hostname | IPv6-only direct hostname issue |

---

## 7. TECH STACK CONFIRMATION

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (existing) + new dashboard pages |
| Backend | NestJS 11 (new instance, separate from MR Travels) |
| ORM | Prisma 6.19.3 (pinned) |
| Database | PostgreSQL via Supabase (new schema/tables) |
| Auth | JWT + refresh tokens |
| Payments | Razorpay |
| State | Zustand (frontend) |
| Email | SMTP / Nodemailer |
| WhatsApp | WhatsApp Business API |
| PDF | (same pattern as MR Travels invoices) |
| Deployment | Docker + Nginx + Cloudflare SSL on existing VM |

---

## 8. PRICING TO IMPLEMENT IN DB

| Product | Plan | Half Year | Yearly |
|---|---|---|---|
| DomainApp | Startup | ₹3,999 | ₹6,999 |
| DomainApp | Enterprise | ₹13,999 | ₹24,999 |
| DomainCampaign | Starter | ₹3,999 | ₹6,999 |
| DomainCampaign | Business | ₹16,999 | ₹29,999 |

Note: The current frontend shows ₹4,999 flat. This needs to be updated to the spec pricing once the backend plans API is live.

---

**Ready to begin. Confirm which phase to start and confirm the API subdomain choice, then I will generate all code.**
