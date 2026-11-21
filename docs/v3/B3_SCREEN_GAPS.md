# B3: the backend behind the vendor screens that were sample-data only

Dispatch G1, job B3. Source of the list: `COMPLETION_AUDIT.md` section 3 (the screens not in `REAL_SCREENS` of `get4domain-ui/apps/vendor/src/pages/bodies.ts`). Paths are under `backend-api` unless stated. Nothing here was run against a live server; what was run is named in `B3_LOG`-style lines in `DISPATCH_REPORT_G1.md`.

Words used: **WIRING ONLY** = the backend route already exists and only the vendor app has to call it. **BUILT** = a route added in this dispatch. **SCHEMA** = a real route needs a new table, so it is written down as a contract and left for a dispatch that may write and apply a migration. **PROVIDER** = needs a channel or provider the owner has not chosen.

## 1. Screen by screen

| Screen (route) | State | The backend route(s) it needs | What this dispatch did |
|---|---|---|---|
| home/overview | WIRING ONLY (partly) | `GET /v3/me/app-shell` (menu, plan words), `GET /v3/me/next-steps` (what to do next), `GET /v3/me/inbox/waiting` (new enquiries), `GET /v3/me/customers/summary`, `GET /v3/me/orders` | nothing new needed: each tile has a route |
| business/jobs | WIRING ONLY | `/v3/me/jobs` (9 routes in `v3-jobs`) | none |
| business/quotes | WIRING ONLY | `/v3/me/quotes` (7) | none |
| business/work (appointments) | WIRING ONLY | `/v3/me/appointments` (19) | none |
| business/orders | WIRING ONLY | `/v3/me/orders`, `/orders/:id`, `PUT /orders/:id/status` | none |
| business/stock | WIRING ONLY | `/v3/me/store`, `/items`, `PUT /v3/me/stock/:productRef` | none |
| business/offerings | WIRING ONLY | `/v3/me/items` | none |
| grow/offers | WIRING ONLY | `/v3/me/offers` (3) | none |
| grow/marketplace | WIRING ONLY | `/v3/me/services`, `/v3/me/service-requests` (6) | none |
| money/accounting | WIRING ONLY | `/v3/me/accounts` (8) | none |
| money/payment-setup, more/payment-methods | WIRING ONLY | `/v3/me/payment-methods` (6) | none |
| more/legal | WIRING ONLY | `GET /v3/me/terms`, `POST /v3/me/terms/accept` | none; the register answer now carries `termsAcceptanceRequired` (B5) |
| more/activity | WIRING ONLY | `GET /v3/me/activity` | none |
| grow/ai-studio | WIRING ONLY | `/v3/me/ai` (2 routes) | none |
| business/import | **BUILT** | `POST /v3/me/customers/import` | added: up to 500 rows, each checked alone, people already on the list counted and never duplicated, bad rows reported by position, consent UNKNOWN, source MANUAL with reference `import`. Pro plan feature `crm.customers`, owner only |
| business/enquiries (REAL already) | **BUILT** (B1) | `GET /v3/me/inbox` now also lists visitor enquiries from the site form | the form route writes into the inbox the screen already reads |
| business/deals | SCHEMA | proposed `GET/POST /v3/me/deals`, `PUT /v3/me/deals/:id` (stage move), `GET /v3/me/deals/board` | not built: a deal is a priced opportunity tied to a customer and a stage; it needs a table. Until then the pack record tabs (generic records, REAL) hold a pipeline per pack |
| business/tasks | SCHEMA | proposed `GET/POST /v3/me/tasks`, `PUT /v3/me/tasks/:id`, `POST /:id/complete` | not built: needs a table with an assignee (team member), a due date and an optional customer or request link |
| business/segments | SCHEMA | proposed `GET/POST /v3/me/segments`, `GET /v3/me/segments/:id/customers` | not built: a saved filter over the customer list (source, consent, tags); stored as JSON, evaluated by the customers module |
| grow/telecrm | SCHEMA + PROVIDER | proposed `GET /v3/me/calls`, `POST /v3/me/calls` (log a call), `GET /v3/me/callbacks` | not built: a call log needs a table; placing calls needs a telephony provider the owner has not chosen |
| grow/messages | SCHEMA + PROVIDER | proposed `GET/POST /v3/me/message-campaigns` | not built: bulk messages need the promotions lane, which the mail design says must not send until counsel approves the Messaging and Anti-Spam text (`V3_ENQUIRY_INBOX.md`) |
| grow/reviews | SCHEMA + PROVIDER | proposed `GET /v3/me/reviews`, `POST /v3/me/reviews/:id/reply` | not built: needs a review source (the Google profile) and a table for replies; no review is ever invented |
| grow/chat | PROVIDER | proposed `GET /v3/me/chats` | not built: needs a chat channel (WhatsApp or web chat) and its provider |
| grow/reports, money/analytics | SCHEMA (aggregate only) | proposed `GET /v3/me/reports/summary?from&to`: enquiries by status and kind, orders and money by day, customers by source | not built: reads only existing tables, so it needs no migration, but the answer shape is the vendor app's to confirm first |
| money/sell (counter sale) | SCHEMA | proposed `POST /v3/me/sales` (a counter sale: lines, tender, stock out, document) | not built: reuses the store and documents modules but needs a sale table |
| money/invoice-settings | SCHEMA | proposed `GET/PUT /v3/me/invoice-settings` (number prefix, footer, terms line, bank details) | not built: today the tax profile (`/v3/me/tax-profile`) holds the legal fields only |
| more/notifications | PARTIAL | the bell today is `GET /v3/me/inbox/waiting` plus the activity feed; per-channel preferences need a table: proposed `GET/PUT /v3/me/notification-settings` | not built |

Count against the audit: of the 25 sample-only screens, **14 are wiring only**, **1 got its missing route here** (import), **10 need a table or a provider** and are written down above as contracts.

## 2. Per-pack demo content (the part the apps and the seed can use)

- File: `src/v3-packs/pack-demo/pack-demo-content.json`, built by `node scripts/build-pack-demo-content.js` (add `--check` to prove the file is exactly what the generator makes; a test does).
- What it holds, for each of the 16 packs: a believable sample business (invented name, tagline, city, about text), what it calls its items and its team, six services with a description, three people with roles, the questions customers ask, service areas, opening hours, the steps of how it works and a few pack sections (a clinic's departments, a pharmacy's licence and refills, a dealer's specifications).
- A clinic shows clinic services and doctors, an accountant shows tax and company filings, a gym shows memberships and classes. The four packs whose site falls back to a neighbouring trade (PHARMACY to a grocery design, B2B_DEALER to a consultant, RENTAL_FLEET to a travel agent, MEMBERSHIP_WELLNESS to a salon) carry their own business from `prisma/seed/pack-demo/pack-demo-overrides.json`.
- **No price anywhere.** The theme kit's own sample prices are dropped; a test fails if a currency sign, a "price" key or a discount phrase appears.
- Served read-only: `GET /v3/public/packs/:key/demo`. Used by the theme gallery (B6) and available to the vendor app's sample mode and to a demo seed.
- Not done: a script that writes this content into a demo vendor's own tables (services, customers). The content is ready for one; writing it needs a staging run that this dispatch kept for the enquiry test.
