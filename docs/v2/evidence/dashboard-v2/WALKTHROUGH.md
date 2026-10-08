# Dashboard v2 walkthrough (2026-10-09)

What this is: a hand walk of the **production build** (`next build` then `next start`, not dev mode) against the real NestJS API over an isolated in-memory Postgres (`backend-api/scripts/e2e/dashboard-serve.js`). Nothing here touched production data. Four throwaway vendors were seeded: Essentials retail shop, Pro professional-services studio, Essentials clinic (seeded, not walked), and Step N Rock look-alike pinned to the previous dashboard.

Anything not listed here was **not** verified by hand. The registry guard (`npm run registry:check`) requires every feature that claims a manual check to appear below as its id in backticks, so an id appears only when it was really opened. What was exercised, and what was not, is written next to each one.

## Screenshots (this folder)

| File | Shows |
|---|---|
| `01-essentials-home-open-and-coming-soon.jpg` | Essentials home: "Needs your attention", go-live checklist, Open items and grey Coming soon items with plan badges |
| `02-essentials-locked-expenses.jpg` | Locked state: upgrade card for Expenses and GST (built, Pro only) |
| `03-essentials-coming-soon-campaigns.jpg` | Coming soon state: no half-built screen, "Planned for the Pro plan" |
| `04-essentials-lead-made-customer.jpg` | One-click "Make customer" on a captured lead |
| `05-ai-studio-reel-video-coming-soon.jpg` | AI Studio: Reel / Video and Photo Reel disabled with a Coming soon tag |
| `06-pro-home-services-profile.jpg` | Pro vendor, services profile (labels follow the profile, no Stock) |
| `07-pro-mobile-bottom-tabs.jpg` | Phone width: Home, Enquiries, Website, Marketing, More; no horizontal scroll (page width 375 = viewport 375) |
| `08-flag-off-vendor-old-dashboard-unchanged.jpg` | A vendor with `nav_v2` off: the previous dashboard, no redirect, no v2 cookie, no Make customer button |

## Bugs the production-build walk found (all fixed in this release)

1. Opening a v2 address directly (full page load) bounced the vendor to the old address while the account was still loading (`/dashboard/sales/customers` went to Home, `/dashboard/website/design` to Content). Fixed: a v2 page only redirects a vendor it knows is not on v2.
2. The CRM board listed **no leads at all** for anyone: the API client sent `?source=undefined`, so the server filtered on the text "undefined". Existing bug, also in the old dashboard. Fixed in `getCrmLeads`.
3. "Industry workspace" was Open for a retail shop but led to "nothing to show". Now hidden unless the vendor's industry really has workspace tabs.
4. Plan and billing page still headed "Billing & Payments". Renamed.

## Redirects (HTTP, production build, `curl` with the `g4d_nav_v2=1` cookie)

| Old address | Answer |
|---|---|
| `/dashboard/crm?status=new&q=a` | 308 to `/dashboard/sales/leads?tab=board&status=new&q=a` |
| `/dashboard/my-products` | 308 to `/dashboard/commerce/products` |
| `/dashboard/domain-app/orders?x=1` | 308 to `/dashboard/commerce/orders?tab=orders&x=1` |
| `/dashboard/domain-app/clients` | 308 to `/dashboard/sales/customers?tab=clients` |
| `/dashboard/domain-app` | 308 to `/dashboard` |
| `/dashboard/billing?tab=billing` | 308 to `/dashboard/account/billing?tab=billing` |
| `/dashboard/team` | 308 to `/dashboard/people/team` |
| `/dashboard/payments` | 200 (kept: it holds the checkout-mode switch) |

Without the cookie every one of these answers 200 (the old dashboard is untouched for vendors who are not on v2).

## Per feature

- `home.today` — Essentials home loads with the attention box (1 new lead, 1 product low on stock) and the go-live checklist (2 of 5 done). Pro home shows the empty state ("Nothing waiting"). Revenue widgets underneath are the existing Overview, not re-verified here.
- `sales.leads` — Board lists the lead, status select, call/WhatsApp/note buttons, and Make customer (v2 only). The Call queue tab opens (`?tab=queue`) and shows the pipeline counts. Phone calling itself is the phone's dialler; not tested.
- `sales.customers` — the converted lead appears as a customer (retail uses the customers list).
- `sales.portal` — the Customer Hub page loads and shows the portal address. Sending invites was not tested.
- `website.domain` — Domain page loads with the free subdomain. Buying and connecting a domain were not exercised.
- `website.search` — Website Manager opened with only the SEO section (title, description, keywords).
- `website.widget` — Embed page loads.
- `website.readiness` — Go-live readiness page loads.
- `commerce.workspace` — Pro professional-services studio: opens "Engagements". Retail shop: the item is not in the menu.
- `finance.invoices` — Customer invoices page loads (empty). Creating an invoice was not exercised.
- `finance.expenses` — Pro: opens Accounts (revenue, expenses, GST tabs). Essentials: shows the upgrade card (screenshot 02).
- `communication.inbox` — Inbox loads with the honest subtitle (e-mail works now; WhatsApp and SMS need your number or sender).
- `account.profile` — Business profile: changed the one-line description, saved, reloaded, value was still there. Login name, e-mail and password are not editable here by design.
- `account.help` — Help and support loads.
- `account.stationery` — reachable from Business profile > Extras; the Office and stationery tracker loads (empty list).

## Other screens opened (covered by suites, not by a manual-check anchor)

Products (two tabs: your products and the stock back-office tab), Stock (product businesses only; the services profile gets a 404 for `/dashboard/commerce/stock`, as designed), Orders, Notifications, Plan and billing (four tabs), Wallet, AI Studio, Design and themes, Content and pages, Team and roles all loaded for the vendors they apply to.

## Not walked

Clinic profile (seeded, only registry-level matrix tested), team-member menus (server tests only), custom-domain vendors, real payments (no gateway keys exist locally), e-mail/SMS/WhatsApp sending.
