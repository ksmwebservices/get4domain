# GET4DOMAIN
# INDUSTRY-AWARE BUSINESS WEBAPP PLATFORM
# MASTER PRODUCT REQUIREMENTS DOCUMENT

You are acting as the:
- Principal Product Architect
- Senior UX Architect
- Senior Frontend Architect
- Senior Backend Architect
- API Integration Architect
- PWA Architect
- AI Platform Architect
- QA/Testing Architect

Your responsibility is to understand and complete the Get4Domain product architecture and implementation without breaking the existing application.

==================================================
1. PRODUCT VISION
==================================================

Get4Domain is NOT a generic website builder.

Get4Domain is an:

INDUSTRY-AWARE BUSINESS WEBAPP PLATFORM

It combines:

1. Public web presence
2. Vendor Business WebApp
3. Client Customer WebApp
4. Industry Experience Engine
5. CRM + TeleCRM
6. Communication Hub
7. AI Studio
8. Business Operations
9. Online Payments
10. Smart Notifications
11. Growth Hub
12. Website / Lead Generation
13. Analytics
14. Wallet
15. Subscription/Billing
16. Integrations
17. Automation

The system must support different industries and business categories while maintaining a common technical platform.

==================================================
2. CORE PRINCIPLE
==================================================

COMMON PLATFORM ENGINE
+
INDUSTRY-SPECIFIC BUSINESS EXPERIENCE

Do NOT build one generic website/dashboard and merely change:

- colors
- logo
- text
- images

The underlying technical architecture must be reusable.

However, the UX, UI, workflows, operations, customer journey, navigation priorities, features, terminology and content structure must adapt to the selected industry and category.

Example:

Restaurant
≠
Dental Clinic
≠
Real Estate
≠
Travel Agency
≠
Salon
≠
Law Firm
≠
Education Institute

Each should feel purpose-built for its business operation.

==================================================
3. THREE PRIMARY EXPERIENCES
==================================================

Get4Domain consists of:

A. PUBLIC WEB
B. VENDOR WEBAPP
C. CLIENT WEBAPP

All must be responsive.

All must be designed for:

- Desktop
- Tablet
- Mobile
- PWA

Mobile must NOT simply be a compressed desktop interface.

Mobile should provide an app-like experience.

==================================================
4. PUBLIC WEB
==================================================

The Get4Domain public web includes:

- Home
- Product pages
- Feature pages
- Industry pages
- Pricing
- Resources
- Marketing pages
- Signup
- Login
- Vendor onboarding

Each vendor may also have a public business presence using:

- Get4Domain subdomain
- Hosting
- CDN
- SSL
- Business website
- Enquiry forms
- WhatsApp CTA
- Call CTA

The public business experience must be generated based on:

Industry
+
Category
+
Business Model
+
Services/Products
+
Operations
+
Brand configuration

==================================================
5. VENDOR BUSINESS WEBAPP
==================================================

The Vendor WebApp is the business operating system.

Existing/default navigation structure:

1. Dashboard
2. Customer Hub
3. TeleCRM
4. Growth Hub
5. AI Studio
6. Communication Hub
7. Website Manager
8. Analytics
9. Wallet
10. Subscription
11. Profile
12. Settings
13. Support

Additional industry-specific modules may be surfaced where appropriate.

Do not force every vendor to use every capability.

The Industry Engine should determine the recommended/default experience.

==================================================
6. CLIENT CUSTOMER WEBAPP
==================================================

The Client WebApp is the customer's operational experience.

Depending on industry/category, it can include:

- Home
- Products
- Services
- Projects
- Professionals
- Doctors
- Packages
- Booking
- Appointment
- Site Visit
- Cart
- Orders
- Quote Request
- Enquiry
- Application
- Signup
- Membership
- Subscription
- Payments
- Messages
- Notifications
- Order history
- Booking history
- Profile

The Client WebApp must be PWA-ready.

==================================================
7. MOBILE NAVIGATION
==================================================

Vendor and Client WebApps must have app-style mobile navigation.

Vendor mobile navigation should prioritize business-critical actions.

Client mobile navigation should prioritize customer actions.

Do not blindly expose the entire desktop navigation in mobile bottom navigation.

Use:

- Bottom navigation
- More menu
- Contextual actions
- Sticky CTA
- Floating action where appropriate
- Mobile-friendly forms
- Touch-friendly controls

The navigation should be configurable by industry and role.

==================================================
8. INDUSTRY EXPERIENCE ENGINE
==================================================

This is the central architecture.

The engine must understand:

Industry
→ Category
→ Subcategory
→ Business Model
→ Products/Services
→ Business Operations
→ Customer Journey
→ Vendor Workflow
→ Client Workflow
→ Features
→ Integrations
→ Automations
→ UI/UX

Do not hard-code these relationships throughout the frontend.

Create an industry/category configuration system.

==================================================
9. BUSINESS MODEL ENGINE
==================================================

Support business models such as:

- Product
- Service
- Property
- Experience
- Consultation
- Membership
- Subscription
- Booking-based
- Appointment-based
- Marketplace-style
- Mixed

==================================================
10. OPERATION ENGINE
==================================================

Create reusable operational capabilities.

Examples:

- Appointment
- Booking
- Site Visit
- Cart
- Order
- Quote
- Enquiry
- Lead
- Application
- Signup
- Consultation
- Membership
- Subscription
- Payment
- POS
- Delivery
- Pickup
- Service Request

The operation engine must be reusable technically.

Its UX and workflow must adapt to the industry.

==================================================
11. EXAMPLE OPERATION MAPPINGS
==================================================

REAL ESTATE / BUILDER / PLOT PROMOTER

Primary:
Site Visit + Enquiry

Vendor:
- Leads
- Projects
- Properties
- Site Visits
- Follow-ups
- Payments
- Campaigns

Client:
- Projects
- Property details
- Floor plans
- Location
- Book Site Visit
- Enquiry
- Payment
- My Visits

DENTAL CLINIC

Primary:
Appointment

Vendor:
- Patients
- Doctors
- Treatments
- Appointments
- Follow-ups
- Payments

Client:
- Doctors
- Treatments
- Book Appointment
- My Appointments
- Payments
- Notifications

RESTAURANT

Primary:
Order

Vendor:
- Menu
- Orders
- POS
- Tables
- Kitchen
- Customers
- Offers

Client:
- Menu
- Cart
- Order
- Pickup/Delivery
- Payment
- Order Tracking

TRAVEL

Primary:
Enquiry + Booking

Vendor:
- Packages
- Leads
- Bookings
- Customers
- Payments
- Follow-ups

Client:
- Packages
- Search
- Enquiry
- Booking
- Payment
- My Bookings

SALON

Primary:
Appointment

Vendor:
- Services
- Staff
- Appointments
- Customers
- Packages
- Payments

Client:
- Services
- Staff
- Choose Slot
- Book Appointment
- Payment
- My Appointments

EDUCATION

Primary:
Enquiry + Application + Signup

Vendor:
- Courses
- Leads
- Counselling
- Applications
- Students
- Payments

Client:
- Courses
- Course Details
- Enquiry
- Application
- Signup
- Payment
- Student Area

==================================================
12. COMMUNICATION HUB
==================================================

Create one communication system.

Supported channels:

A. WhatsApp Business API
B. Transactional SMS
C. Promotional SMS
D. Email
E. Unified Inbox

IMPORTANT:

WhatsApp, SMS and email should be provider/API based.

Do not hard-code one provider throughout the application.

Create an integration/provider abstraction.

Conceptually:

Communication Provider
→ WhatsApp Provider
→ SMS Provider
→ Email Provider

Provider configuration should be manageable securely.

==================================================
13. WHATSAPP BUSINESS API
==================================================

Support WhatsApp Business API through approved third-party/API gateway providers.

The system should support:

- Sending messages
- Receiving messages where supported
- Templates
- Transactional messages
- Promotional campaigns where permitted
- Customer conversations
- Media where supported
- Message status
- Delivery status
- Read status where supported
- Conversation history

Do not assume a specific provider permanently.

Create a provider adapter architecture.

Example:

WhatsAppProviderInterface

Providers can implement:

- sendMessage()
- sendTemplate()
- sendMedia()
- getStatus()
- receiveWebhook()

All credentials must be stored securely.

==================================================
14. SMS GATEWAY
==================================================

Support SMS gateway API integrations.

Separate:

- Transactional SMS
- Promotional SMS

The system must support:

- SMS templates
- Sender configuration
- Delivery reports
- Webhooks
- Campaign sending
- Transactional event-triggered SMS
- Message history
- Usage tracking

Create an SMS provider abstraction.

Do not hard-code a single SMS vendor.

==================================================
15. EMAIL SYSTEM
==================================================

Support company/business email services and email campaign functionality.

Capabilities:

- Transactional email
- Promotional email
- Email campaigns
- Templates
- Sender identity
- Company branding
- Contact lists
- Segmentation
- Delivery tracking
- Open tracking where supported
- Click tracking where supported
- Bounce handling where supported
- Unsubscribe management
- Email history

Create an email provider abstraction.

Do not hard-code one email provider.

==================================================
16. UNIFIED INBOX
==================================================

Communication Hub should provide one place to see relevant customer communications.

Conceptually:

Customer
→ WhatsApp
→ SMS
→ Email
→ Calls/Call records
→ Communication history

Where provider capabilities permit, normalize messages into a common conversation model.

==================================================
17. AI STUDIO
==================================================

AI Studio is an integrated marketing-content creation workspace.

Features:

1. Reel Maker
2. Poster Designer
3. Content Generator
4. Caption Generator
5. Marketing Copy
6. Industry-specific campaign content

AI Studio usage is pay-per-use through the vendor wallet.

==================================================
18. AI PROVIDER ARCHITECTURE
==================================================

AI services must use provider abstraction.

Potential AI/video providers include:

- Claude / Anthropic
- OpenAI
- Runway
- Kling AI
- Other supported providers in future

Do not hard-code AI provider-specific logic into UI components.

Create service abstractions such as:

AITextProvider
AIVideoProvider
AIImageProvider

Provider configuration should be controlled from a secure backend/admin configuration layer.

==================================================
19. CLAUDE / ANTHROPIC
==================================================

Claude can be used for:

- Marketing copy
- Captions
- Content generation
- Campaign concepts
- Business content
- Industry-specific content assistance

API credentials must never be exposed in the browser.

All API calls requiring secret credentials must go through secure server-side services.

==================================================
20. OPENAI
==================================================

Where OpenAI services are used, implement them through a backend provider layer.

Possible capabilities:

- Content generation
- Image generation where supported
- AI assistance
- Structured content generation

Never expose API keys client-side.

==================================================
21. RUNWAY / KLING
==================================================

AI video generation can support the Reel Maker.

Conceptual workflow:

User selects:
Industry
+
Campaign type
+
Business
+
Product/service
+
Images/content

↓

AI generates concept/script

↓

Video provider generates video

↓

Job status is tracked

↓

Result is stored

↓

User previews

↓

User exports/publishes

AI video generation is asynchronous.

Implement:

- Job creation
- Job status
- Retry handling
- Provider errors
- Usage accounting
- Wallet deduction
- Result storage

Do not assume video generation is instantaneous.

==================================================
22. AI STUDIO DESIGN
==================================================

AI Studio must be industry-aware.

Restaurant:
- Food promotion
- Menu promotion
- Festival offer
- New dish reel

Real Estate:
- Project launch
- Property promotion
- Site visit campaign
- Construction update

Clinic:
- Health awareness
- Treatment education
- Appointment campaign

Salon:
- Service promotion
- Bridal package
- Offer campaign

The user should not need to write complex prompts.

The UI should provide structured generation workflows.

==================================================
23. WALLET + PAY-PER-USE
==================================================

AI usage can be deducted from the vendor wallet.

Track:

- Service
- Provider
- Model
- Usage
- Cost
- Vendor charge
- Timestamp
- Job ID
- Status

Wallet transactions must be auditable.

Never deduct funds without a clear transaction record.

Handle:

- Insufficient balance
- Failed jobs
- Refund/reversal
- Partial provider failure

==================================================
24. BUSINESS OPERATIONS
==================================================

Business Operations should include reusable capabilities:

- Tasks
- Bookings
- Appointments
- POS
- Staff scheduling

Industry-specific modules can be activated depending on the industry.

Examples:

Restaurant:
POS + Orders + Tables + Kitchen

Clinic:
Appointments + Doctors + Patients

Salon:
Appointments + Staff + Services

Real Estate:
Leads + Site Visits + Properties

==================================================
25. ONLINE PAYMENTS
==================================================

Support:

- UPI
- Cards
- Net banking
- Payment links
- GST invoicing
- Auto receipts

Payment provider integration must be abstracted.

Never expose secret payment credentials in frontend code.

Support:

- Payment creation
- Payment status
- Webhooks
- Success
- Failure
- Refund where supported
- Receipts
- Reconciliation

==================================================
26. SMART NOTIFICATIONS
==================================================

Create an event-driven notification system.

Events include:

- New lead
- New enquiry
- Task assigned
- Task due
- Booking created
- Appointment created
- Booking reminder
- Payment initiated
- Payment successful
- Payment failed
- Order created
- Order updated

Channels:

- In-app
- Push/PWA
- Email
- SMS
- WhatsApp where supported

The Industry Engine should determine relevant notification events.

==================================================
27. CRM + TELECRM
==================================================

CRM capabilities:

- Leads
- Pipeline
- Follow-ups
- Customer history
- Notes
- Activities
- Tags
- Assignments
- Sources
- Conversion tracking

TeleCRM:

- Calling integration where supported
- Call records
- Call history
- Follow-up scheduling
- Customer timeline

Pipeline stages should be configurable by industry.

Example:

Real Estate:
Lead → Qualified → Site Visit → Negotiation → Booking → Won

Insurance:
Lead → Requirement → Quote → Documents → Proposal → Policy

Education:
Enquiry → Counselling → Course Selected → Application → Payment → Enrolled

==================================================
28. GROWTH HUB
==================================================

Growth Hub includes:

- Campaign pages
- Shareable links
- Audience segments
- Result tracking

Campaigns must connect to:

- CRM
- Communication Hub
- AI Studio
- Analytics

Campaign landing pages should inherit the vendor's branding.

==================================================
29. WEBSITE / LEAD GENERATION
==================================================

Website Manager should support:

- Public business website
- Subdomain
- Hosting
- CDN
- SSL
- Enquiry forms
- WhatsApp CTA
- Call CTA

The website experience must be generated based on industry/category/operation.

This is not a generic template system.

==================================================
30. INDUSTRY DESIGN SYSTEM
==================================================

Each industry must have its own design language.

Design differences should include:

- Layout
- Typography
- Information architecture
- Navigation
- Hero
- Sections
- CTA
- Cards
- Forms
- Imagery
- Motion
- Mobile UX

Do not create one visual template and recolor it.

==================================================
31. INDUSTRY CATEGORY REGISTRY
==================================================

Create a structured registry for all supported industries and categories.

Initial industry groups:

1. Restaurant & Food
2. Travel & Tours
3. Real Estate
4. Healthcare
5. Education
6. Construction & Interior
7. Retail & Shopping
8. Beauty & Wellness
9. Fitness & Sports
10. Professional Services
11. Events & Entertainment
12. Finance & Insurance

The registry must be extensible.

Each category should define:

- Business model
- Primary operation
- Secondary operations
- Recommended modules
- Client features
- Vendor features
- Recommended pages
- Recommended sections
- CTA
- Integrations
- Notifications
- Automation
- AI Studio templates
- CRM pipeline
- Mobile navigation priorities

==================================================
32. INDUSTRY CONFIGURATION EXAMPLE
==================================================

Conceptual structure:

Industry:
Healthcare

Category:
Dental Clinic

businessModel:
service

primaryOperation:
appointment

secondaryOperations:
consultation
payment
enquiry

vendorModules:
patients
doctors
appointments
crm
payments
communication

clientModules:
treatments
doctors
appointment
payments
notifications

primaryCTA:
Book Appointment

integrations:
whatsapp
sms
email
payment
calendar

automation:
appointmentConfirmation
appointmentReminder
followUp

This should be data/configuration driven wherever practical.

==================================================
33. AUTOMATION ENGINE
==================================================

Create reusable automation/event capabilities.

Examples:

Lead created
→ CRM entry
→ Vendor notification
→ WhatsApp
→ SMS
→ Follow-up task

Appointment booked
→ Confirmation
→ Calendar event where supported
→ Reminder
→ Follow-up

Order placed
→ Payment status
→ Confirmation
→ Kitchen/POS
→ Customer notification

Site visit booked
→ CRM
→ Sales assignment
→ Confirmation
→ Reminder
→ Follow-up

Automations must be configurable and industry-aware.

==================================================
34. WEBHOOK ARCHITECTURE
==================================================

External services will send webhooks.

Create secure webhook handling for:

- Payment
- WhatsApp
- SMS
- Email
- AI jobs
- Other integrations

Requirements:

- Signature verification
- Idempotency
- Event logging
- Retry handling
- Failure handling
- Audit trail

Never trust arbitrary webhook payloads.

==================================================
35. API ARCHITECTURE
==================================================

Use clear service boundaries.

Suggested domains:

/auth
/vendors
/clients
/industries
/categories
/websites
/themes
/pages
/sections
/crm
/telecrm
/bookings
/appointments
/orders
/quotes
/enquiries
/payments
/communications
/whatsapp
/sms
/email
/ai
/ai/jobs
/wallet
/campaigns
/notifications
/analytics
/integrations
/automations

Do not duplicate business logic between frontend applications.

==================================================
36. SECURITY
==================================================

All secret credentials must remain server-side.

Never expose:

- API keys
- WhatsApp credentials
- SMS credentials
- Email provider secrets
- AI provider keys
- Payment secrets

in browser/client bundles.

Implement:

- Authentication
- Authorization
- Role-based access
- Tenant isolation
- Secure secrets
- Audit logging
- Input validation
- Rate limiting where appropriate
- Webhook verification
- Secure file handling

==================================================
37. MULTI-TENANCY
==================================================

Get4Domain is a multi-vendor platform.

Every vendor/business must have isolated:

- Customers
- Leads
- Communications
- Campaigns
- Wallet
- Payments
- Websites
- AI usage
- Settings
- Integrations
- Staff
- Business data

Never allow cross-tenant data access.

==================================================
38. CLIENT/VENDOR RELATIONSHIP
==================================================

A client/customer belongs to or interacts with a vendor/business.

The system must maintain:

Vendor
→ Customers
→ Leads
→ Activities
→ Orders
→ Bookings
→ Appointments
→ Payments
→ Communications

Customer timeline should provide a unified history where applicable.

==================================================
39. RESPONSIVE/PWA
==================================================

Build all major experiences as responsive WebApps.

Desktop:
SaaS-style interface.

Mobile:
PWA/app-style interface.

Requirements:

- Bottom navigation
- Installable PWA architecture
- Responsive layouts
- Offline-aware shell where appropriate
- Push notifications where supported
- Touch-friendly controls
- Mobile forms
- Mobile modals/sheets
- Mobile-friendly tables
- Mobile-friendly CRM
- Mobile-friendly communication inbox

==================================================
40. DESIGN QUALITY
==================================================

Do not create generic AI-generated-looking UI.

Avoid excessive:

- Rounded cards
- Gradients
- Glassmorphism
- Floating blobs
- Repetitive 3-card layouts
- Generic SaaS hero sections

Design should be:

- Modern
- Premium
- Clear
- Functional
- Industry-specific
- Conversion-focused
- Accessible
- Responsive

==================================================
41. EXISTING APPLICATION
==================================================

Before changing existing code:

1. Inspect project structure.
2. Identify frontend applications.
3. Identify backend.
4. Identify API contracts.
5. Identify database/schema.
6. Identify authentication.
7. Identify existing dashboard.
8. Identify existing reusable components.
9. Identify current integrations.
10. Identify what is already implemented.

Do not rebuild working systems unnecessarily.

Preserve existing functionality.

Extend architecture where appropriate.

==================================================
42. IMPLEMENTATION PRINCIPLE
==================================================

Do not attempt to build every industry as 135 separate applications.

Build:

COMMON ENGINE
+
INDUSTRY CONFIGURATION
+
INDUSTRY DESIGN SYSTEM
+
OPERATION ENGINE
+
INTEGRATION ENGINE

Then progressively implement industry experiences.

The first complete industry can be used to validate architecture, but it is NOT the final product scope.

==================================================
43. DEVELOPMENT PHASES
==================================================

PHASE 1

Audit existing application.

Produce:

- Architecture map
- Existing functionality map
- API map
- Database map
- Reusable components
- Missing capabilities
- Technical risks
- Integration requirements

Do not modify code during the audit.

PHASE 2

Define:

- Industry registry
- Category registry
- Business model registry
- Operation registry
- Feature registry
- Integration registry
- Automation registry

PHASE 3

Build/extend:

- Industry Experience Engine
- Theme system
- Page system
- Section system
- Operation engine

PHASE 4

Implement Vendor WebApp integration.

PHASE 5

Implement Client WebApp integration.

PHASE 6

Implement Communication Hub:

- WhatsApp
- SMS
- Email
- Unified inbox

PHASE 7

Implement AI Studio:

- Text/content
- Poster
- Reel
- Provider abstraction
- Wallet usage

PHASE 8

Implement Business Operations.

PHASE 9

Implement Payments.

PHASE 10

Implement Notifications.

PHASE 11

Implement CRM + TeleCRM.

PHASE 12

Implement Growth Hub.

PHASE 13

Implement Public Website / Lead Generation.

PHASE 14

Implement PWA/mobile experiences.

PHASE 15

Implement industry packs systematically.

PHASE 16

QA, security, performance and production hardening.

==================================================
44. CLAUDE CODE EXECUTION RULE
==================================================

Do not blindly start coding.

First inspect the existing project.

Then create an implementation plan.

For every major change:

1. Explain what currently exists.
2. Explain what needs to change.
3. Identify dependencies.
4. Identify affected files/modules.
5. Implement incrementally.
6. Run tests/build/type checks.
7. Verify responsive behavior.
8. Verify existing functionality remains intact.

Do not rewrite large portions of the application unless necessary.

==================================================
45. ACCEPTANCE CRITERIA
==================================================

The platform is successful when:

A vendor can:

Signup
→ select industry
→ select category
→ configure business
→ receive industry-specific recommended experience
→ configure website
→ configure operations
→ configure CRM
→ configure communications
→ configure payments
→ configure AI Studio
→ configure campaigns
→ preview desktop/mobile
→ publish

A client can:

Discover business
→ view industry-specific experience
→ perform the relevant business action
→ book/order/enquire/quote/site visit/apply/etc.
→ pay where applicable
→ receive notifications
→ communicate
→ view history/status

The vendor can then:

Receive the activity
→ CRM
→ notification
→ communication
→ task
→ automation
→ payment/order/booking processing
→ analytics

==================================================
46. FINAL PRODUCT PRINCIPLE
==================================================

Get4Domain must NOT be:

"AI website templates for businesses."

It should be:

"An industry-aware business WebApp platform that adapts the digital experience, business operations, customer journey, communications, payments, CRM, AI marketing and automation to the way each business actually operates."

The platform should make the industry selection meaningful.

Industry selection must change more than appearance.

It must influence:

- UX
- UI
- Navigation
- Modules
- Operations
- Customer journey
- Vendor workflow
- Client workflow
- Features
- Integrations
- Automations
- AI Studio
- Notifications
- CRM
- Analytics

Build the architecture accordingly.