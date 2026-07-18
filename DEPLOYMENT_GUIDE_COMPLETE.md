# GET4DOMAIN — Complete Deployment Guide
## Where to Put Files + How to Deploy Live + Auth Setup

---

## PART 1 — WHERE TO PUT THE FILES ON YOUR LOCAL PC

### Your current local folder: `C:\Get4Domain`

```
C:\Get4Domain\
├── .claude
├── .git
├── .github
├── assets
├── backend              ← MR Travels NestJS backend (untouched)
├── BACKUPS
├── CLIENT_PROJECTS\
│   ├── HOSPITAL
│   ├── HR
│   ├── REAL_ESTATE
│   ├── RESTAURANT
│   └── TRAVEL           ← MR Travels source
├── database
├── deployment
├── docs
├── engineering\
│   ├── checklists
│   ├── coding-standards
│   ├── docker-base
│   ├── industry-reference
│   ├── prompts
│   └── templates
├── frontend             ← MR Travels frontend (UNTOUCHED)
├── logs
├── scripts
├── shared
├── SHARED_LIBRARIES
├── testing
├── TOOLS
└── uploads
```

### What to do with the new ZIP (get4domain_mvp_monday.zip)

**Create a new folder INSIDE C:\Get4Domain:**

```
C:\Get4Domain\
└── get4domain-site\         ← NEW FOLDER — create this
    └── (extract zip contents here)
```

**Steps:**
1. Create folder `C:\Get4Domain\get4domain-site`
2. Extract `get4domain_mvp_monday.zip` INTO that folder
3. After extraction you should see:
```
C:\Get4Domain\get4domain-site\
├── src\
├── public\
├── Dockerfile
├── docker-compose.yml
├── nginx-get4domain.conf
├── next.config.ts
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── .env.local.example    ← IMPORTANT
```

---

## PART 2 — SET UP YOUR REAL LOGIN CREDENTIALS

**Before any deployment, set your real passwords:**

1. In `C:\Get4Domain\get4domain-site`, copy `.env.local.example` → rename to `.env.local`
2. Open `.env.local` and fill in your real values:

```env
# Your admin login for /admin panel
NEXT_PUBLIC_ADMIN_EMAIL=admin@get4domain.in
NEXT_PUBLIC_ADMIN_PASSWORD=YourStrongAdminPassword123!
NEXT_PUBLIC_ADMIN_NAME=Get4Domain Admin

# MR Travels client login for /dashboard
NEXT_PUBLIC_VENDOR_1_EMAIL=muthukumar@mrtravels.com
NEXT_PUBLIC_VENDOR_1_PASSWORD=MRTravels2026Strong!
NEXT_PUBLIC_VENDOR_1_NAME=Muthukumar R
NEXT_PUBLIC_VENDOR_1_BUSINESS=MR Travels
NEXT_PUBLIC_VENDOR_1_PLAN=DomainApp Enterprise

# Your actual contact details
NEXT_PUBLIC_PHONE=+91XXXXXXXXXX
NEXT_PUBLIC_EMAIL=hello@get4domain.in
NEXT_PUBLIC_WHATSAPP=91XXXXXXXXXX
NEXT_PUBLIC_SITE_URL=https://get4domain.in
```

**Password rules for production:**
- Minimum 12 characters
- Mix of uppercase, lowercase, numbers, symbols
- Different password for admin and each vendor
- NEVER use: demo1234, admin1234, password, 123456

**`.env.local` is in `.gitignore` — it will NEVER be pushed to GitHub automatically.**

---

## PART 3 — PUSH TO YOUR EXISTING GITHUB REPO

Your GitHub repo: `https://github.com/ksmwebservices/get4domain`

Looking at your repo (Image 4), it already has: backend, frontend, CLIENT_PROJECTS etc.

**You need to push ONLY the new site folder. Two options:**

### Option A — Push to a new branch (RECOMMENDED, safe)

Open Windows PowerShell or Git Bash, go to the get4domain-site folder:

```powershell
cd C:\Get4Domain\get4domain-site

# Initialize git in this folder
git init
git remote add origin https://github.com/ksmwebservices/get4domain.git

# Create a new branch — does NOT affect your existing main branch
git checkout -b get4domain-site

# Add all files EXCEPT .env.local
git add .
git status   # verify .env.local is NOT listed

# Commit
git commit -m "feat: Get4Domain marketing site + vendor dashboard + admin panel"

# Push to new branch
git push origin get4domain-site
```

### Option B — Push to a subfolder on main (if you want everything together)

```powershell
# From C:\Get4Domain root
cd C:\Get4Domain

# Create subfolder and copy files
mkdir get4domain-site
# (paste/copy the extracted files into get4domain-site\)

git add get4domain-site/
git commit -m "feat: Add Get4Domain marketing site"
git push origin main
```

---

## PART 4 — DEPLOY TO YOUR GOOGLE CLOUD VM

**VM Details:**
- IP: 34.14.130.68
- Region: asia-south1-c
- MR Travels already running on: port 3000 (frontend) + port 3002 (backend)
- Get4Domain site will run on: **port 3001**

### Step 4.1 — SSH into VM

```bash
ssh your_username@34.14.130.68
```

### Step 4.2 — Create site folder on VM

```bash
sudo mkdir -p /srv/get4domain-site
sudo chown $USER:$USER /srv/get4domain-site
cd /srv/get4domain-site
```

### Step 4.3 — Clone from GitHub

```bash
# Clone the branch you pushed
git clone -b get4domain-site https://github.com/ksmwebservices/get4domain.git .

# Verify files are there
ls -la
```

### Step 4.4 — Create .env.local on the VM

**IMPORTANT: Do NOT push .env.local to GitHub. Create it directly on the VM:**

```bash
nano /srv/get4domain-site/.env.local
```

Paste your credentials (same as your local .env.local), then Ctrl+X → Y → Enter to save.

### Step 4.5 — Build and run with Docker

```bash
cd /srv/get4domain-site

# Build the Docker image (takes 3-5 minutes first time)
docker compose build --no-cache

# Run in background
docker compose up -d

# Check it's running
docker compose ps
```

Expected output:
```
NAME                    STATUS          PORTS
get4domain_frontend     Up              0.0.0.0:3001->3001/tcp
```

### Step 4.6 — Test locally on VM before opening to internet

```bash
curl http://localhost:3001
# Should return HTML with Get4Domain content
```

### Step 4.7 — Add Nginx vhost

```bash
sudo cp /srv/get4domain-site/nginx-get4domain.conf /etc/nginx/sites-available/get4domain

sudo ln -sf /etc/nginx/sites-available/get4domain /etc/nginx/sites-enabled/get4domain

# Test Nginx config — IMPORTANT, do this before reload
sudo nginx -t

# If test passes, reload (does NOT affect MR Travels)
sudo systemctl reload nginx
```

### Step 4.8 — Cloudflare DNS

Log into Cloudflare → Your domain → DNS:

| Type | Name          | Content       | Proxy status |
|------|---------------|---------------|--------------|
| A    | @             | 34.14.130.68  | Proxied ✓   |
| A    | www           | 34.14.130.68  | Proxied ✓   |
| A    | mrtravels     | 34.14.130.68  | Proxied ✓   |

*(mrtravels subdomain should already be there — don't change it)*

### Step 4.9 — Verify everything works

```bash
# Check both sites are running
curl http://localhost:3001   # Get4Domain
curl http://localhost:3000   # MR Travels (should still work)
```

Visit in browser:
- https://get4domain.in → Home page
- https://get4domain.in/domain-app
- https://get4domain.in/industries
- https://get4domain.in/login → login with your credentials
- https://get4domain.in/dashboard → vendor dashboard
- https://get4domain.in/admin → admin dashboard (dark)
- https://mrtravels.get4domain.com → MR Travels (still working)
- https://get4domain.in/sitemap.xml → shows all 62 pages
- https://get4domain.in/robots.txt → blocks dashboard/admin

---

## PART 5 — UPDATE DEPLOYMENTS (after changes)

Every time you make changes:

```bash
# On your local PC: commit and push
cd C:\Get4Domain\get4domain-site
git add .
git commit -m "your change description"
git push origin get4domain-site

# On VM: pull and rebuild
cd /srv/get4domain-site
git pull origin get4domain-site
docker compose build --no-cache
docker compose up -d
```

---

## PART 6 — AUTH SETUP (What you have now + Google OAuth later)

### What's live NOW (credential-based login)

**How it works:**
1. You set credentials in `.env.local` on the VM
2. When someone visits `/login`, they enter email + password
3. System checks against your env vars
4. Admin email → redirects to `/admin` (dark dashboard)
5. Vendor email → redirects to `/dashboard` (vendor panel)

**To add a new client after they sign up:**
1. SSH into VM
2. Edit `.env.local`: add VENDOR_2, VENDOR_3 etc.
3. Rebuild: `docker compose build --no-cache && docker compose up -d`

**This is the right approach for your first 10-20 clients.**

### Google OAuth (add this when you have more clients)

Google OAuth is better when you have many clients who need self-service login.
For now (MVP with manual onboarding), credential login is simpler and more controlled.

**When to add Google/Facebook login:**
- When clients want to log in without you setting their password
- When you have more than 20 vendors
- After you build the NestJS backend (Task 5.3 in TASK_SEQUENCE.md)

**Cost comparison:**
- Credential login (current): FREE, full control, you manage passwords
- Google OAuth: FREE, easier for clients, needs NextAuth.js setup
- Facebook OAuth: FREE, some clients prefer it, needs Meta app approval

**Recommendation: Stick with credential login for production MVP. Add Google OAuth in the next sprint after backend is live.**

---

## PART 7 — CLAUDE CODE PROMPT (to run in Claude Code)

If you want to continue development in Claude Code, use this prompt:

```
You are working on the Get4Domain platform at C:\Get4Domain\get4domain-site

Tech stack: Next.js 15, Tailwind CSS, TypeScript, no backend yet
Deployed at: https://get4domain.in (port 3001 on Google Cloud VM)
MR Travels (separate): https://mrtravels.get4domain.com (port 3000, DO NOT TOUCH)
GitHub: https://github.com/ksmwebservices/get4domain (branch: get4domain-site)

Current state:
- 62 static pages built and deployed
- Marketing site: home, domain-app, domain-campaign, pricing, industries (20), book-demo
- Individual industry pages: /industries/[id] for all 20 industries with full content
- Vendor dashboard: /dashboard (8 pages, auth-guarded)
- Admin panel: /admin (6 pages, dark theme)
- Auth: credential-based via .env.local (no backend yet)
- SEO: sitemap.xml, robots.txt, JSON-LD structured data

Auth credentials are in .env.local (never committed to git)
Admin: NEXT_PUBLIC_ADMIN_EMAIL / NEXT_PUBLIC_ADMIN_PASSWORD
Vendors: NEXT_PUBLIC_VENDOR_1_EMAIL through VENDOR_20_*

Key files:
- src/data/content.ts — industries, testimonials, FAQs
- src/data/industry-content.ts — detailed content for all 20 industry pages
- src/lib/auth.ts — credential auth against env vars
- src/constants/site.ts — site config, nav links

Do NOT modify anything related to MR Travels.
Do NOT push .env.local to GitHub.
Always run npm run build before considering any task complete.
```

---

## PART 8 — WHAT TO STORE IN CLIENT_PROJECTS FOLDER

Your `C:\Get4Domain\CLIENT_PROJECTS\` folder — use it like this:

```
CLIENT_PROJECTS\
├── TRAVEL\
│   └── MR_TRAVELS_001\       ← existing MR Travels ERP
│       ├── requirements\
│       ├── design\
│       └── handover\
├── RESTAURANT\
│   └── (next restaurant client goes here)
├── HOSPITAL\
│   └── (next hospital client goes here)
├── REAL_ESTATE\
│   └── (next real estate client goes here)
└── HR\
    └── (HR software client)
```

Each new client gets a folder named: `BUSINESSNAME_001`, `BUSINESSNAME_002` etc.

---

## QUICK REFERENCE — Ports on VM

| Service              | Port | URL                                |
|----------------------|------|------------------------------------|
| Get4Domain Site      | 3001 | https://get4domain.in              |
| MR Travels Frontend  | 3000 | https://mrtravels.get4domain.com   |
| MR Travels Backend   | 3002 | https://api.get4domain.com         |
| Get4Domain API (future) | 3003 | https://gapi.get4domain.in      |

---

## QUICK REFERENCE — Login URLs

| URL                        | Who uses it         | Redirects to   |
|----------------------------|---------------------|----------------|
| https://get4domain.in/login | Admin + all vendors | /admin or /dashboard |
| https://get4domain.in/admin | Admin only          | Admin panel    |
| https://get4domain.in/dashboard | Vendors only   | Vendor panel   |
