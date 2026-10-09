# Roles, Permissions and Tenancy (PRD §47, §56, §86, §63K)

## Full BOS permissions (2026-10-09)

| Route family | Who | Enforced by |
|---|---|---|
| `/bos/*` (invoices, quotes, counter, receipts, parties, expenses, stock, Accounts totals) | vendor owner; team member only with the **accounts** area (stock screens: **website** area) | `JwtAuthGuard`, `@RequireModule('accounts' / 'website')`; every query filters by the vendor id |
| `/bos/purchases`, `/bos/books/*`, `/bos/stock/locations|transfer|valuation`, period lock, recurring | the same people, **and the plan must include it** | `EntitlementGuard`: HTTP 403 `PLAN_REQUIRED` with `{feature, requiredPlan}`; a team invite beyond the plan's seats gets 403 `LIMIT_REACHED` |
| `/public/bos/doc/:token` (shared invoice, Pay now) | anyone with the unguessable link | public by design; the page shows only that document; Pay now exists only if the vendor set up their own Razorpay; the amount always comes from the server |
| `/admin/bos/capabilities`, `/admin/bos/vendors/:id/capability` | platform admin only (the MARKETING staff role is refused) | `CommercialAdminGuard`; each change needs a written reason and is audited |
| `/vendor-payments`, `/vendor-payments/test` | the vendor | the secret is write-only and never returned; a saved Key ID that is not an `rzp_` key is never shown back and can never take a payment |

The MARKETING staff role stays refused on commerce, pricing, billing and accounts routes.

> Part of the Get4Domain V2 audit baseline (2026-10-02, audit-only). Statuses use the PRD §64.2 vocabulary. **Static-verified only.** Source evidence: `evidence/platform.md §2-§3, evidence/bos.md §2/§14`. Verdict: [AUDIT_REPORT.md](AUDIT_REPORT.md).

## A. Principal / role / permission matrix (as implemented)

| Principal | How minted | Reaches | Enforced by | Notes |
|---|---|---|---|---|
| Vendor owner | `POST /auth/login` → JWT 7d, `sub`=vendorId | All vendor modules | `JwtAuthGuard` (global, default-deny; `@Public()` exempt) | Tenancy from `user.sub` in ~95% of vendor routes |
| Vendor team member | login → JWT with `kind:team_member`, `sub`=parent vendorId + `modules` claim | Only the 8 coarse areas **on 9 of 75 controllers** (`@RequireModule`) | `ModuleGuard` | Everywhere else a team member has **owner-level API access** (nav hidden in UI only) |
| Platform SUPER_ADMIN (a `Vendor` row with role SUPER_ADMIN) | seeded `admin@get4domain.com` | Admin API | `AdminGuard`, `SuperAdminGuard` on 2 controllers | |
| Platform AdminTeamMember (MARKETING / OPERATIONS) | invite/accept; JWT minted `role:'ADMIN'` | **Same as ADMIN** — `adminRole` is not enforced by `AdminGuard` | — | Marketing staff can delete/suspend vendors, mark invoices paid, view vendor password hashes |
| Customer (end customer) | phone OTP → separate JWT secret suffix `_customer`, 24h | Customer portal | manual token verify in service | OTP unthrottled; phone lookup not vendor-scoped |
| Sandbox vendor | demo flow → 48h JWT `kind:sandbox` | Demo vendor APIs | JWT strategy checks expiry | Can still call `/payments/create-order` and `/uploads` |

PRD §47/63K roles (Owner, Admin, Manager, Sales, Telecaller, Accountant, HR, Purchase, Inventory, Cashier, Delivery, Technician, Kitchen, Doctor…) and granular permissions (view/create/edit/delete/approve/export/print/assign/manage-money/manage-staff/settings): **MISSING** — `TeamMember.role` is a free-text label that nothing reads for authorization.

## B. Authentication and session (PRD §57, §86)
| Item | Verdict | Evidence |
|------|---------|----------|
| JWT access tokens (HS256 via @nestjs/jwt) | WORKING (static) | auth/auth.service.ts:226-227, expiry fixed `7d` (also auth.module.ts:15). 7 days is long for a financial-product admin console. |
| Refresh token | PARTIAL (it is not a refresh-token system) | `POST /auth/refresh` just re-signs a new 7-day JWT for an already valid JWT (auth.controller.ts:28-32, auth.service.ts:195-205). No refresh token, no rotation, no server-side storage, no revocation list; stolen token can be refreshed forever. CLAUDE.md claim "JWT + Refresh Token" is FALSE. |
| Revocation / session invalidation | PARTIAL | JwtStrategy reloads the principal from DB each request (jwt.strategy.ts:25-77): suspended vendor, removed/inactive team member, removed admin member and expired sandbox are rejected immediately. No password-change invalidation because there is no password change. |
| Password hashing | WORKING | bcryptjs, cost 10 (auth.service.ts:244; team.service.ts:70; vendors.service.ts:45). Register policy: min 8 + upper + digit (register.dto.ts); Login/Team: min 6/8 only. |
| Login endpoints | WORKING | One `POST /auth/login` that resolves principal in order Vendor (incl. bootstrap ADMIN/SUPER_ADMIN vendor) -> AdminTeamMember -> TeamMember (auth.service.ts:82-193). `POST /auth/register` self-service (auto-login). Sandbox token minted by Book-Demo flow (auth.service.ts:231-236, 48h). Customer portal uses separate phone-OTP flow (see below). |
| Principal types | WORKING | Vendor (role VENDOR), Vendor SUPER_ADMIN (the seeded `admin@get4domain.com`; platform admin is a Vendor row), AdminTeamMember (kind admin_member; adminRole SUPER_ADMIN / MARKETING / OPERATIONS), vendor TeamMember (kind team_member; sub = parent vendorId + modules claim reloaded from DB), sandbox vendor (kind sandbox), customer (separate JWT secret suffix `_customer`, 24h). |
| Guards / decorators | PARTIAL | `@Public()`, `@CurrentUser()`, `@RequireModule()` (9 controllers), `AdminGuard`, `SuperAdminGuard` (2 controllers), `VendorOwnerGuard` (team mgmt only: team.controller.ts:18,33,41). No `@Roles()` decorator exists (CLAUDE.md mentions it). |
| Forgot / reset / change password | MISSING | No endpoint anywhere (grep for forgot/reset/change-password = 0 backend hits). Admin cannot reset a vendor password either: `UpdateVendorDto = OmitType(CreateVendorDto, ['password'])` (vendors/dto/update-vendor.dto.ts:5). The dashboard Settings page "Change Password" form is a stub: `setTimeout` fake save, no API call (get4domain_mvp/src/app/dashboard/settings/page.tsx:11-14,60-75). Status: UI-ONLY. |
| Email verification | MISSING | Register creates + logs in immediately. Welcome email contains the plaintext password: `sendWelcomeEmail(vendor, dto.password)` (vendors.service.ts:69; demo.service.ts:~125). |
| Brute-force protection / lockout | MISSING | See C5. |
| 2FA / MFA | MISSING | none |
| Phone OTP (platform): `/otp/request`, `/otp/verify` | PARTIAL | In-memory Map store (otp.service.ts:37), `Math.random()` (not crypto RNG, :86), 5-attempt cap per code (good), 30s per-number cooldown (not per-IP), 5-min TTL, no cross-instance sharing (comment admits; breaks behind >1 backend instance), "verified today" DB record lets anyone who knows a number verified earlier today skip the OTP (otp.service.ts:50-54; leads.service.ts:44-50). Dev echo `OTP_DEV_ECHO=true` returns the code in the response when SMS is unconfigured (otp.service.ts:95). |
| Customer portal login (`/customer/request-otp`, `/verify`) | BROKEN-security (see C6) | customer.service.ts:49-82. Also `findFirst({phone})` across ALL vendors picks one arbitrary vendor's contact (a customer of two vendors can only ever reach one). |
| Demo access gate (OTP before viewing /demo/*) | BROKEN (bypassable) | `app/api/demo/verify/route.ts:7-9,22-50` explicitly does NOT re-verify the OTP; any client can POST `{phone, category}` and receive the signed pass cookie. Signing secret falls back to hard-coded `'g4d-demo-access-v1'` when `DEMO_ACCESS_SECRET` is unset (lib/demo-access.ts:8). |
| Frontend session storage | PARTIAL | JWT + user object in `localStorage` (`g4d_token`, `g4d_user`: lib/api.ts:8, lib/auth.ts:25-44) - XSS-stealable; no httpOnly cookie, no CSP. Next middleware only gates `/demo/*` (middleware.ts:50); `/admin`, `/dashboard` are client-side gated, backend is the real enforcement. |

Public (unauthenticated) handlers: 46 (44 `@Public()` decorators plus class-level on go.controller.ts), see section 3.3.

---------------------------------------------------------------------------------------------------


## C. Tenancy / IDOR audit (PRD §56 — 'Test cross-tenant isolation')


Method: parsed all 75 controllers (route, @Public, guards, params, whether vendorId comes from `@CurrentUser`), then read every service touching `where:{id}` without `vendorId` (heuristic script over all 82 `*.service.ts`).

### 3.1 Summary
Vendor-facing endpoints derive tenancy from the JWT (`user.sub`) in ~95% of routes. The 19 industry modules, DomainApp (contacts/catalog/records/invoices), accounting, stationery, travel/contracts, WhatsApp KB, campaign-pages, campaigns, CRM, CMS use "own*" helpers (`findFirst({where:{id,vendorId}})` or `row.vendorId !== vendorId -> Forbidden`) before every update/delete, including child entities (job lines, milestones, sessions, order items), and verify foreign-key ids in bodies (e.g. clinic `assertDoctor`, travel `assertAssignmentsOwned`, contracts vehicle/driver/contact checks). Evidence: automobile.service.ts:58-68,107-117; construction.service.ts:61-83,122-133; clinic.service.ts:45-57; travel.service.ts:62-75; travel/contracts.service.ts:158-175; retail.service.ts:52-103; domainapp/*.service.ts. Vendor-id taken from path/query is always guarded by `assertOwnerOrAdmin` / admin-only `resolveVendorId`:
- cms.controller.ts:13-18,56-66,82-92,94-114 (ownerOrAdmin)
- invoices.controller.ts:17-22,44-75 (ownerOrAdmin)
- subscriptions.controller.ts:15-24, support.controller.ts:48-60 (inline owner/admin checks)
- addons.controller.ts:8-11 + modules.controller.ts (admin may pass vendorId, others forced to user.sub)

### 3.2 Risky endpoints (exhaustive list of what was found)

| # | file:line | Route | Issue | What a malicious logged-in vendor can do | Sev |
|---|-----------|-------|-------|------------------------------------------|-----|
| 1 | notifications/notifications.controller.ts:22-26; notifications.service.ts:74-76 | PUT /notifications/:id/read | `markRead(id)` updates by id only, no recipient check | Mark any other vendor's/admin's notification read (needs a cuid; low guessability) | LOW |
| 2 | payments/payments.controller.ts:14-26; payments.service.ts:61-103 | POST /payments/create-order, /payments/verify | `invoiceId` from body, no ownership or amount binding; any amount order creation | Mark ANY vendor's invoice (incl. their own large pending one) PAID with a valid tiny payment triple, replayable (C1) | CRITICAL |
| 3 | wallet/wallet.service.ts:85-130 (POST /wallet/topup/verify) | POST /wallet/topup/verify | replayable credit (C2) | Unlimited wallet credit from one real payment | CRITICAL |
| 4 | demo/demo.service.ts:82-84 ; website-themes/website-themes.service.ts:48-50 | POST /demo/buy/confirm, POST /website-themes/:id/unlock/confirm | order not bound to amount/purpose (C3) | Go live on a paid plan / unlock any paid theme for the price of a Rs 1 order | CRITICAL |
| 5 | team/team.service.ts:45-47; team.controller.ts:25-29 | GET /team/members | returns password hash + inviteToken; no owner guard | A restricted team member harvests hashes of colleagues and pending invite tokens (invite tokens do not expire, so an invited-but-not-yet-accepted member account can be taken over: team.service.ts:64-76) | HIGH |
| 6 | vendors/vendors.service.ts:25-35 (GET /vendors, /vendors/:id) | admin routes | raw Vendor incl. `password` hash | Any admin principal (incl. Marketing/Operations) reads all vendor bcrypt hashes | HIGH |
| 7 | vendor-payments/vendor-payments.controller.ts:18-21 | PUT /vendor-payments | no `VendorOwnerGuard`/module guard | Any team member (even restricted) replaces the vendor's Razorpay key pair; customers' payments then go to the attacker | HIGH |
| 8 | engine/engine.controller.ts:32-45 ; domains/domains.controller.ts:33 ; domainapp/* ; industry controllers | many | `@RequireModule` absent (see C9) | Restricted team members reach everything but the 9 tagged areas | MEDIUM |
| 9 | campaigns/campaigns.service.ts:60-83 | POST /campaigns/:id/approve | no status guard: approving twice debits the wallet twice; deduct and status update are not atomic | Vendor self-harm / double charge; replay | MEDIUM (integrity) |
| 10 | domains/domains.service.ts:263-271 | POST /domains/connect | no global uniqueness and no TXT-ownership proof; verify only checks A/CNAME to platform | Pre-claim another business's domain name; as soon as the real owner points DNS, the squatter's row flips to "active" | MEDIUM |
| 11 | cms/cms.controller.ts:68-73 (public) -> cms.service.ts:134-136 | GET /cms/vendor/:vendorId/products | no `active:true` filter on the public list (the /site endpoint filters, this one does not) | Draft/inactive products are public | LOW |
| 12 | domain-campaign/domain-campaign.controller.ts:25-29 | POST /domain-campaign/clients/me | body typed `Omit<Dto,'vendorId'>` (type alias, so ValidationPipe cannot validate it) then spread into createEnquiry | Mass-assignment of unvalidated fields (vendorId is overridden after the spread, so not a tenancy break) | LOW |
| 13 | invoices/templates/invoice.template.ts:66,130 ; quotes/templates | invoice HTML | `${vendor.businessName}` / `${i.description}` interpolated unescaped (businessName is self-chosen at public register) and the frontend writes this HTML with `document.write` into a same-origin popup (dashboard/invoices/page.tsx:51-53) | Stored XSS in invoice view / emailed invoice HTML; if an admin/viewer opens it from the app origin the script can read `g4d_token` | MEDIUM |

No cross-tenant read/write IDOR was found on industry/DomainApp/CRM/CMS/campaign endpoints (the most valuable result of this section). Residual TOCTOU: ownership check and update are two queries (not a transaction) everywhere; practically benign.

### 3.3 Public (@Public) endpoints - abuse review

| Route | Writes? | Controls present | Risk |
|-------|---------|------------------|------|
| POST /auth/login, /auth/register | register creates vendor + Rs 100 credit + welcome email + AI hero seed | none | brute force, sybil credit farming, email bombing |
| POST /otp/request, /otp/verify | SMS send (cost) | 30s per-number cooldown, 5 attempts | SMS pumping to arbitrary numbers |
| POST /customer/request-otp, /verify | SMS | none | brute force (C6), enumeration |
| GET /customer/* (me, records, catalog, contact, invoices, POST actions/:intent) | reads/writes using customer JWT in header | customer JWT verified manually, tenant from token | OK, but marked @Public so JwtAuthGuard bypassed (token verified in service: customer.service.ts:99-109) |
| POST /leads, /leads/demo, /leads/demo/visit | lead + sandbox vendor provisioning | OTP for /demo; none for POST /leads | spam, sandbox-vendor row flooding (no cron cleanup; only admin `POST /demo/cleanup-sandboxes`) |
| POST /ai/chat, /widget/chat | LLM call on platform key | max_tokens 300 only | cost abuse, no input cap |
| POST /widget/lead, /go/:slug/lead, /support/callback, /demo/enquiry, /domain-campaign/enquiry, /managed-services/enquiry | CRM leads + notifications (+ wallet debit for go/:slug) | none | spam, wallet drain |
| POST /campaign-pages/:pageId/view | counter increment | none | view inflation |
| POST /engine/public/:subdomain/actions/:intent | enquiry/booking/checkout/payment-CTA writes | DTO validation per action (engine.service.ts:95-100); vendor resolved from subdomain | spam, creates Razorpay orders on platform key for realestate token (engine.dto.ts:42-55), price trust (C4) |
| POST /payments/webhook | marks invoice paid | HMAC over raw body (payments.controller.ts:29-45; payments.service.ts:166-175) | OK; uses RAZORPAY_WEBHOOK_SECRET else falls back to KEY_SECRET; only `payment_link.paid` handled; idempotency by status check, not atomic |
| POST /whatsapp-bot/webhook | bot reply + wallet charge | header secret IF configured (fail-open otherwise) with constant-time compare (whatsapp-bot.controller.ts:49-68) | fail-open |
| GET/PUT /quotes/public/:token | proposal view/respond | 128-bit random token (quotes.service.ts:112) | OK |
| POST /team/invite/accept, /admin-team/invite/accept | set password | random 24-byte token, no expiry | long-lived tokens |
| GET /cms/*, /website-themes, /industries, /pricing, /demo/site/:industry, /widget/config/:key, /widget/embed.js | reads | - | public by design; `GET /cms/vendor/:vendorId` returns whole VendorCMS (public contact info) |

---------------------------------------------------------------------------------------------------


## D. BOS-side permission findings


Pattern is good in most vendor controllers: `@CurrentUser() user` -> `user.sub` -> service filters `{ id, vendorId }` (domainapp contacts/catalog/records/invoices/summary, accounting, stationery, retail, restaurant, finance, crm `findOne` ownership check at `crm.service.ts:80-83`, team `findOne` `team.service.ts:50-52`, campaigns, campaign-pages, cms products via controller owner check). vendorId is never read from body/query for vendor-facing BOS controllers. Exceptions and defects:

| # | Endpoint | file:line | Problem | Severity |
|---|---|---|---|---|
| 1 | `POST /payments/verify` | `payments.controller.ts:22-26`, `payments.service.ts:79-98` | `invoiceId` from body; **no ownership check, no amount/order binding**: verifies only HMAC(order_id|payment_id), then `prisma.invoice.update({where:{id: dto.invoiceId}})` -> marks ANY vendor's platform invoice PAID, activates its subscription (`finalizePayment`) and grants wallet bonuses. Combined with #2 an attacker pays INR 1 and settles any invoice | Critical |
| 2 | `POST /payments/create-order` | `payments.controller.ts:15-19`, `payments.service.ts:61-67` | Any authenticated principal (vendor, team member, sandbox) can create a Razorpay order for any amount/receipt | High |
| 3 | `POST /demo/buy/confirm` (go-live) | `demo.service.ts:80-103` | Verifies only the signature (:84); never compares the paid order amount to the chosen plan price; with #2 a sandbox converts to a live BOS/Workspace vendor + subscription + AI credit for INR 1 | Critical |
| 4 | `engine.checkout.order/confirm` (public) | `public-checkout.service.ts:47-48,55,77,81-103` | Cart `price` is **client-supplied** (`CheckoutLine.price`, `engine.dto.ts:65`); order total and recorded sale both derive from it, so a buyer can set price 1. `confirm` recomputes `rupees` from the posted cart and never fetches/compares the Razorpay order amount, and has no idempotency (same `razorpay_payment_id` can be replayed -> unlimited `PosSale` 'completed' rows + CRM leads). Stock decrement is dead (section 5). Comment at :22 ("recomputed server-side ... never trusted") is not true for price | Critical |
| 5 | `GET /team/members` | `team.service.ts:45-46` | Returns `password` (bcrypt) and `inviteToken` of every member to any vendor-side principal incl. restricted team members -> a member can take over pending invitations | High |
| 6 | `PUT /vendor-payments` | `vendor-payments.controller.ts:18-21` | No owner/module guard: a team member can replace the vendor's Razorpay keys (redirects public-checkout funds) | High |
| 7 | `/domainapp/*`, `/retail/*`, `/restaurant/*`, all industry controllers, `/stationery`, `/finance`, `POST /customer/invite`, `POST /engine/actions/:intent` | (no `@RequireModule`) | Any team member (even with zero modules) has full read/write on customers, invoices, POS, stock via direct API despite hidden nav | High |
| 8 | Customer portal OTP | `customer.service.ts:49-66,24` | `contact.findFirst({where:{phone}})` is **not vendor-scoped** - if the same phone is a contact of 2 vendors the session binds to an arbitrary vendor; `devOtp` is returned in the API response whenever `NODE_ENV !== 'production'` (:62-63); OTP via `Math.random`; in-memory `Map` (lost on restart / not multi-instance); no attempt limit or throttling anywhere in the app (6-digit OTP, 5-min TTL); `Contact.portalAccess` flag is never checked at login | High |
| 9 | `PUT /notifications/:id/read` | `notifications.controller.ts:22-25`, `notifications.service.ts:74-76` | No recipient check - any user can mark any notification read | Low |
| 10 | `GET /vendors`, `GET /vendors/:id` (admin) | `vendors.service.ts:~14,28` | Returns full `Vendor` incl. `password` hash to every platform staff role | Low |
| 11 | CRM/Team/Campaign findOne | `crm.service.ts:82`, `team.service.ts:52` | 403 vs 404 reveals id existence across tenants | Info |
| 12 | Team login email not unique across vendors | `auth.service.ts:~150` `findFirst({email})` | Same email on two vendors' teams logs into whichever is found first | Low |
| 13 | Stored XSS in print views | `generic-invoice.template.ts:32,68,80`; `accounting.service.ts` voucher | see section 9; combined with #7 a low-privilege member can attack the owner | Medium |

Verified OK (sampled): CMS `PUT vendor/:vendorId` & product update/delete (owner/admin check), `/invoices/vendor/:vendorId` and `/subscriptions/vendor/:vendorId` (`assertOwnerOrAdmin`/inline check), CRM/campaign pages, `engine.dispatchPublic` (vendor from subdomain), domainapp `create` verifying `contactId`/`recordId`/`catalogItemId` belong to the vendor (`invoices.service.ts:36-44`, `records.service.ts:12-26`). Not exhaustively verified: the remaining ~15 industry services beyond the sampled ones.


## E. Role / users / HR evidence (PRD 63K, 63V)


Evidence: `TeamMember` model (schema.prisma:459-476): `role String` (free text), `department String?` (label), `modules Json` (array of labels), `status`, `inviteToken`, `password`. `AdminTeamMember` + `AdminRole` enum SUPER_ADMIN/MARKETING/OPERATIONS (schema.prisma:762-786) are *platform staff*, not vendor staff. `Role` enum VENDOR/ADMIN/SUPER_ADMIN (schema.prisma:685-689).

| Capability | Evidence | Status |
|---|---|---|
| Invite / accept / login / remove vendor team member | `team/team.controller.ts:18-52`, `team.service.ts:20-77`, login `auth/auth.service.ts:148-190`; removal is a soft status flip (`team.service.ts:63-64`) and JWT re-checks status every request (`jwt.strategy.ts:41-45`) | WORKING (invite email/WhatsApp awaited with no try/catch at `team.service.ts:36-39`: a provider failure after the row is created returns 500 and invites duplicate on retry) |
| Module-level access (8 areas) | `team-access.ts:91-126`, `module.guard.ts:43-55`; enforced only on the 8 controllers listed in section 0 | PARTIAL |
| Configurable roles (Owner/Manager/Sales/Cashier/Accountant...) | `role` is an arbitrary string, no role table, nothing reads it for authorization | MISSING |
| Granular permissions (view/create/edit/delete/approve/export/print/assign/manage money/staff/settings) | None. No permission matrix anywhere | MISSING |
| Departments | 4 hard-coded presets in UI (`dashboard/team/page.tsx:21-26`: Sales, Support, Accounts, Marketing) mapping to module labels; `department` stored but `update` ignores it (`team.service.ts:55`) | PARTIAL |
| Team members visibility of secrets | `GET /team/members` (`team.controller.ts:25-29`, `team.service.ts:45-46`) returns full `TeamMember` rows **including `password` hash and `inviteToken`** to any vendor principal, including a restricted team member (no `VendorOwnerGuard` on the GET) | BROKEN (data exposure) |
| Platform staff roles (MARKETING/OPERATIONS) | `AdminGuard` accepts any role ADMIN/SUPER_ADMIN (`auth/guards/admin.guard.ts:9-12`); only `SuperAdminGuard` (admin-team, platform-settings) differentiates. MARKETING and OPERATIONS therefore have identical API power | PARTIAL |
| Employee master / HR | No Employee model | MISSING |
| Attendance | No model. Gym tab `attendance` resolves to `ComingSoon` stub (`tab-registry.ts:5-13`: `attendance` is in `TAB_ADDON_REQUIREMENT` -> `resolveView` returns 'addon') | UI-ONLY (stub) |
| Leave, payroll, payslip, shifts | None in schema or src | MISSING |

## Release 1A additions (2026-10-09)

| Route | Who | MARKETING staff | Tests |
|---|---|---|---|
| `GET /dashboard/context` | The signed-in **vendor** (owner, team member or sandbox), own account only | n/a (staff accounts get 403) | `verify-dashboard-v2.js` tenancy section: vendor A never sees vendor B's invoice, leads, orders or domain; team members never get the plan invoice |
| `POST /crm/leads/:id/convert` | Vendor with the telecrm module, own leads only | n/a | cross-vendor convert is 403, nothing created |
| `/admin/plan-access/*` | Platform admin (SUPER_ADMIN, ADMIN with a non-marketing role) | **403** | controller sits behind `CommercialAdminGuard`; vendors, team members, sandbox users and MARKETING refused |
| `/admin/special-arrangements/*` | Platform admin; create / edit / end also behind `MoneyAdminGuard` | **403** | `verify-arrangements.js` permissions section |

Dashboard v2 team-member menu = the plan's access intersected with the member's areas; owner-only screens (Team and roles, Plan and billing, Business profile, Connections, Website disclosures, Stationery) are never shown to a team member. The server (module guard) remains the real boundary; the menu is a convenience.
