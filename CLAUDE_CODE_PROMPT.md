# GET4DOMAIN — Claude Code Master Prompt
# Paste this entire prompt when you open Claude Code

---

You are working on the **Get4Domain** SaaS platform.

## Working Directory
The project is at: `C:\Get4Domain\get4domain-site\get4domain_mvp`

This is a Next.js 15 + Tailwind CSS + TypeScript project — NO backend yet.

## What Has Already Been Built (DO NOT REBUILD)
- 62 static pages, all building with zero errors
- Marketing site: home, /domain-app, /domain-campaign, /pricing, /industries, /book-demo, /portfolio, /contact, /how-it-works, /support
- Individual industry pages: /industries/[id] for 20 industries — restaurant, travel, healthcare, education, realestate, retail, beauty, fitness, construction, professional, events, finance, automobile, logistics, diagnostics, hotel, photography, technology, agriculture, coaching
- Vendor dashboard: /dashboard (8 pages — home, domain-app, domain-campaign, billing, invoices, notifications, support, settings)
- Admin panel: /admin (6 pages — home, leads, customers, invoices, plans, support, settings) — dark theme
- Auth: credential-based via .env.local environment variables
- SEO: sitemap.xml, robots.txt, JSON-LD structured data (Organization + SoftwareApplication)
- PWA manifest

## Key Files
- `src/data/content.ts` — 20 industries, testimonials, FAQs, addons
- `src/data/industry-content.ts` — detailed content for all 20 industry landing pages
- `src/lib/auth.ts` — credential auth against NEXT_PUBLIC_* env vars
- `src/lib/auth-context.tsx` — React auth context provider
- `src/constants/site.ts` — site config, nav links
- `src/app/layout.tsx` — root layout with AuthProvider + JSON-LD
- `src/app/(marketing)/layout.tsx` — marketing layout with Header + Footer
- `src/app/dashboard/layout.tsx` — vendor dashboard layout (auth-guarded, redirects to /login)
- `src/app/admin/layout.tsx` — admin layout (auth-guarded, dark theme)

## Auth System
- `.env.local.example` exists — user must copy it to `.env.local` and fill real passwords
- Admin login: NEXT_PUBLIC_ADMIN_EMAIL + NEXT_PUBLIC_ADMIN_PASSWORD → redirects to /admin
- Vendor login: NEXT_PUBLIC_VENDOR_1_EMAIL through VENDOR_20_* → redirects to /dashboard
- localStorage-based session (no backend yet)

## Live Infrastructure
- MR Travels frontend: https://mrtravels.get4domain.com (port 3000) — DO NOT TOUCH
- MR Travels backend: https://api.get4domain.com (port 3002) — DO NOT TOUCH
- Get4Domain site will deploy to: https://get4domain.in (port 3001)
- Google Cloud VM: 34.14.130.68 (asia-south1-c)
- GitHub: https://github.com/ksmwebservices/get4domain

## Deployment Files Ready
- `Dockerfile` — multi-stage Node 20 Alpine, port 3001, standalone output
- `docker-compose.yml` — service: get4domain_frontend, port 3001
- `nginx-get4domain.conf` — Nginx vhost for get4domain.com/get4domain.in → port 3001

## Design System
- Primary color: blue (#2563eb = primary-600)
- Secondary color: orange (#f97316 = secondary-500)
- Tailwind custom config: primary, secondary, success, warning, error color scales
- CSS classes: .card-base, .card-hover, .section-py, .container-mx, .container-px, .gradient-text, .glass
- Font: system-ui / sans-serif (Google Fonts removed for build reliability)
- Animations: fade-in, fade-in-up, slide-down, scale-in, float

## Pricing (DO NOT CHANGE without instruction)
- DomainApp Startup: ₹3,999 (6mo) / ₹6,999 (yearly)
- DomainApp Enterprise: ₹13,999 (6mo) / ₹24,999 (yearly)
- DomainCampaign Starter: ₹3,999 (6mo) / ₹6,999 (yearly)
- DomainCampaign Business: ₹16,999 (6mo) / ₹29,999 (yearly)

## GST Context
- India GST compliant platform
- Passenger transport (Travel): CGST 2.5% + SGST 2.5% intrastate, IGST 5% interstate
- General services: 18% GST
- SAC code 996412 for passenger transport

## Hard Rules
1. NEVER modify anything in C:\Get4Domain\frontend (old Bolt, separate from MVP)
2. NEVER push .env.local to GitHub — it is in .gitignore
3. ALWAYS run `npm run build` before saying any task is complete
4. NEVER break existing pages — add new pages, don't change working ones
5. Keep Prisma pinned at 6.19.3 if ever added
6. DO NOT add Google Fonts — use system fonts only (build environment blocks Google)
7. Port 3001 for Get4Domain, NEVER use 3000 (MR Travels) or 3002 (MR Travels API)

## Current Task — START HERE

**TASK 1: Verify the build works locally**
Run these commands in the get4domain_mvp directory:
```
npm install
npm run build
```
If build passes (should show 62 pages, 0 errors), proceed to Task 2.

**TASK 2: Create .env.local**
Copy `.env.local.example` to `.env.local` and update with real credentials:
- Set NEXT_PUBLIC_ADMIN_EMAIL to your real admin email
- Set NEXT_PUBLIC_ADMIN_PASSWORD to a strong password (min 12 chars)
- Set NEXT_PUBLIC_VENDOR_1_* for MR Travels (Muthukumar's login)
- Set NEXT_PUBLIC_PHONE, NEXT_PUBLIC_EMAIL, NEXT_PUBLIC_WHATSAPP with real contact details

**TASK 3: Test locally**
```
npm run dev
```
Open http://localhost:3000 and verify:
- Home page loads
- /login page works with the credentials you set in .env.local
- /dashboard redirects if not logged in
- /admin redirects if not logged in
- /industries shows all 20 industries
- /industries/travel shows travel industry detail page

**TASK 4: Git setup and push**
```
git init
git remote add origin https://github.com/ksmwebservices/get4domain.git
git checkout -b get4domain-site
git add .
git status   (verify .env.local is NOT in the list)
git commit -m "feat: Get4Domain MVP - 62 pages, vendor dashboard, admin panel, 20 industries"
git push -u origin get4domain-site
```

**TASK 5: Deploy to VM**
SSH into 34.14.130.68 and run:
```bash
sudo mkdir -p /srv/get4domain-site
cd /srv/get4domain-site
git clone -b get4domain-site https://github.com/ksmwebservices/get4domain.git .
nano .env.local   # paste your .env.local content here
docker compose build --no-cache
docker compose up -d
docker compose ps
curl http://localhost:3001
```

**TASK 6: Nginx + DNS**
```bash
sudo cp nginx-get4domain.conf /etc/nginx/sites-available/get4domain
sudo ln -sf /etc/nginx/sites-available/get4domain /etc/nginx/sites-enabled/get4domain
sudo nginx -t
sudo systemctl reload nginx
```
Then add DNS in Cloudflare:
- A record: @ → 34.14.130.68 (proxied)
- A record: www → 34.14.130.68 (proxied)

After DNS propagation, verify:
- https://get4domain.in loads
- https://mrtravels.get4domain.com still works

---

## After Deployment — Next Development Tasks (in order)

### NEXT-1: Add WhatsApp floating button to marketing site
Add to `src/app/(marketing)/layout.tsx` — a fixed green button bottom-right linking to wa.me/{number}

### NEXT-2: Update real contact details
In `src/constants/site.ts` and `src/components/Footer.tsx`:
- Replace placeholder phone, email, address with real details
- Replace social media # links with real profile URLs

### NEXT-3: Add About Us page
Create `src/app/(marketing)/about/page.tsx` with:
- Company story
- Team section
- Mission and vision
- Why Get4Domain

### NEXT-4: Book Demo form — save to Google Sheets (no backend needed)
Wire the /book-demo form to a Google Forms endpoint or Formspree to capture real leads
without needing a backend. Every demo booking goes to your email immediately.

### NEXT-5: Add Google Analytics
Add GA4 Measurement ID to layout.tsx as a Script tag

### NEXT-6: Real portfolio items
Update `src/data/content.ts` portfolioItems with:
- Real client screenshots (hosted on Cloudinary or similar)
- Real client URLs
- Real city and industry data

### NEXT-7: NestJS backend (when ready for real auth + payments)
Create new folder: C:\Get4Domain\get4domain-site\backend-api\
Tech: NestJS 11, Prisma 6.19.3 (pinned), PostgreSQL (Supabase), port 3003
Subdomain: gapi.get4domain.in
Modules needed: auth, users, organizations, demo-bookings, payments (Razorpay), invoices

---

## Important Context for All Future Tasks

The platform serves two products:
1. **DomainApp** — Business OS (website + CRM + HR + accounting + invoicing)
2. **DomainCampaign** — Managed digital marketing (we run their social media/SEO)

Target customers: Indian SMBs across 20+ industries
GST compliant. All prices in INR. Razorpay for payments (not Stripe).
Language: English (Tamil/Hindi support planned later).

MR Travels (mrtravels.get4domain.com) is the LIVE reference implementation of DomainApp Enterprise.
It proves the platform works. All new industry clients follow the same pattern.
