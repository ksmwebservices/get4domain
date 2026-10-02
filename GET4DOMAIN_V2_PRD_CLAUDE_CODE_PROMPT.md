> **⚠ SUPERSEDED — HISTORICAL DOCUMENT (as of 2026-10-02).**
> This document is superseded by [`docs/reference/GET4DOMAIN_V2_PRD.md`](docs/reference/GET4DOMAIN_V2_PRD.md), the authoritative master PRD for Get4Domain V2.
> It is retained unchanged below for historical reference only. Do not use it as a source of requirements; where it conflicts with the V2 PRD, the V2 PRD wins.

---

# Get4Domain V2 — Vendor Workplace, Growth, Commerce & Marketing PRD
## Implementation Prompt for Claude Code

**Document purpose:** This is the implementation source of truth for the Get4Domain V2 redesign. Claude Code must inspect the existing Get4Domain repository, existing demo website, existing Vendor Dashboard, and the new Next.js frontend files supplied by the product team, then implement the approved V2 architecture without removing working functionality.

**Reference competitor:** LentloSites is used only as product inspiration and competitive reference. Do not copy its branding, proprietary text, assets, visual identity, source code, or exact UI. Recreate the useful product concepts natively in Get4Domain with a distinct professional UI.

**Reference site:** https://www.lentlosites.com/
The reference currently exposes a Main Dashboard, website-level dashboard, contextual menus, CRM/WhatsApp, Growth/Marketing, SEO/Grow, Search Insights, Marketing Kit, sales channels, multiple industry-specific website types, commerce/food/grocery/travel/vehicle/finance/catalogue/news/rental capabilities, and business operations. Its current feature catalogue lists 11 website/business categories plus CRM and WhatsApp API. Treat these as inspiration, not a requirement to duplicate every implementation detail.

---

# 1. OBJECTIVES

Build Get4Domain V2 as a professional, scalable, industry-aware SaaS platform with:

1. A redesigned professional Vendor Workplace.
2. A redesigned Main Dashboard.
3. Context-aware navigation by business category/capabilities.
4. Existing Get4Domain functionality preserved and enhanced.
5. Complete Growth/Marketing engine.
6. SEO Manager inspired by the competitor's Grow concept.
7. Marketing Studio for static creatives and business documents.
8. Social account connection and publishing architecture.
9. WhatsApp Business/API, catalogue, inbox, broadcasts and automation architecture.
10. E-commerce, food/restaurant, grocery, travel, vehicles, finance, catalogue, news, rental and service-business capabilities.
11. Sales Channel/Marketplace connector architecture.
12. Delivery/shipping API connector architecture.
13. Search Insights.
14. Coupons, cashback, flash deals, loyalty and referral/affiliate systems.
15. Analytics connecting traffic → leads → communication → orders → revenue.
16. Reusable product/service/business data so vendors enter information once and reuse it everywhere.
17. A clean responsive UI suitable for desktop, tablet and mobile.
18. Demo-ready category experiences with realistic demo data.
19. A modular architecture that can grow without duplicating business logic.

---

# 2. NON-NEGOTIABLE IMPLEMENTATION RULES

## 2.1 Inspect before changing

Claude Code MUST first inspect:

- Entire existing repository.
- Existing package.json and lockfile.
- Existing Next.js/React structure.
- Existing routes.
- Existing API routes/backend.
- Existing database/schema/migrations.
- Existing authentication.
- Existing Vendor Dashboard.
- Existing admin dashboard.
- Existing website/demo pages.
- Existing category/industry definitions.
- Existing reusable UI components.
- Existing tests.
- Existing environment variable documentation.
- Existing deployment configuration.

Do not rewrite working backend logic merely to match a new UI.

## 2.2 New frontend source from Bolt

The product team may provide a complete Next.js frontend exported from Bolt.

The source may be uploaded:
- through the Admin Dashboard, or
- into a server/repository folder.

Claude Code MUST locate the supplied source and inspect it before implementation.

If a new frontend is present:
- reuse its useful components/layouts/assets;
- integrate it into the existing application architecture;
- preserve working APIs;
- remove duplicate/demo-only implementations;
- replace mock data with real application data where available;
- do not blindly overwrite the existing application.

## 2.3 Existing functionality must not disappear

Before changing a module, identify what currently works.

Create an internal implementation matrix:

| Existing Feature | Existing Route | Existing API | Existing UI | V2 Status |
|---|---|---|---|---|
| Lead management | verify | verify | verify | preserve/enhance |
| Tasks | verify | verify | verify | preserve/enhance |
| CRM | verify | verify | verify | preserve/enhance |
| Communication Hub | verify | verify | verify | preserve/enhance |
| SMS | verify | verify | verify | preserve/enhance |
| Email | verify | verify | verify | preserve/enhance |
| WhatsApp | verify | verify | verify | preserve/enhance |
| Website | verify | verify | verify | preserve/enhance |
| POS | verify | verify | verify | preserve/enhance |
| Bookings | verify | verify | verify | preserve/enhance |
| Payments | verify | verify | verify | preserve/enhance |
| AI Center/Studio | verify | verify | verify | preserve/enhance |

Fill this from the actual repository; never assume.

---

# 3. DESIGN DIRECTION

## 3.1 Professional SaaS theme

The existing demo UI is not considered the final design standard.

Create a polished B2B SaaS dashboard:
- clean light base;
- professional neutral surfaces;
- strong typography hierarchy;
- restrained shadows;
- consistent border radius;
- clear spacing system;
- accessible contrast;
- compact but readable tables;
- responsive cards;
- useful empty states;
- consistent icon system;
- clear status badges;
- no excessive gradients;
- no childish/consumer styling;
- no visually noisy dashboards.

Do NOT copy Lentlo's colors or branding.

## 3.2 Navigation

Use a desktop sidebar + responsive mobile navigation.

Main navigation should be contextual.

Base navigation:

- Dashboard
- Analytics
- Leads
- Customers
- Communication Hub
- Growth
- Marketing Studio
- Products / Services
- Orders
- Bookings
- Tasks
- Payments
- Website
- Client App / PWA
- AI Center
- Reports
- Settings

Additional category-specific modules appear only when relevant.

---

# 4. MAIN DASHBOARD

Create a high-quality operational dashboard.

## Header

- greeting;
- business name;
- business switcher if multiple businesses;
- notifications;
- quick create;
- profile/settings.

## KPI cards

- Leads
- Customers
- Orders
- Sales
- Bookings
- Pending Tasks
- Marketing Leads
- Conversion Rate

Allow period:
- Today
- 7 days
- 30 days
- Custom

## Action Center

Show:
- new leads not contacted;
- follow-ups due;
- pending orders;
- pending bookings;
- failed payments;
- campaigns awaiting approval;
- SEO issues;
- catalogue sync issues;
- marketplace/API issues.

Each item must have a direct action.

## Growth Snapshot

- Growth Score
- SEO Score
- Lead Conversion
- Customer Retention
- Marketing Activity
- Review health

## Lead Pipeline

- New
- Contacted
- Qualified
- Proposal/Quotation
- Won
- Lost

## Sales / Orders chart

Actual database values only.

## Marketing performance

- visitors;
- leads;
- orders;
- revenue;
- channel/source.

## Recent Activity

Unified timeline:
- lead created;
- call;
- WhatsApp;
- SMS;
- email;
- task;
- order;
- payment;
- campaign;
- social publish;
- coupon use;
- loyalty redemption.

---

# 5. CONTEXTUAL BUSINESS CAPABILITIES

Do not show every feature to every vendor.

Create a capability configuration layer.

Examples:

### Service Business
- Leads
- Customers
- Bookings
- Communication
- Tasks
- Growth
- Marketing Studio
- Payments
- Website

### E-commerce
- Products
- Categories
- Inventory
- Orders
- Shipping
- Coupons
- Loyalty
- Customers
- Communication
- Growth
- Sales Channels
- Marketing Studio
- Payments

### Restaurant/Food
- Menu
- Categories
- Tables
- QR ordering
- Orders
- Kitchen
- Delivery
- Bookings/reservations
- Customers
- Communication
- Growth
- Marketing Studio
- Payments

### Grocery
- Products
- Variants/weights
- Inventory
- Orders
- Delivery zones
- Routes
- Customers
- Credit/Khata
- Communication
- Growth

### Real Estate
- Leads
- Properties
- Site Visits
- Follow-ups
- TeleCRM
- Tasks
- Documents
- Communication
- Campaigns
- Growth

### Vehicle Dealer
- Inventory
- Vehicles
- Leads
- Enquiries
- Site/test drives
- Finance leads
- Communication
- Growth

### Finance/Insurance
- Leads
- Products/Plans
- Applications
- Documents
- Follow-ups
- Agents
- Communication
- Growth

### Catalogue
- Products
- Categories
- WhatsApp enquiries
- Leads
- Communication
- Growth
- Marketing Studio

### News/Media
- Articles
- Categories
- Authors
- E-paper/content
- Ads
- Notices/payment links
- Subscribers
- Growth/SEO
- Analytics

### Travel
- Packages
- Hotels
- Transport
- Bookings
- Enquiries
- Payments
- Customers
- Communication
- Growth

### Vehicle Rental
- Fleet
- Availability
- Bookings
- Pricing
- Delivery/pickup
- Customers
- Payments
- Growth

### Landing Page
- Campaigns
- Leads
- Forms
- Analytics
- SEO
- Marketing Studio

---

# 6. CATEGORY COVERAGE

Implement/prepare the architecture for:

1. Online Store / E-commerce
2. Restaurant & Food
3. Kirana & Grocery
4. Business Website / Services
5. Vehicles Buy & Sell
6. Finance & Insurance
7. Catalogue / WhatsApp Enquiry
8. News & Magazine
9. Travel Booking
10. Vehicle Rental
11. Landing Page

Also support business profiles such as:
- salon/spa;
- clinic/doctor;
- gym/fitness;
- coaching/tuition;
- portfolio;
- company website;
- hotel/homestay;
- real estate;
- astrologer;
- jeweller;
- tools/machinery;
- distributor/wholesaler;
- export house;
- group/holding company.

Use capabilities rather than hard-coding every business type separately.

---

# 7. LEADS / CRM

## Lead profile

Fields:
- name;
- phone;
- email;
- source;
- campaign;
- product/service interest;
- assigned staff;
- stage;
- score;
- tags;
- notes;
- next follow-up;
- last activity.

## Lead timeline

- calls;
- WhatsApp;
- SMS;
- email;
- notes;
- tasks;
- appointments;
- quotations;
- status changes.

## Pipeline

Drag/drop or stage actions:
- New
- Contacted
- Qualified
- Proposal
- Negotiation
- Won
- Lost

## Lead sources

- Website
- WhatsApp
- Facebook
- Instagram
- Google
- Google Ads
- Google Shopping
- Marketplace
- Referral
- Manual
- QR
- Campaign

---

# 8. TASK MANAGEMENT

Tasks must integrate with Leads/CRM.

Task fields:
- title;
- lead/customer;
- owner;
- priority;
- due date/time;
- status;
- notes;
- recurring;
- source.

Automations:
- new lead → task to contact;
- missed follow-up → reminder;
- quotation sent → follow-up task;
- booking created → confirmation task where needed.

---

# 9. TELECRM

Phase architecture:
- click-to-call;
- call log;
- call duration;
- call outcome;
- next follow-up;
- agent assignment;
- call reports.

Future-ready:
- telephony provider connector;
- IVR;
- recording;
- queues.

Do not tightly couple the core CRM to one telecom vendor.

---

# 10. COMMUNICATION HUB

Unified module:

## Inbox
- WhatsApp
- SMS
- Email
- internal notes

## Templates
- lead response;
- order;
- booking;
- payment;
- shipping;
- campaign;
- follow-up.

## Automation

Examples:
- new lead;
- order placed;
- order confirmed;
- shipped;
- delivered;
- booking reminder;
- abandoned enquiry/cart;
- price drop;
- inactive customer;
- review request.

Maintain consent/opt-out and provider rules.

---

# 11. WHATSAPP

Architecture must support the vendor's own authorized WhatsApp Business/API account.

Features:
- inbox;
- contacts;
- templates;
- broadcasts;
- auto replies;
- keyword replies;
- AI-assisted replies;
- automation;
- message history;
- charges;
- delivery status;
- webhook health;
- number/account health;
- catalogue sync;
- order updates;
- abandoned cart recovery;
- price-drop alerts;
- human handoff.

Do not store vendor passwords.

Use official Meta authorization/API mechanisms.

---

# 12. SMS

Provider abstraction:
- provider connection;
- sender ID where supported;
- templates;
- campaigns;
- transactional messages;
- delivery status;
- usage/cost;
- opt-out.

---

# 13. EMAIL

Features:
- SMTP/provider connection;
- sender verification;
- templates;
- campaigns;
- transactional email;
- scheduling;
- delivery/open/click tracking where provider permits;
- unsubscribe;
- campaign analytics.

---

# 14. GROWTH MODULE

Growth is a major V2 product area.

Navigation:

- Growth Overview
- SEO Manager
- Marketing Studio
- Social Media
- Campaigns
- Offers
- Loyalty & Rewards
- Referrals / Affiliates
- Search Insights
- Share Links
- Sales Channels
- Growth Analytics

---

# 15. GROWTH OVERVIEW

Show:
- Growth Score;
- SEO score;
- visitors;
- leads;
- orders;
- revenue;
- conversion;
- repeat customers;
- campaigns;
- reviews;
- top acquisition channels.

Recommendations:
- missing SEO title;
- missing meta description;
- poor product content;
- inactive customer segment;
- high-demand search with no result;
- unsynced catalogue;
- campaign opportunity.

Every recommendation should have an action.

---

# 16. SEO MANAGER

Inspired by the useful concept of a Grow page, but implemented as a Get4Domain-native SEO manager.

## SEO score

Categories:
- Technical SEO
- On-page SEO
- Local SEO
- Product SEO
- Content SEO
- Performance
- Indexing

## Technical checks
- HTTPS;
- sitemap;
- robots;
- canonical;
- mobile friendliness;
- broken links;
- image optimization;
- page speed indicators;
- duplicate metadata.

## On-page checks
- title;
- meta description;
- H1;
- H2;
- ALT text;
- internal links;
- readable URL;
- content quality.

## Local SEO
- business name;
- address;
- phone;
- service area;
- opening hours;
- Google Business Profile;
- Maps;
- reviews;
- local keywords.

## Product SEO
Auto-suggest:
- SEO title;
- meta description;
- slug;
- ALT;
- product description;
- FAQ;
- structured data.

## Search/indexing
- sitemap status;
- submission status;
- indexing checks;
- Search Console connection;
- ranking data where available.

## Issue list

Each issue:
- severity;
- page;
- explanation;
- suggested fix;
- Fix Now.

Do not promise guaranteed rankings.

---

# 17. SEARCH INSIGHTS

Record internal website searches.

Show:
- search term;
- count;
- date;
- result count;
- products shown;
- logged-in customer where available.

Special sections:
- Most searched;
- Found nothing;
- By customer;
- searches/day.

Actions for zero-result searches:
- choose products;
- create search synonym;
- fix spelling;
- create category;
- add product;
- create campaign.

Example:
"drill machine" → map to "rotary hammer".

Search Insights must be clearly distinguished from Google search analytics.

---

# 18. MARKETING STUDIO — PHASE 1

Phase 1 is STATIC ASSETS + BUSINESS DOCUMENTS.

Do NOT block Phase 1 on AI video.

## Reels/Video
Display:
**AI Reels & Video — Coming Soon**

No production implementation required in Phase 1.

## Social creatives
Generate/export:
- Instagram post 1:1;
- Instagram story 9:16;
- Facebook post;
- Facebook cover;
- LinkedIn post;
- WhatsApp status 9:16;
- Google Business post;
- YouTube thumbnail;
- promotional banner;
- festival poster;
- offer poster;
- product poster;
- service poster.

## Business assets
- Business Card;
- Employee ID Card;
- Letterhead;
- Invoice;
- Estimate/Quotation;
- Receipt;
- Payment Receipt;
- Payslip;
- Purchase Order;
- Delivery Note;
- Certificate;
- Appointment Card;
- Thank-you Card;
- Membership Card.

---

# 19. DATA-AWARE DESIGN GENERATION

The vendor must NOT retype information.

Fetch from:
- Business Profile;
- Branding;
- Products;
- Services;
- Customers;
- Employees;
- Orders;
- Offers;
- payment/billing data.

For documents such as invoice/payslip:
- use structured templates and real database values;
- AI can assist with wording/design, but must never invent financial values.

For promotional posters:
- use actual products/prices/offers;
- require vendor confirmation before export/publish.

---

# 20. SOCIAL MEDIA CONNECTIONS

Create:

**Growth → Social Media → Connected Accounts**

Support architecture for:
- Facebook Pages;
- Instagram Professional accounts;
- YouTube channels.

Vendor owns the external account.

Use official OAuth/API authorization.

Never request/store social passwords.

Show:
- connected account;
- connection status;
- scopes/permissions;
- reconnect;
- disconnect;
- last sync;
- publishing errors.

---

# 21. SOCIAL PUBLISHING

Phase 1:
- prepare content;
- export;
- schedule architecture;
- publish where official API access is implemented.

Future/implementation:
- Facebook Page publishing;
- Instagram publishing for eligible professional accounts;
- YouTube upload/metadata;
- content calendar;
- scheduled posts;
- publish history;
- error/retry.

Do not claim an external platform supports an operation unless its current API permits it.

---

# 22. SALES CHANNELS

Create a dedicated Sales Channels module.

Potential channels:
- Get4Domain Website;
- Google Shopping/Merchant;
- Facebook/Instagram catalogue;
- WhatsApp catalogue;
- supported marketplaces;
- future partner portals.

For each connector:
- connect/authenticate;
- product mapping;
- category mapping;
- price sync;
- inventory sync;
- image sync;
- order import;
- order status sync;
- error log;
- last sync.

Use connector abstraction so new marketplaces can be added without changing core commerce.

---

# 23. MARKETPLACE CONNECTOR FRAMEWORK

Connector interface should conceptually support:

- authenticate();
- disconnect();
- syncProduct();
- syncProducts();
- syncInventory();
- syncPrice();
- fetchOrders();
- updateOrder();
- fetchReturns();
- updateShipment();
- getStatus();
- getErrors().

Do not hard-code marketplace-specific logic into Products/Orders core.

Where no API exists:
- support feed/export/manual workflow;
- clearly show integration capability status.

---

# 24. DELIVERY / SHIPPING CONNECTORS

Create:

**Commerce → Shipping**

Features:
- shipping provider connection;
- serviceability;
- pincode check;
- rate calculation;
- shipment creation;
- label;
- tracking number;
- tracking URL;
- pickup;
- cancellation;
- delivery status;
- COD;
- returns.

Connector architecture:
- provider abstraction;
- configurable priority;
- fallback provider;
- manual courier option.

---

# 25. E-COMMERCE

Core:
- products;
- variants;
- categories;
- inventory;
- SKU;
- barcode;
- GST;
- HSN;
- pricing;
- MRP/sale price;
- customer pricing;
- wholesale/member pricing;
- cart;
- checkout;
- orders;
- payments;
- shipping;
- returns;
- invoices;
- reviews;
- wishlist;
- search;
- coupons;
- cashback;
- loyalty;
- abandoned cart.

Product model must support:
- physical;
- digital;
- service where appropriate.

---

# 26. RESTAURANT & FOOD

Separate capability engine:
- menu;
- categories;
- variants/add-ons;
- veg/non-veg;
- preparation time;
- dine-in;
- QR table ordering;
- takeaway;
- delivery;
- kitchen;
- order states;
- table management;
- reservations;
- delivery zones;
- delivery fee;
- restaurant coupons;
- customer history;
- POS;
- payments;
- reports.

---

# 27. GROCERY / KIRANA

- products;
- variants by weight;
- 250g/500g/1kg etc.;
- stock;
- low-stock alerts;
- delivery zones;
- route support;
- customer credit/Khata;
- recurring essentials;
- offers;
- WhatsApp ordering;
- POS.

---

# 28. OFFERS ENGINE

## Coupons
- percentage;
- fixed;
- first order;
- product-specific;
- category-specific;
- customer-specific;
- minimum order;
- usage limit;
- one-use/customer;
- start/end;
- weekday rules.

## Cashback
- percentage/fixed;
- maximum cashback;
- wallet credit;
- expiry;
- minimum next purchase.

## Flash Deals
- start/end;
- countdown;
- stock limit;
- quantity/customer;
- product/category.

---

# 29. LOYALTY & REWARDS

- points per ₹;
- redemption value;
- minimum points;
- maximum redemption;
- expiry;
- bonus points;
- birthday;
- festival multiplier;
- customer balance;
- transaction ledger.

Integrate with CRM and campaigns.

---

# 30. REFERRALS / AFFILIATES / PROMOTERS

Two concepts:

## Affiliate
Commission based on conversions/sales.

Features:
- affiliate account;
- referral URL;
- coupon;
- clicks;
- leads;
- orders;
- revenue;
- commission;
- payout;
- status.

## Promoter
Traffic/referral attribution where supported.

Features:
- share links;
- QR;
- counted visitors;
- source;
- campaign;
- fraud/duplicate controls;
- payout rules.

---

# 31. SHARE LINKS

Create campaign-aware links.

Fields:
- campaign;
- source;
- medium;
- content.

Track:
- clicks;
- visitors;
- leads;
- orders;
- revenue.

Support QR generation.

---

# 32. GROWTH ANALYTICS

Show:
- visitors;
- source;
- leads;
- conversion;
- orders;
- revenue;
- average order;
- repeat purchase;
- campaign performance;
- coupon usage;
- loyalty;
- affiliate;
- social where APIs permit;
- Google;
- WhatsApp;
- SMS;
- email.

Important:
Money metrics must come from real order/payment records, not estimates.

---

# 33. ANALYTICS

Create:
- Overview;
- Live;
- Visitors;
- Pages;
- Sources;
- Campaigns;
- Products;
- Search;
- App/PWA;
- Orders;
- Conversion funnel.

Track:
- Google;
- Google Shopping;
- Google Ads;
- Meta;
- Instagram;
- Facebook;
- WhatsApp;
- direct;
- UTM;
- QR;
- referrals;
- marketplaces.

---

# 34. PRODUCT MASTER

Create one canonical product model.

It feeds:
- website;
- POS;
- invoice;
- Google Shopping;
- Meta catalogue;
- WhatsApp catalogue;
- marketplace connectors;
- marketing creatives;
- campaigns;
- affiliates;
- search;
- analytics.

Price/stock changes must propagate to supported connected channels.

---

# 35. BUSINESS MASTER

One source of truth:
- business name;
- logo;
- address;
- phone;
- email;
- website;
- WhatsApp;
- social accounts;
- GST;
- tax settings;
- bank/payment info;
- working hours;
- service areas;
- brand colours;
- typography/preferences.

Reuse in:
- website;
- SEO;
- posters;
- business cards;
- letterhead;
- invoices;
- quotations;
- payslips;
- campaigns.

---

# 36. EMPLOYEE MASTER

Fields:
- name;
- employee ID;
- designation;
- phone;
- email;
- joining date;
- department;
- permissions;
- salary configuration.

Reuse in:
- ID card;
- payslip;
- tasks;
- CRM;
- call assignment.

---

# 37. DOCUMENT ENGINE

Create a reusable template engine.

Requirements:
- templates;
- variables;
- sections;
- branding;
- page sizes;
- print-safe margins;
- preview;
- edit;
- export PDF;
- export PNG/JPG where relevant;
- save template;
- duplicate;
- version.

Supported paper formats:
- A4;
- A5;
- Letter;
- custom;
- card;
- ID card;
- social dimensions.

---

# 38. AI INTEGRATION

Use OpenAI only where appropriate.

Phase 1 AI:
- poster/creative generation;
- copy generation;
- SEO suggestions;
- product description;
- social caption;
- hashtags;
- campaign text;
- document wording assistance.

AI must receive actual vendor context from structured data.

Never allow AI to invent:
- price;
- GST;
- tax;
- account number;
- phone;
- address;
- product availability;
- invoice totals.

For financial documents, deterministic application data wins over AI output.

---

# 39. AI REELS — LATER

Phase 1:
**Coming Soon**

Do not implement full AI video generation now.

Future architecture:
- prompt → storyboard;
- scenes;
- images/video assets;
- voice;
- captions;
- music/licensing;
- renderer;
- MP4;
- approval;
- publishing.

---

# 40. WEBSITE / CMS

Preserve/enhance:
- pages;
- sections;
- menus;
- header/footer;
- blog;
- media;
- forms;
- landing pages;
- SEO;
- domain;
- SSL;
- branding;
- responsive layouts.

All website types must use the same core CMS with capability extensions.

---

# 41. CLIENT PWA / APP

Preserve/enhance:
- installable PWA;
- customer account;
- orders;
- bookings;
- wallet;
- loyalty;
- notifications;
- catalogue;
- profile;
- order tracking.

Future app integrations must not duplicate the commerce backend.

---

# 42. PAYMENTS

Preserve existing payment integration.

Architecture:
- payment provider abstraction;
- orders;
- refunds;
- settlement;
- payment status;
- webhooks;
- reconciliation.

Never trust client-side payment success without server-side verification.

---

# 43. BILLING / GST

Support:
- invoices;
- estimates;
- receipts;
- GST;
- HSN;
- tax rates;
- customer GSTIN;
- credit notes;
- debit notes where applicable;
- PDF;
- WhatsApp/email delivery;
- reporting.

---

# 44. POS

Support:
- product search;
- barcode;
- cart;
- customer;
- cash;
- UPI/payment;
- discount;
- GST;
- invoice;
- stock deduction;
- returns;
- credit/Khata.

---

# 45. BOOKINGS

Support:
- services;
- staff;
- availability;
- calendar;
- booking form;
- confirmation;
- reminders;
- cancellation;
- reschedule;
- payment;
- customer history.

---

# 46. REPORTS

Reports:
- sales;
- orders;
- customers;
- leads;
- conversion;
- products;
- inventory;
- GST;
- payments;
- bookings;
- marketing;
- campaigns;
- communication;
- staff;
- affiliate;
- delivery.

Export CSV/PDF where appropriate.

---

# 47. TEAM & PERMISSIONS

Roles:
- Owner;
- Admin;
- Manager;
- Sales;
- Marketing;
- Accountant;
- Support;
- Kitchen;
- Delivery;
- Custom role.

Permissions should be granular:
- view;
- create;
- edit;
- delete;
- export;
- approve;
- publish;
- financial visibility;
- customer data;
- marketing;
- integrations.

---

# 48. SETTINGS

Business:
- profile;
- branding;
- tax;
- hours;
- locations.

Team:
- roles;
- staff;
- permissions.

Channels:
- WhatsApp;
- SMS;
- email;
- social.

Commerce:
- payments;
- shipping;
- taxes;
- returns.

Integrations:
- Google;
- Meta;
- YouTube;
- WhatsApp;
- marketplace;
- delivery;
- payment.

Security:
- sessions;
- audit logs;
- webhooks;
- API credentials.

---

# 49. AUDIT LOG

Track:
- login;
- permission changes;
- product price change;
- stock change;
- order edit;
- refund;
- invoice change;
- campaign publish;
- social publish;
- integration connect/disconnect;
- user actions.

---

# 50. ERROR / SYNC CENTER

Create a centralized integration health page.

Show:
- connector;
- status;
- last sync;
- next sync;
- failed items;
- reason;
- fix action;
- retry.

Examples:
- Meta token expired;
- Google product rejected;
- WhatsApp webhook disconnected;
- delivery API failed;
- marketplace SKU mismatch.

---

# 51. DEMO ENVIRONMENT

Create demo data for every major category.

Demo users should see:
- realistic products;
- customers;
- orders;
- leads;
- tasks;
- bookings;
- campaigns;
- analytics;
- growth;
- SEO;
- communications.

Do not use real customer data.

Create a category demo switcher.

---

# 52. CATEGORY DEMO REVIEW — MANDATORY

Claude Code MUST go through the complete live/demo experience available from the supplied application and verify:

- main dashboard;
- category landing;
- website;
- vendor dashboard;
- menus;
- every tab;
- every category;
- products;
- orders;
- CRM;
- leads;
- tasks;
- communication;
- marketing;
- growth;
- settings;
- mobile view;
- empty states;
- loading;
- error states.

Do not stop after implementing the first dashboard.

---

# 53. COMPETITOR REVIEW — MANDATORY

Review https://www.lentlosites.com/ as a reference.

At minimum inspect:
- Main Dashboard;
- feature/category catalogue;
- demo dashboard;
- Growth/Grow;
- Marketing Kit;
- Search Insights;
- Sales Channels;
- WhatsApp;
- CRM;
- analytics;
- online store;
- restaurant/food;
- grocery;
- catalogue;
- vehicles;
- finance;
- news;
- travel;
- vehicle rental;
- business/service websites;
- landing pages;
- app/PWA;
- relevant pricing/packaging.

Record useful product concepts in an internal comparison matrix:

| Concept | Lentlo-inspired | Existing Get4Domain | V2 decision |
|---|---|---|---|
| Grow/SEO | Yes | verify | implement/enhance |
| Marketing Kit | Yes | verify | implement |
| Search Insights | Yes | verify | implement |
| Sales Channels | Yes | verify | implement |
| WhatsApp catalogue | Yes | verify | implement |
| Loyalty | Yes | verify | implement |
| Coupons | Yes | verify | implement |
| Affiliate | Yes | verify | implement |
| Social publishing | Yes/industry standard | verify | implement via APIs |
| Delivery connectors | Yes/industry standard | verify | connector framework |

Do not copy competitor source code or assets.

---

# 54. API / CONNECTOR SAFETY

All external integrations must use official supported APIs or documented feeds.

Do not:
- scrape private dashboards;
- automate browser login;
- collect external passwords;
- bypass API permissions;
- promise unsupported posting;
- fake successful sync.

Every connector must report its actual state.

---

# 55. DATABASE / ARCHITECTURE PRINCIPLES

Prefer normalized core entities:
- businesses;
- users;
- roles;
- permissions;
- products;
- categories;
- variants;
- inventory;
- customers;
- leads;
- activities;
- tasks;
- orders;
- order_items;
- payments;
- invoices;
- bookings;
- campaigns;
- campaign_channels;
- offers;
- loyalty_accounts;
- loyalty_transactions;
- affiliates;
- referrals;
- share_links;
- marketing_assets;
- documents;
- social_accounts;
- channel_connections;
- channel_products;
- channel_orders;
- integrations;
- sync_jobs;
- sync_errors;
- notifications;
- templates;
- audit_logs.

Use tenant/business IDs consistently.

---

# 56. MULTI-TENANCY

Every business-owned record must be tenant-scoped.

Never expose another vendor's:
- customers;
- orders;
- products;
- leads;
- payments;
- documents;
- campaigns;
- credentials.

Test cross-tenant isolation.

---

# 57. SECURITY

- OAuth tokens encrypted at rest;
- secrets never in frontend;
- signed webhooks;
- server-side authorization;
- rate limiting;
- audit logs;
- secure file uploads;
- validation;
- CSRF protections where applicable;
- XSS prevention;
- SQL/NoSQL injection prevention;
- least-privilege external scopes.

---

# 58. RESPONSIVE UI

Test:
- desktop 1440px;
- laptop 1280px;
- tablet;
- mobile 390px;
- mobile 360px.

No horizontal overflow.

Tables need responsive alternatives.

Forms need usable mobile controls.

---

# 59. UX REQUIREMENTS

Every important action needs:
- loading state;
- success state;
- error state;
- empty state;
- confirmation for destructive actions;
- retry where appropriate.

Use:
- breadcrumbs;
- contextual help;
- search;
- filters;
- bulk actions;
- pagination;
- export;
- saved filters where useful.

---

# 60. TESTING

Before declaring complete:

## Unit tests
Core business logic.

## Integration tests
APIs/database.

## E2E
- login;
- dashboard;
- lead;
- task;
- customer;
- product;
- order;
- payment;
- booking;
- campaign;
- document;
- integration connection mock;
- search insights;
- SEO;
- marketing asset.

## Responsive smoke tests
Desktop/tablet/mobile.

## Security tests
Tenant isolation and permissions.

## Regression
Existing Get4Domain features must continue working.

---

# 61. IMPLEMENTATION PHASES

## P007 — Discovery & Baseline
- inspect repository;
- inspect existing demo;
- inspect supplied Bolt frontend;
- inventory all routes/features;
- establish current baseline;
- competitor review.

## P008 — V2 UI Foundation
- design system;
- navigation;
- sidebar;
- dashboard shell;
- responsive layout;
- reusable components.

## P009 — Main Dashboard + Contextual Navigation
- dashboard;
- capability engine;
- category demo switcher.

## P010 — CRM / Leads / Tasks / Communication
- lead timeline;
- tasks;
- TeleCRM foundation;
- communication hub.

## P011 — Growth Foundation
- Growth overview;
- SEO Manager;
- Search Insights;
- Share Links;
- Analytics.

## P012 — Marketing Studio
- static social creatives;
- business documents;
- data-aware generation;
- templates;
- PDF/image export;
- reels placeholder.

## P013 — Commerce
- products;
- variants;
- inventory;
- orders;
- coupons;
- cashback;
- loyalty;
- POS;
- billing.

## P014 — Food / Grocery / Service Vertical Enhancements
- restaurant;
- QR;
- kitchen;
- grocery;
- delivery;
- booking.

## P015 — Sales Channels / Connectors
- Google;
- Meta catalogue;
- WhatsApp catalogue;
- connector framework;
- marketplace abstraction;
- delivery abstraction.

## P016 — Social Publishing
- OAuth;
- connected accounts;
- content calendar;
- publishing where API support is verified.

## P017 — Growth Automation
- campaigns;
- referral;
- affiliate;
- automation;
- analytics attribution.

## P018 — Full Category QA
- all categories;
- all tabs;
- demo data;
- responsive;
- regression.

## P019 — Production Hardening
- security;
- performance;
- logging;
- error monitoring;
- deployment;
- documentation.

---

# 62. DEFINITION OF DONE

The implementation is NOT complete when the homepage looks good.

It is complete only when:

1. Existing working features remain available.
2. New navigation is coherent.
3. All major categories have working capability configurations.
4. Main dashboard is operational.
5. Growth module is functional.
6. SEO Manager is functional.
7. Marketing Studio is functional for Phase 1.
8. Business documents use real vendor data.
9. Leads/tasks/CRM/communication are connected.
10. Commerce works with product/order/inventory data.
11. Food capabilities are represented.
12. Sales Channels architecture is present.
13. Connector health/errors are visible.
14. Search Insights is functional.
15. Offers/loyalty/referrals are functional.
16. Social account connection architecture is secure.
17. Reels are clearly marked Coming Soon.
18. Demo data exists for all major categories.
19. Mobile UI works.
20. Tests pass.
21. No real customer data is used in demos.
22. No unsupported third-party API behavior is faked.
23. Documentation is updated.
24. Deployment/build passes.
25. Final feature-gap audit is performed.

---


---

# 63A. CRITICAL PRODUCT DISTINCTION — BUSINESS WEBSITE WEBAPP vs E-COMMERCE SHOPPING WEBAPP

**CLAUDE CODE MUST TREAT THESE AS TWO DISTINCT WEBAPP APPLICATION MODES.**

Do NOT implement them as merely two themes of the same page.

They share the same Get4Domain platform, authentication, business master, customer master, CRM, communication, Growth, AI, analytics and backend foundation, but their **front-end information architecture, customer experience, navigation, templates and primary workflows are different.**

## A. BUSINESS WEBSITE WEBAPP

### Purpose

The Business Website WebApp is primarily for businesses that want to:

- present their company/business online;
- generate enquiries;
- capture leads;
- receive calls;
- receive WhatsApp enquiries;
- collect forms;
- accept bookings/appointments;
- display services;
- display portfolio/projects;
- publish content/blogs;
- show locations/contact details;
- build trust and brand presence.

It is NOT primarily a shopping-cart application.

### Business Website Customer-Facing Structure

Typical structure:

- Home
- About
- Services
- Service Detail
- Products/Portfolio where applicable
- Projects/Portfolio
- Team
- Testimonials
- Blog/News
- Gallery
- FAQ
- Contact
- Location/Google Maps
- Enquiry Form
- Booking/Appointment
- WhatsApp CTA
- Call CTA

### Primary conversion actions

The primary CTA should depend on the business:

- Call Now
- WhatsApp
- Enquire Now
- Book Appointment
- Request Quote
- Request Callback
- Schedule Visit
- Get Directions
- Submit Form

### Business Website does NOT require by default

Do not automatically expose:

- shopping cart;
- checkout;
- product quantity controls;
- shipping address;
- delivery selection;
- order tracking;
- customer shopping account;
- e-commerce checkout navigation;
- marketplace product feeds.

These should remain disabled unless the vendor explicitly enables Commerce.

### Vendor Dashboard for Business Website

Prioritize:

- Dashboard
- Leads
- CRM
- Customers
- Bookings
- Tasks
- Communication Hub
- TeleCRM
- Growth
- Marketing Studio
- Website/CMS
- SEO Manager
- Reviews
- Reports
- Payments where applicable

### Typical Business Website workflow

Visitor
→ Website
→ Service/Product information
→ Enquiry / Call / WhatsApp / Booking
→ Lead
→ Assigned staff
→ Task
→ Follow-up
→ Quotation
→ Customer
→ Payment where applicable

---

# 63B. E-COMMERCE SHOPPING WEBAPP

### Purpose

The E-commerce Shopping WebApp is primarily for businesses that sell products online through a shopping experience.

It must have a genuine shopping-cart and checkout workflow.

### E-commerce Customer-Facing Structure

Typical structure:

- Home
- Shop
- Categories
- Product Listing
- Product Detail
- Search
- Filters
- Wishlist
- Cart
- Checkout
- Address
- Delivery/Shipping
- Payment
- Order Confirmation
- Customer Account
- My Orders
- Order Tracking
- Coupons
- Loyalty/Rewards
- Reviews
- Offers
- Wishlist
- Returns/Refunds where supported

### Primary conversion action

**Add to Cart → Checkout → Payment → Order**

This must be visibly different from a lead/enquiry website.

### E-commerce Product Detail

Must support where applicable:

- Product images
- Gallery
- Product title
- SKU
- Price
- MRP
- Sale price
- Discount
- Variants
- Size
- Colour
- Quantity
- Stock status
- Description
- Specifications
- GST/HSN
- Delivery information
- Reviews
- Wishlist
- Add to Cart
- Buy Now
- Related products

### Cart

Cart must support:

- product;
- variant;
- quantity;
- price;
- discount;
- coupon;
- subtotal;
- tax;
- shipping;
- cashback;
- loyalty redemption;
- grand total.

### Checkout

Support:

- customer details;
- address;
- billing address;
- shipping address;
- delivery method;
- shipping fee;
- coupon;
- loyalty;
- tax;
- payment;
- order confirmation.

### Order lifecycle

Order states should support:

- Pending Payment
- Confirmed
- Processing
- Packed
- Shipped
- Out for Delivery
- Delivered
- Cancelled
- Return Requested
- Returned
- Refund Initiated
- Refunded

### E-commerce Vendor Dashboard

Prioritize:

- Dashboard
- Products
- Categories
- Inventory
- Orders
- Customers
- Coupons
- Cashback
- Loyalty
- Reviews
- Shipping
- Delivery
- Payments
- POS
- Billing
- Communication Hub
- Growth
- Marketing Studio
- Sales Channels
- Marketplace Connectors
- Reports
- Website/CMS

---

# 63C. SHARED PLATFORM, DIFFERENT EXPERIENCE

The two webapps must use shared backend/domain services wherever appropriate.

### Shared

- Authentication
- Business
- Users
- Team
- Customers
- Leads
- CRM
- Communication
- WhatsApp
- SMS
- Email
- Growth
- SEO
- Marketing Studio
- AI
- Analytics
- Payments
- Notifications
- Files/Media
- Reviews
- Settings

### Business Website-specific

- Services
- Enquiries
- Forms
- Bookings
- Portfolio
- Projects
- Testimonials
- Service pages
- Quote requests
- Callback requests

### E-commerce-specific

- Products
- Variants
- Inventory
- Cart
- Wishlist
- Checkout
- Orders
- Shipping
- Delivery
- Returns
- Coupons
- Cashback
- Loyalty
- Product reviews
- Product feeds
- Sales channels
- Marketplace sync

---

# 63D. ENABLE/DISABLE COMMERCE WITHOUT DUPLICATING THE WEBSITE

A Business Website may later enable Commerce.

Example:

### Initial state

Business Website:

`www.example.com`

Customer sees:

Home | About | Services | Contact | WhatsApp

Later vendor enables:

**Commerce → Enable Online Store**

The same website can then add:

Shop | Categories | Products | Cart | Checkout | Orders

Do NOT require the vendor to create a completely separate website.

The CMS, domain, branding and business data remain shared.

---

# 63E. BUSINESS WEBSITE vs E-COMMERCE — UI RULE

Claude Code MUST verify the distinction visually.

### Business Website

The design should emphasize:

**Brand → Trust → Services → Enquiry → Booking → Contact**

### E-commerce

The design should emphasize:

**Products → Discovery → Price → Cart → Checkout → Order**

Do not make the two experiences look identical.

A business website should not look like a generic online store.

An e-commerce site should not look like a static corporate brochure.

---

# 63F. FOOD / RESTAURANT IS A THIRD COMMERCE EXPERIENCE

Do not force Restaurant/Food into the generic e-commerce UI.

Restaurant/Food should have:

**Menu → Item → Add-ons → Cart/Order → Dine-in/Takeaway/Delivery → Payment**

Vendor side:

- Menu
- Categories
- Tables
- QR
- Kitchen
- Orders
- Delivery
- POS
- Customers
- Offers
- Loyalty
- Communication
- Growth

The same shared commerce/payment/customer infrastructure can be reused, but the UX must be restaurant-specific.

---

# 63G. FINAL CLAUDE CODE REMINDER

Before implementation, explicitly verify these three customer-facing application modes:

1. **Business Website WebApp**
   - lead/enquiry/service/booking focused.

2. **E-commerce Shopping WebApp**
   - product/cart/checkout/order/shipping focused.

3. **Restaurant/Food WebApp**
   - menu/order/kitchen/table/delivery focused.

They must share the Get4Domain platform foundation but must NOT be reduced to one generic website template.

Create separate demo flows for all three and test each from:

**Landing → Customer Experience → Conversion → Vendor Dashboard → Fulfilment → Communication → Growth → Analytics.**


# 63H. FULL INDUSTRY BOS EXECUTION REQUIREMENT — CLAUDE CODE MUST IMPLEMENT, NOT JUST DOCUMENT

## Executive instruction

**This section is mandatory. Claude Code must treat Get4Domain V2 as a complete Industry Business Operating System (BOS), not as a website-builder enhancement.**

The implementation must cover the complete business lifecycle:

**Business Setup → Team → Products/Services → Leads → Sales → Quotation → Order/Booking → Fulfilment/Operations → Billing → GST → Payments → Accounting → Inventory → Communication → Tasks → HR → Reporting → Growth → Customer Retention**

The public website, business website webapp, e-commerce webapp, restaurant webapp and other customer-facing applications are channels that operate on top of this BOS.

Do not stop after UI implementation.

For every module:

1. database/schema;
2. API/service layer;
3. validation;
4. permissions;
5. business rules;
6. UI;
7. mobile/responsive UI;
8. search/filter/sort;
9. create/edit/delete/archive;
10. workflow/status transitions;
11. audit history;
12. reports;
13. notifications;
14. integrations where applicable;
15. tests;
16. demo data;
17. error handling;
18. empty/loading/error states;
19. import/export where applicable.

---

# 63I. INDUSTRY CAPABILITY ENGINE

Create a configurable `IndustryProfile` / `BusinessCapability` system.

A business type must determine:

- enabled modules;
- terminology;
- navigation;
- dashboard widgets;
- workflows;
- forms;
- fields;
- statuses;
- reports;
- document templates;
- automation rules;
- default roles;
- default tasks;
- default notifications;
- customer terminology;
- product/service terminology.

The business owner can later enable/disable capabilities.

**Changing industry mode must never delete or hide historical data.**

Examples:

Clinic:
- Customer → Patient
- Booking → Appointment
- Service → Treatment
- Staff → Doctor/Staff
- Case → Patient Case

Restaurant:
- Product → Menu Item
- Order → Food Order
- Inventory → Kitchen Stock
- Employee → Staff
- Fulfilment → Kitchen/Delivery

Vehicle Dealer:
- Product → Vehicle
- Customer → Buyer
- Lead → Vehicle Enquiry
- Case → Vehicle Deal
- Order → Vehicle Booking

---

# 63J. COMPLETE BUSINESS SETUP

Create a Business Setup Wizard.

## Business master

- Business name
- Legal name
- Business type
- Industry
- Logo
- Brand colours
- Address
- Branches
- Phone
- Email
- Website
- Social accounts
- GSTIN
- PAN where applicable
- Tax settings
- Currency
- Time zone
- Invoice prefix
- Invoice numbering
- Financial year
- Payment methods
- Bank/UPI details
- Terms & conditions
- Signature
- Document footer

## Branches

Each branch supports:

- address;
- manager;
- staff;
- warehouse;
- POS;
- stock;
- invoice series;
- business hours;
- contact details;
- branch reports.

---

# 63K. ROLE, TEAM & TASK OPERATING SYSTEM

Create configurable roles.

Example:

Owner
Admin
Manager
Sales
Telecaller
Accountant
HR
Purchase
Inventory
Store Manager
Cashier
Delivery
Technician
Receptionist
Kitchen
Doctor
Teacher
Agent
Field Staff

Each role must support granular permissions:

- view;
- create;
- edit;
- delete;
- approve;
- export;
- print;
- assign;
- manage money;
- manage staff;
- manage settings.

## Task engine

Every business activity can create a task.

Task fields:

- title;
- description;
- business;
- branch;
- department;
- assigned user;
- assigned team;
- creator;
- priority;
- due date;
- start date;
- recurrence;
- status;
- checklist;
- attachment;
- customer;
- lead;
- order;
- booking;
- invoice;
- case;
- project;
- related module.

Task states:

**New → Assigned → Accepted → In Progress → Waiting → Completed → Verified → Closed**

Support:

- reassignment;
- escalation;
- reminders;
- overdue queue;
- recurring tasks;
- task dependencies;
- approval;
- comments;
- activity timeline.

## Automation examples

New lead:
→ assign sales task.

Quotation sent:
→ create follow-up task.

Quotation accepted:
→ create fulfilment task.

Invoice overdue:
→ create collection task.

Appointment completed:
→ create follow-up task.

Order paid:
→ create packing task.

Order shipped:
→ create delivery tracking task.

Employee joined:
→ create onboarding checklist.

---

# 63L. PRODUCT & SERVICE MASTER — COMPLETE CRUD

The Product/Service Master is a shared foundation.

## Product creation

Support:

- product name;
- SKU;
- barcode;
- category;
- subcategory;
- brand;
- description;
- short description;
- images;
- videos;
- price;
- MRP;
- sale price;
- purchase cost;
- tax;
- GST rate;
- HSN;
- unit;
- stock;
- minimum stock;
- maximum stock;
- supplier;
- warehouse;
- weight;
- dimensions;
- variants;
- attributes;
- tags;
- SEO title;
- SEO description;
- status;
- featured;
- digital/physical;
- return policy.

## Variants

Examples:

Size:
S / M / L / XL

Colour:
Black / White / Blue

Weight:
250g / 500g / 1kg

Each variant can have:

- SKU;
- barcode;
- price;
- cost;
- stock;
- image;
- tax;
- weight.

## Service creation

Support:

- service name;
- category;
- description;
- duration;
- price;
- tax;
- staff;
- location;
- availability;
- booking requirement;
- online/offline;
- add-ons;
- package;
- recurring service;
- terms;
- images.

## Product/service operations

Must support:

- create;
- edit;
- duplicate;
- bulk edit;
- archive;
- restore;
- import CSV;
- export CSV;
- barcode import;
- image upload;
- category management;
- price updates;
- stock adjustments;
- supplier mapping;
- tax mapping.

---

# 63M. SALES ENGINE

## Lead

Lead creation from:

- website;
- form;
- WhatsApp;
- phone;
- manual;
- social;
- ad platform webhook;
- referral;
- QR;
- marketplace.

Lead fields:

- source;
- campaign;
- customer;
- product/service;
- value;
- stage;
- assigned staff;
- next action;
- notes;
- probability;
- expected close date.

## Pipeline

Configurable per industry.

Example:

Real Estate:
Enquiry → Qualified → Site Visit → Negotiation → Booking → Agreement → Closed

Clinic:
New Patient → Consultation → Treatment → Follow-up → Completed

Vehicle:
Enquiry → Qualified → Test Drive → Finance → Booking → RTO → Delivery

Agency:
Lead → Discovery → Proposal → Negotiation → Won → Project

---

# 63N. QUOTATION / ESTIMATE ENGINE

Quotation must support:

- customer;
- products/services;
- quantity;
- unit;
- price;
- discount;
- tax;
- GST;
- notes;
- validity;
- terms;
- salesperson;
- approval;
- attachments.

Statuses:

Draft → Sent → Viewed → Accepted → Rejected → Expired → Converted

**Quotation → Invoice conversion must preserve line items and tax calculations.**

Version history is mandatory.

---

# 63O. ORDER / BOOKING / CASE ENGINE

Create reusable transaction engines.

## Order

- online order;
- walk-in;
- phone;
- WhatsApp;
- manual;
- marketplace.

## Booking

- service;
- appointment;
- date;
- time;
- staff;
- location;
- advance;
- balance;
- status.

## Case

For long-running workflows:

- case number;
- customer;
- assigned owner;
- stage;
- documents;
- tasks;
- payments;
- notes;
- timeline;
- SLA;
- branch.

Cases must support configurable stage transitions and automatic next-step task creation.

---

# 63P. BILLING & INVOICE ENGINE

Create a central invoice engine used by:

- business website;
- e-commerce;
- restaurant;
- retail;
- services;
- clinic;
- salon;
- travel;
- vehicle;
- rental;
- professional services;
- other industries.

## Invoice types

- GST invoice;
- non-GST invoice where legally applicable;
- retail receipt;
- service invoice;
- recurring invoice;
- proforma;
- credit note;
- debit note;
- purchase invoice;
- expense voucher;
- payment receipt;
- quotation/estimate.

## Invoice capabilities

- automatic numbering;
- branch-specific series;
- financial-year series;
- customer details;
- GSTIN;
- HSN/SAC;
- tax calculation;
- CGST;
- SGST;
- IGST;
- discount;
- round-off;
- payment status;
- due date;
- partial payment;
- advance;
- balance;
- QR/payment link;
- PDF;
- print;
- email;
- WhatsApp sharing.

Never allow AI to invent financial values.

All financial calculations must be deterministic server-side logic.

---

# 63Q. ACCOUNTING & FINANCE ENGINE

Implement a finance foundation rather than only invoice generation.

## Core books

- sales;
- purchases;
- expenses;
- income;
- receivables;
- payables;
- customer ledger;
- vendor ledger;
- cash;
- bank;
- advances;
- credit notes;
- debit notes.

## Reports

- daily sales;
- sales by product;
- sales by service;
- sales by employee;
- sales by branch;
- purchase report;
- expense report;
- outstanding receivables;
- outstanding payables;
- customer ledger;
- vendor ledger;
- cash book;
- bank book;
- profit & loss;
- trial balance;
- balance sheet;
- tax summary.

If a complete accounting ledger is implemented, use proper double-entry principles and preserve immutable financial history.

---

# 63R. GST ENGINE

Create a dedicated GST layer.

Support configurable:

- GSTIN;
- GST registration type;
- CGST;
- SGST;
- IGST;
- HSN;
- SAC;
- tax rates;
- place of supply;
- intra-state;
- inter-state;
- reverse-charge configuration where applicable;
- GST invoice;
- credit note;
- debit note;
- purchase GST;
- input tax credit;
- output tax;
- reconciliation;
- GST reports;
- export formats.

Where government API integrations are available and legally/technically permitted, implement them through official/authorized providers.

Do not hard-code legal assumptions. Keep tax rules configurable and auditable.

---

# 63S. INVENTORY / STOCK ENGINE

Support:

- multiple warehouses;
- multiple branches;
- opening stock;
- purchase;
- sale;
- transfer;
- adjustment;
- return;
- damage;
- consumption;
- stock reservation;
- low-stock alerts;
- reorder levels;
- stock ledger;
- batch where applicable;
- expiry where applicable;
- serial numbers where applicable.

Important distinction:

**Website selling stock** and **operational consumable stock** may be separate ledgers but must be reconciled when they represent the same physical inventory.

---

# 63T. PURCHASE & SUPPLIER ENGINE

Support:

- suppliers;
- purchase orders;
- purchase invoices;
- goods receipt;
- supplier payments;
- purchase returns;
- GST input;
- vendor ledger;
- supplier products;
- purchase history.

Workflow:

**Purchase Request → PO → Goods Received → Purchase Invoice → Payment**

---

# 63U. POS ENGINE

Support:

- barcode;
- product search;
- variants;
- quantity;
- discounts;
- customer selection;
- cash;
- UPI;
- card;
- partial payment;
- credit;
- advance;
- hold bill;
- resume bill;
- return;
- receipt;
- thermal printing;
- cashier permissions.

---

# 63V. HR & PAYROLL ENGINE

Support:

- employee master;
- departments;
- designations;
- reporting manager;
- joining;
- onboarding;
- attendance;
- shifts;
- leave;
- overtime;
- salary;
- allowances;
- deductions;
- advances;
- commissions;
- incentives;
- payroll;
- payslip;
- payroll reports.

Keep payroll calculations configurable for jurisdiction and company policy.

---

# 63W. COMMUNICATION ENGINE

Central communication timeline:

- WhatsApp;
- SMS;
- email;
- push;
- in-app notifications.

Every customer timeline can show:

**Lead → Calls → Messages → Quotation → Invoice → Payment → Order → Booking → Tasks**

Support:

- templates;
- approvals;
- scheduling;
- delivery status;
- automation;
- human handoff;
- opt-out/consent handling.

---

# 63X. INDUSTRY-SPECIFIC OPERATIONS

Claude Code MUST create reusable industry workflows.

## Retail

Products → Inventory → POS → Purchase → Sale → Customer → GST → Reports

## Grocery

Products → Weight/Units → Inventory → POS → Delivery → Route → Khata → Repeat Orders

## Restaurant

Menu → Table/QR → Order → Kitchen → Packing → Delivery/Takeaway → Payment → GST → Reports

## Salon

Services → Staff → Appointment → Service → Billing → Rebooking → Loyalty

## Clinic

Patient → Appointment → Consultation → Treatment → Prescription/Notes → Billing → Follow-up

## Education

Student → Admission → Batch → Attendance → Fees → Exams → Results → Parent communication

## Real Estate

Property → Lead → Qualification → Site Visit → Negotiation → Booking → Documents → Payment → Closure

## Vehicle Dealer

Vehicle → Lead → Test Drive → Quotation → Finance → Insurance → RTO → Booking → Delivery

## Vehicle Rental

Fleet → Availability → Booking → KYC/Agreement → Pickup → Rental → Return → Inspection → Billing

## Travel

Package/Trip → Enquiry → Traveller → Availability → Booking → Payment → Documents → Travel status

## Logistics

Customer → Shipment → Pickup → Hub/Route → Driver → Delivery → POD → Billing

## Repair/Workshop

Customer → Job Card → Inspection → Estimate → Approval → Parts → Technician → QC → Billing → Delivery

## Finance/Insurance

Lead → Application → Documents → Eligibility → Processing → Case → Approval → Disbursement/Policy → Renewal

## Manufacturing

Product → BOM → Purchase → Raw Material → Production → QC → Finished Goods → Sales → Dispatch

## Wholesale/Distribution

Supplier → Purchase → Warehouse → Stock → Sales Order → Picking → Dispatch → Invoice → Collection

## Professional Services

Lead → Proposal → Project → Tasks → Timesheet → Milestones → Invoice → Collection

---

# 63Y. REPORTING & BUSINESS INTELLIGENCE

Create role-specific dashboards.

## Owner dashboard

- revenue;
- profit;
- receivables;
- payables;
- sales;
- expenses;
- cash;
- orders;
- leads;
- conversion;
- staff;
- inventory;
- branch performance.

## Sales dashboard

- leads;
- pipeline;
- follow-ups;
- conversion;
- sales target;
- salesperson performance.

## Operations dashboard

- open tasks;
- overdue tasks;
- orders;
- cases;
- SLA;
- staff workload.

## Finance dashboard

- sales;
- purchases;
- GST;
- receivables;
- payables;
- cash;
- bank;
- P&L.

## HR dashboard

- headcount;
- attendance;
- leave;
- payroll;
- department workload.

## Inventory dashboard

- stock value;
- low stock;
- fast moving;
- slow moving;
- dead stock;
- purchase;
- consumption.

## Marketing dashboard

- leads;
- campaign spend;
- enquiries;
- conversion;
- revenue;
- channel performance.

Every report must support:

- date range;
- branch;
- employee;
- category;
- customer;
- product;
- service;
- export;
- print;
- drill-down.

---

# 63Z. DOCUMENT ENGINE

Central document engine for:

- quotation;
- estimate;
- invoice;
- credit note;
- debit note;
- receipt;
- purchase order;
- delivery note;
- payslip;
- employee ID;
- business card;
- letterhead;
- appointment card;
- certificate;
- membership card;
- agreement;
- case documents.

Documents must use structured data from the BOS.

---

# 63AA. DATA IMPORT / EXPORT

Every major master should support:

- CSV import;
- CSV export;
- validation preview;
- duplicate detection;
- error rows;
- import history.

Masters:

- customers;
- products;
- services;
- employees;
- suppliers;
- opening stock;
- opening balances.

---

# 63AB. AUDIT & CONTROL

Record:

- who created;
- who edited;
- who approved;
- who deleted;
- old value;
- new value;
- timestamp;
- IP/device where appropriate.

Financial records should never be silently overwritten.

Use reversal/correction mechanisms instead of destructive edits wherever legally/business appropriate.

---

# 63AC. AI MUST ASSIST, NOT CONTROL FINANCIAL TRUTH

AI may help with:

- descriptions;
- marketing copy;
- classification;
- summaries;
- report explanations;
- task suggestions;
- customer reply drafts;
- creative generation;
- search assistance.

AI must NOT independently invent or alter:

- invoice totals;
- GST amounts;
- payment amounts;
- payroll amounts;
- stock quantities;
- accounting balances;
- tax liabilities.

Deterministic business logic remains the source of truth.

---

# 63AD. CLAUDE CODE EXECUTION MODE

Claude Code MUST NOT respond with only a plan.

After inspecting the repository and current application:

1. create a feature inventory;
2. create an implementation matrix;
3. identify existing reusable modules;
4. identify missing modules;
5. identify database migrations;
6. identify APIs;
7. identify UI routes;
8. implement the modules in dependency order;
9. run tests after each major module;
10. fix failures;
11. run full integration tests;
12. test every industry demo;
13. test mobile/responsive layouts;
14. verify permissions;
15. verify tenant isolation;
16. verify financial calculations;
17. verify invoice generation;
18. verify GST calculations;
19. verify task assignment;
20. verify automated workflows;
21. verify reports;
22. verify imports/exports;
23. verify audit logs;
24. verify integrations;
25. verify production build.

Do not mark a module complete because its page exists.

A module is complete only when:

**UI + API + Database + Validation + Permissions + Business Rules + Workflow + Reports + Audit + Tests + Error Handling**

are implemented.

---

# 63AE. DEFINITION OF DONE — FULL BOS

The project is NOT complete until a business can realistically perform the applicable lifecycle from one Get4Domain account.

### Minimum end-to-end test

**Business Setup**
→ create business
→ create branch
→ create users
→ assign roles

**Master Data**
→ create customer
→ create supplier
→ create product
→ create service
→ configure GST

**Sales**
→ create lead
→ assign salesperson
→ create task
→ follow up
→ create quotation
→ accept quotation

**Transaction**
→ create order/booking
→ generate invoice
→ calculate GST
→ record payment

**Operations**
→ assign fulfilment task
→ update status
→ update inventory
→ complete operation

**Finance**
→ show receivable
→ record payment
→ update ledger
→ reflect in reports

**Communication**
→ send permitted notification
→ update customer timeline

**Reporting**
→ owner dashboard
→ sales report
→ finance report
→ operations report
→ staff report
→ inventory report

**Audit**
→ verify all important actions are recorded.

---

# 63AF. MANDATORY FINAL CLAUDE CODE OUTPUT

At completion, Claude Code must produce:

1. Existing feature inventory.
2. New feature inventory.
3. Preserved features.
4. Enhanced features.
5. Newly implemented BOS modules.
6. Industry modules implemented.
7. Database migrations.
8. API endpoints.
9. Frontend routes.
10. Role/permission matrix.
11. Automation/workflow matrix.
12. Report matrix.
13. Document/invoice matrix.
14. GST implementation status.
15. Accounting implementation status.
16. HR/payroll implementation status.
17. Product/service master status.
18. Inventory status.
19. Task engine status.
20. Industry-by-industry status.
21. Integration status.
22. Test results.
23. Security results.
24. Performance results.
25. Known limitations.
26. Deferred features.
27. Environment variables required.
28. Deployment instructions.
29. Database migration instructions.
30. Production readiness checklist.

**Do not claim 100% completion if any mandatory module is only mocked, placeholder UI, static demo, fake API, or unfinished backend.**

# 63. FINAL CLAUDE CODE INSTRUCTION

Do not implement this PRD as a superficial visual redesign.

Treat this as a product and engineering upgrade.

First understand the existing Get4Domain system.

Then understand the supplied new Next.js frontend.

Then inspect the entire live/demo experience and every category.

Then compare the existing implementation against this PRD.

Then implement missing functionality without destroying existing working features.

Do not leave orphaned UI buttons.

Every button should either:
- work;
- open a real implementation;
- or clearly say Coming Soon where intentionally deferred.

Do not create fake backend success responses.

Do not use mock data in production paths.

Use demo/mock data only in explicit demo mode.

After implementation, perform a complete category-by-category and dashboard-by-dashboard audit.

Produce a final implementation report:

- Existing features preserved
- New features implemented
- Features enhanced
- Features intentionally deferred
- API integrations required
- Environment variables required
- Database migrations
- Tests
- Known limitations
- Deployment steps
- Remaining roadmap

The final goal is:

**Get4Domain V2 = Website Builder + Vendor Workplace + CRM + Communication Hub + Commerce + Food + Delivery + Sales Channels + Growth + SEO + Marketing Studio + Customer PWA + AI + Analytics**

with one shared business/product/customer data foundation.
