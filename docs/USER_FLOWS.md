# GET4DOMAIN — USER FLOWS
# Version 2.0 | July 2026

---

## FLOW 1: PROSPECT → PAYING CLIENT

```
STEP 1: Discovery
  Prospect finds get4domain.com
  Reads about DomainCampaign or DomainApp
  Clicks "Book a Demo"

STEP 2: Book Demo Form
  Fills: Name, Phone, Email, Business, Industry
  Selects: DomainCampaign / DomainApp / Both
  Submits form
  → Saved to g4d_leads table
  → Admin gets push notification + WhatsApp alert

STEP 3: Sales Call (our team)
  Admin opens Demo Bookings in admin dashboard
  Calls prospect
  Discusses requirements
  Updates lead status: pending → called → converted

STEP 4: Onboarding
  Admin creates vendor account in admin dashboard
  System auto-sends welcome email:
    Login URL, email, password
    Via Resend
  
STEP 5: Payment
  Admin creates invoice in admin dashboard
  Sends Razorpay payment link to vendor
  Vendor pays via UPI/Card/NetBanking
  Razorpay webhook fires
  Invoice marked PAID automatically
  Subscription activated
  Income recorded in our accounting
  PDF invoice emailed to vendor

STEP 6: Vendor Active
  Vendor logs into get4domain.com/login
  Redirected to their dashboard
  Onboarding checklist shown
```

---

## FLOW 2: CAMPAIGN CREATION

```
STEP 1: Vendor request
  Vendor opens dashboard → Campaigns
  Clicks "Create Campaign"
  
  OR
  
  AI reminds vendor:
  "Diwali is in 7 days — shall we create an offer campaign?"
  Vendor clicks YES

STEP 2: Campaign brief
  Vendor fills:
  - What to promote: "Our Ooty 3N/4D tour ₹8,500"
  - Target audience: "Families in Chennai"
  - Campaign period: 15 Oct - 25 Oct

STEP 3: Channel selection
  Vendor selects:
  ☑ Facebook organic post
  ☑ Instagram post
  ☐ Paid ads (skip for now)
  ☑ WhatsApp broadcast
  ☐ SMS campaign
  
  System shows estimated wallet cost:
  "Facebook post: ₹10 | Instagram post: ₹10 | WhatsApp (50 contacts): ₹50"
  "Total estimated: ₹70"
  "Your wallet: ₹847"

STEP 4: Submit for approval
  Vendor clicks [Submit Campaign Request]
  Admin gets notification:
  "New campaign request from MR Travels — Ooty Tour Package"

STEP 5: Our team creates content (within 24 hours)
  Campaign Manager opens admin dashboard → Campaigns
  Reviews brief
  Uses AI to generate:
    Facebook post caption + image (Claude + DALL-E)
    Instagram post caption + image
    WhatsApp message template
  Reviews and refines content

STEP 6: Send for vendor approval
  System sends notification to vendor:
  "Your Ooty campaign content is ready for approval"
  
  Vendor opens dashboard
  Previews each piece of content:
    Facebook post preview
    Instagram post preview
    WhatsApp message preview
  
  Vendor clicks [Approve All] or [Request Changes]

STEP 7: Execution
  After vendor approval:
  System deducts wallet: ₹70
  
  Campaign Manager executes:
  - Posts to Facebook page (via page access)
  - Posts to Instagram (via page access)
  - Sends WhatsApp broadcast (via vendor's WA API)
  
  System logs each action with timestamp

STEP 8: Analytics
  Vendor sees in dashboard:
  - Post reach (from Facebook API)
  - Leads generated (from landing page)
  - WhatsApp delivered count
  
  Monthly report auto-generated and available for download
```

---

## FLOW 3: LEAD MANAGEMENT (CRM + TeleCRM)

```
LEAD COMES IN (multiple sources)

Source A: Campaign landing page
  Customer visits get4domain.com/go/mrtravels-ooty
  Fills name + phone + message
  Clicks Submit
  → Lead saved to g4d_campaign_leads
  → Vendor WhatsApp alert (₹1 from wallet):
    "🔔 New Lead
    Name: Ramesh Kumar
    Phone: +91 98765 43210
    Page: Ooty Tour Package
    Time: 2:34 PM"

Source B: Social media click
  Customer clicks WhatsApp button on their post
  Vendor manually adds lead to CRM

Source C: Phone call
  Customer calls vendor directly
  Vendor adds lead manually in CRM

IN CRM:
  Lead appears in "New" tab
  Lead card shows:
    Name, phone, source, time since enquiry
    [Call] [WhatsApp] [Add Note] [Update Status]

IN TELECRM:
  Lead appears in "Today's Call Queue"
  Sorted by priority (newest first, overdue last)
  
  Vendor clicks [Call Now]
  Phone dials automatically (tap-to-call)
  
  After call, vendor updates:
  - Outcome: Interested / Not Interested / Callback / Won
  - Notes: "Wants Ooty package, budget ₹8,500, family of 4"
  - Follow-up date: "2026-07-22 at 10:00 AM"
  
  System sets reminder
  At 10:00 AM next day → push notification to vendor:
  "Follow-up: Ramesh Kumar, Ooty package enquiry"

LEAD CONVERSION:
  Vendor updates status to "Won"
  Creates quotation from CRM
  Sends via WhatsApp or Email
  Customer confirms
  Invoice created in BOS (if DomainApp) or manually
```

---

## FLOW 4: WALLET TOP-UP

```
STEP 1: Low balance
  Vendor opens dashboard
  Sees: "Wallet: ₹47 credits"
  
  OR
  
  System notification:
  "Your wallet balance is low (₹47). Top-up to continue campaigns."

STEP 2: Top-up
  Vendor goes to Wallet → Top-up
  
  Sees options:
  ┌─────────────────────────────────────────┐
  │ ₹999   → ₹1,100 credits  (+10% bonus) │
  │ ₹2,499 → ₹3,000 credits  (+20% bonus) │
  │ ₹4,999 → ₹6,500 credits  (+30% bonus) │
  │ [Custom amount]                         │
  └─────────────────────────────────────────┘
  
  Vendor selects ₹999

STEP 3: Payment
  Razorpay opens
  Vendor pays via UPI
  Payment confirmed

STEP 4: Credits added
  Wallet shows: ₹1,147 credits (₹47 + ₹1,100 new)
  GST invoice emailed
  Expiry: 90 days from today
  
  Transaction logged:
  "₹999 top-up → ₹1,100 credits added | Expires: 2026-10-19"
```

---

## FLOW 5: SUPPORT TICKET

```
STEP 1: Vendor raises ticket
  Dashboard → Support → Create Ticket
  
  Fills:
  Category: Website Change / Campaign / Billing / Technical / Other
  Subject: "Add our new Ooty package to website gallery"
  Description: "Please add 5 new photos of our Ooty tour..."
  Attachment: photo1.jpg, photo2.jpg
  
  Submits ticket

STEP 2: Notifications fire
  Admin gets:
  - Push notification on phone (FCM)
  - Email to admin@get4domain.com
  - Bell icon updates in admin dashboard
  
  Vendor gets:
  - Email: "Ticket #045 received, we respond in 24 hours"

STEP 3: AI pre-analysis
  Claude reads ticket
  Checks knowledge base
  If simple question (FAQ): AI drafts reply automatically
  Admin sees: "AI suggested reply: [preview] — Approve to send?"
  
  If complex task: AI just categorizes and routes
  Admin notified: "Action required — website update for MR Travels"

STEP 4: Admin responds
  Admin opens ticket in dashboard
  Types reply or approves AI reply
  Clicks Send Reply
  
  Vendor gets:
  - Email with reply
  - Push notification: "Support ticket #045 replied"

STEP 5: Resolved
  After update done:
  Admin marks ticket as Resolved
  Vendor gets: "Ticket #045 resolved — your Ooty photos are now live"
```

---

## FLOW 6: DOMAINAPP SUBSCRIPTION (Website + BOS)

```
STEP 1: Client enquires
  Calls or fills book-demo form
  Says they want travel website + booking management

STEP 2: Sales call
  We discuss:
  - How many vehicles do they have?
  - How many drivers?
  - Do they have existing website to migrate?
  - Which domain do they want?
  
  We quote:
  - Setup fee: ₹15,000 (travel BOS — already built, just customize)
  - Monthly: ₹2,999/month
  - Minimum: Quarter (₹8,997 first payment)

STEP 3: Payment
  Admin creates two invoices:
  - Invoice 1: ₹15,000 setup fee
  - Invoice 2: ₹8,997 first quarter
  
  Sends Razorpay links
  Client pays both

STEP 4: Onboarding
  Collect: logo, photos, service list, vehicle details
  Configure: MR Travels BOS template with their data
  Set up: subdomain (clientname.get4domain.com)
  
  Or if they have own domain:
  They change DNS → we configure Nginx

STEP 5: Go live (Day 5-7)
  Website live
  BOS admin panel ready at clientname.get4domain.com/admin
  Client logs in with credentials we send
  
  We do 30-min training call:
  - How to add bookings
  - How to create invoices
  - How to manage drivers
  - How to view reports

STEP 6: Ongoing
  Monthly: ₹2,999 invoice sent automatically
  Support: via ticket system
  Updates: via support ticket request
  
  If they want to add DomainCampaign:
  They top-up wallet ₹999
  We start managing their social media
```

---

## FLOW 7: TEAM INVITE

```
STEP 1: Owner invites team member
  Settings → Team → Invite Member
  
  Fills:
  Name: Suresh (Sales Manager)
  Email: suresh@mrtravels.com
  Role: Sales Person
  Modules: ☑ CRM ☑ TeleCRM ☐ Campaigns ☐ Wallet

STEP 2: Invite sent
  System sends email to suresh@mrtravels.com:
  
  "Hi Suresh,
  Jayachandran (MR Travels) has invited you to join
  their Get4Domain team as Sales Person.
  
  Click here to set your password and get started:
  [Accept Invitation]
  
  Your access is limited to: CRM and TeleCRM only."
  
  Also sends WhatsApp if phone provided

STEP 3: Team member accepts
  Clicks link → sets password
  Logs in to get4domain.com/login
  Sees limited dashboard:
  Only CRM and TeleCRM visible
  
  Cannot see: Campaigns, Wallet, Reports, Settings

STEP 4: Owner manages team
  Can see last login of each member
  Can change role anytime
  Can remove access anytime
  Activity log shows what each member did
```

---

## FLOW 8: ADMIN DASHBOARD — DAILY WORKFLOW

```
MORNING (9 AM):
  Admin opens get4domain.com/admin on phone (PWA)
  
  Overview shows:
  🔴 URGENT: 2 support tickets unread (24+ hours)
  🟡 PENDING: 3 campaign approvals waiting for our execution
  🟡 NEW: 1 demo booking from last night
  🟢 PAYMENT: Spice Garden paid ₹1,100 wallet top-up
  
  Admin handles:
  1. Calls demo booking prospect
  2. Reviews and executes 3 campaigns
  3. Replies to support tickets

AFTERNOON:
  Check renewals expiring this week
  Send reminders to clients
  Create renewal invoices
  
  Check campaign analytics
  Upload monthly reports for clients

EVENING:
  Review new leads generated for all clients
  Check AI notifications
  "MR Travels post got 245 reach today"
  "CareWell Clinic has 3 new leads"
```

---

## FLOW 9: CAMPAIGN PAGE (PUBLIC)

```
CREATION (vendor side):
  Dashboard → My Page → Edit
  AI generates content from their input
  Page goes live at get4domain.com/go/mrtravels

SHARING (vendor shares link):
  WhatsApp groups: "Check our Ooty package!"
  Instagram bio link
  Facebook post: "Book now →"
  SMS: "Special offer at get4domain.com/go/mrtravels"

CUSTOMER JOURNEY:
  Customer receives WhatsApp
  Clicks link → page opens on phone
  
  Sees full-screen professional page:
  → Hero: "Ooty 3N/4D | ₹8,500 per person"
  → Benefits: AC vehicle, hotel, breakfast...
  → Gallery: beautiful Ooty photos
  → Enquiry form: Name + Phone
  → [📞 Call] [💬 WhatsApp] buttons always visible
  
  Customer fills form
  Taps Submit
  
  Sees: "Thank you Ramesh! We will call you within 1 hour."

BACKEND PROCESSING:
  Lead saved to database
  Vendor gets WhatsApp immediately (₹1 deducted):
  "🔔 New Lead from Ooty Campaign
   Ramesh Kumar: +91 98765..."
  
  Lead appears in CRM
  TeleCRM adds to call queue for today

PAGE ANALYTICS:
  Every visit counted (even without form submission)
  Vendor sees: "47 views · 8 leads · 17% conversion"
```
