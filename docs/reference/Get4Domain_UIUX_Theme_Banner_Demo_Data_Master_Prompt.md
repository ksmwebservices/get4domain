# Get4Domain — UI/UX Theme, Visual System & Demo Data Master Prompt
## Companion specification for the Next.js + React Industry Website Engine

Use this document together with the existing Get4Domain Industry Website/architecture specification and the Claude Code Next.js implementation prompt.

---

# 1. PURPOSE

Build a production-quality visual system for Get4Domain's **industry-specific customer websites**.

The result must NOT look like a generic website builder.

It must look like a professionally designed website created specifically for the selected business industry and subcategory.

The architecture is shared; the visual experience is industry-specific.

The public website, Vendor App and Client App must feel like parts of one connected product.

---

# 2. VISUAL PRODUCT MODEL

Every generated business experience should communicate:

**Professional Website + Vendor App + Client App**

Public website:
- attracts visitors
- explains services/products
- builds trust
- captures enquiry
- supports booking/order/admission/site visit/etc.
- provides WhatsApp/call/contact actions

Vendor App:
- manages operations
- manages leads/customers
- manages bookings/orders/tasks
- manages payments/accounts
- manages communication
- manages marketing/AI
- shows reports

Client App/PWA:
- lets customers browse
- enquire/book/order
- receive updates
- view status/history
- communicate with business

---

# 3. GET4DOMAIN DESIGN LANGUAGE

The visual language should be:

- modern
- premium
- trustworthy
- conversion-focused
- mobile-first
- clean
- professional
- Indian SMB friendly
- industry-aware

Avoid:
- generic SaaS dashboard appearance on the public website
- excessive gradients
- random neon colours
- oversized decorative elements
- stock-template feeling
- excessive animation
- crowded screens
- meaningless cards
- fake statistics that look like real business claims

Use:
- strong typography hierarchy
- generous spacing
- high-quality imagery
- meaningful icons
- clear CTA hierarchy
- restrained shadows
- polished cards
- subtle borders
- premium responsive layouts
- realistic business content

---

# 4. BRAND SYSTEM

Use the existing official Get4Domain logo and assets from the repository.

Do not recreate the logo with text if an official asset exists.

Keep:
- Get4Domain brand identity
- approved logo proportions
- approved brand colours
- consistent favicon/app icon
- consistent buttons and interaction patterns

For marketing/demo website previews, the Get4Domain attribution/domain treatment must be consistent with the current product configuration.

Where the standard commercial offer is displayed, use the current approved product/pricing configuration rather than scattering hard-coded values across components.

---

# 5. HERO / BANNER SYSTEM

Every industry website must have a visually strong hero.

Hero structure:

```text
[Header]

[Industry-specific image / visual composition]

Small trust/industry label

Strong business-specific headline

Short supporting value proposition

[Primary CTA] [Secondary CTA]

Trust indicators / quick information

[Website / product visual where appropriate]
```

The hero must show the actual industry context.

Examples:

## Clinic
Visual:
- modern clinic reception
- doctor/patient consultation
- medical environment
- professional healthcare feel

Headline:
"Compassionate Care. Better Health."

CTA:
"Book Appointment"

Secondary:
"WhatsApp Us"

## Restaurant
Visual:
- premium restaurant interior
- plated food
- chef/service atmosphere

Headline:
"Great Food. Easy Ordering."

CTA:
"View Menu"
Secondary:
"Order Now"

## Cloud Kitchen
Visual:
- professional cloud-kitchen workspace
- food preparation
- packaging
- delivery-ready orders

Headline:
"Fresh From Our Kitchen to Your Door."

CTA:
"Order Now"
Secondary:
"View Menu"

## Beauty Parlour / Unisex Salon
Visual:
- premium salon interior
- stylist at work
- beauty services

Headline:
"Look Good. Feel Confident."

CTA:
"Book Appointment"
Secondary:
"View Services"

## Gym & Fitness
Visual:
- modern gym
- trainer coaching
- fitness equipment
- energetic but professional atmosphere

Headline:
"Train Better. Get Stronger."

CTA:
"Join Now"
Secondary:
"View Programs"

## Real Estate
Visual:
- premium property/building
- residential development
- site visit context
- professional agent/property environment

Headline:
"Find the Right Property."

CTA:
"View Properties"
Secondary:
"Book Site Visit"

## Education / Tuition / Coaching
Visual:
- classroom
- teacher/student interaction
- modern learning environment

Headline:
"Learn. Improve. Achieve More."

CTA:
"View Courses"
Secondary:
"Enquire Now"

## Retail
Visual:
- actual shop/store environment
- products
- shelves/displays
- shopping experience

Headline:
"Everything You Need. Shop Online."

CTA:
"Shop Now"
Secondary:
"WhatsApp Us"

---

# 6. BANNER IMAGE RULE

Do not use the same hero image across all industries.

Do not use a generic business-office image for unrelated categories.

Hero image selection must depend on:
1. industry
2. subcategory
3. business positioning
4. visual theme

Subcategories should be visually distinguishable.

Example:
- Restaurant ≠ Cloud Kitchen
- Beauty Parlour ≠ Unisex Salon
- Clinic ≠ Gym
- Grocery ≠ Jewellery
- Real Estate ≠ Travel
- DSA ≠ Insurance Agent
- CA ≠ Legal Firm

---

# 7. WEBSITE DEVICE SHOWCASE

Where the design calls for product demonstration, show realistic responsive website UI inside:

- laptop/desktop mockup
- tablet where appropriate
- mobile phone

The screen content must be real demo UI, not blank placeholders.

Example:

```text
Laptop:
Business website homepage

Phone:
Client App

Optional second phone:
Vendor App
```

Use industry-specific sample content on each screen.

Do not cover the primary hero message with device mockups.

---

# 8. THREE-APP VISUAL SYSTEM

Create visually connected cards or sections for:

### Website
Public customer-facing website.

### Vendor App
Business operations.

### Client App
Customer experience.

Use consistent product chrome but different content.

Example clinic:

### Website
CareWell Clinic
Services
Doctors
Appointments
Contact

### Vendor App
Dashboard
Appointments
Patients
Leads
Payments
Tasks
Reports

### Client App
Book Appointment
My Appointments
Doctors
Prescriptions
Health Packages
Messages

---

# 9. MOBILE WEBAPP BOTTOM NAVIGATION

This is a major design element.

On mobile, websites should feel like installable WebApps.

Use a fixed bottom navigation.

Rules:
- 4–5 items maximum
- icon + label
- active state
- touch-friendly
- safe-area inset
- elevated/card-like surface
- subtle border/shadow
- never obscure content
- primary action can be visually emphasized
- navigation is industry-specific

Examples:

Clinic:
`Home | Services | Doctors | Book | More`

Restaurant:
`Home | Menu | Order | Offers | More`

Cloud Kitchen:
`Home | Menu | Order | Track | More`

Beauty Parlour:
`Home | Services | Book | Offers | More`

Gym:
`Home | Programs | Join | Schedule | More`

Real Estate:
`Home | Properties | Enquiry | Visit | More`

Education:
`Home | Courses | Enquiry | Admission | More`

Retail:
`Home | Products | Cart | Offers | More`

Loan/DSA:
`Home | Loans | Eligibility | Enquiry | More`

Insurance:
`Home | Plans | Quote | Enquiry | More`

CA/GST:
`Home | Services | Enquiry | Contact | More`

Legal:
`Home | Practice | Enquiry | Contact | More`

Events:
`Home | Services | Gallery | Enquiry | More`

---

# 10. DESKTOP NAVIGATION

Desktop should not show the mobile bottom navigation.

Use:
- logo
- relevant primary links
- primary CTA
- WhatsApp/contact when appropriate

Navigation must remain clean.

Do not put every possible page in the header.

Use More/menu for secondary pages.

---

# 11. PAGE SECTION SYSTEM

Sections must be configurable and industry-specific.

Possible sections:

- Hero
- Trust strip
- Services
- Products
- Categories
- Doctors
- Team
- Trainers
- Courses
- Classes
- Menu
- Properties
- Projects
- Rooms
- Packages
- Memberships
- Portfolio
- Gallery
- Testimonials
- Reviews
- Offers
- FAQ
- Location
- Contact
- Booking
- Enquiry
- Order
- Payment
- Blog
- Footer

Never force irrelevant sections.

---

# 12. INDUSTRY VISUAL BLUEPRINTS

## CLINIC / HEALTHCARE

Theme:
clean medical premium

Colours:
calm professional palette based on configured brand

Hero:
doctor/clinic visual

Sections:
- services
- doctors
- specialties
- appointment booking
- health packages
- testimonials
- clinic information
- timings
- location
- contact

Demo business:
**CareWell Clinic**

Sample:
- Dr. Anjali Mehta — General Physician
- Dr. Rahul Nair — Consultant
- General Consultation — ₹500
- Health Checkup — ₹1,500
- Dental Consultation — ₹700

Vendor App:
- appointments
- patients
- leads
- prescriptions
- invoices
- payments
- tasks
- TeleCRM
- reports

Client App:
- book appointment
- doctors
- appointments
- prescriptions
- health packages
- payments
- messages

---

# 13. RESTAURANT / CAFE

Theme:
premium food/hospitality

Hero:
restaurant interior + food

Sections:
- signature dishes
- menu categories
- chef
- table booking
- offers
- reviews
- gallery
- location
- contact

Demo:
**Urban Spice Restaurant**

Sample:
- Butter Chicken — ₹320
- Paneer Tikka — ₹280
- Biryani — ₹260
- Masala Dosa — ₹140

Vendor:
- orders
- tables
- menu
- kitchen
- customers
- payments
- offers
- reports

Client:
- menu
- cart
- order
- table booking
- order tracking
- offers

---

# 14. CLOUD KITCHEN

Do not visually reuse the restaurant layout without modification.

Theme:
delivery-first modern food brand

Hero:
cloud kitchen prep/packing/delivery visual

Sections:
- best sellers
- menu
- combos
- delivery zones
- offers
- order flow
- reviews
- contact/support

Demo:
**HomeBite Cloud Kitchen**

Sample:
- Chicken Rice Bowl — ₹189
- Paneer Wrap — ₹149
- Family Combo — ₹499
- Chocolate Brownie — ₹99

Vendor:
- incoming orders
- kitchen queue
- preparation
- dispatch
- delivery
- menu
- offers
- customers
- payments

Client:
- menu
- cart
- order
- delivery tracking
- support

---

# 15. BEAUTY PARLOUR

Demo:
**Glow Beauty Parlour**

Services:
- Haircut — ₹350
- Facial — ₹900
- Bridal Package — ₹6,500
- Hair Spa — ₹1,200

Website:
services, pricing, gallery, stylist/team, offers, booking, reviews, location.

Vendor:
appointments, staff, services, packages, memberships, POS, customers, payments, reports.

Client:
services, stylist, booking, packages, offers, appointment history.

---

# 16. UNISEX SALON

Demo:
**Glow Studio Unisex Salon**

Website:
- men's services
- women's services
- hair
- skin
- grooming
- packages
- stylists
- booking
- offers

Vendor:
- appointments
- stylists
- services
- packages
- memberships
- POS
- customers
- reports

Client:
- service selection
- stylist
- time slot
- booking
- packages
- offers

Use a clearly different visual identity from Beauty Parlour where the business positioning differs.

---

# 17. GYM & FITNESS

Demo:
**IronCore Fitness Studio**

Website:
- programs
- trainers
- membership plans
- schedules
- transformations/testimonials where authorized
- facilities
- enquiry
- join CTA

Sample:
- Monthly — ₹1,499
- Quarterly — ₹3,999
- Annual — ₹11,999

Vendor:
- members
- memberships
- attendance
- trainers
- classes
- payments
- tasks
- leads
- reports

Client:
- membership
- classes
- schedule
- attendance/status
- trainer
- payments
- contact

---

# 18. REAL ESTATE

Demo:
**PrimeNest Realty**

Website:
- featured properties
- residential projects
- property details
- amenities
- gallery
- location
- site visit
- enquiry
- agents
- contact

Sample properties:
- 2 BHK Apartment — ₹68L
- 3 BHK Apartment — ₹92L
- Residential Plot — ₹42L

Vendor:
- properties
- leads
- site visits
- follow-ups
- documents
- deal pipeline
- payments
- reports

Client:
- property search
- filters
- details
- enquiry
- site visit
- contact agent

---

# 19. EDUCATION / TUITION / COACHING

Demo:
**BrightPath Coaching Centre**

Website:
- courses
- faculty
- batches
- timetable
- admissions
- results/achievements where authorized
- testimonials
- enquiry

Sample:
- NEET Foundation
- JEE Preparation
- Mathematics Tuition
- Spoken English

Vendor:
- enquiries
- admissions
- students
- batches
- attendance
- fees
- communication
- reports

Client:
- courses
- enquiry
- admission
- schedule
- notices
- fee information

---

# 20. RETAIL / E-COMMERCE

### Grocery / Supermarket / Kirana
Demo:
**SmartMart Supermarket**

Show:
- categories
- products
- prices
- offers
- WhatsApp ordering
- delivery/pickup

### Clothing & Apparel
Demo:
**UrbanThread**

Show:
- collections
- categories
- sizes
- offers
- catalogue
- enquiry/order

### Electronics & Mobile
Demo:
**TechZone Mobiles**

Show:
- phones
- accessories
- repair services
- offers
- enquiry

### Footwear
Demo:
**StepStyle Footwear**

Show:
- men
- women
- kids
- sizes
- collections
- offers

### Jewellery
Demo:
**Sri Lakshmi Jewellers**

Show:
- gold
- diamond
- bridal
- collections
- enquiry
- store visit

### Furniture & Home Decor
Demo:
**HomeCraft Furnishings**

Show:
- furniture
- living room
- bedroom
- decor
- catalogue
- enquiry

Vendor common:
- products
- inventory
- POS
- purchases
- customers
- orders
- payments
- offers
- reports

Client:
- browse
- search
- product detail
- cart/order where enabled
- offers
- contact

---

# 21. FINANCE

## LOAN & MORTGAGE CONSULTANCY / DSA

Target audience must clearly read as:

**Loan Agency / Loan & Mortgage Consultancy / DSA**

Demo:
**PrimeLoan DSA Services**

Website:
- home loan
- personal loan
- business loan
- vehicle loan
- eligibility
- enquiry
- callback
- document checklist

Do not imply guaranteed loan approval.

Vendor:
- leads
- applications
- follow-ups
- document status
- lender/product tracking
- tasks
- TeleCRM
- communication
- reports

Client:
- loan types
- eligibility enquiry
- callback
- application status
- document guidance
- contact

---

# 22. INSURANCE AGENT

Demo:
**SecureLife Insurance Services**

Website:
- policy categories
- protection
- health
- life
- motor
- enquiry
- callback
- renewal reminder CTA

Avoid unsupported claims about coverage, returns or approval.

Vendor:
- leads
- customers
- policies
- renewals
- follow-ups
- tasks
- communication
- reports

Client:
- policy enquiry
- quote/request
- renewal reminder
- documents
- contact agent

---

# 23. CA / TAX / GST

Demo:
**FinTax Advisors**

Website:
- accounting
- GST
- income tax
- compliance
- payroll
- advisory
- enquiry
- consultation booking

Vendor:
- clients
- tasks
- compliance reminders
- invoices
- payments
- documents
- CRM
- reports

Client:
- services
- consultation
- document request
- invoice/payment
- communication

---

# 24. ADVOCATES / LEGAL FIRMS

Demo:
**LexBridge Legal**

Website:
- practice areas
- attorneys/team
- experience/credentials where supplied
- consultation
- enquiry
- FAQ
- contact

Vendor:
- enquiries
- clients
- cases/matters where supported
- appointments
- tasks
- documents
- invoices
- payments
- reports

Client:
- consultation request
- appointment
- matter/contact workflow where supported
- documents/status where authorized

Do not invent legal credentials, case wins or certifications.

---

# 25. EVENTS & PLANNING

Demo:
**Celebrate Events**

Website:
- services
- event types
- packages
- portfolio
- gallery
- testimonials
- enquiry
- booking consultation

Vendor:
- leads
- events
- tasks
- vendors
- packages
- payments
- calendar
- reports

Client:
- services
- packages
- gallery
- enquiry
- consultation booking

---

# 26. SAMPLE DATA RULES

Demo data must be:

- realistic
- internally consistent
- visually useful
- clearly demo/sample data
- relevant to the selected industry
- easy to replace through the Vendor Dashboard

Never use:
- fake government certifications
- fake awards
- fake medical credentials
- fake legal victories
- fake customer reviews presented as verified
- misleading financial claims
- guaranteed loan/insurance outcomes
- fabricated business registration details

---

# 27. SAMPLE DASHBOARD DATA

Vendor dashboard demos should feel alive.

Example:

```text
Revenue                 ₹48,250
Appointments                  128
Active Clients              1,243
New Leads                      24
Pending Tasks                  12
Rating                         4.9
```

Recent activity:

```text
New appointment booked — Ravi Kumar
Payment received — ₹1,500
New lead from website — Mohan J.
```

Use industry-appropriate labels.

For restaurant:
Revenue / Orders / Tables / Customers

For retail:
Sales / Orders / Inventory / Customers

For real estate:
Leads / Site Visits / Properties / Deals

For education:
Admissions / Students / Fees / Batches

---

# 28. GET4DOMAIN PLATFORM FEATURE PRESENTATION

When the commercial/product section is shown, communicate the unified platform.

Include where appropriate:

- Industry Website
- Vendor App
- Client App
- AI Studio
- TeleCRM
- Tasks
- Auto Reply
- Accounts & Invoicing
- Payments
- Reports & Analytics
- WhatsApp Business API
- Transactional SMS
- Promotional SMS
- Email
- Free subdomain
- Hosting
- SSL
- CDN
- 4 email accounts

The presentation must not overwhelm the industry website itself.

Use a dedicated "Everything included" or platform section.

---

# 29. PRICING PRESENTATION

When pricing is displayed, use the current approved Get4Domain pricing configuration.

The campaign material currently positions:
- ₹999/month
- ₹9,999/year
- yearly saving messaging
- 18% GST extra
- cancel anytime
- applicable terms/conditions

Do not hard-code pricing into every component.

Create a reusable PricingCard/PricingSection fed from configuration.

---

# 30. 24-HOUR POSITIONING

Where the current commercial configuration supports it, communicate:

**Live in 24 Hours**

Use supporting language such as:
- instant deploy
- ready-made industry template
- content/theme customization
- onboarding/setup

Do not promise an exact delivery time if the actual backend/service configuration does not support that promise.

---

# 31. VISUAL HIERARCHY

Every website must have:

### Level 1
Business value proposition.

### Level 2
Primary conversion action.

### Level 3
Trust and proof.

### Level 4
Services/products/features.

### Level 5
Supporting information.

### Level 6
Secondary actions.

Do not let platform marketing overpower the customer's business.

The visitor should first understand:

**What does this business offer?**

Then:

**How do I contact/book/order/enquire?**

Then:

**Why trust them?**

Then:

**What else can I do?**

---

# 32. RESPONSIVE DESIGN

Desktop:
- spacious hero
- balanced two-column layouts
- premium imagery
- clear navigation

Tablet:
- adaptive grids
- touch-friendly controls

Mobile:
- one-column flow where appropriate
- fixed bottom navigation
- sticky CTA where appropriate
- compact header
- large readable typography
- thumb-friendly controls
- optimized images
- no horizontal overflow

The mobile design must feel intentionally designed as a WebApp.

---

# 33. ANIMATION

Use subtle motion only:

- fade/slide on section entry
- hover elevation
- button feedback
- tab transitions
- carousel transitions
- mobile navigation active-state transition

Avoid:
- distracting parallax
- excessive bouncing
- continuous decorative motion
- animations that delay interaction

Respect `prefers-reduced-motion`.

---

# 34. IMAGE SYSTEM

Create a centralized image/content configuration.

Each industry/subcategory should define:

- hero image
- secondary hero image
- section images
- card images
- gallery images
- app-preview imagery if needed

Use responsive image handling through Next.js.

Use descriptive alt text.

Never put critical text inside an image when it should be HTML text.

---

# 35. DEMO WEBSITE ROUTES

Design the engine so a demo can be viewed through predictable routes, for example:

```text
/demo/clinic
/demo/restaurant
/demo/cloud-kitchen
/demo/parlour
/demo/unisex-salon
/demo/gym
/demo/real-estate
/demo/tuition
/demo/coaching
/demo/grocery
/demo/clothing
/demo/electronics
/demo/footwear
/demo/jewellery
/demo/furniture
/demo/loan-dsa
/demo/insurance
/demo/ca-gst
/demo/legal
/demo/events
```

Use the project's actual routing conventions if they already exist.

---

# 36. COMPONENT API DESIGN

Prefer:

```tsx
<IndustryWebsite
  config={industryConfig}
  business={businessData}
/>
```

rather than:

```tsx
<ClinicWebsite />
<RestaurantWebsite />
<SalonWebsite />
```

Use reusable components:

```text
IndustryHero
IndustryNavigation
IndustryBottomNav
IndustrySection
ServiceGrid
ProductGrid
BookingCTA
EnquiryCTA
OrderCTA
TrustSection
TeamSection
GallerySection
ReviewSection
ContactSection
VendorPreview
ClientPreview
PricingSection
PlatformFeatures
```

Industry configuration controls what they display.

---

# 37. QUALITY BAR

Before declaring an industry complete, verify:

- Does it immediately look like its industry?
- Is the hero image relevant?
- Is the CTA relevant?
- Are the navigation labels relevant?
- Are the sections relevant?
- Are the sample products/services realistic?
- Are Vendor App modules relevant?
- Are Client App actions relevant?
- Does mobile feel like a WebApp?
- Is bottom navigation polished?
- Is the website visually distinct from other industries?
- Is Get4Domain branding consistent?
- Are all images optimized?
- Are loading/error/empty states handled?
- Does it work without breaking existing dashboard/backend functionality?

---

# 38. FINAL DESIGN PRINCIPLE

**Shared engine. Custom experience.**

The code should be reusable.

The website should NOT feel reusable.

A doctor should feel that Get4Domain was built for clinics.

A restaurant owner should feel it was built for restaurants.

A DSA should feel it was built for loan agencies.

An insurance agent should feel it was built for insurance.

A CA should feel it was built for professional services.

A lawyer should feel it was built for legal practice.

A retailer should feel it was built for retail.

The visual language, content, imagery, navigation, features, sample data and conversion flow must communicate that difference.
