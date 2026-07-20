# GET4DOMAIN — CLAUDE MEMORY & SKILLS FILE
# This file gives Claude complete context about this project
# Use this at the start of every Claude Code session

---

## PROJECT IDENTITY

Name: Get4Domain
Company: KSM Quantum Technologies
Owner: ksmwebtech (Ksmwebtechservices@gmail.com)
Domain: get4domain.com
Admin: admin@get4domain.com / ChangeMe123!
Phone: +917550047567
Address: Chennai, Tamil Nadu, India

---

## TWO PRODUCTS

### PRODUCT 1: DomainCampaign
Pure digital promotion and lead generation.
We act as their marketing team.
Wallet-based, no fixed subscription.
Minimum wallet: ₹999, valid 90 days.

Vendor Dashboard: get4domain.com/dashboard
Features: CRM, TeleCRM, Campaign creation, Analytics, Wallet

### PRODUCT 2: DomainApp
Website + Business Operating System.
We build everything, they use it.
Monthly subscription with setup fee.

Vendor Dashboard: vendorname.get4domain.com/admin
Features: BOS (industry-specific), Accounts, HR, Design Studio, Communication

---

## TECH STACK

```
Frontend:   Next.js 15, TailwindCSS, TypeScript
Backend:    NestJS 11, TypeScript, Prisma 6.19.3 (PINNED)
Database:   PostgreSQL via Supabase (get4domain project)
Auth:       JWT (7 day tokens, stored in localStorage as g4d_token)
Container:  Docker + Docker Compose
Proxy:      Nginx + Cloudflare (Flexible SSL)
AI:         Claude API (claude-sonnet-4-6), DALL-E 3
Payment:    Razorpay
Email:      Resend (noreply@get4domain.com)
SMS:        MSG91 (DLT compliant)
Push:       Firebase FCM
```

---

## LIVE INFRASTRUCTURE

```
VM:         Google Cloud asia-south1-c, IP 34.14.130.68
SSH:        ksmwebtechservices@34.14.130.68
GitHub:     github.com/ksmwebservices/get4domain
Branch:     get4domain-site
Frontend:   port 3006 → get4domain.com
Backend:    port 3008 → gapi.get4domain.com
MR Travels: port 3000 (frontend), 3001 (backend) ← NEVER TOUCH
```

---

## HARD RULES — CRITICAL

```
1. NEVER touch ports 3000 or 3001 (MR Travels is there)
2. Prisma MUST stay at 6.19.3 — breaking changes in v7
3. Always use Supabase POOLER URL (port 6543, not 5432 direct)
4. Backend Docker CMD: node dist/src/main (not dist/main)
5. Never push .env.local to GitHub
6. Never put secret keys in NEXT_PUBLIC_* vars
7. All database tables MUST have g4d_ prefix
8. /go/[slug] campaign pages work WITHOUT auth (public)
9. Backend routes: /auth/login NOT /api/auth/login
10. Run npm run build before EVERY commit — 0 errors required
11. Test MR Travels (curl localhost:3000) after every deployment
12. Never generate code that auto-posts to social media without vendor approval
```

---

## DATABASE TABLES (all with g4d_ prefix)

```
g4d_vendors              Main users table (admin, vendors)
g4d_subscriptions        DomainApp subscriptions
g4d_invoices             All invoices
g4d_wallets              Campaign wallet balances
g4d_wallet_transactions  Wallet usage history (expires 90 days)
g4d_campaign_pages       Landing pages (/go/[slug])
g4d_campaign_leads       CRM leads from all sources
g4d_call_logs            TeleCRM call history
g4d_campaigns            Marketing campaign requests
g4d_team_members         Vendor team members
g4d_notifications        All notifications (admin + vendor)
g4d_push_subscriptions   Firebase FCM tokens
g4d_leads                Demo booking enquiries (get4domain.com/book-demo)
g4d_support_tickets      Support tickets
g4d_platform_cms         get4domain.com settings
g4d_vendor_cms           Vendor website settings
g4d_vendor_products      Vendor products/services
```

---

## API ENDPOINTS (backend at gapi.get4domain.com)

```
Auth:
POST /auth/login           → email+password → JWT token
POST /auth/refresh         → refresh token

Vendors (admin only):
GET/POST /vendors
GET/PUT/DELETE /vendors/:id
POST /vendors/:id/suspend
POST /vendors/:id/activate

Wallet:
GET  /wallet/balance
GET  /wallet/transactions
POST /wallet/topup         → Razorpay order
POST /wallet/topup/verify  → credit wallet after payment
POST /wallet/deduct        → internal service deduction

Campaign Pages:
POST /campaign-pages/generate → Claude AI generates content
POST /campaign-pages          → create page
GET  /campaign-pages          → vendor's pages
PUT  /campaign-pages/:id      → update
GET  /go/:slug                → PUBLIC: no auth needed
POST /go/:slug/lead           → PUBLIC: lead submission

Payments:
POST /payments/create-order   → Razorpay order
POST /payments/verify         → verify and process
POST /payments/webhook        → Razorpay webhook

AI:
POST /ai/chat                 → chatbot
POST /ai/generate-content     → campaign content
POST /ai/generate-page        → landing page content

Notifications:
GET  /notifications           → vendor/admin
POST /notifications/subscribe → save FCM token

Support:
POST /support/tickets         → create
GET  /support/tickets         → list
PUT  /support/tickets/:id/reply → reply
```

---

## FILE STRUCTURE

```
get4domain-site/
├── get4domain_mvp/          ← FRONTEND (Next.js 15)
│   ├── src/
│   │   ├── app/
│   │   │   ├── (marketing)/ ← Public pages (home, pricing, industries)
│   │   │   ├── go/[slug]/   ← Campaign pages (PUBLIC, no auth)
│   │   │   ├── dashboard/   ← DomainCampaign vendor dashboard
│   │   │   ├── bos/         ← DomainApp BOS dashboard (to build)
│   │   │   ├── admin/       ← Super admin dashboard
│   │   │   └── login/
│   │   ├── lib/
│   │   │   ├── api.ts       ← API client (all fetch calls)
│   │   │   └── auth.ts      ← JWT auth logic
│   │   └── components/
│   ├── public/
│   │   ├── logo.png
│   │   ├── favicon.ico
│   │   └── sw.js            ← Service worker
│   └── docker-compose.yml   ← Port 3006
│
└── backend-api/             ← BACKEND (NestJS 11)
    ├── src/
    │   ├── main.ts          ← Port 3008
    │   ├── auth/
    │   ├── vendors/
    │   ├── wallet/          ← (to build)
    │   ├── campaign-pages/  ← (to build)
    │   ├── campaigns/       ← (to build)
    │   ├── crm/             ← (to build)
    │   ├── payments/
    │   ├── ai/
    │   ├── notifications/   ← (to build)
    │   ├── support/
    │   └── email/
    ├── prisma/
    │   ├── schema.prisma
    │   └── migrations/
    └── docker-compose.yml   ← Port 3008
```

---

## WALLET SYSTEM RULES

```
Minimum top-up: ₹999
Validity: 90 days from top-up date
Expired credits: cannot be used after 90 days

Top-up bonuses:
₹999  → ₹1,100 credits  (10%)
₹2,499 → ₹3,000 credits (20%)
₹4,999 → ₹6,500 credits (30%)

Deduction rates (in paise, ₹1 = 100 paise):
Image post AI:     500  (₹5)
Reel script AI:    1000 (₹10)
Festival poster:   800  (₹8)
Blog post AI:      1500 (₹15)
Ad creative AI:    1000 (₹10)
Organic FB post:   1000 (₹10) (we post on their page)
WhatsApp message:  100  (₹1)
SMS message:       50   (₹0.50)
Email:             10   (₹0.10)
AI call summary:   300  (₹3)
Paid ad mgmt:      20000 (₹200/campaign)
Lead WA alert:     100  (₹1)

Always check balance BEFORE deducting.
If insufficient: return INSUFFICIENT_WALLET_BALANCE error.
Frontend shows top-up modal on this error.
```

---

## CAMPAIGN WORKFLOW

```
1. Vendor requests campaign (describes what to promote)
2. Our team + AI creates content for selected channels
3. System sends approval notification to vendor dashboard
4. Vendor reviews and approves (or requests changes)
5. Vendor selects campaign channels
6. System shows wallet cost before confirming
7. Vendor confirms → wallet deducted
8. Our team executes campaign:
   - Post on their social media pages (using page access)
   - Send SMS via MSG91
   - Send WhatsApp via their WA Business API
   - Send email via their email config
   - Run paid ads (client pays ad spend directly)
9. Analytics tracked
10. Monthly report auto-generated
```

---

## SOCIAL MEDIA POSTING MODEL

```
HOW WE GET ACCESS:
- Vendor adds campaigns@get4domain.com as Editor on their FB page
- OR vendor authorizes our Get4Domain Facebook App
- We post using their page (their brand shows to followers)
- We NEVER store their personal login/password
- Page access only (professional agency model)

WE ALWAYS POST ON THEIR PAGE (not ours):
- Their Facebook Business Page
- Their Instagram Business Account
- Their YouTube Channel
- Their Google Business Profile

VENDOR MUST APPROVE before we post.
No automatic posting without approval.
```

---

## NOTIFICATION TRIGGERS

Send push notification + email to admin when:
- New demo booking (get4domain.com/book-demo)
- New support ticket raised
- Payment received from any vendor
- Campaign approved by vendor (ready to execute)
- Vendor wallet balance critically low

Send push notification + email to vendor when:
- Campaign content ready for approval
- Campaign published (executed by our team)
- Support ticket replied by admin
- Invoice created for them
- Payment confirmation
- Renewal reminder (30/7/1 days before expiry)

---

## DEPLOYMENT COMMANDS

```bash
# Pull latest code
cd /srv/get4domain-site && git pull origin get4domain-site

# Deploy backend
cd backend-api
docker compose down
docker compose build --no-cache
docker compose up -d

# Run migrations (if schema changed)
npx prisma migrate deploy

# Deploy frontend
cd ../get4domain_mvp
docker compose down
docker compose build --no-cache
docker compose up -d

# Verify everything
docker ps
curl -I http://localhost:3006  # frontend
curl -I http://localhost:3008  # backend
curl -I http://localhost:3000  # MR Travels (must still work)
```

---

## COMMON ISSUES & FIXES

### Unauthorized errors in dashboard
- JWT token stale from old session
- Fix: clear localStorage (g4d_token, g4d_user)
- Login fresh at get4domain.com/login

### Docker build fails
- Check if public/logo.png exists (must be committed to GitHub)
- Check .env.local for invalid characters (especially JSON in env vars)
- Run: docker compose build 2>&1 | tail -20 for error details

### Prisma migration fails
- Check DIRECT_URL in .env (not pooler URL for migrations)
- Run: npx prisma migrate deploy (not migrate dev on production)

### API 404 errors
- Backend routes start at / not /api/
- Correct: POST /auth/login
- Wrong: POST /api/auth/login

### Supabase connection error
- Must use POOLER URL (port 6543) not direct URL (port 5432)
- Direct URL is IPv6 only — will fail on Google Cloud VM

### Push notifications not working
- Check NEXT_PUBLIC_VAPID_KEY in frontend .env.local
- Check FIREBASE_PROJECT_ID in backend .env.local
- Ensure service worker registered: /sw.js

---

## WHAT IS COMPLETE vs INCOMPLETE

### COMPLETE ✓
- get4domain.com marketing site (71 pages)
- Login with real JWT
- Admin dashboard (basic)
- Vendor dashboard (basic)
- Support tickets
- Invoice creation UI
- Razorpay UI (needs key in .env)
- Backend API 33 endpoints
- Database with 7 base tables
- Email routing (Cloudflare)
- AI chatbot (marketing + dashboard)
- MR Travels BOS (Travel industry reference)
- Demo bookings saving to database

### INCOMPLETE ✗
- Wallet system (not built)
- Campaign page /go/[slug] (not built)
- Content creator (not built)
- CRM full features (basic only)
- TeleCRM (not built)
- Team management (not built)
- Email automation (configured but not triggered)
- PDF invoice generation (not built)
- Push notifications (service worker built, not wired)
- DomainApp BOS dashboard (only MR Travels built)
- Design studio (not built)
- Communication automation (not built)
- Pricing page update (old plans showing)
