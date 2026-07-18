# GET4DOMAIN — Monday Launch Deployment Guide

## What's in the ZIP

```
get4domain_mvp/
├── src/
│   ├── app/
│   │   ├── (marketing)/          ← Public landing site (33 pages)
│   │   │   ├── page.tsx          ← Home — hero, products, industries, testimonials
│   │   │   ├── domain-app/       ← DomainApp product page with plans
│   │   │   ├── domain-campaign/  ← DomainCampaign product page with plans
│   │   │   ├── pricing/          ← All 4 plans side by side
│   │   │   ├── industries/       ← 20 industries with demo booking
│   │   │   ├── book-demo/        ← Booking form (consultant call flow)
│   │   │   ├── portfolio/        ← Live MR Travels link + other clients
│   │   │   └── ...               ← All other pages updated
│   │   ├── dashboard/            ← Vendor dashboard (post-login)
│   │   │   ├── page.tsx          ← Dashboard home
│   │   │   ├── domain-app/       ← Manage DomainApp subscription
│   │   │   ├── domain-campaign/  ← Add / manage DomainCampaign
│   │   │   ├── billing/          ← Pay via Razorpay (UI ready, SDK in Phase 2)
│   │   │   ├── invoices/         ← View all invoices
│   │   │   ├── notifications/
│   │   │   ├── support/          ← Raise tickets
│   │   │   └── settings/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── components/               ← All components updated
│   └── data/content.ts           ← 20 industries, correct pricing, updated copy
├── Dockerfile
├── docker-compose.yml
├── nginx-get4domain.conf
└── next.config.ts                ← standalone output mode for Docker
```

---

## Step 1 — Push to GitHub

```bash
# On your local machine
cd get4domain_mvp
git init
git remote add origin https://github.com/ksmwebservices/get4domain.git
git add .
git commit -m "feat: MVP launch — marketing site + vendor dashboard"
git push origin main
```

---

## Step 2 — SSH into VM

```bash
ssh your_user@34.14.130.68
```

---

## Step 3 — Clone / Pull

```bash
# First time
cd /srv
git clone https://github.com/ksmwebservices/get4domain.git get4domain
cd get4domain

# Or if already cloned
cd /srv/get4domain && git pull
```

---

## Step 4 — Docker Build & Run

**IMPORTANT: MR Travels runs on port 3000. Get4Domain uses port 3001.**

```bash
cd /srv/get4domain

# Build (takes 3-5 minutes)
docker compose build --no-cache

# Run in background
docker compose up -d

# Verify it's running
docker compose ps
docker compose logs frontend --tail=20
```

---

## Step 5 — Nginx Configuration

```bash
# Copy the nginx config
sudo cp nginx-get4domain.conf /etc/nginx/sites-available/get4domain

# Enable it
sudo ln -sf /etc/nginx/sites-available/get4domain /etc/nginx/sites-enabled/

# Test config
sudo nginx -t

# Reload (does NOT affect MR Travels)
sudo systemctl reload nginx
```

---

## Step 6 — Cloudflare DNS

Add these DNS records in Cloudflare:

| Type | Name           | Value         | Proxy |
|------|----------------|---------------|-------|
| A    | get4domain.com | 34.14.130.68  | ✓     |
| A    | www            | 34.14.130.68  | ✓     |

SSL: Cloudflare handles it automatically (Full Strict mode).

---

## Step 7 — Verify

Visit these URLs and confirm they load:

- `https://get4domain.com` → Home page ✓
- `https://get4domain.com/domain-app` → DomainApp page ✓
- `https://get4domain.com/domain-campaign` → DomainCampaign page ✓
- `https://get4domain.com/pricing` → Pricing page ✓
- `https://get4domain.com/industries` → 20 industries ✓
- `https://get4domain.com/book-demo` → Booking form ✓
- `https://get4domain.com/dashboard` → Vendor dashboard ✓
- `https://mrtravels.get4domain.com` → MR Travels still works ✓

---

## What's Live After Monday

### Marketing Site
- Professional home page (no "24 hours" promise — "Professional Business Launch Made Easy")
- DomainApp page — all features, Startup & Enterprise plans with correct pricing
- DomainCampaign page — managed marketing, Starter & Business plans
- Pricing page — all 4 plans side by side with GST note
- 20 industries with Live Demo badge for Travel (links to MR Travels)
- Book Demo form — consultant call flow, no payment at this stage
- Portfolio with live MR Travels link
- Updated testimonials with product badges (DomainApp Enterprise, etc.)

### Vendor Dashboard
- Post-login dashboard (mock data — real auth in Phase 2)
- DomainApp management with module status
- DomainCampaign upsell with plan picker
- **Billing page with Razorpay payment UI** (SDK wiring in Phase 2)
- Invoice list with GST breakdown
- Support ticket form
- Settings / profile page

---

## Revenue Flow (Current MVP)

```
Prospect visits get4domain.com
        ↓
Books Demo → /book-demo (form captured, consultant calls)
        ↓
Consultant discusses requirements, sends payment link manually
        ↓
Client logs in → /dashboard/billing → pays via Razorpay
        ↓
Consultant activates subscription manually
        ↓
Phase 2: fully automated
```

---

## Pricing Implemented

| Product              | Half Year   | Yearly      |
|----------------------|-------------|-------------|
| DomainApp Startup    | ₹3,999      | ₹6,999      |
| DomainApp Enterprise | ₹13,999     | ₹24,999     |
| DomainCampaign Starter | ₹3,999    | ₹6,999      |
| DomainCampaign Business | ₹16,999  | ₹29,999     |

---

## What NOT to Touch

- `mrtravels.get4domain.com` — MR Travels frontend (port 3000)
- `api.get4domain.com` — MR Travels NestJS backend (port 3002)
- Supabase MR Travels database tables

---

## Phase 2 — Next Week

1. NestJS backend for Get4Domain auth (register, login, JWT)
2. Book Demo form → saves to DB → sends WhatsApp confirmation
3. Razorpay SDK integration → auto-generate invoice on payment
4. Admin panel to manage demo bookings and activate subscriptions

---

## Need Help?

Port conflict check:
```bash
sudo netstat -tlnp | grep -E '3000|3001|3002'
```

Container logs:
```bash
docker compose logs frontend -f
```

Nginx logs:
```bash
sudo tail -f /var/log/nginx/error.log
```
