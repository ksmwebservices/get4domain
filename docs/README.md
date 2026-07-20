# GET4DOMAIN
## Your Complete Digital Business Partner
### KSM Quantum Technologies | get4domain.com

---

## QUICK START

### Live URLs
```
get4domain.com              → Marketing site + Campaign Dashboard
gapi.get4domain.com         → Backend API
gapi.get4domain.com/api/docs → Swagger documentation
mrtravels.get4domain.com    → MR Travels (DO NOT TOUCH)
```

### Admin Login
```
URL:      https://get4domain.com/login
Email:    admin@get4domain.com
Password: ChangeMe123! (change after first login)
```

### VM SSH
```bash
ssh ksmwebtechservices@34.14.130.68
# OR
# Google Cloud Console → ksmwebservices project → Compute Engine → SSH
```

---

## WHAT IS GET4DOMAIN?

Two products on one platform:

### DomainCampaign
Pure digital promotion. No website needed.
- AI creates campaign content
- We post on their social media pages
- Lead CRM + TeleCRM
- Wallet-based usage (pay per action)
- Free landing page included

### DomainApp
Professional website + Business Operating System.
- We build industry-specific website
- Complete BOS (bookings, invoicing, HR, accounts)
- Design studio (letterhead, ID cards, quotes)
- Communication automation
- MR Travels = Travel industry reference

---

## SERVER SETUP

### VM Details
```
Provider:   Google Cloud
Region:     asia-south1-c (Mumbai)
IP:         34.14.130.68
Project:    ksmwebservices
VM Name:    get4domain-server
```

### Docker Containers
```
get4domain_frontend  → port 3006 (Get4Domain Next.js)
get4domain_backend   → port 3008 (Get4Domain NestJS)
mr_travels_frontend  → port 3000 (MR Travels — NEVER TOUCH)
mr_travels_backend   → port 3001 (MR Travels — NEVER TOUCH)
```

### Nginx Config Files
```
/etc/nginx/sites-enabled/get4domain          → port 3006
/etc/nginx/sites-enabled/gapi.get4domain.com → port 3008
/etc/nginx/sites-enabled/mrtravels.get4domain.com → port 3000
/etc/nginx/sites-enabled/api.get4domain.com  → port 3001
```

---

## DEPLOYMENT

### Standard Deploy (both services)
```bash
cd /srv/get4domain-site
git pull origin get4domain-site

# Backend
cd backend-api
docker compose down
docker compose build --no-cache
docker compose up -d

# Frontend
cd ../get4domain_mvp
docker compose down
docker compose build --no-cache
docker compose up -d

# Verify
docker ps
curl -I http://localhost:3006
curl -I http://localhost:3008
```

### After Schema Changes (run migration)
```bash
cd /srv/get4domain-site/backend-api
npx prisma migrate deploy
```

### After Deploy — Clear Cache
```
Cloudflare → get4domain.com → Caching → Purge Everything
```

---

## ENVIRONMENT VARIABLES

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=https://gapi.get4domain.com
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_xxx
NEXT_PUBLIC_FIREBASE_API_KEY=xxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=get4domain-94648.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=get4domain-94648
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=676562625575
NEXT_PUBLIC_FIREBASE_APP_ID=xxx
NEXT_PUBLIC_VAPID_KEY=xxx
```

### Backend (.env.local)
```
DATABASE_URL=postgresql://pooler-url:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://direct-url:5432/postgres
JWT_SECRET=xxx
RAZORPAY_KEY_ID=rzp_live_xxx
RAZORPAY_KEY_SECRET=xxx
RAZORPAY_WEBHOOK_SECRET=xxx
CLAUDE_API_KEY=sk-ant-xxx
OPENAI_API_KEY=sk-xxx
RESEND_API_KEY=re_xxx
FIREBASE_PROJECT_ID=get4domain-94648
FIREBASE_MESSAGING_SENDER_ID=676562625575
COMPANY_NAME=KSM Quantum Technologies
COMPANY_EMAIL=admin@get4domain.com
ADMIN_EMAIL=admin@get4domain.com
ADMIN_PHONE=+917550047567
FRONTEND_URL=https://get4domain.com
PORT=3008
```

---

## DATABASE

### Supabase Project
```
Project:  get4domain (separate from MR Travels)
Tables:   All prefixed with g4d_
```

### Key Tables
```
g4d_vendors              → All users (admin, vendors)
g4d_subscriptions        → DomainApp subscriptions
g4d_invoices             → All invoices
g4d_wallets              → Campaign wallet balances
g4d_wallet_transactions  → Wallet usage history
g4d_campaign_pages       → Landing pages
g4d_campaign_leads       → CRM leads
g4d_call_logs            → TeleCRM call history
g4d_campaigns            → Marketing campaigns
g4d_team_members         → Vendor team members
g4d_notifications        → All notifications
g4d_push_subscriptions   → FCM tokens
g4d_leads                → Demo booking enquiries
g4d_support_tickets      → Support tickets
g4d_platform_cms         → get4domain.com settings
g4d_vendor_cms           → Vendor website settings
```

### Create Admin User
```bash
cd /srv/get4domain-site/backend-api
node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();
async function main() {
  const hash = await bcrypt.hash('ChangeMe123!', 10);
  const admin = await prisma.vendor.create({
    data: {
      name: 'Get4Domain Admin',
      email: 'admin@get4domain.com',
      password: hash,
      businessName: 'KSM Quantum Technologies',
      phone: '+917550047567',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    },
  });
  console.log('Admin created:', admin.id);
  await prisma.\$disconnect();
}
main().catch(console.error);
"
```

---

## CODE STRUCTURE

### Frontend Key Files
```
src/lib/api.ts              → API client (all backend calls)
src/lib/auth.ts             → Login, session management
src/lib/auth-context.tsx    → Auth React context
src/constants/site.ts       → Site config, nav items
src/data/content.ts         → Industries, FAQs, testimonials
```

### Backend Key Files
```
src/main.ts                 → Entry point (port 3008)
src/app.module.ts           → Root module
src/auth/jwt.strategy.ts    → JWT validation
src/prisma/prisma.service.ts → Database client
src/ai/ai.service.ts        → Claude + DALL-E integration
src/payments/payments.service.ts → Razorpay integration
src/email/email.service.ts  → Resend integration
```

---

## INTEGRATIONS

### Razorpay
```
Dashboard: dashboard.razorpay.com
Webhook URL: https://gapi.get4domain.com/payments/webhook
Test: Use rzp_test_xxx key for testing
Live: Use rzp_live_xxx key for production
```

### Claude AI
```
API: https://api.anthropic.com/v1/messages
Model: claude-sonnet-4-6
Used for: Content generation, chatbot, call summaries
Key: In backend .env.local only (never frontend)
```

### Resend (Email)
```
Dashboard: resend.com
Domain: get4domain.com (verified)
From: noreply@get4domain.com
Used for: Welcome emails, invoices, support tickets
```

### Firebase (Push Notifications)
```
Project: get4domain-94648
Sender ID: 676562625575
Used for: Admin push notifications on mobile
```

### Cloudflare
```
Account: Ksmwebtechservices@gmail.com
Zones: get4domain.com
SSL Mode: Flexible (origin runs HTTP)
Email Routing: Enabled (forwards to Gmail)
```

---

## HARD RULES

```
❌ NEVER touch ports 3000 or 3001 (MR Travels)
❌ NEVER upgrade Prisma beyond 6.19.3
❌ NEVER use direct Supabase URL (use pooler)
❌ NEVER push .env.local to GitHub
❌ NEVER put secret keys in NEXT_PUBLIC_* vars
❌ NEVER run migrations without testing locally first
❌ NEVER deploy without running npm run build first
❌ NEVER auto-post to social media without vendor approval

✅ Always use Supabase pooler URL (port 6543)
✅ Always run npm run build before committing
✅ Always test MR Travels after any deployment
✅ Always purge Cloudflare cache after deployment
✅ Always prefix database tables with g4d_
✅ Always check wallet balance before any paid action
```

---

## GITHUB

```
Org:    ksmwebservices
Repo:   get4domain
Branch: get4domain-site

Clone:
git clone https://github.com/ksmwebservices/get4domain.git
cd get4domain
git checkout get4domain-site
```

---

## SUPPORT

```
Email:    support@get4domain.com (→ forwards to Gmail)
WhatsApp: +917550047567
Admin:    get4domain.com/admin
```

---

## ROADMAP

### Week 1 (Current)
- [x] Frontend live (71 pages)
- [x] Backend API (33 endpoints)
- [x] Real database (Supabase)
- [x] JWT authentication
- [x] Admin dashboard
- [x] Vendor dashboard
- [x] Support tickets
- [ ] Wallet system
- [ ] Campaign page builder
- [ ] Razorpay complete wiring

### Week 2
- [ ] Content creator (AI)
- [ ] Template builder
- [ ] Full CRM + TeleCRM
- [ ] Team management

### Week 3
- [ ] Email/SMS/WhatsApp blast
- [ ] SEO/GEO tools
- [ ] PDF invoices
- [ ] Email automation

### Week 4
- [ ] DomainApp BOS dashboard
- [ ] Design studio
- [ ] Communication automation
- [ ] Full admin dashboard

### Month 2
- [ ] Restaurant BOS template
- [ ] Clinic BOS template
- [ ] Social media API posting
- [ ] Campaign analytics

### Month 3
- [ ] Multi-language support
- [ ] Advanced analytics
- [ ] White-label option
