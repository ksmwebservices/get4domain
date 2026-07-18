# GET4DOMAIN — Task Sequence (No Timelines)
## Deploy → Promote → Build in Order

---

## BATCH 1 — DEPLOY & GO LIVE
*Do these in order. Each one depends on the previous.*

**Task 1.1 — Push code to GitHub**
```bash
cd get4domain_mvp
git init
git remote add origin https://github.com/ksmwebservices/get4domain.git
git add .
git commit -m "feat: MVP launch — marketing site + dashboards"
git push origin main
```

**Task 1.2 — Build and run Docker on VM**
```bash
ssh into 34.14.130.68
cd /srv && git clone https://github.com/ksmwebservices/get4domain.git get4domain
cd get4domain
docker compose build --no-cache
docker compose up -d
docker compose ps   # verify: get4domain_frontend is Up on port 3001
```

**Task 1.3 — Add Nginx vhost**
```bash
sudo cp nginx-get4domain.conf /etc/nginx/sites-available/get4domain
sudo ln -sf /etc/nginx/sites-available/get4domain /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

**Task 1.4 — Add Cloudflare DNS**
- A record: `get4domain.com` → `34.14.130.68` (proxied ✓)
- A record: `get4domain.in` → `34.14.130.68` (proxied ✓)
- A record: `www` → `34.14.130.68` (proxied ✓)

**Task 1.5 — Verify all URLs load**
- [ ] https://get4domain.in
- [ ] https://get4domain.in/domain-app
- [ ] https://get4domain.in/domain-campaign
- [ ] https://get4domain.in/pricing
- [ ] https://get4domain.in/industries
- [ ] https://get4domain.in/book-demo
- [ ] https://get4domain.in/login → logs in with demo creds
- [ ] https://get4domain.in/dashboard → redirects to login if not authenticated
- [ ] https://get4domain.in/admin → admin dashboard (dark theme)
- [ ] https://mrtravels.get4domain.com → MR Travels still works ✓
- [ ] https://get4domain.in/sitemap.xml → lists all pages
- [ ] https://get4domain.in/robots.txt → blocks dashboard/admin

---

## BATCH 2 — SEO & GOOGLE MY BUSINESS SETUP
*Do after site is live. All these are independent, do in any order.*

**Task 2.1 — Google Search Console**
- Go to https://search.google.com/search-console
- Add property: `https://get4domain.in`
- Verify via HTML tag → paste code in `src/app/layout.tsx` where the comment says `YOUR_VERIFICATION_CODE`
- Redeploy after adding verification code
- Submit sitemap: `https://get4domain.in/sitemap.xml`

**Task 2.2 — Google My Business (GMB) / Google Business Profile**
- Go to https://business.google.com
- Create profile for **Get4Domain**
- Business category: "Software Company" or "Internet Marketing Service"
- Address: Chennai, Tamil Nadu, India
- Phone: your number
- Website: https://get4domain.in
- Add photos: logo, office/team photos, service images
- Write business description (use copy from the site's about section)
- Verify via postcard or phone

**Task 2.3 — Google Analytics 4**
- Go to https://analytics.google.com
- Create property for `get4domain.in`
- Copy Measurement ID (G-XXXXXXXXXX)
- Add to `src/app/layout.tsx` as a `<Script>` tag
- Redeploy

**Task 2.4 — Update real contact details in code**
In `src/constants/site.ts` replace:
- Phone: your actual number
- Email: your actual email
- Address: your actual address
- Social links: actual social profile URLs

**Task 2.5 — Create and upload logo/favicon**
- Create `logo.png` (for structured data / OG image)
- Create `icon-192.png` and `icon-512.png` (for PWA manifest)
- Create `favicon.ico`
- Upload to `public/` folder in the repo
- These are referenced in layout.tsx and manifest.ts already

**Task 2.6 — Set up WhatsApp Business**
- Activate WhatsApp Business on your business number
- Update the WhatsApp link in `src/constants/site.ts` → `social.whatsapp`
- Add WhatsApp floating button to the marketing site (Task 4.1 below)

**Task 2.7 — Create social media profiles**
- Facebook: @get4domain
- Instagram: @get4domain
- LinkedIn: /company/get4domain
- YouTube: Get4Domain channel
- Update URLs in `src/constants/site.ts` → `social.*`
- Update Footer component with real hrefs

---

## BATCH 3 — PROMOTION LAUNCH
*Do after Batch 2 is complete.*

**Task 3.1 — First GMB post**
- Go to your Google Business Profile
- Add first post: "Get4Domain is now live! Professional Business Launch Made Easy."
- Add your website link and Book Demo CTA

**Task 3.2 — Share site on social media**
- LinkedIn: post about the launch, tag relevant industries
- Instagram: post product screenshots or video walkthrough
- Facebook: create a page post and boost it

**Task 3.3 — List on Indian business directories**
- JustDial: list Get4Domain as a software company
- IndiaMART: list your services
- Sulekha: list digital services
- Clutch.co: create a software company profile

**Task 3.4 — WhatsApp broadcast**
- Send launch announcement to existing contacts
- Share the website link and Book Demo CTA

**Task 3.5 — Email announcement**
- Send to all existing contacts and leads
- Subject: "Get4Domain is Live — Professional Business Launch Made Easy"
- Include link to https://get4domain.in/book-demo

---

## BATCH 4 — SITE ENHANCEMENTS (do after live + promotion)
*These improve conversion. Do in order.*

**Task 4.1 — WhatsApp floating button**
Add to `src/app/(marketing)/layout.tsx`:
```jsx
<a href="https://wa.me/91XXXXXXXXXX" target="_blank"
  className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-green-500 shadow-lg hover:bg-green-600 transition-colors">
  <MessageCircle className="h-7 w-7 text-white" />
</a>
```

**Task 4.2 — Add real portfolio/client logos**
- Replace Pexels images in `src/data/content.ts` → `portfolioItems`
- Add actual client screenshots as portfolio items
- Add MR Travels logo to portfolio

**Task 4.3 — Add About Us page**
- Create `src/app/(marketing)/about/page.tsx`
- Add to sitemap, footer, nav

**Task 4.4 — Add Blog section**
- Create `src/app/(marketing)/blog/page.tsx`
- Write first 3 articles targeting: "business website india", "GST invoice software", "managed social media india"

**Task 4.5 — Industry-specific landing pages**
- Create `/industries/travel`, `/industries/restaurant` etc.
- Each page targets local search keywords
- "Travel business website in Chennai", "Restaurant website management"
- Add these URLs to sitemap

---

## BATCH 5 — BACKEND INTEGRATION (after frontend is fully stable)
*These make the platform fully functional without manual work.*

**Task 5.1 — Create NestJS backend**
- New repo: `ksmwebservices/get4domain-api`
- Port: 3003 (separate from MR Travels api on 3002)
- Subdomain: `gapi.get4domain.in`
- Modules: auth, users, organizations, demo-bookings

**Task 5.2 — Wire Book Demo form to backend**
- `POST /demo-bookings` → saves to DB
- Triggers WhatsApp message via your WhatsApp Business API
- Sends confirmation email to prospect
- Sends admin notification with prospect details

**Task 5.3 — Wire login to real JWT auth**
- Replace `loginWithCredentials()` in `src/lib/auth.ts`
- Call `POST gapi.get4domain.in/auth/login`
- Store JWT in httpOnly cookie (not localStorage)
- Add middleware.ts for route protection

**Task 5.4 — Razorpay integration**
- Create Razorpay account at razorpay.com
- Add `NEXT_PUBLIC_RAZORPAY_KEY` to `.env`
- Wire billing page's Pay button to Razorpay SDK
- Backend webhook: `POST /payments/razorpay-webhook` → activate subscription

**Task 5.5 — Auto-generate invoice after payment**
- On successful Razorpay payment → create invoice record
- Generate PDF using existing MR Travels PDF pattern
- Email PDF to customer
- Show in `/dashboard/invoices`

**Task 5.6 — Admin activates subscription**
- After payment confirmed → admin clicks "Activate" in admin panel
- Sets subscription status to active
- Customer dashboard updates automatically

---

## BATCH 6 — ADMIN ENHANCEMENTS (after Batch 5)

**Task 6.1 — Real data in admin dashboard**
- Connect admin overview stats to database
- Real customer count, real revenue, real pending invoices

**Task 6.2 — Demo booking auto-notifications to admin**
- When someone submits Book Demo form → WhatsApp to admin phone
- Email to admin with all lead details

**Task 6.3 — Plan management UI**
- Admin can edit plan prices from dashboard (no code change needed)
- Admin can create custom plans for specific clients

**Task 6.4 — Customer onboarding flow**
- After admin activates subscription → auto-email to customer
- Customer gets login credentials
- Customer dashboard shows their specific modules

---

## DEMO LOGIN CREDENTIALS (current MVP)

| Role       | Email                    | Password   | Redirects to    |
|------------|--------------------------|------------|-----------------|
| Client     | client@mrtravels.com     | demo1234   | /dashboard      |
| Admin      | admin@get4domain.in      | admin1234  | /admin          |

*Remove these hardcoded credentials before going live with real customers.*
*Replace with real auth in Task 5.3.*

---

## CURRENT BUILD STATUS
- 44 pages built, zero errors
- sitemap.xml ✓ robots.txt ✓ JSON-LD structured data ✓
- Login with role-based redirect ✓ (vendor → /dashboard, admin → /admin)
- Vendor dashboard: 8 pages ✓
- Admin dashboard: 6 pages ✓ (dark theme)
- MR Travels: completely untouched ✓
