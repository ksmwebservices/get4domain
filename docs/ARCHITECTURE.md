# GET4DOMAIN — SYSTEM ARCHITECTURE
# Version 2.0 | July 2026

---

## 1. SYSTEM OVERVIEW

```
┌─────────────────────────────────────────────────────────────────┐
│                      GET4DOMAIN PLATFORM                         │
│                   gapi.get4domain.com (API)                      │
│                   database.supabase.com (DB)                     │
│               Claude AI + DALL-E + Firebase FCM                  │
└──────────────────────────────┬──────────────────────────────────┘
                               │
           ┌───────────────────┼───────────────────┐
           │                   │                   │
           ▼                   ▼                   ▼
  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐
  │ DOMAINCAMPAIGN │  │   DOMAINAPP    │  │  SUPER ADMIN   │
  │   DASHBOARD    │  │   DASHBOARD    │  │   DASHBOARD    │
  │                │  │                │  │                │
  │ get4domain.com │  │ vendor.get4    │  │ get4domain.com │
  │  /dashboard    │  │ domain.com     │  │    /admin      │
  │                │  │    /admin      │  │                │
  │ Mobile PWA     │  │ Mobile PWA     │  │ Mobile PWA     │
  └────────────────┘  └────────────────┘  └────────────────┘
           │                   │                   │
           └───────────────────┴───────────────────┘
                               │
                               ▼
                    ┌──────────────────┐
                    │   PUBLIC PAGES   │
                    │                  │
                    │ get4domain.com   │
                    │ /go/[slug]       │
                    │ Campaign pages   │
                    │ (no auth needed) │
                    └──────────────────┘
```

---

## 2. TECH STACK

### Frontend
```
Framework:    Next.js 15 (App Router)
Styling:      TailwindCSS
Icons:        Lucide React
Charts:       Recharts
Animation:    Framer Motion
PWA:          next-pwa
State:        React Context + useState
Auth:         JWT stored in localStorage
API Client:   Custom fetch wrapper (src/lib/api.ts)
```

### Backend
```
Framework:    NestJS 11
Language:     TypeScript
ORM:          Prisma 6.19.3 (PINNED — do not upgrade)
Database:     PostgreSQL via Supabase
Auth:         JWT + Passport
File upload:  Supabase Storage
Validation:   class-validator
Documentation: Swagger (OpenAPI 3.0)
```

### Database
```
Provider:     Supabase (get4domain project — separate from MR Travels)
ORM:          Prisma 6.19.3
Connection:   Pooler URL (Transaction mode) — NOT direct (IPv6 only)
Tables prefix: g4d_ (to avoid conflicts)
Migrations:   Prisma migrations
```

### Infrastructure
```
Server:       Google Cloud VM (asia-south1-c, 34.14.130.68)
Containers:   Docker + Docker Compose
Reverse proxy: Nginx
CDN/SSL:      Cloudflare (Flexible SSL mode)
DNS:          Cloudflare
Domain:       get4domain.com
```

### AI Services
```
Content AI:   Claude API (claude-sonnet-4-6)
Image AI:     OpenAI DALL-E 3
Push Notif:   Firebase Cloud Messaging (FCM)
```

### Payment
```
Gateway:      Razorpay
Webhooks:     /payments/webhook (NestJS endpoint)
Invoice:      Auto-generated PDF via html-pdf
```

### Communication
```
Email:        Resend (noreply@get4domain.com)
SMS:          MSG91 (DLT compliant)
WhatsApp:     Vendor's own WA Business API
Push:         Firebase FCM
```

---

## 3. REPOSITORY STRUCTURE

```
get4domain-site/ (GitHub: ksmwebservices/get4domain, branch: get4domain-site)
├── get4domain_mvp/          ← Frontend (Next.js 15)
│   ├── src/
│   │   ├── app/
│   │   │   ├── (marketing)/     ← Public marketing pages
│   │   │   │   ├── page.tsx     ← Home
│   │   │   │   ├── pricing/
│   │   │   │   ├── industries/
│   │   │   │   ├── book-demo/
│   │   │   │   └── contact/
│   │   │   ├── go/              ← Campaign landing pages (PUBLIC)
│   │   │   │   └── [slug]/
│   │   │   │       └── page.tsx
│   │   │   ├── dashboard/       ← DomainCampaign vendor dashboard
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx     ← Overview
│   │   │   │   ├── landing-page/
│   │   │   │   ├── crm/
│   │   │   │   ├── telecrm/
│   │   │   │   ├── campaigns/
│   │   │   │   ├── reports/
│   │   │   │   ├── wallet/
│   │   │   │   ├── team/
│   │   │   │   └── support/
│   │   │   ├── bos/             ← DomainApp vendor dashboard
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx     ← Overview
│   │   │   │   ├── operations/  ← Industry-specific BOS
│   │   │   │   ├── accounts/
│   │   │   │   ├── hr/
│   │   │   │   ├── design-studio/
│   │   │   │   ├── communication/
│   │   │   │   ├── website-cms/
│   │   │   │   ├── team/
│   │   │   │   └── settings/
│   │   │   ├── admin/           ← Super admin dashboard
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx     ← Overview
│   │   │   │   ├── leads/
│   │   │   │   ├── vendors/
│   │   │   │   ├── campaigns/
│   │   │   │   ├── invoices/
│   │   │   │   ├── renewals/
│   │   │   │   ├── accounting/
│   │   │   │   ├── support/
│   │   │   │   ├── cms/
│   │   │   │   ├── team/
│   │   │   │   └── settings/
│   │   │   └── login/
│   │   ├── components/
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   ├── ChatBot.tsx       ← Marketing chatbot
│   │   │   ├── DashboardChatBot.tsx
│   │   │   └── ui/
│   │   ├── lib/
│   │   │   ├── api.ts            ← API client
│   │   │   ├── auth.ts           ← Auth logic
│   │   │   ├── auth-context.tsx
│   │   │   └── push-notifications.ts
│   │   └── data/
│   │       ├── content.ts        ← Industries, FAQs
│   │       └── industry-content.ts
│   ├── public/
│   │   ├── logo.png
│   │   ├── favicon.ico
│   │   └── sw.js                ← Service worker (PWA)
│   ├── Dockerfile
│   ├── docker-compose.yml       ← Port 3006
│   └── .env.local               ← NEVER commit
│
├── backend-api/                 ← Backend (NestJS 11)
│   ├── src/
│   │   ├── main.ts              ← Port 3008
│   │   ├── app.module.ts
│   │   ├── auth/                ← JWT auth
│   │   ├── vendors/             ← Vendor management
│   │   ├── subscriptions/       ← Plan management
│   │   ├── invoices/            ← Invoice generation
│   │   ├── payments/            ← Razorpay integration
│   │   ├── campaigns/           ← Campaign management
│   │   ├── leads/               ← Demo bookings + CRM leads
│   │   ├── wallet/              ← Wallet system
│   │   ├── cms/                 ← Vendor and platform CMS
│   │   ├── support/             ← Support tickets
│   │   ├── notifications/       ← Push notifications FCM
│   │   ├── ai/                  ← Claude + DALL-E integration
│   │   ├── email/               ← Resend integration
│   │   ├── sms/                 ← MSG91 integration
│   │   └── prisma/              ← Prisma service
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── Dockerfile
│   ├── docker-compose.yml       ← Port 3008
│   └── .env.local               ← NEVER commit
│
└── mr-travels-001/              ← MR Travels (NEVER TOUCH)
    ← Port 3000 (frontend)
    ← Port 3001 (backend)
```

---

## 4. DATABASE SCHEMA

### All tables prefixed with g4d_

```prisma
// VENDORS
model Vendor {
  id           String       @id @default(cuid())
  name         String
  email        String       @unique
  password     String       // bcrypt hashed
  businessName String
  phone        String?
  industry     String?      // travel, restaurant, clinic...
  subdomain    String?      @unique
  customDomain String?
  role         Role         @default(VENDOR)
  status       VendorStatus @default(ACTIVE)
  productType  ProductType  @default(CAMPAIGN) // CAMPAIGN, BOS, COMBO
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt
  
  subscriptions    Subscription[]
  invoices         Invoice[]
  tickets          SupportTicket[]
  cms              VendorCMS?
  campaignPages    CampaignPage[]
  campaignLeads    CampaignLead[]
  wallet           Wallet?
  walletTxns       WalletTransaction[]
  teamMembers      TeamMember[]
  notifications    Notification[]
  @@map("g4d_vendors")
}

// WALLET
model Wallet {
  id           String   @id @default(cuid())
  vendorId     String   @unique
  vendor       Vendor   @relation(fields:[vendorId],references:[id])
  balance      Int      @default(0)  // in paise
  totalCredited Int     @default(0)
  totalDebited  Int     @default(0)
  updatedAt    DateTime @updatedAt
  @@map("g4d_wallets")
}

model WalletTransaction {
  id           String   @id @default(cuid())
  vendorId     String
  vendor       Vendor   @relation(fields:[vendorId],references:[id])
  type         String   // CREDIT or DEBIT
  amount       Int      // in paise
  description  String
  service      String   // CONTENT/MESSAGING/CAMPAIGN/TOPUP/FREE
  balanceAfter Int
  expiresAt    DateTime? // 90 days for top-up credits
  razorpayId   String?
  createdAt    DateTime @default(now())
  @@map("g4d_wallet_transactions")
}

// CAMPAIGN PAGES (landing pages)
model CampaignPage {
  id          String   @id @default(cuid())
  vendorId    String
  vendor      Vendor   @relation(fields:[vendorId],references:[id])
  slug        String   @unique
  title       String
  headline    String
  subheadline String?
  benefits    Json     // array of benefit points
  aboutText   String?
  heroImage   String?
  photos      Json?    // array of photo URLs
  style       String   @default("LIGHT") // LIGHT/DARK/VIBRANT
  phone       String
  whatsapp    String
  email       String?
  address     String?
  mapsLink    String?
  testimonials Json?
  ctaText     String   @default("Enquire Now")
  active      Boolean  @default(true)
  views       Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  leads       CampaignLead[]
  @@map("g4d_campaign_pages")
}

model CampaignLead {
  id             String       @id @default(cuid())
  campaignPageId String?
  campaignPage   CampaignPage? @relation(fields:[campaignPageId],references:[id])
  vendorId       String
  vendor         Vendor       @relation(fields:[vendorId],references:[id])
  name           String
  phone          String
  message        String?
  source         String?      // landing-page/whatsapp/manual/social
  status         String       @default("new") // new/contacted/quoted/won/lost
  notes          String?
  assignedTo     String?      // team member id
  followUpDate   DateTime?
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  callLogs       CallLog[]
  @@map("g4d_campaign_leads")
}

// TELECRM
model CallLog {
  id         String       @id @default(cuid())
  leadId     String
  lead       CampaignLead @relation(fields:[leadId],references:[id])
  vendorId   String
  calledBy   String       // team member id
  duration   Int?         // seconds
  outcome    String?      // interested/not_interested/callback/won
  notes      String?
  aiSummary  String?      // Claude generated summary
  followUpAt DateTime?
  createdAt  DateTime     @default(now())
  @@map("g4d_call_logs")
}

// CAMPAIGNS
model Campaign {
  id          String   @id @default(cuid())
  vendorId    String
  name        String
  description String?
  status      String   @default("draft") // draft/pending_approval/approved/running/completed
  channels    Json     // selected channels array
  content     Json     // generated content per channel
  walletCost  Int      // total wallet cost in paise
  startDate   DateTime?
  endDate     DateTime?
  analytics   Json?    // reach, clicks, leads
  approvedAt  DateTime?
  approvedBy  String?  // vendor user who approved
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@map("g4d_campaigns")
}

// TEAM MEMBERS
model TeamMember {
  id         String   @id @default(cuid())
  vendorId   String
  vendor     Vendor   @relation(fields:[vendorId],references:[id])
  name       String
  email      String?
  phone      String?
  role       String   // MANAGER/ACCOUNTANT/HR/OPERATIONS/DESIGNER/FIELD/SALES/CAMPAIGN_MANAGER
  modules    Json     // allowed modules array
  status     String   @default("active")
  inviteToken String?
  lastLogin  DateTime?
  createdAt  DateTime @default(now())
  @@map("g4d_team_members")
}

// NOTIFICATIONS
model Notification {
  id             String   @id @default(cuid())
  recipientId    String
  recipientType  String   // VENDOR/ADMIN
  type           String   // PAYMENT/CAMPAIGN/LEAD/SUPPORT/SYSTEM/AI_APPROVAL
  priority       String   @default("INFO") // URGENT/IMPORTANT/INFO
  title          String
  message        String
  data           Json?    // action URL, entity ID
  read           Boolean  @default(false)
  actionRequired Boolean  @default(false)
  actionType     String?  // APPROVE_CAMPAIGN/APPROVE_CONTENT
  actionData     Json?
  createdAt      DateTime @default(now())
  @@map("g4d_notifications")
}

// PUSH SUBSCRIPTIONS (FCM)
model PushSubscription {
  id        String   @id @default(cuid())
  userId    String
  userType  String   // VENDOR/ADMIN
  fcmToken  String
  device    String   // mobile/desktop
  createdAt DateTime @default(now())
  @@map("g4d_push_subscriptions")
}

// DEMO LEADS (book-demo form)
model Lead {
  id        String   @id @default(cuid())
  name      String
  phone     String
  email     String?
  business  String
  industry  String
  interest  String   // CAMPAIGN/BOS/COMBO
  message   String?
  status    String   @default("pending") // pending/called/converted/lost
  notes     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@map("g4d_leads")
}

// Enums
enum Role {
  SUPER_ADMIN
  ADMIN
  VENDOR
}

enum VendorStatus {
  ACTIVE
  SUSPENDED
  PENDING
}

enum ProductType {
  CAMPAIGN
  BOS
  COMBO
}
```

---

## 5. API ENDPOINTS

### Auth
```
POST /auth/login              → JWT token
POST /auth/refresh            → new token
POST /auth/invite/accept      → team member accepts invite
```

### Vendors (Admin only)
```
GET    /vendors               → all vendors
POST   /vendors               → create vendor + welcome email
GET    /vendors/:id           → single vendor
PUT    /vendors/:id           → update
DELETE /vendors/:id           → delete
POST   /vendors/:id/suspend   → suspend
POST   /vendors/:id/activate  → activate
```

### Wallet
```
GET  /wallet/balance          → current balance
GET  /wallet/transactions     → history
POST /wallet/topup            → create Razorpay order
POST /wallet/topup/verify     → verify and credit
POST /wallet/deduct           → internal: deduct for service
```

### Campaign Pages
```
POST /campaign-pages/generate      → AI generates page content
POST /campaign-pages               → create and publish
GET  /campaign-pages               → vendor's pages
GET  /campaign-pages/:id           → single page
PUT  /campaign-pages/:id           → update
DELETE /campaign-pages/:id         → delete
GET  /go/:slug                     → PUBLIC page data (no auth)
POST /go/:slug/lead                → PUBLIC lead submission (no auth)
GET  /campaign-pages/:id/analytics → views + leads
```

### CRM Leads
```
GET    /leads/campaign         → vendor's campaign leads
POST   /leads/campaign         → add manual lead
GET    /leads/campaign/:id     → single lead
PUT    /leads/campaign/:id     → update status/notes
POST   /leads/campaign/:id/call → log a call
GET    /leads/telecrm/queue    → today's call queue
GET    /leads/telecrm/followups → follow-ups due
```

### Campaigns
```
POST /campaigns                → create campaign
GET  /campaigns                → vendor's campaigns
GET  /campaigns/:id            → single campaign
POST /campaigns/:id/approve    → vendor approves
POST /campaigns/:id/execute    → admin executes after approval
GET  /campaigns/:id/analytics  → performance data
```

### Invoices
```
POST   /invoices               → admin creates
GET    /invoices               → admin: all; vendor: own
GET    /invoices/:id           → single
POST   /invoices/:id/send-link → send Razorpay payment link
POST   /invoices/:id/mark-paid → mark as paid
GET    /invoices/:id/pdf       → download PDF
```

### Payments
```
POST /payments/create-order    → Razorpay order
POST /payments/verify          → verify payment
POST /payments/webhook         → Razorpay webhook
```

### AI
```
POST /ai/chat                  → chatbot (Claude)
POST /ai/generate-content      → campaign content generation
POST /ai/generate-image        → DALL-E image generation
POST /ai/generate-page         → campaign page content
POST /ai/call-summary          → TeleCRM call note summary
```

### Notifications
```
GET  /notifications            → vendor/admin notifications
PUT  /notifications/:id/read   → mark read
POST /notifications/subscribe  → save FCM token
POST /notifications/push       → admin: send push to vendor
```

### Support
```
POST /support/tickets          → create ticket
GET  /support/tickets          → admin: all; vendor: own
PUT  /support/tickets/:id/reply → admin reply
PUT  /support/tickets/:id/resolve → resolve ticket
```

### CMS
```
GET  /cms/platform             → get4domain.com settings
PUT  /cms/platform             → admin updates
GET  /cms/vendor/:id           → vendor website settings
PUT  /cms/vendor/:id           → vendor updates
```

### Subscriptions
```
POST /subscriptions            → create
GET  /subscriptions            → all (admin) / own (vendor)
PUT  /subscriptions/:id/activate → activate after payment
GET  /subscriptions/expiring   → renewals due soon
```

---

## 6. DOCKER SETUP

### Ports
```
3000 → MR Travels frontend      (NEVER TOUCH)
3001 → MR Travels backend       (NEVER TOUCH)
3006 → Get4Domain frontend
3008 → Get4Domain backend
```

### Docker CMD
```
Frontend: npm start (Next.js)
Backend:  node dist/src/main
```

### Environment Variables
```
Frontend (.env.local):
  NEXT_PUBLIC_API_URL=https://gapi.get4domain.com
  NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_xxx
  NEXT_PUBLIC_FIREBASE_API_KEY=xxx
  NEXT_PUBLIC_FIREBASE_PROJECT_ID=get4domain-94648
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=676562625575
  NEXT_PUBLIC_FIREBASE_APP_ID=xxx
  NEXT_PUBLIC_VAPID_KEY=xxx

Backend (.env.local):
  DATABASE_URL=postgresql://...pooler...6543/postgres?pgbouncer=true
  DIRECT_URL=postgresql://...supabase.co:5432/postgres
  JWT_SECRET=xxx
  RAZORPAY_KEY_ID=rzp_live_xxx
  RAZORPAY_KEY_SECRET=xxx
  RAZORPAY_WEBHOOK_SECRET=xxx
  CLAUDE_API_KEY=sk-ant-xxx
  OPENAI_API_KEY=sk-xxx
  RESEND_API_KEY=re_xxx
  FIREBASE_PROJECT_ID=get4domain-94648
  FIREBASE_MESSAGING_SENDER_ID=676562625575
  MSG91_API_KEY=xxx
  COMPANY_NAME=KSM Quantum Technologies
  COMPANY_GST=xxx
  COMPANY_EMAIL=admin@get4domain.com
  ADMIN_EMAIL=admin@get4domain.com
  FRONTEND_URL=https://get4domain.com
  PORT=3008
```

---

## 7. NGINX CONFIGURATION

```nginx
# get4domain.com (frontend - port 3006)
server {
    listen 80;
    server_name get4domain.com www.get4domain.com *.get4domain.com;
    location / {
        proxy_pass http://localhost:3006;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# gapi.get4domain.com (backend - port 3008)
server {
    listen 80;
    server_name gapi.get4domain.com;
    location / {
        proxy_pass http://localhost:3008;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 8. DEPLOYMENT SEQUENCE

```bash
# Standard deployment
cd /srv/get4domain-site
git pull origin get4domain-site

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

# Verify
docker ps
curl -I http://localhost:3006
curl -I http://localhost:3008

# Clear Cloudflare cache
# Cloudflare → get4domain.com → Caching → Purge Everything
```

---

## 9. HARD RULES — NEVER BREAK

```
1. Never touch ports 3000 or 3001 (MR Travels)
2. Prisma must stay at 6.19.3 (breaking changes in v7)
3. Always use Supabase POOLER connection (not direct)
4. Docker CMD: node dist/src/main (backend)
5. Never push .env.local to GitHub
6. All NEXT_PUBLIC_* vars are visible in browser
   Never put secrets there (Claude key, Razorpay secret)
7. Backend routes: /auth/login NOT /api/auth/login
8. After every Docker rebuild: test MR Travels still works
9. All database tables must use g4d_ prefix
10. Campaign pages /go/[slug] must work WITHOUT auth
```
