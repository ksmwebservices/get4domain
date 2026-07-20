# GET4DOMAIN — MASTER CLAUDE CODE DISPATCH
# Version 2.0 | July 2026
# Paste this entire file into Claude Code

---

## CONTEXT

Project: Get4Domain — India's AI-powered digital business platform
Frontend: C:\Get4Domain\get4domain-site\get4domain_mvp (Next.js 15, port 3006)
Backend: C:\Get4Domain\get4domain-site\backend-api (NestJS 11, port 3008)
Branch: get4domain-site on github.com/ksmwebservices/get4domain
Live: get4domain.com (frontend) + gapi.get4domain.com (backend)
DB: Supabase get4domain project (separate from MR Travels)

## HARD RULES — NEVER BREAK
1. Never touch ports 3000 or 3001 (MR Travels is there)
2. Prisma stays at 6.19.3 — never upgrade
3. Always use Supabase POOLER connection
4. Backend Docker CMD: node dist/src/main
5. Never push .env.local to GitHub
6. Never put secrets in NEXT_PUBLIC_* vars
7. All g4d_ table prefix in database
8. /go/[slug] pages work WITHOUT auth (public)
9. After every change: npm run build → 0 errors
10. Commit after each phase with clear message

---

## PHASE 1 — BACKEND: WALLET + CAMPAIGN + NOTIFICATIONS

### 1A. Add to backend-api/prisma/schema.prisma

Add these models after existing models:

```prisma
model Wallet {
  id            String              @id @default(cuid())
  vendorId      String              @unique
  vendor        Vendor              @relation(fields:[vendorId],references:[id])
  balance       Int                 @default(0)
  totalCredited Int                 @default(0)
  totalDebited  Int                 @default(0)
  updatedAt     DateTime            @updatedAt
  transactions  WalletTransaction[]
  @@map("g4d_wallets")
}

model WalletTransaction {
  id           String   @id @default(cuid())
  vendorId     String
  vendor       Vendor   @relation(fields:[vendorId],references:[id])
  walletId     String
  wallet       Wallet   @relation(fields:[walletId],references:[id])
  type         String
  amount       Int
  description  String
  service      String
  balanceAfter Int
  expiresAt    DateTime?
  razorpayId   String?
  createdAt    DateTime @default(now())
  @@map("g4d_wallet_transactions")
}

model CampaignPage {
  id           String         @id @default(cuid())
  vendorId     String
  vendor       Vendor         @relation(fields:[vendorId],references:[id])
  slug         String         @unique
  title        String
  headline     String
  subheadline  String?
  benefits     Json
  aboutText    String?
  heroImage    String?
  photos       Json?
  style        String         @default("LIGHT")
  phone        String
  whatsapp     String
  email        String?
  address      String?
  mapsLink     String?
  testimonials Json?
  ctaText      String         @default("Enquire Now")
  active       Boolean        @default(true)
  views        Int            @default(0)
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt
  leads        CampaignLead[]
  @@map("g4d_campaign_pages")
}

model CampaignLead {
  id             String        @id @default(cuid())
  campaignPageId String?
  campaignPage   CampaignPage? @relation(fields:[campaignPageId],references:[id])
  vendorId       String
  vendor         Vendor        @relation(fields:[vendorId],references:[id])
  name           String
  phone          String
  message        String?
  source         String?
  status         String        @default("new")
  notes          String?
  assignedTo     String?
  followUpDate   DateTime?
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
  callLogs       CallLog[]
  @@map("g4d_campaign_leads")
}

model CallLog {
  id         String       @id @default(cuid())
  leadId     String
  lead       CampaignLead @relation(fields:[leadId],references:[id])
  vendorId   String
  calledBy   String
  duration   Int?
  outcome    String?
  notes      String?
  aiSummary  String?
  followUpAt DateTime?
  createdAt  DateTime     @default(now())
  @@map("g4d_call_logs")
}

model Campaign {
  id          String   @id @default(cuid())
  vendorId    String
  name        String
  description String?
  status      String   @default("draft")
  channels    Json
  content     Json
  walletCost  Int      @default(0)
  startDate   DateTime?
  endDate     DateTime?
  analytics   Json?
  approvedAt  DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@map("g4d_campaigns")
}

model TeamMember {
  id          String   @id @default(cuid())
  vendorId    String
  vendor      Vendor   @relation(fields:[vendorId],references:[id])
  name        String
  email       String?
  phone       String?
  role        String
  modules     Json
  status      String   @default("active")
  inviteToken String?
  lastLogin   DateTime?
  createdAt   DateTime @default(now())
  @@map("g4d_team_members")
}

model Notification {
  id             String   @id @default(cuid())
  recipientId    String
  recipientType  String
  type           String
  priority       String   @default("INFO")
  title          String
  message        String
  data           Json?
  read           Boolean  @default(false)
  actionRequired Boolean  @default(false)
  actionType     String?
  actionData     Json?
  createdAt      DateTime @default(now())
  @@map("g4d_notifications")
}

model PushSubscription {
  id        String   @id @default(cuid())
  userId    String
  userType  String
  fcmToken  String
  device    String
  createdAt DateTime @default(now())
  @@map("g4d_push_subscriptions")
}
```

Also add to Vendor model these relations:
```
wallet           Wallet?
walletTxns       WalletTransaction[]
campaignPages    CampaignPage[]
campaignLeads    CampaignLead[]
teamMembers      TeamMember[]
notifications    Notification[]
```

### 1B. Build these backend modules

**Wallet Module (src/wallet/):**
- GET /wallet/balance → {balance, freeCreditsNextDate}
- GET /wallet/transactions → paginated list
- POST /wallet/topup → create Razorpay order for topup
- POST /wallet/topup/verify → verify payment, credit wallet with bonus
- POST /wallet/deduct (internal) → deduct credits for service

Bonus logic:
- ₹999 topup → credit 1100 (10% bonus), expires 90 days
- ₹2499 topup → credit 3000 (20% bonus), expires 90 days  
- ₹4999 topup → credit 6500 (30% bonus), expires 90 days

**Campaign Pages Module (src/campaign-pages/):**
- POST /campaign-pages/generate → call Claude API to generate page content
  Input: {industry, businessName, offerTitle, description, phone, whatsapp}
  Output: {headline, subheadline, benefits[5], aboutText, ctaText}
  Deduct ₹0 (page creation is free, wallet only for posting)
- POST /campaign-pages → create and save page
- GET /campaign-pages → vendor's pages with lead count
- GET /campaign-pages/:id → full page data
- PUT /campaign-pages/:id → update page
- DELETE /campaign-pages/:id → soft delete
- GET /go/:slug → PUBLIC: page data (no JWT required)
- POST /go/:slug/lead → PUBLIC: submit lead (no JWT required)
  After lead saved: send WhatsApp notification to vendor (₹1 from wallet)
- GET /campaign-pages/:id/analytics → {views, leads, conversion}
- POST /campaign-pages/:pageId/view → increment view count (no auth)

**Campaign Module (src/campaigns/):**
- POST /campaigns → create campaign request
- GET /campaigns → vendor's campaigns
- GET /campaigns/:id → single campaign
- POST /campaigns/:id/approve → vendor approves
  Check wallet balance before approval
  Deduct wallet for selected channels
- GET /campaigns/:id/analytics → performance data
- GET /campaigns/admin/all → admin: all vendor campaigns

**CRM Module (src/crm/):**
- GET /crm/leads → vendor's leads (filter by status/source/date)
- POST /crm/leads → add manual lead
- GET /crm/leads/:id → lead detail with call history
- PUT /crm/leads/:id → update status/notes/assignment
- POST /crm/leads/:id/call → log a call (optional AI summary)
- GET /crm/telecrm/queue → leads to call today (sorted by priority)
- GET /crm/telecrm/followups → upcoming follow-up reminders

**Team Module (src/team/):**
- POST /team/invite → invite team member (send email/WhatsApp)
- GET /team/members → vendor's team
- PUT /team/members/:id → update role/modules
- DELETE /team/members/:id → remove
- POST /team/invite/accept → accept invite (set password)
- GET /team/activity → recent activity log

**Notifications Module (src/notifications/):**
- GET /notifications → vendor/admin notifications (unread first)
- PUT /notifications/:id/read → mark as read
- PUT /notifications/read-all → mark all read
- POST /notifications/subscribe → save FCM token
- POST /notifications/push → admin: send push to specific vendor

**Enhanced AI Module (src/ai/):**
Extend existing ai module with:
- POST /ai/generate-content → campaign content for given channel
  Input: {channel, vendorIndustry, offerDetails, tone}
  Output: {caption, hashtags, imagePrompt}
  Call DALL-E for image if channel needs visual
  Deduct wallet: ₹5 for post, ₹10 for reel, ₹8 for poster
- POST /ai/generate-page → landing page content (Claude)
- POST /ai/call-summary → TeleCRM call note (Claude)
  Input: {voiceNote or textNotes, leadName, callDuration}
  Output: {summary, nextAction, sentiment}
  Deduct ₹3 from wallet

**Enhanced Payments Module:**
- Fix Razorpay webhook to properly:
  1. Verify signature
  2. Mark invoice as PAID
  3. Activate subscription
  4. Record income in platform accounting
  5. Send confirmation email via Resend
  6. Send push notification to admin
  7. Generate PDF invoice

**Support Notifications:**
When support ticket created:
  1. Save to database
  2. Send push notification to admin (FCM)
  3. Send email to admin@get4domain.com
  4. Send WhatsApp to admin +917550047567
  5. Auto-reply to vendor: "Ticket received, we respond in 24 hours"

After all backend changes:
- Run: npx prisma generate
- Run: npm run build → 0 errors
- Note: Do not run prisma migrate (runs on VM)
- Commit: "feat: wallet, campaign pages, CRM, team, notifications backend"
- Push to get4domain-site

---

## PHASE 2 — FRONTEND: CAMPAIGN DASHBOARD

### 2A. Update src/app/dashboard/layout.tsx

New navigation for DomainCampaign vendors:

```typescript
const navItems = [
  { icon: LayoutDashboard, label: 'Overview', href: '/dashboard' },
  { icon: FileText, label: 'My Page', href: '/dashboard/landing-page' },
  { icon: Users, label: 'CRM', href: '/dashboard/crm' },
  { icon: Phone, label: 'TeleCRM', href: '/dashboard/telecrm' },
  { icon: Megaphone, label: 'Campaigns', href: '/dashboard/campaigns' },
  { icon: BarChart3, label: 'Reports', href: '/dashboard/reports' },
  { icon: Wallet, label: 'Wallet', href: '/dashboard/wallet' },
  { icon: UserPlus, label: 'Team', href: '/dashboard/team' },
  { icon: HelpCircle, label: 'Support', href: '/dashboard/support' },
  { icon: Bell, label: 'Notifications', href: '/dashboard/notifications' },
];
```

Mobile bottom nav (shows on screens < 768px):
```
🏠 Home | 👥 CRM | 📣 Campaign | 📊 Reports | ⚙️ More
```

### 2B. Build these pages

**src/app/dashboard/page.tsx (Overview)**
Show:
- Greeting: "Good morning, {vendorName} 👋"
- Business: {businessName} · {industry}
- Stats row: Leads today | Active campaigns | Wallet balance
- Quick actions: [Create Campaign] [Add Lead] [Get Support]
- Recent leads (last 5)
- Recent notifications (last 3)
- Upcoming follow-ups (next 3)

**src/app/dashboard/landing-page/page.tsx (My Page)**
Show:
- Page URL: get4domain.com/go/{slug} [Visit] [Copy] [Share]
- QR Code for the URL
- Edit form (basic fields):
  Business name, phone, WhatsApp, tagline
  [Save Changes] → PUT /campaign-pages/:id
- Stats: {views} views · {leads} leads · {conversion}%
- [View All Leads] → links to CRM filtered by this page

**src/app/dashboard/crm/page.tsx (CRM)**
Show:
- Filter tabs: All | New | Contacted | Quoted | Won | Lost
- Search by name/phone
- Lead cards with:
  Name, phone, source badge, status badge
  Time since enquiry
  [Call] [WhatsApp] [Add Note] [Update Status]
- Add Lead button → modal form
- Export to CSV button

**src/app/dashboard/telecrm/page.tsx (TeleCRM)**
Show:
- "Today's Call Queue" section:
  Leads sorted by priority (new first, overdue follow-ups)
  Each lead: name, phone, last contact, [Call Now] [Skip]
- "Follow-ups Due" section:
  Calendar view of upcoming follow-ups
- Call modal (when Call Now clicked):
  Lead name and last notes
  Call duration timer
  Outcome buttons: [Interested] [Not Interested] [Callback] [Won]
  Notes text area
  Follow-up date setter
  [Save Call Log]

**src/app/dashboard/campaigns/page.tsx (Campaigns)**
Show:
- Active campaigns list
- [Create Campaign] button → campaign creation flow:
  
  Step 1: Campaign brief
    What to promote? (text)
    Target audience? (text)
    Campaign duration: start/end date
    
  Step 2: Select channels
    Checkboxes for each channel
    Show estimated wallet cost per channel
    
  Step 3: AI generates content
    Loading: "AI is creating your campaign content..."
    Shows generated content per channel
    Edit options for each
    
  Step 4: Review and submit for approval
    Summary of all content
    Total wallet cost shown
    [Submit for Approval]

- Campaigns awaiting approval from admin:
  "3 campaigns pending our team's action"

**src/app/dashboard/wallet/page.tsx (Wallet)**
Show:
- Large balance display: ₹{balance} credits
- Usage this month breakdown
- Top-up section:
  Preset amounts: [₹999 → ₹1,100] [₹2,499 → ₹3,000] [₹4,999 → ₹6,500]
  [Pay via Razorpay] → Razorpay checkout
- Transaction history table:
  Date | Description | Type | Amount | Balance
- Credits expiry notice if applicable

**src/app/dashboard/team/page.tsx (Team)**
Show:
- Team members list with role badges
- [Invite Member] button → modal:
  Name, email/phone, role selection, module checkboxes
  [Send Invite via Email] [Send via WhatsApp]
- Each member: last active, [Edit Role] [Remove]

**src/app/go/[slug]/page.tsx (PUBLIC Campaign Page)**
This page works WITHOUT authentication.
Mobile-first, webapp style.

Sections:
1. Hero: full-width image, headline, CTA button (floating)
2. Benefits: icon grid with 5 benefit points
3. Gallery: horizontal swipe (if photos uploaded)
4. About: business description
5. Testimonials: card slider (if available)
6. Enquiry form: name + phone + message (simple, 2-3 fields)
7. Contact: [Call] [WhatsApp] [Maps] buttons
8. Footer: "Powered by Get4Domain" watermark

Three visual themes (based on page.style):
- LIGHT: white bg, blue accents, clean
- DARK: dark bg, bright accents, bold
- VIBRANT: gradient bg, energetic colors

On form submit:
- POST /go/:slug/lead
- Show: "Thank you! We will call you within 1 hour"
- Trigger vendor WhatsApp notification (backend handles)

Page must:
- Load under 2 seconds
- Work perfectly on mobile
- Have floating [Call] [WhatsApp] buttons always visible
- Show lead count social proof: "47 people enquired this week"
- Be PWA installable

---

## PHASE 3 — FRONTEND: ADMIN DASHBOARD REBUILD

### 3A. Update src/app/admin/layout.tsx navigation

```typescript
const adminNavItems = [
  { icon: LayoutDashboard, label: 'Overview', href: '/admin' },
  { icon: CalendarCheck, label: 'Demo Bookings', href: '/admin/leads', badge: true },
  { icon: Users, label: 'Vendors', href: '/admin/vendors' },
  { icon: Megaphone, label: 'Campaigns', href: '/admin/campaigns', badge: true },
  { icon: FileText, label: 'Invoices', href: '/admin/invoices' },
  { icon: RefreshCw, label: 'Renewals', href: '/admin/renewals' },
  { icon: BarChart3, label: 'Accounting', href: '/admin/accounting' },
  { icon: MessageSquare, label: 'Support', href: '/admin/support', badge: true },
  { icon: Globe, label: 'Platform CMS', href: '/admin/cms' },
  { icon: Users2, label: 'Our Team', href: '/admin/team' },
  { icon: Settings, label: 'Settings', href: '/admin/settings' },
];
```

Mobile bottom nav:
```
📊 Overview | 📣 Campaigns | 👥 Vendors | 🎫 Support | ⚙️ More
```

### 3B. Build/update admin pages

**src/app/admin/page.tsx (Overview)**
Fetch real data:
- GET /vendors → total count by product type
- GET /invoices → revenue this month, pending payments
- GET /campaigns → pending approvals count
- GET /support/tickets → open tickets count
- GET /leads → new demo bookings today

Show:
- Revenue cards: This Month | Last Month | Total
- Stats: Vendors | Active Campaigns | Pending Approvals | Open Tickets
- Demo bookings list (recent 5) with [Call] [WhatsApp] buttons
- Campaigns pending approval list
- Notifications feed

**src/app/admin/campaigns/page.tsx**
Show:
- Campaigns by status: All | Pending | Approved | Running | Completed
- Each campaign card:
  Vendor name, campaign name, channels, status
  Content preview per channel
  [Approve & Execute] [Request Changes] [Reject]
- Campaign creation queue for our team
- Analytics summary per campaign

**src/app/admin/team/page.tsx (Our Team)**
Manage Get4Domain internal team:
- Team members with roles
- Roles: Campaign Manager, Support Agent, Developer, Accountant, Sales
- [Invite Team Member]
- Activity log per member
- Access control per section

---

## PHASE 4 — RAZORPAY COMPLETE WIRING

### Fix payments end-to-end:

**Frontend: src/app/dashboard/wallet/page.tsx**
When vendor clicks top-up:
1. POST /wallet/topup → get Razorpay order ID
2. Load Razorpay SDK: https://checkout.razorpay.com/v1/checkout.js
3. Open Razorpay modal:
   key: NEXT_PUBLIC_RAZORPAY_KEY_ID
   amount: selected amount in paise
   currency: INR
   name: Get4Domain
   description: Wallet Top-up
   prefill: vendor name and email
4. On payment success: POST /wallet/topup/verify
5. Show: "₹{credits} credits added to your wallet!"
6. Refresh wallet balance

**Frontend: src/app/dashboard/billing/page.tsx**
When vendor pays invoice:
1. Show invoice details
2. [Pay ₹{amount} via Razorpay] button
3. POST /payments/create-order
4. Open Razorpay modal
5. On success: POST /payments/verify
6. Show: "Payment successful! Invoice emailed to you."

**Backend: payments.service.ts**
After payment verified:
1. Mark invoice PAID
2. Activate subscription
3. Record income in g4d_platform_income
4. Generate PDF invoice (html-to-pdf)
5. Send PDF via Resend to vendor email
6. Send push notification to admin FCM
7. Send WhatsApp to admin +917550047567: 
   "Payment received ₹{amount} from {vendorName}"
8. Send confirmation email to vendor

---

## PHASE 5 — SUPPORT NOTIFICATIONS COMPLETE WIRING

When vendor submits support ticket:
1. Save to database
2. Send push notification to admin (FCM)
   title: "New Support Ticket"
   body: "{vendorName}: {subject}"
   data: {ticketId, url: /admin/support}
3. Send email to admin@get4domain.com via Resend
4. Auto-reply to vendor via email:
   "Hi {name}, we received your ticket #{number}.
    We will respond within 24 hours.
    Our working hours: Mon-Sat 9am-8pm IST"
5. Update notification bell count in admin dashboard

When admin replies to ticket:
1. Update ticket in database
2. Send email to vendor via Resend with reply
3. Send push notification to vendor (if they have FCM token)
4. Send WhatsApp to vendor (₹1 from their wallet OR free from our side)

---

## PHASE 6 — MOBILE PWA COMPLETE

### Service Worker (public/sw.js)
Already created. Verify it handles:
- Push events → show notification
- Notification click → open relevant URL
- Background sync for offline actions

### Manifest (src/app/manifest.ts)
```typescript
export default function manifest() {
  return {
    name: 'Get4Domain',
    short_name: 'G4D',
    description: 'Your Complete Digital Business Partner',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#2563eb',
    orientation: 'portrait',
    icons: [
      { src: '/favicon.png', sizes: '64x64', type: 'image/png' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
```

### Admin PWA Install Prompt
In admin layout, after login:
```typescript
// Request push notification permission
const permission = await Notification.requestPermission();
if (permission === 'granted') {
  const registration = await navigator.serviceWorker.register('/sw.js');
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: process.env.NEXT_PUBLIC_VAPID_KEY,
  });
  // POST /notifications/subscribe with subscription data
}
```

---

## PHASE 7 — FINAL BUILD AND DEPLOY

After all phases complete:

1. Run npm run build in frontend → confirm 0 errors, check page count
2. Run npm run build in backend → confirm 0 errors
3. Commit all changes: "feat: complete platform v2 - wallet, campaigns, CRM, notifications"
4. Push to get4domain-site

Then on VM:
```bash
cd /srv/get4domain-site && git pull origin get4domain-site

# Deploy backend
cd backend-api
docker compose down
docker compose build --no-cache
docker compose up -d
npx prisma migrate deploy  # run new migrations

# Deploy frontend
cd ../get4domain_mvp
docker compose down
docker compose build --no-cache
docker compose up -d

# Verify
curl -I http://localhost:3006
curl -I http://localhost:3008
curl http://localhost:3008/auth/login -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@get4domain.com","password":"ChangeMe123!"}'
```

5. Purge Cloudflare cache
6. Test all flows in browser

---

## BUILD NOTES

- Complete each phase fully before starting next
- Run npm run build after each phase
- If errors: fix before proceeding
- Commit after each phase
- Test critical paths: login, wallet topup, campaign page public view, lead submission
- The /go/[slug] page is the most important — test on mobile

Start with Phase 1 backend changes.
Tell me when each phase is complete.
