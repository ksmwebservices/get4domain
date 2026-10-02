# GET4DOMAIN V2 — FULL APPLICATION PRD, EXISTING-SYSTEM AUDIT & CLAUDE CODE IMPLEMENTATION PROMPT

**Purpose:** Master implementation prompt for auditing and upgrading the existing Get4Domain application into a fully functional Get4Domain V2 platform.

**Instruction:** Give this file to Claude Code at the root of the existing Get4Domain repository. Claude Code must inspect the real repository/runtime before deciding what is already implemented.

> This document combines the established Get4Domain V2 product requirements with mandatory application-audit, 100%-functionality, Social Publisher, Communication Hub, tiering, versioning and delivery requirements.

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


---

# 64. GET4DOMAIN V2 — EXISTING APPLICATION AUDIT, 100% FUNCTIONALITY AND VERSION UPGRADE MANDATE

## 64.1 Purpose of this addendum

This section is mandatory and overrides any interpretation of the earlier PRD that would allow a visual-only, prototype-only, documentation-only, or mock implementation.

Claude Code must treat the existing Get4Domain repository and deployed/demo application as an existing product that must be audited, preserved where correct, repaired where incomplete, and upgraded into the target Get4Domain V2 application.

The first question Claude Code must answer with evidence is:

> Does the existing Get4Domain application already implement 100% of the required features in this PRD as genuinely working end-to-end application functionality?

Do not answer this from filenames, routes, screenshots, menu items, components, TODO documents, README claims, or visible dashboard cards alone.

A feature counts as implemented only when its complete functional path exists and can be verified.

## 64.2 Mandatory feature status classification

For every module, page, menu item, dashboard card, workflow, API integration and industry capability, classify the current implementation as exactly one of:

- WORKING — end-to-end functionality verified.
- PARTIAL — some functional layers exist but the complete workflow is not operational.
- UI-ONLY — interface exists but there is no complete application logic/backend/integration.
- BACKEND-ONLY — service/API/data layer exists but usable UI/workflow is incomplete.
- MOCKED — fake/static/sample behavior is being presented as functionality.
- BROKEN — intended functionality exists but currently fails.
- MISSING — required capability is not implemented.
- BLOCKED-EXTERNAL — implementation is ready but requires provider approval, credentials, OAuth, business verification, API entitlement or another external dependency.
- DEFERRED-APPROVED — intentionally outside the current release after explicit roadmap classification.

Never convert PARTIAL, UI-ONLY, MOCKED, BROKEN or BLOCKED-EXTERNAL into WORKING merely because a screen exists.

## 64.3 Definition of "100% working"

A required feature is 100% working only when all applicable layers are complete:

1. User interface.
2. Responsive/mobile behavior.
3. Input validation.
4. Permission/role enforcement.
5. Application/business logic.
6. API/service layer.
7. Database persistence.
8. Tenant/business isolation.
9. Success state.
10. Failure/error state.
11. Audit/logging where applicable.
12. Notification/integration behavior where applicable.
13. Reporting impact where applicable.
14. Tests.
15. Production configuration/integration contract.
16. Security controls.
17. Real workflow verification.

For financial, GST, inventory, payroll, order, booking, payment and other deterministic business records, calculations must be deterministic and auditable. AI must never silently invent or modify authoritative transaction values.

# 65. REQUIRED PRE-IMPLEMENTATION DISCOVERY

Before making major changes, Claude Code must inspect the existing application.

## 65.1 Repository discovery

Inspect and document:

- framework versions;
- frontend applications;
- backend applications/services;
- package/workspace structure;
- database technology and schema;
- migrations;
- authentication;
- tenant/business model;
- role and permission system;
- APIs;
- queues/workers;
- cron/scheduled jobs;
- storage;
- payment integrations;
- messaging integrations;
- social integrations;
- environment variables;
- deployment configuration;
- test suites;
- CI/CD;
- feature flags;
- existing documentation;
- existing industry/category configuration;
- current customer Client WebApp;
- current Vendor Dashboard;
- Admin/Super Admin;
- existing mobile/PWA implementation.

Search the actual code. Do not assume documentation matches implementation.

## 65.2 Runtime audit

Where the local environment permits, run the existing system and verify:

- authentication;
- onboarding;
- dashboard;
- every navigation item;
- CRUD workflows;
- lead creation and conversion;
- quotation/invoice;
- products/services;
- orders/bookings;
- tasks;
- POS;
- inventory;
- HR;
- finance;
- communication;
- content creation;
- social connection/publishing;
- WhatsApp/SMS/email;
- reports;
- industry-specific routes;
- customer Client WebApps;
- responsive/PWA behavior.

Record runtime errors, console errors, failed network requests, missing APIs, placeholder actions and broken links.

## 65.3 Existing-feature preservation

Do not delete a working existing feature simply because the new design does not show it.

For every existing feature:

- preserve it if still relevant;
- improve it if required;
- migrate it into the new information architecture where appropriate;
- document replacement if superseded;
- preserve existing data and compatibility wherever reasonably possible.

Breaking changes require a migration plan.

# 66. GET4DOMAIN V2 PRODUCT DEFINITION

Get4Domain V2 is not merely a website builder.

It is a multi-tenant platform composed of:

1. Client WebApp Engine.
2. DomainApp Business Growth System.
3. DomainApp Business Operating System.
4. Custom Business Operating System.
5. Communication Hub.
6. Growth & Marketing Engine.
7. Social Publisher.
8. Industry Engine.
9. Admin/Platform Control Plane.
10. Domain Campaign as a separate managed advertising service.

The platform uses a shared business data foundation so information is created once and reused across operational and customer-facing channels.

Core shared masters include:

- Business Master.
- Branch Master.
- User/Employee Master.
- Customer/Contact Master.
- Lead Master.
- Product Master.
- Service Master.
- Supplier Master.
- Tax Master.
- Order/Booking/Job records.
- Communication records.
- Content/media records.

# 67. CLIENT WEBAPP ENGINE

The Client WebApp is the real customer-facing application layer of Get4Domain, not a disposable demo.

It must support:

- industry-specific themes and information architecture;
- responsive desktop/tablet/mobile layouts;
- installable PWA behavior where supported;
- category-specific bottom navigation;
- business branding;
- logo, favicon and PWA icon;
- banners and media;
- CMS-managed content;
- products and/or services;
- enquiries;
- calls and WhatsApp CTAs;
- booking/order/cart capabilities according to industry;
- customer account where applicable;
- SEO;
- AEO;
- GEO/local discovery;
- structured data/schema;
- sitemap;
- AutoBot;
- analytics hooks;
- lead attribution;
- configurable domain/subdomain;
- integration with the Vendor Dashboard and BOS.

The Client WebApp must not be one generic template with only colors changed. Industry profiles must change capabilities, pages, customer journeys, navigation and relevant components.

Examples:

Business Website:
Brand -> Trust -> Services -> Enquiry -> Booking/Contact.

E-commerce:
Discovery -> Product -> Variant -> Cart -> Checkout -> Order -> Payment/Tracking.

Restaurant:
Menu -> Item/Add-ons -> Cart -> Dine-in/Takeaway/Delivery -> Payment -> Order Status.

Real Estate:
Property Discovery -> Property Detail -> Enquiry -> Qualification -> Site Visit -> Follow-up.

Salon:
Services -> Staff/Slot -> Booking -> Reminder -> Service -> Billing -> Rebooking.

Clinic:
Doctor/Service -> Appointment -> Patient/Customer details -> Visit workflow -> Billing -> Follow-up.

# 68. INDUSTRY ENGINE

Use one extensible platform with capability-based industry profiles rather than unrelated codebases.

Required industry coverage includes, at minimum:

- Business/Service Website
- E-commerce/Retail
- Restaurant/Food
- Grocery/Kirana
- Catalogue/WhatsApp Enquiry
- Salon/Spa
- Clinic/Doctor
- Gym/Fitness
- Coaching/Tuition/Education
- Real Estate
- Vehicle Dealer
- Vehicle Rental
- Travel
- Hotel/Homestay
- Finance/Insurance
- News/Media/Magazine
- Jewellery
- Pharmacy
- Electronics
- Clothing/Fashion
- Sweet Shop/Bakery
- Astrologer
- Portfolio
- Corporate/Company
- Landing Page
- Distributor/Wholesaler
- Export House
- Group of Companies
- Manufacturing
- Logistics
- Repair/Workshop
- Professional Services
- other service-business profiles supported by the common capability engine.

Each industry profile must define:

- enabled modules;
- customer-facing routes;
- bottom navigation;
- terminology;
- lead fields;
- booking/order/case workflow;
- product/service behavior;
- required documents;
- relevant reports;
- relevant automations;
- Vendor Dashboard shortcuts.

# 69. DOMAINAPP BUSINESS GROWTH SYSTEM

Official product name:

**DomainApp Business Growth System**

Purpose:

> Build the business's digital presence, get found, capture leads, communicate with prospects/customers and provide practical tools for day-to-day growth.

Required Growth System scope:

### Digital presence
- Client WebApp.
- Domain/subdomain support.
- Hosting/SSL integration architecture.
- CMS.
- Branding.
- Media/banner management.
- Product/service catalogue.
- Business contact/location/hours.
- Enquiry/contact/booking forms as applicable.

### Discovery
- SEO settings.
- Keyword management.
- Meta titles/descriptions.
- Sitemap.
- Schema/structured data.
- Image SEO.
- technical/local SEO support.
- Google Business Profile integration architecture.
- Google Search Console integration architecture.
- Google Analytics integration architecture.
- AEO.
- GEO.
- backlink tracking/management/reporting.

### Lead Capture
- Website enquiry.
- WhatsApp enquiry.
- Call CTA tracking where possible.
- Contact form.
- Booking enquiry.
- Product/service enquiry.
- source attribution.
- basic lead dashboard.

### TeleCRM Lite
Growth must include a real basic TeleCRM rather than only a lead count card.

Lead record:
- name;
- mobile;
- email;
- source;
- enquiry;
- created date;
- status;
- notes;
- follow-up date;
- contact/call information where supported;
- customer/contact history.

Basic statuses:
- New;
- Contacted;
- Interested;
- Not Interested;
- Converted;
- Lost.

TeleCRM Lite functions:
- lead capture;
- contact management;
- lead source;
- lead list/search/filter;
- status update;
- call/contact notes;
- follow-up reminder;
- customer history;
- click-to-call where supported;
- basic dashboard.

Basic reports:
- total leads;
- new leads;
- leads by source;
- converted leads;
- pending follow-ups.

Growth is primarily **Capture + Communicate + Basic Follow-up**, not the complete advanced sales operating system.

### Basic business documents/tools
- estimate;
- quotation;
- invoice;
- receipt;
- basic billing;
- basic expenses;
- payment link/integration where configured.

### Content Studio
- social post;
- product/service creative;
- offer creative;
- festival creative;
- announcement;
- educational post;
- testimonial/customer story;
- recruitment/event post;
- blog;
- basic reel/short-video content workflow;
- image/media upload;
- AI-assisted caption/headline/description/hashtags/CTA;
- editable generated content;
- visiting card;
- letterhead/letter pad;
- office/employee ID creative;
- QR creative.

# 70. DOMAINAPP BUSINESS OPERATING SYSTEM

Official product name:

**DomainApp Business Operating System**

It includes the Growth System plus deeper business operations.

Purpose:

> Run and manage business operations from leads through work, sales, service, billing, employees, stock and reporting.

Required standard BOS scope:

- Business Master.
- Branches.
- Departments.
- Teams.
- users.
- roles and permissions.
- employee/HR.
- attendance.
- leave.
- payroll.
- advanced CRM/TeleCRM.
- task/workflow engine.
- product/service master.
- variants.
- inventory.
- warehouses.
- suppliers.
- purchasing.
- POS.
- quotation/estimate.
- orders.
- bookings.
- jobs/cases.
- billing.
- GST configuration/calculation/reporting.
- accounting/finance.
- expenses.
- receivables/payables.
- payments.
- documents.
- reports/analytics.
- audit logs.
- industry-specific workflows.

## 70.1 Advanced TeleCRM

BOS TeleCRM is **Manage & Convert**.

Lead/opportunity record may include:

- owner/salesperson;
- department/branch;
- priority;
- score;
- pipeline stage;
- tags;
- activities;
- calls;
- WhatsApp;
- SMS;
- email;
- tasks;
- notes;
- documents;
- quotation;
- deal value;
- next follow-up;
- conversion records.

Assignment must support appropriate combinations of:

- employee;
- team;
- department;
- branch;
- location;
- product/service;
- source;
- round-robin.

Default configurable sales pipeline:

New Lead -> Qualified -> Assigned -> Contacted -> Interested -> Quotation -> Negotiation -> Won/Lost -> Customer.

Conversion may continue:

Customer -> Order/Booking/Service/Property Booking -> Invoice -> Payment.

Reports include:

- pipeline;
- lead source;
- salesperson performance;
- conversion;
- follow-up;
- ageing;
- lost reasons;
- quotation conversion;
- order/booking conversion.

# 71. CUSTOM BUSINESS OPERATING SYSTEM

Official product category:

**Custom Business Operating System**

This is not merely "all standard features enabled." It is a custom enterprise/project offering built around the organization's workflows.

Potential Custom BOS capabilities include:

- custom workflow design;
- custom fields and data models;
- custom approval chains;
- custom lead qualification/scoring/routing;
- custom CRM pipelines;
- customer portals;
- employee portals;
- supplier portals;
- distributor/dealer portals;
- partner/franchise/agent portals;
- management portals;
- custom APIs;
- third-party integrations;
- custom reports/dashboards;
- custom mobile/PWA applications;
- dedicated infrastructure;
- application/database maintenance;
- server maintenance;
- NEXBOS AI;
- AI agents;
- AI Sales Agent;
- AI lead qualification/follow-up;
- Voice AI agents;
- custom voice workflows;
- multi-brand/multi-company architecture;
- proprietary automation;
- custom database architecture where justified.

Source-code/proprietary licensing is a separate commercial option for qualifying projects and must not be assumed to be included automatically.

Standard BOS must intentionally remain productized. Do not move every enterprise customization into the standard subscription and eliminate the Custom BOS upgrade path.

# 72. SOCIAL CONTENT AND SOCIAL PUBLISHER

Social posting through the Vendor Dashboard is a required real application capability.

It must not be represented by fake "Publish" buttons.

## 72.1 Core workflow

Content Studio
-> Create/Edit Content
-> Attach Media
-> Preview
-> Select Connected Social Accounts
-> Vendor explicitly clicks Publish
-> Connector validates capability/permissions
-> Platform API request
-> Publication result
-> Store external post ID/status/error
-> Publication History/Analytics where available.

**Creating content must never automatically publish it.**

Automatic posting/scheduling is a separate capability and must only be enabled where explicitly supported, configured and permitted.

## 72.2 Supported connector architecture

Design connector interfaces for:

- Meta/Facebook Page;
- Instagram Professional;
- LinkedIn;
- YouTube;
- X/Twitter where API access and commercial terms permit;
- Google Business Profile where relevant APIs/permissions permit;
- future social providers.

Meta-related account management should support connection of eligible Facebook Pages and Instagram Professional accounts through official authorization flows.

Do not treat "Meta Business Suite" itself as a generic posting API. Get4Domain should integrate with the applicable official Meta platform APIs and permissions.

## 72.3 Capability discovery

Each connected account/provider must expose capability state, for example:

- text post;
- image post;
- video post;
- reel/short-form video;
- carousel;
- link;
- scheduling if supported;
- analytics if supported.

The UI must only offer actions supported by the provider/account/permissions.

## 72.4 Social account entity

Store appropriate fields such as:

- tenant/business;
- provider;
- provider account/page ID;
- display name;
- account type;
- authorization state;
- granted scopes/capabilities;
- token metadata stored securely;
- expiry/refresh metadata;
- connection status;
- last synchronization;
- errors;
- created/updated audit data.

Never expose secrets/tokens to normal frontend clients.

## 72.5 Social publication entity

Each publication should track:

- content ID;
- business;
- target account;
- platform;
- requested by;
- requested time;
- status;
- external post/video ID;
- external URL where available;
- request/correlation ID;
- provider response metadata where safe;
- failure category;
- retry eligibility;
- published time.

Statuses should include:

- Draft;
- Ready;
- Publishing;
- Published;
- Failed;
- Retry Required.

## 72.6 Vendor UI

Required Vendor Dashboard areas:

- Social Accounts;
- Connect Account;
- Content Studio;
- Create Post;
- Preview;
- Select Accounts;
- Publish;
- My Content;
- Drafts;
- Published;
- Failed;
- Media Library;
- Templates;
- Publication History;
- connector errors/status.

## 72.7 Tiering

Growth:
- content creation;
- AI-assisted caption;
- image creative;
- manual vendor-initiated publishing;
- supported connected accounts;
- basic publication history.

BOS:
- everything in Growth;
- multiple accounts;
- branch/team support;
- employee permissions;
- approval workflow;
- richer content library;
- product/service -> social content workflow;
- campaign association;
- publishing reports;
- activity/audit logs.

Custom:
- multi-brand/multi-company;
- custom approval chains;
- agency/client portal;
- custom connectors;
- AI content agents;
- advanced automation;
- custom reporting.

# 73. COMMUNICATION HUB

Communication must be a first-class platform engine shared by Growth and BOS.

Channels:

- WhatsApp Business Platform/API;
- SMS;
- Email;
- website AutoBot;
- in-app notifications;
- push notifications where supported;
- social messaging connectors where separately supported.

The Communication Hub must provide:

- provider abstraction;
- channel configuration;
- templates;
- contacts/recipients;
- consent/preferences where required;
- message composer;
- message queue;
- delivery status;
- failure handling;
- retry policy;
- inbound message handling where supported;
- conversation/thread association;
- CRM/customer/lead association;
- automation triggers;
- audit/history;
- usage tracking;
- branch/business isolation.

# 74. WHATSAPP BUSINESS PLATFORM REQUIREMENTS

WhatsApp is separate from Social Publisher.

Implement an integration architecture that can support the official WhatsApp Business Platform directly and/or approved BSP/provider integrations configured by Get4Domain.

Required capability model:

### Account/setup
- business/provider connection;
- phone number configuration;
- WABA/provider identifiers where applicable;
- template synchronization;
- connection/health status;
- webhook configuration;
- credential/security handling.

### Messaging
- customer replies;
- template messages;
- approved utility templates;
- approved marketing templates;
- authentication/OTP templates only where the configured platform/provider and business use case permit;
- media;
- delivery/read/failure status where supplied;
- inbound messages;
- conversation history;
- human handoff.

### Business automation
Examples:
- enquiry acknowledgement;
- welcome/greeting workflow;
- lead acknowledgement;
- booking confirmation;
- booking reminder;
- order confirmation;
- order status;
- payment acknowledgement;
- invoice/receipt delivery;
- service reminder;
- follow-up;
- approved marketing campaign workflows.

All automation must respect platform rules, template categories, consent/opt-in requirements, messaging windows and current provider/API restrictions.

Do not hard-code the assumption that any arbitrary message may be sent as "utility." The application must store the actual approved template category and status.

### Template lifecycle
Track:
- template name;
- language;
- category;
- content/components;
- provider ID;
- submitted state;
- approval/rejection state;
- quality/status where provided;
- last sync;
- variables;
- usage.

# 75. SMS ENGINE

Required SMS capabilities:

- provider abstraction;
- sender/header configuration where applicable;
- templates;
- OTP/authentication where legally/provider permitted;
- transactional/utility notifications;
- lead notification;
- order notification;
- booking notification;
- payment notification;
- approved marketing messaging;
- automation triggers;
- queue;
- delivery reports;
- failure/retry;
- usage/cost tracking;
- DLT/regulatory configuration for India where applicable and configurable.

Do not fake delivery success. Store provider status.

# 76. EMAIL ENGINE

Required email capabilities:

- provider/API abstraction;
- transactional email;
- welcome/acknowledgement;
- lead communication;
- order/booking;
- invoice/receipt;
- campaign/marketing email;
- templates;
- variables;
- HTML/plain-text;
- attachments;
- queue;
- delivery state where provider exposes it;
- bounce/failure handling;
- sender/domain configuration;
- unsubscribe/preferences for marketing where applicable;
- automation;
- audit/history.

# 77. AUTOMATION ENGINE

Automation must connect business events to controlled actions.

General model:

Trigger -> Conditions -> Action(s) -> Delay/Schedule if allowed -> Execution -> Result -> Audit.

Example triggers:

- lead created;
- lead assigned;
- follow-up due;
- quotation sent;
- quotation accepted;
- order created;
- payment received;
- order shipped;
- appointment booked;
- appointment upcoming;
- appointment completed;
- invoice overdue;
- customer created;
- employee onboarding;
- stock low.

Actions may include:

- create task;
- assign user;
- send approved WhatsApp template;
- send SMS;
- send email;
- create notification;
- update permitted workflow state;
- create follow-up.

Provide:

- automation enable/disable;
- validation;
- permission checks;
- dry-run/test where practical;
- execution log;
- failure log;
- retry;
- loop protection;
- rate limiting;
- provider quota awareness.

# 78. TASK AND WORKFLOW ENGINE

Default task lifecycle:

New -> Assigned -> Accepted -> In Progress -> Waiting -> Completed -> Verified -> Closed.

Tasks require:

- title;
- description;
- related entity;
- business/branch;
- owner;
- assignee;
- priority;
- due date;
- status;
- comments;
- attachments;
- activity timeline;
- audit.

Tasks may be created manually or by automation.

# 79. COMMERCE, PRODUCTS, SERVICES AND INVENTORY

Product/service master must support practical management, not static catalogue cards.

Product capabilities:
- CRUD;
- categories;
- variants;
- SKU/barcode;
- pricing;
- taxes;
- images;
- stock behavior;
- supplier mapping;
- branch/warehouse availability;
- bulk edit;
- CSV import/export.

Service capabilities:
- CRUD;
- categories;
- pricing;
- duration;
- tax;
- staff/resource mapping;
- booking eligibility;
- images;
- descriptions;
- branch availability.

Inventory:
- multi-warehouse/branch;
- opening stock;
- purchase;
- sale;
- transfer;
- adjustment;
- return;
- damage;
- consumption;
- reservation;
- low-stock/reorder;
- stock ledger;
- batch/expiry/serial where industry requires it.

Purchase flow:
Purchase Request -> Purchase Order -> Goods Received -> Purchase Invoice -> Payment.

# 80. POS

Where enabled, POS must support:

- product/barcode search;
- variants;
- customer;
- cart;
- discount permission rules;
- taxes;
- cash/UPI/card;
- partial payment where supported;
- credit/advance where configured;
- hold/resume;
- return;
- receipt;
- thermal print layout;
- stock impact;
- accounting/payment impact;
- audit.

# 81. BILLING, GST AND FINANCE

Required standard financial scope:

- estimate;
- quotation;
- invoice;
- receipt;
- sales;
- purchases;
- expenses;
- income;
- receivables;
- payables;
- customer/vendor ledger;
- cash/bank;
- advances;
- payment records;
- P&L;
- trial balance;
- balance sheet where accounting model supports it;
- tax summary.

GST engine must be configurable and auditable, including applicable support for:

- GSTIN;
- CGST;
- SGST;
- IGST;
- HSN/SAC;
- place of supply;
- credit/debit notes;
- input tax credit records/reconciliation support;
- reverse-charge configuration where applicable;
- reports;
- authorized/official integrations where available.

Do not hard-code legal/tax assumptions that may change.

# 82. HR AND PAYROLL

Standard BOS should support:

- employee master;
- department;
- designation;
- reporting manager;
- branch;
- joining/onboarding;
- attendance;
- shifts;
- leave;
- overtime;
- salary structure;
- allowances;
- deductions;
- advances;
- commissions/incentives;
- payroll;
- payslip;
- reports;
- permissions.

# 83. INDUSTRY CASE/JOB ENGINE

Use a reusable case/job model for industries that require lifecycle-based work.

Common case fields:

- customer;
- case/job type;
- owner;
- assigned team;
- stage;
- documents;
- tasks;
- payments;
- notes;
- timeline;
- SLA;
- status.

Industry-specific workflows include:

Retail:
Products -> Inventory -> POS -> Purchase -> Sale -> Customer -> GST -> Reports.

Grocery:
Products -> Weight/Units -> Inventory -> POS -> Delivery -> Route -> Khata -> Repeat Orders.

Restaurant:
Menu -> Table/QR -> Order -> Kitchen -> Packing -> Delivery/Takeaway -> Payment -> GST -> Reports.

Salon:
Services -> Staff -> Appointment -> Service -> Billing -> Rebooking -> Loyalty.

Clinic:
Patient/Customer -> Appointment -> Consultation/Service -> Treatment/Record as applicable -> Billing -> Follow-up.

Education:
Student -> Admission -> Batch -> Attendance -> Fees -> Exams -> Results -> Parent Communication.

Real Estate:
Property -> Lead -> Qualification -> Site Visit -> Negotiation -> Booking -> Documents -> Payment -> Closure.

Vehicle Dealer:
Vehicle -> Lead -> Test Drive -> Quotation -> Finance -> Insurance -> RTO -> Booking -> Delivery.

Vehicle Rental:
Fleet -> Availability -> Booking -> KYC/Agreement -> Pickup -> Rental -> Return -> Inspection -> Billing.

Travel:
Package/Trip -> Enquiry -> Traveller -> Availability -> Booking -> Payment -> Documents -> Travel Status.

Logistics:
Customer -> Shipment -> Pickup -> Hub/Route -> Driver -> Delivery -> POD -> Billing.

Repair/Workshop:
Customer -> Job Card -> Inspection -> Estimate -> Approval -> Parts -> Technician -> QC -> Billing -> Delivery.

Finance/Insurance:
Lead -> Application -> Documents -> Eligibility -> Processing -> Case -> Approval -> Disbursement/Policy -> Renewal.

Manufacturing:
Product -> BOM -> Purchase -> Raw Material -> Production -> QC -> Finished Goods -> Sales -> Dispatch.

Wholesale/Distribution:
Supplier -> Purchase -> Warehouse -> Stock -> Sales Order -> Picking -> Dispatch -> Invoice -> Collection.

Professional Services:
Lead -> Proposal -> Project -> Tasks -> Timesheet -> Milestones -> Invoice -> Collection.

# 84. DOCUMENT ENGINE

Support reusable templates and generated business documents such as:

- quotation;
- estimate;
- invoice;
- receipt;
- credit note;
- debit note;
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
- industry/case documents.

Documents require tenant branding, numbering, permissions, generation history and audit as applicable.

# 85. REPORTING AND ANALYTICS

Dashboards/reports should be role-aware.

Required reporting areas:

- owner/executive;
- leads/CRM;
- sales;
- operations;
- orders/bookings;
- finance;
- HR;
- inventory;
- marketing;
- communication;
- social publishing;
- industry-specific metrics.

Support filters, date ranges, branch, employee/team, export/print where applicable and drill-down to source records.

# 86. SECURITY, TENANCY AND AUDIT

Mandatory:

- strict tenant isolation;
- branch-aware access;
- server-side permission enforcement;
- secure credential/token storage;
- least-privilege integrations;
- input validation;
- safe file upload;
- rate limiting where needed;
- audit log;
- sensitive-action logging;
- immutable or controlled financial audit behavior;
- secure password/session/auth handling;
- environment-secret separation.

Financial records must not be silently overwritten.

# 87. ADMIN / PLATFORM CONTROL PLANE

Get4Domain platform administrators need appropriate controls for:

- tenants/businesses;
- plans;
- subscriptions;
- feature/capability flags;
- industry profiles;
- templates;
- connector/provider configuration;
- integration health;
- usage;
- billing/plan status;
- support/admin impersonation only if securely designed and fully audited;
- announcements;
- system status;
- audit;
- content/templates where centrally managed.

Do not expose provider master secrets to tenant users.

# 88. DOMAIN CAMPAIGN — SEPARATE MANAGED SERVICE

Domain Campaign is not part of the BOS subscription feature set.

It is Get4Domain's managed paid advertising service.

Scope:

- campaign strategy;
- ad content/creative;
- social page management related to campaigns;
- campaign publishing;
- Meta/Google paid advertising;
- optimization;
- reporting.

Commercial model supplied by product owner:

- Up to ₹20,000 monthly ad budget: ₹2,000/month Get4Domain management fee.
- ₹20,001–₹1,00,000 monthly ad budget: ₹5,000/month management fee.
- Above ₹1,00,000 monthly ad budget: ₹10,000/month management fee.
- Enterprise/multi-brand: custom.

Ad spend is separate and paid toward advertising platforms. Domain Campaign management is separate from DomainApp Growth/BOS.

Do not confuse Vendor Dashboard manual social publishing with Get4Domain-managed Domain Campaign operations.

# 89. EXTERNAL INTEGRATION RULE

For every external integration:

1. Identify official API/provider.
2. Define authentication/OAuth.
3. Define scopes/permissions.
4. Define account eligibility.
5. Define webhook requirements.
6. Define token lifecycle.
7. Define rate limits.
8. Define supported capabilities.
9. Define failure states.
10. Define retry/reconciliation.
11. Define provider approval/app review dependencies.
12. Define environment variables.
13. Define test/sandbox strategy.
14. Never simulate production success.

This applies to social platforms, WhatsApp, SMS, email, payments, analytics, search, Google Business Profile, accounting/tax APIs and other external systems.

# 90. VERSION UPGRADE AND DELIVERY PLAN

Claude Code must not immediately attempt an uncontrolled rewrite.

After the audit, create a versioned implementation plan based on actual repository findings.

Use the following release structure as a planning baseline, but adjust exact scope only after evidence from the audit.

## V2.0 — Foundation and Audit Closure

Objectives:
- complete repository/runtime audit;
- feature inventory;
- fix critical broken navigation/auth/tenant issues;
- establish capability/industry engine;
- normalize design system;
- establish data/API contracts;
- remove fake success behavior;
- preserve existing working features;
- establish test baseline.

Exit criteria:
- audited matrix exists;
- critical platform foundation is stable;
- no unknown major feature areas;
- regression tests cover core paths.

## V2.1 — Client WebApp Engine

Objectives:
- shared PWA shell;
- industry profiles;
- business/e-commerce/restaurant reference implementations;
- responsive navigation;
- CMS/branding;
- product/service integration;
- enquiry/order/booking integration;
- SEO/AEO/GEO foundations.

Then extend verified patterns to remaining industry profiles.

## V2.2 — Growth System

Objectives:
- digital presence;
- lead capture;
- TeleCRM Lite;
- Content Studio;
- basic documents/billing;
- SEO/discovery tools;
- analytics connectors;
- social account connection and vendor-initiated publishing.

## V2.3 — Communication Hub

Objectives:
- WhatsApp connector architecture;
- template synchronization/status;
- utility/marketing workflows according to approved template state;
- inbound/outbound history;
- SMS engine;
- email engine;
- automation triggers;
- delivery/failure tracking.

## V2.4 — Standard BOS Core

Objectives:
- Advanced TeleCRM;
- tasks/workflow;
- HR;
- products/services;
- inventory;
- purchasing;
- POS;
- orders/bookings/jobs;
- billing/GST;
- finance;
- reports;
- documents;
- audit.

## V2.5 — Industry Operations

Objectives:
- complete industry-specific operational workflows;
- industry dashboards;
- role shortcuts;
- industry reports;
- relevant documents/automation.

## V2.6 — Hardening and Production Readiness

Objectives:
- security review;
- performance;
- accessibility;
- responsive/PWA verification;
- migration verification;
- integration resilience;
- backups/observability as applicable;
- production deployment checklist;
- end-to-end regression.

## V2.x+ — Custom BOS / Enterprise Extensions

Custom projects are scoped separately and must not block the standard product release unless a shared platform dependency is required.

# 91. SCHEDULING REQUIREMENT FOR CLAUDE CODE

Claude Code must produce an implementation schedule after inspecting the codebase.

Do not invent dates before understanding team capacity and repository condition.

The schedule must contain:

- release/version;
- milestone;
- workstream;
- feature/module;
- dependency;
- current status;
- target status;
- implementation tasks;
- test tasks;
- migration impact;
- external dependency;
- risk;
- estimated engineering effort;
- recommended sequence;
- acceptance criteria.

If the developer is working alone, explicitly produce a single-developer sequence that avoids opening too many incomplete modules simultaneously.

Prioritize:
1. security/data integrity;
2. tenant/auth foundation;
3. shared engines;
4. highest-value complete workflows;
5. external connectors;
6. industry extensions;
7. polish.

# 92. REQUIRED AUDIT MATRICES

Claude Code must create/update project documentation with at least these matrices.

## 92.1 Master Feature Matrix

Columns:

| Area | Feature | Existing Route/Code | Current Status | Backend | DB | Permission | Tests | Target Tier | Target Version | Action |

## 92.2 Dashboard/UI Action Matrix

For every clickable action:

| Screen | Action/Button | Expected Behavior | Current Behavior | API/Service | Status | Fix |

This is specifically required to detect existing UI that was shown but never practically implemented.

## 92.3 Integration Matrix

| Provider | Capability | Connection | Permission/Approval | Current Status | Error Handling | Production Ready |

## 92.4 Industry Matrix

| Industry | Client WebApp | Vendor Modules | Workflow | Reports | Automation | Current Status | Target Version |

## 92.5 Communication Matrix

| Channel | Use Case | Template/Consent Requirement | Trigger | Provider | Status | Audit |

## 92.6 Test Matrix

| Module | Unit | Integration | E2E | Permission | Failure Path | Mobile/PWA | Status |

# 93. DOCUMENTS CLAUDE CODE MUST MAINTAIN

Create or update, as appropriate:

- `PRD.md`
- `STATUS.md`
- `FEATURE_MATRIX.md`
- `AUDIT_REPORT.md`
- `ROADMAP.md`
- `RELEASE_PLAN.md`
- `TASKS.md`
- `CHECKLIST.md`
- `INTEGRATIONS.md`
- `PERMISSIONS.md`
- `INDUSTRY_MATRIX.md`
- `TEST_PLAN.md`
- `MIGRATION_PLAN.md`
- `DEPLOYMENT.md`

Do not duplicate contradictory information across documents. The PRD is the product requirement source; STATUS/AUDIT reflect current reality; ROADMAP/RELEASE_PLAN reflect future execution.

# 94. CLAUDE CODE — REQUIRED FIRST RESPONSE AFTER AUDIT

After initial inspection, Claude Code must report:

1. What applications/packages exist.
2. Current architecture.
3. What is genuinely working.
4. What is partial.
5. What is UI-only.
6. What is mocked.
7. What is broken.
8. What is missing.
9. Which existing features must be preserved.
10. Database/schema issues.
11. Authentication/tenant/permission issues.
12. Integration status.
13. Test coverage status.
14. Client WebApp status.
15. Growth System status.
16. BOS status.
17. Social Publisher status.
18. WhatsApp status.
19. SMS status.
20. Email status.
21. Automation status.
22. Industry coverage.
23. Major technical debt.
24. Security/data-integrity risks.
25. Recommended V2 release sequence.
26. Proposed implementation schedule.

It must explicitly answer:

> "Is the existing application currently 100% functional against this PRD?"

The answer must be evidence-based.

If not, give the measured feature matrix and gap list rather than a vague percentage.

# 95. IMPLEMENTATION BEHAVIOR

Claude Code should work iteratively.

For each milestone:

1. inspect affected existing code;
2. confirm data model and dependencies;
3. create/update tests;
4. implement backend/service logic;
5. implement UI;
6. enforce permissions;
7. implement validation/error states;
8. integrate real provider where applicable;
9. run tests;
10. run relevant E2E workflow;
11. update STATUS/FEATURE_MATRIX;
12. commit logically if source-control workflow permits.

Do not mark a milestone complete because the UI looks complete.

# 96. NO-PLACEHOLDER POLICY

The following are prohibited in production paths unless clearly marked as demo/development fixtures:

- fake API success;
- fake payment success;
- fake social publish success;
- fake WhatsApp delivery;
- fake SMS delivery;
- fake email delivery;
- fake stock changes;
- fake invoice/payment state;
- hard-coded dashboard metrics presented as real;
- buttons with no functional action;
- static lists pretending to be database records.

If a provider is not configured, show a clear "Not Connected", "Configuration Required", "Approval Required" or equivalent real state.

# 97. ACCEPTANCE CRITERIA FOR CORE CROSS-CHANNEL WORKFLOW

At minimum, verify representative end-to-end flows such as:

### Growth lead flow
Client WebApp enquiry
-> Lead created
-> source recorded
-> appears in TeleCRM Lite
-> vendor adds note/follow-up
-> permitted acknowledgement communication
-> conversion status reflected in report.

### BOS sales flow
Lead
-> qualification
-> assignment
-> follow-up/task
-> quotation
-> negotiation
-> conversion
-> customer
-> order/booking
-> invoice
-> payment
-> accounting/report impact.

### Social publishing flow
Vendor creates content
-> edits
-> selects connected account
-> explicitly publishes
-> connector validates capability
-> provider result stored
-> publication history updated
-> failure is visible and actionable.

### WhatsApp automation flow
Business event
-> automation rule
-> approved/configured template selected
-> provider request
-> delivery/failure state
-> customer/lead conversation history
-> audit log.

### Inventory/POS flow
Purchase/stock receipt
-> inventory increases
-> POS sale
-> payment
-> inventory decreases
-> receipt/invoice
-> financial/report impact.

# 98. FINAL DEFINITION OF DONE

Get4Domain V2 is not "done" until mandatory release scope has:

- functional UI;
- real application logic;
- persistent data;
- permissions;
- validation;
- correct business rules;
- working workflows;
- real integration contracts;
- success/failure states;
- audit where required;
- reports where required;
- automated tests;
- E2E verification;
- responsive behavior;
- production configuration documentation.

For externally blocked features, application-side implementation may be complete only when the system truthfully reports the external dependency and all internal integration contracts/tests are complete.

# 99. FINAL COMMAND TO CLAUDE CODE

You are upgrading an existing real application.

Do not start by rewriting everything.

First audit the entire repository and runnable application against this PRD.

Determine, with evidence, whether every visible and documented feature is genuinely implemented end-to-end.

Preserve all valuable working functionality.

Identify every UI-only, mocked, partial, broken and missing feature.

Then create the Master Feature Matrix, Audit Report, Roadmap, Release Plan and implementation schedule.

Only after the audit baseline is established should you execute the V2 upgrade in controlled releases.

The target product is:

**Get4Domain V2 — Client WebApp Platform + DomainApp Business Growth System + DomainApp Business Operating System + Custom BOS Platform + Communication Hub + Social Publisher + Growth/Marketing Engine + Industry Engine + Analytics**

The standard application must be genuinely usable, not a collection of dashboard screens.

The Vendor Dashboard must only expose functionality that has a defined and implementable engine behind it.

Social posting must be vendor-initiated through supported official APIs.

WhatsApp, SMS and email must be implemented as real communication channels with provider state, templates, automation, delivery/failure tracking and audit.

Growth uses TeleCRM Lite for capture and basic follow-up.

BOS uses Advanced TeleCRM for assignment, pipeline management and conversion.

Custom BOS adds organization-specific workflows, portals, AI/voice agents, integrations and enterprise architecture.

At the end of every release, report exactly what works, what remains, what is externally blocked and what is scheduled next.

Never claim 100% completion without evidence.
