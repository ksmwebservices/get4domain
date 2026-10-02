> **Evidence file — static audit, 2026-10-02.** Produced by read-only code inspection (no runtime, no DB writes, no provider calls). Every status is "static-verified only" unless stated. This is raw supporting evidence for [AUDIT_REPORT.md](../AUDIT_REPORT.md); where it disagrees with AUDIT_REPORT.md or STATUS.md on post-audit changes, those win.

# Get4Domain - Platform Foundation / Security / Tenancy / Integrations / Deployment Audit

Scope: static, read-only inspection of C:\Get4Domain\get4domain-site (backend-api, get4domain_mvp, stepnrock, deebiphotography, ksm-quantum, allwin-tours, docs). Nothing was run (no build, tests, prisma, DB, network). Every verdict is "static-verified only". All paths below are relative to `C:\Get4Domain\get4domain-site\` unless absolute. Secret values were never read or printed; only variable names.

Audit date: 2026-10-02. Branch: get4domain-site.

Status vocabulary: WORKING, PARTIAL, UI-ONLY, BACKEND-ONLY, MOCKED, BROKEN, MISSING, BLOCKED-EXTERNAL, DEFERRED-APPROVED.

---------------------------------------------------------------------------------------------------

## 0. Headline answer

The platform is NOT production-safe against the V2 PRD security/money requirements. Tenancy isolation across vendor CRUD is genuinely good (the 19 industry modules, DomainApp, CMS, CRM, campaigns all scope by JWT vendorId with ownership checks). But there are several critical payment-integrity defects, no rate limiting/brute-force protection anywhere, no password reset, no audit log, zero automated tests, no CI, no monitoring/health/backups, and migrations that cannot recreate the schema.

Top critical items (details in section 3/5):

| # | Severity | Finding | Evidence |
|---|----------|---------|----------|
| C1 | CRITICAL | Platform payment verification is replayable and not bound to an invoice/amount. Any logged-in vendor can pay a tiny Razorpay order (they can create an order of ANY amount via `POST /payments/create-order`), then submit that valid {orderId, paymentId, signature} against any `invoiceId` and mark a large invoice PAID (activates subscription, grants wallet bonus, records income). The same valid triple can be reused again and again. | backend-api/src/payments/payments.controller.ts:14-26; payments.service.ts:61-67 (createOrder: any amount/receipt), :79-103 (verifyPayment: only HMAC(order\|payment), then `invoice.update({where:{id: dto.invoiceId}})` - no ownership, no amount match, no already-paid check, no payment-id uniqueness) |
| C2 | CRITICAL | Wallet top-up verification is replayable: the same {order,payment,signature} can be POSTed repeatedly and credits the wallet every time (no uniqueness check on razorpayId; `WalletTransaction.razorpayId` has no unique index). Also does not check `order.status`/notes.vendorId. | backend-api/src/wallet/wallet.service.ts:85-130; schema model WalletTransaction (razorpayId String? only) |
| C3 | CRITICAL | Same pay-small-reuse-signature bypass for (a) go-live conversion of a sandbox to a paid annual plan (Rs 14,145 / 28,305) and (b) premium theme unlock: both only call `verifySignature(order,payment,sig)`; neither fetches the order to compare amount or purpose. | backend-api/src/demo/demo.service.ts:84 (convertSandbox); website-themes/website-themes.service.ts:50 (confirmUnlock); payments.service.ts:71-77 |
| C4 | CRITICAL | Public-site checkout trusts client-supplied prices. `createOrder` and `confirm` both total `input.items[].price * qty` from the request body (the DTO even accepts per-line `price`); prices are never looked up from `CatalogItem`. A shopper can buy a Rs 1000 item for Rs 1. `confirm` is also replayable (no payment-id uniqueness), so one real payment creates unlimited "completed" sales and stock decrements. Comment claims "recomputed server-side from items" but the items ARE the client input. | backend-api/src/engine/public-checkout.service.ts:47-49 (total), :52-65 (createOrder), :68-122 (confirm); engine.dto.ts:60-84 (CheckoutLine.price, @IsNumber @Min(0)); stepnrock/components/cart/CartView.tsx:76,92 (calls it with client prices) |
| C5 | HIGH | No rate limiting, throttling, lockout, CAPTCHA or helmet anywhere. `@nestjs/throttler`/`helmet` not in package.json; 0 hits for Throttl/rateLimit. Login, register, OTP request/verify, customer OTP, public leads, public AI chat, widget chat, campaign-page lead form are all unthrottled. | backend-api/package.json (deps list), main.ts:1-47 |
| C6 | HIGH | Customer-portal OTP login has no attempt limit: `verify()` never counts failures, 6-digit code valid 5 minutes, endpoint is @Public and unthrottled -> brute-forceable account takeover of any customer by phone number. OTP is also logged in plaintext on every request and `contactExists` is returned (user enumeration, contradicts the code comment). | backend-api/src/customer/customer.service.ts:49-82 (no attempts), :60 (logs OTP), :53/63 (contactExists); customer.controller.ts:24-36 |
| C7 | HIGH | Password hashes (and invite tokens) are returned to API clients: `GET /team/members` returns raw `TeamMember` rows (password hash + inviteToken) to ANY vendor session including restricted team members; `GET/POST/PUT /vendors*` (admin) returns raw `Vendor` incl. password hash to any admin principal incl. Marketing staff. Only AdminTeamMember is sanitised. | backend-api/src/team/team.service.ts:45-47 and team.controller.ts:25-29 (no VendorOwnerGuard); vendors/vendors.service.ts:25-35; contrast admin-team/admin-team.service.ts:13 (`SafeAdminMember`) |
| C8 | HIGH | Admin sub-roles (MARKETING / OPERATIONS) are not enforced by the API. `AdminGuard` accepts `role === ADMIN`, and every invited AdminTeamMember is minted `role: 'ADMIN'`; only 2 controllers use `SuperAdminGuard` (admin-team, platform-settings). A Marketing staffer can delete/suspend vendors, mark invoices paid, deduct wallets, create subscriptions, view vendor password hashes. | backend-api/src/auth/guards/admin.guard.ts:9-12; auth/auth.service.ts:125-131; only `adminRole` consumers are ai/reels/video "isInternalStaff" |
| C9 | HIGH | Restricted team-member modules are enforced on only 9 of 75 controllers (`@RequireModule`). A member limited to e.g. "telecrm" can still call vendor-payments (overwrite the vendor's Razorpay keys), domains/register (spends wallet), DomainApp invoices/contacts, all 19 industry ops, uploads, engine actions. Only team management has `VendorOwnerGuard`. | grep: 9 `@RequireModule(` hits; vendor-payments/vendor-payments.controller.ts:18-21 (PUT keys, no guard) |
| C10 | HIGH | Public unauthenticated cost/abuse endpoints: `POST /ai/chat` (platform LLM spend, input length unbounded: `message`/`history.content` are plain @IsString), `/widget/chat`, `POST /go/:slug/lead` (each submission debits the target vendor's wallet Rs 1 for a WhatsApp alert -> wallet-drain), `POST /otp/request` (SMS cost; cooldown is per-number only), `POST /auth/register` (each signup gets Rs 100 free trial wallet credit, no email verification -> sybil farming), WhatsApp inbound webhook is fail-OPEN when no secret configured (anyone can drive the bot and charge vendor wallets). | ai/ai.controller.ts:17-23, ai/dto/chat.dto.ts; campaign-pages/campaign-pages.service.ts:13,141-150; otp/otp.service.ts:80-87; vendors/vendors.service.ts:12,60-66; whatsapp-bot/whatsapp-bot.controller.ts:49-68 |

---------------------------------------------------------------------------------------------------

## 1. Architecture inventory

### 1.1 Applications / packages

| App | Path | Framework / versions | Port (compose) | Notes |
|-----|------|---------------------|----------------|-------|
| backend-api | backend-api/ | NestJS ^11.1.28, Prisma 6.19.3, class-validator 0.14, passport-jwt 4, bcryptjs 2.4, razorpay 2.9.5, resend 4, web-push, @nestjs/schedule, @nestjs/swagger. Node 20-alpine image (Node 20 is past EOL as of Oct-2026). | 3008 | 77 module imports in app.module.ts (see 1.2); 75 controllers; ~480 route handlers; 388 .ts files / ~22.2k LOC (tracked). `strict: true` (tsconfig.json). |
| get4domain_mvp | get4domain_mvp/ | Next ^15.5.20, React 19, Tailwind 3.4, TypeScript 5.7, deps: fabric, gsap, jspdf, lucide-react. (No shadcn/ui, no radix: CLAUDE.md says shadcn/ui.) | 3006 | 288 .ts/.tsx files / ~42k LOC. 3 Next route handlers (app/api/demo/*). |
| stepnrock | stepnrock/ | Next 14.2.35, React 18.2, shadcn/radix, @supabase/supabase-js dep, zod, RHF | 3015 | Standalone vendor site; talks to platform API (`/cms/site/<sub>`, `/engine/public/<sub>/actions/engine.checkout.*`). netlify.toml present. |
| deebiphotography | deebiphotography/ | Next 13.5.1 (old, known-vulnerable line), React 18.2, shadcn/radix, @supabase/supabase-js | 3016 | Standalone vendor site; `/cms/site`, `/engine/public/.../engine.enquiry`. netlify.toml. |
| ksm-quantum | ksm-quantum/ | Next ^15.5.20, React 19 | 3014 | Static corporate site; no API calls found. |
| allwin-tours | allwin-tours/ | Next ^15.5.20, @anthropic-ai/sdk | 3010 | Own Next route handler `src/app/api/chat/route.ts` calling Claude with `CLAUDE_API_KEY`; no auth/rate limit on that route. |

No monorepo tooling (no root package.json/workspaces/turbo). Six independent `package.json` / `Dockerfile` / `docker-compose.yml` sets. Root has ~80 loose docs and several .zip bundles checked into the working tree (untracked).

### 1.2 Backend module wiring (backend-api/src/app.module.ts:1-171)
Global `ConfigModule` (isGlobal, `.env.local` then `.env`), `ScheduleModule`, `PrismaModule`, then 77 feature modules: Auth, Vendors, Subscriptions, Invoices, Payments, Cms, Email, Support, Ai, Leads, Wallet, Domains, VendorComms, Travel, Salon, Gym, Hotel, RealEstate, Education, Professional, Construction, Events, Finance, Automobile, Logistics, Diagnostics, Photography, Agriculture, Coaching, Technology, Clinic, Restaurant, Retail, Engine, VendorPayments, Notifications, CampaignPages, Campaigns, Crm, Team, AdminTeam, AdminCrm, Quotes, ManagedServices, DomainCampaign, Industries, AiTemplates, WebsiteThemes, BusinessDocuments, Design, Reels, Accounting, Stationery, Analytics, Widget, DomainApp, Addons, PlatformSettings, Whatsapp, WhatsappBot, Sms, Meta, GoogleAds, GrowthHub, Communication, Customer, Otp, Video, Demo, Uploads. (Storage module exists but is not imported at top level; consumed through Ai/others.)

Global providers (app.module.ts:~140-158): `APP_GUARD JwtAuthGuard` (default-deny, `@Public()` exemption: common/guards/jwt-auth.guard.ts:12-24) then `APP_GUARD ModuleGuard` (team-member area gating, only on `@RequireModule` routes: common/guards/module.guard.ts:20-31).

main.ts (backend-api/src/main.ts:12-47): `rawBody: true`; static `/uploads/`; `enableCors({origin:true, credentials:true})` (reflects any origin; comment justifies as Bearer-only); global `ValidationPipe({whitelist, transform, forbidNonWhitelisted})` (GOOD); `TransformInterceptor` envelope `{success,statusCode,message,data,timestamp}` (matches CLAUDE.md); `HttpExceptionFilter` (returns raw `exception.message` for 500s, so Prisma error text can leak: common/filters/http-exception.filter.ts:28-33); Swagger at `/api/docs` always on, no auth, in production too (main.ts:39-42). NOT present: helmet, throttler, compression, CSP, request-id/logging middleware, graceful-shutdown hooks, env validation (a missing `JWT_SECRET` is not detected at boot).

JWT secret read at import time: `JwtModule.register({secret: process.env.JWT_SECRET})` (auth/auth.module.ts:13-16) is evaluated before `ConfigModule.forRoot` loads `.env.local` (works only because Docker `env_file` injects variables into the real environment). CustomerModule falls back to the literal `'dev-secret'` + `_customer` if `JWT_SECRET` is unset (customer/customer.module.ts:17): forgeable customer tokens on misconfiguration.

### 1.3 Database / Prisma
- 99 models, 8 enums (Role, AdminRole, VendorStatus, Product, Plan, SubStatus, InvoiceStatus, TicketStatus), schema.prisma 2,329 lines. `datasource` uses `url` + `directUrl` (DIRECT_URL) (schema.prisma:5-9) = Supabase pooled + direct pattern. GOOD.
- 38 migration directories (backend-api/prisma/migrations). Practice is mixed: many hand-written SQL migrations (industry ops tables 20260826-20260828, registry, theme etc.) AND `prisma db push` on the VM for core tables (docs/VM_DEPLOY_RUNBOOK.md:80; docs/DISPATCH_PROGRESS.md:41-42, AUDIT_REPORT.md:54). Result: 71 tables created by migrations vs 99 in schema; 28 schema tables have no CREATE TABLE in any migration (g4d_leads, g4d_wallets, g4d_wallet_transactions, g4d_campaign_pages, g4d_campaign_leads, g4d_call_logs, g4d_campaigns, g4d_team_members, g4d_notifications, g4d_platform_income, g4d_contacts, g4d_messages, g4d_catalog_items, g4d_records, g4d_generic_invoices, g4d_vendor_addons, g4d_vendor_modules, g4d_platform_settings, g4d_quotes, g4d_admin_team_members, g4d_ai_templates, g4d_website_themes, g4d_vendor_payment_config, g4d_vendor_template_unlock, g4d_expenses, g4d_stationery, g4d_lead_call_logs, g4d_push_subscriptions possible naming mismatch). A fresh DB built with `prisma migrate deploy` would be missing core tables. Status: PARTIAL (migration history not reproducible; no staging parity). `backend-api/prisma/sql/enable_rls_public.sql` (manual RLS enable for Supabase) is a nice mitigation, must be re-run after each push.
- `DomainCampaignRecord` is accessed via `$queryRawUnsafe` because Prisma client was not regenerated (backend-api/src/domain-campaign/domain-campaign.service.ts:107-141,175) - all 5 raw-SQL calls use `$1..$n` parameters (SAFE; the only raw SQL in the codebase).
- CLAUDE.md conventions vs reality (computed from schema.prisma):

| Convention | Compliance |
|-----------|-----------|
| `id String @id @default(uuid())` | 0 / 99 models (98 use `cuid()`, 1 other scheme) = 0% |
| `createdAt` | 93 / 99 = 94% (missing: PlatformCMS, Wallet, VendorAddon, VendorModule, PlatformSetting, OtpDailyVerification) |
| `updatedAt` | 87 / 99 = 88% |
| `deletedAt` (soft delete) | 1 / 99 = 1% (VendorCommsSettings only, schema.prisma:1335) and ZERO code references to `deletedAt` in backend-api/src |
| Full compliance (uuid + 3 timestamps) | 0% |
| "Never hard delete" | 69 `.delete()/.deleteMany()` calls in backend-api/src (e.g. cms.service.ts:250 product delete, accounting.service.ts:101,189, every industry module delete). Only campaign-pages uses an `active=false` soft-delete (campaign-pages.service.ts:85-88). |
| Prisma transactions for multi-table writes | Only 10 `$transaction` usages. Missing/non-atomic: campaign approve (deduct then update: campaigns.service.ts:60-72), wallet.deduct reads balance then decrements (race can overdraw: wallet.service.ts:141-167), paymentslink webhook update-then-finalise (payments.service.ts:184-201, race on duplicate webhook). |

---------------------------------------------------------------------------------------------------

## 2. Authentication & RBAC

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

## 3. Tenancy / IDOR audit

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

## 4. Secrets and cryptography

| Item | Verdict | Evidence |
|------|---------|----------|
| Platform-settings encryption at rest | WORKING | AES-256-GCM, random 12-byte IV, auth tag, format `iv:tag:ct` (platform-settings/crypto.util.ts:3-45). Key = `PLATFORM_SETTINGS_KEY` env (64-hex used directly; any other string -> single SHA-256, no KDF; :11-20). No key versioning/rotation; losing the key makes all stored secrets undecryptable (`getResolvedValue` silently falls back to env: platform-settings.service.ts:121-135). If `PLATFORM_SETTINGS_KEY` is unset, saving any secret throws. The checked `.env.local` has NO `PLATFORM_SETTINGS_KEY` variable (names only inspected); only `.env.example` does -> verify on VM. |
| Vendor Razorpay secret at rest | WORKING | same `encryptSecret` (vendor-payments.service.ts:37); never returned (`hasSecret`) |
| Secrets masked in admin UI | WORKING | `maskSecret` last-4 only (crypto.util.ts:48-52); controller is SuperAdminGuard (platform-settings.controller.ts:10) |
| OAuth tokens | MISSING (n/a) | There is no OAuth integration (Meta/Google Ads are mocks); nothing to store. For V2 social/ads publishing this must be built, encrypted. |
| Admin-entered keys actually used? | PARTIAL | Razorpay and Resend keys exist in the Integrations UI (platform-settings.constants.ts:34-41,98-103) but the code reads them ONLY from `process.env` (payments.service.ts:37-40; wallet.service.ts:28-31; email.service.ts:17; domainapp/engine too). Entering new Razorpay/Resend keys in Admin -> Integrations has no effect. By contrast AI, SMS, WhatsApp, storage, domains, Meta, Google Ads, video do resolve via settings. |
| "Test connection" button | MOCKED | `testSetting` only checks a value is present, no provider ping (platform-settings.service.ts:101-118). Integration "health" is therefore not real. |
| Hard-coded secrets in source | NONE FOUND (static) | `git grep` for sk_/rzp_/AIza/sk-ant/eyJ: only doc placeholders (docs/ARCHITECTURE.md:610; vendor-payment.dto.ts:6 example; stepnrock/app/pages/cart.html:181 `rzp_test_XXXX` placeholder). |
| Hard-coded config/fallbacks | FOUND | `'dev-secret'` JWT fallback (customer.module.ts:17); `'g4d-demo-access-v1'` demo secret (get4domain_mvp/src/lib/demo-access.ts:8); server IP `34.14.130.68` (domains.service.ts:~283); `https://gapi.get4domain.com` default in 10+ places (backend widget.controller.ts:8; frontend lib/api.ts:1, 8 more files; deebiphotography/lib/site-data.ts:18; deebiphotography+stepnrock docker-compose.yml:7,15); admin Settings page placeholder phone `+91 98765 43210` (admin/settings/page.tsx). |
| .env files tracked? | NO | `git ls-files` shows only `backend-api/.env.example` and `get4domain_mvp/.env.local.example`. `.env.local` files exist locally and are ignored (`backend-api/.gitignore:4`, `get4domain_mvp/.gitignore:27`, `allwin-tours/.gitignore:4`, `stepnrock/.gitignore:29`). There is NO root `.gitignore`; `backend-api/uploads/` is not ignored (vendor-uploaded files could be committed). deebiphotography/ksm-quantum have their own .gitignore (not checked for env coverage). |
| Razorpay checkout signature | WORKING but unsafe use | HMAC SHA-256 on `order|payment` (payments.service.ts:69-77, :80-83; wallet.service.ts:86-89) - correct primitive, compared with `!==` (not timing-safe), and used without binding to amount/purpose (C1-C3). |
| Razorpay webhook signature | WORKING | rawBody enabled (main.ts:13), HMAC of raw body (payments.service.ts:166-175). `payment.captured`/`payment.failed`/refund events are not handled despite the controller summary claiming `payment.captured`. |
| WhatsApp (Fast2SMS) webhook | PARTIAL | shared-secret header, constant-time compare, but fail-open when unset (whatsapp-bot.controller.ts:57-68). |
| Meta / MSG91 / Resend webhooks | MISSING | none (no bounce/complaint/delivery-receipt handling anywhere). |

---------------------------------------------------------------------------------------------------

## 5. Payments

| Capability | Verdict | Evidence / notes |
|-----------|---------|------------------|
| Platform Razorpay order create | WORKING-but-unsafe | `POST /payments/create-order` is open to any authenticated principal incl. sandbox tokens, arbitrary `amount` and `receipt` (payments.controller.ts:14-19; create-order.dto.ts). Should be server-derived from invoice/plan only. |
| Platform signature verify + mark paid | BROKEN (C1) | payments.service.ts:79-103 (also not idempotent: replays create duplicate PlatformIncome rows and re-send emails + WhatsApp to admin, :208-238). |
| Payment-link flow (admin sends link, webhook marks paid) | PARTIAL | payments.service.ts:105-132, :184-203. Only event handled is `payment_link.paid`; no failure/expiry/cancel events; status check + update is non-atomic (duplicate webhook race); amount in webhook not compared to invoice. |
| Subscription renewal | MISSING | One-time annual orders only; no auto-renew/dunning; `Subscription.endDate` is never read by any guard or cron (grep: no EXPIRED/PAST_DUE handling); the only `@Cron` in the codebase is travel contract billing (travel/contracts.service.ts:137). Admin Renewals page filters client-side. |
| Wallet top-up | BROKEN (C2) | wallet.service.ts:71-130. Bonus tiers hard-coded (:12-17) not admin-pricing. |
| Wallet debit | PARTIAL | transactional but check-then-decrement race (wallet.service.ts:141-167); credit "90-day expiry" is stored on each credit row (wallet-credit.util.ts:23) but no job ever expires/debits it, balance is a single integer. Status: PARTIAL (display only). |
| Vendor-direct Razorpay (public site checkout) | BROKEN (C4) | per-vendor keys encrypted (vendor-payments.service.ts); order created with vendor's keys (public-checkout.service.ts:58-64); client-trusted prices; confirm replayable; no vendor webhook, so if the shopper closes the tab after paying no sale is recorded (reconciliation relies on browser callback). |
| Refunds | MISSING | no Razorpay refund API usage. `refundSale` in retail only flips status/stock (retail.service.ts:84-100); domain-registration "refund" is a wallet credit grant (domains.service.ts:233-241, itself subject to the 90-day expiry label). |
| Settlement / reconciliation / payout reports | MISSING | none for platform or vendor-direct. |
| GST invoices | WORKING (static) | InvoicesService.createPaidInvoice back-computes 18% GST; template unescaped HTML (3.2 #13). |
| Pricing source of truth | PARTIAL | Admin Pricing Manager (platform-settings `pricing` category via `getRate`) vs hard-coded fallbacks (demo.service.ts:~55-58; wallet bonus tiers; plan-pricing.constants.ts) vs hard-coded Admin Plans page (admin/plans/page.tsx:4-7). Three places can diverge. |

---------------------------------------------------------------------------------------------------

## 6. Input validation / raw SQL / uploads

- DTO coverage: 211 `@Body()` usages in controllers; 206 bind a DTO class (97.6%). Exceptions: `engine.controller.ts:37,59` and `customer.controller.ts:84` (typed unknown/Record but validated manually per action in engine.service.ts:95-100 - acceptable), `invoices.controller.ts:86` (`@Body('paymentId') string`, admin only), plus the `Omit<Dto>` case (3.2 #12). 109 files import class-validator. ValidationPipe is global with whitelist + forbidNonWhitelisted. `@Query()/@Param()` (247 uses) are plain strings; dates/limits mostly not validated. Verdict: WORKING.
- Missing length caps on high-cost public inputs (ai/dto/chat.dto.ts, widget chat) -> see C10.
- Raw SQL: 5 `$queryRawUnsafe/$executeRawUnsafe` calls, all in domain-campaign.service.ts:117,128,135,141,175, all parameterised ($1..$n) - SAFE, but "Unsafe" API and exists only because the Prisma client was not regenerated (typed accessor should replace it).
- File uploads (`POST /uploads`, uploads.controller.ts:23-40): 5 MB limit (:26), extension derived from a server-side MIME map (path traversal safe: random name `Date.now_hex.ext`, :34), BUT MIME is the client-declared `Content-Type` (no magic-byte sniff), `image/svg+xml` is allowed (SVG can carry script and is served same-origin by the API static handler `/uploads/`, main.ts:17-19), no per-vendor quota or rate limit (any authenticated incl. sandbox principal can fill the VM disk), files live on the container's local disk with NO volume in docker-compose (backend-api/docker-compose.yml:1-17) so they are lost on every `docker compose up --force-recreate` (the runbook's deploy command, docs/VM_DEPLOY_RUNBOOK.md:66-67). Additionally the container runs as non-root `nestjs` (Dockerfile:20) with `/app` root-owned and `uploads/` not copied into the runner stage; `mkdirSync(uploads)` in main.ts:17-19 would fail with EACCES unless something external provisions it - static risk, must be verified on the VM. Supabase Storage (`storage/storage.service.ts`) is used only for AI hero images (ai.service.ts:329), not for vendor uploads. SSRF check: `uploadFromUrl` only fed by AI provider URLs (SAFE).
- Verdict: PARTIAL.

---------------------------------------------------------------------------------------------------

## 7. Audit logging / logging

- Audit log table or writer: MISSING (no model, no writer; `git grep -i audit.?log` hits only a comment in engine.types.ts:17). No record of who changed vendor status, prices, integration keys, wallet deductions, admin invites, etc. V2 PRD 49/63AB requirement not met. Closest artefacts: `lastLogin` on team members and `updatedBy` on PlatformSetting; `GET /team/activity` is a team roster with lastLogin, not an audit trail (team.service.ts:79-85).
- Impersonation: MISSING (no code; "Vendor Access" admin page is addon/module/theme-override toggles).
- Logger vs console: backend `console.*` = 0 occurrences in src (WORKING, complies with CLAUDE.md); frontend 2. `Logger` is used, unstructured text, no request id, no PII redaction (OTP codes and phone numbers are logged: customer.service.ts:60; otp.service.ts:90).
- `any` usage: backend 2 occurrences (salon.service.ts, realestate.service.ts) - excellent; frontend 121 `: any / as any` (CLAUDE.md forbids).
- TODO/FIXME: only 4 in backend (all mock-integration markers: customer.service.ts:58, google-ads.service.ts:31, meta.service.ts:31, one doc example).

---------------------------------------------------------------------------------------------------

## 8. Observability / ops / deployment

| Item | Verdict | Evidence |
|------|---------|----------|
| Health endpoint | MISSING | none. Runbook uses `GET /cms/platform` as a proxy (docs/VM_DEPLOY_RUNBOOK.md:153). No Docker HEALTHCHECK in any Dockerfile. |
| Error monitoring (Sentry etc.) | MISSING | no dependency/imports. |
| Structured logging / metrics | MISSING | Nest default Logger only. |
| Backups / restore | MISSING (not in repo or runbook) | DB is Supabase (managed; PITR depends on plan, undocumented). No `pg_dump`, no upload backup (uploads on container disk). |
| CI/CD | MISSING | no `.github/`, no pipeline files; deploy = manual SSH `git pull; docker compose build --no-cache; up -d --force-recreate` (docs/VM_DEPLOY_RUNBOOK.md:66-67, rollback :179). |
| Docker | PARTIAL | one Dockerfile + compose per app (6), multi-stage, non-root, Node 20-alpine (EOL), no HEALTHCHECK, no resource limits, backend has no uploads volume, no DB container (Supabase external, OK), `env_file: .env.local` for backend. |
| Nginx | PARTIAL | nginx conf for get4domain_mvp, stepnrock, deebiphotography, ksm-quantum only; no conf for the API (gapi.get4domain.com -> 3008) is in the repo (documented only in docs/ARCHITECTURE.md:640+); configs listen on :80 (TLS assumed terminated elsewhere: Cloudflare/certbot, not in repo); only X-Frame-Options and X-Content-Type-Options headers; no HSTS/CSP; wildcard `*.get4domain.com` server block exists but the app has no host->/site/<sub> rewrite (middleware matcher is `/demo/:path*` only; docs/GET4DOMAIN_SUBDOMAIN_INFRA_REQUIREMENT.md states "NOT implemented"). Status of per-vendor subdomains and custom domains: MISSING in code, BLOCKED-EXTERNAL for wildcard DNS/TLS. |
| Process manager | docker `restart: unless-stopped` only; no pm2 files in repo. |
| Deployment docs | PARTIAL | docs/VM_DEPLOY_RUNBOOK.md (179 lines), DEPLOYMENT_GUIDE_COMPLETE.md, MONDAY_DEPLOYMENT_GUIDE.md, docs/README.md, docs/ARCHITECTURE.md exist; they reference `prisma db push` in prod (runbook :80) conflicting with the migrations directory. |
| Tests | MISSING (coverage = 0%) | `git ls-files` finds 0 `*.spec.*` / `*.test.*` / e2e / jest / vitest / playwright files in the whole repo; backend package.json has no jest, no `test` script, no ts-jest/supertest (only `jest-worker` as a transitive). Lint: `npm run lint` script exists but no eslint/prettier devDependency or config in backend-api (script cannot run; CLAUDE.md "run lint before commit" is unenforceable); eslint config only in stepnrock/deebiphotography. |
| Dead/duplicate modules | `notifications/whatsapp.service.ts` (MSG91, env-only, not via settings) duplicates `whatsapp/whatsapp.service.ts` (Fast2SMS); two WhatsApp stacks. `stationery` module present. `Storage` module not top-level imported. Stability AI has a settings entry but zero code. |

### 8.1 Environment variable inventory (names only; values never read)

Backend (`process.env.*` in backend-api/src, plus Prisma datasource):

| Variable | Used by | Required? |
|----------|---------|-----------|
| DATABASE_URL, DIRECT_URL | prisma/schema.prisma:6-8 | REQUIRED |
| JWT_SECRET | auth.module.ts, jwt.strategy.ts:22, customer.module.ts:17 | REQUIRED (no boot check; customer falls back to 'dev-secret') |
| PORT | main.ts | optional (3008) |
| PLATFORM_SETTINGS_KEY | platform-settings/crypto.util.ts | REQUIRED for any stored secret (vendor payment keys, integrations); absent in local .env.local |
| RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET | payments, wallet, domainapp, engine | REQUIRED for money flows (env only, NOT settings-driven) |
| RAZORPAY_WEBHOOK_SECRET | payments (falls back to KEY_SECRET) | recommended |
| RESEND_API_KEY | email.service.ts:17 | REQUIRED for email (env only) |
| FRONTEND_URL | customer, email, payments | optional (defaults https://get4domain.com) |
| PUBLIC_API_URL | uploads, widget, reels | recommended (https links behind proxy) |
| COMPANY_NAME/GST/PAN/ADDRESS/PHONE/EMAIL/LOGO_URL | invoices & quotes templates, support, payments (fallback of settings `company`) | optional |
| ADMIN_EMAIL, ADMIN_PASSWORD | email, prisma/seed.ts | seed only |
| ADMIN_WHATSAPP_NUMBER | payments, support | optional |
| MSG91_AUTH_KEY, MSG91_SENDER_ID, MSG91_WHATSAPP_NUMBER | notifications/whatsapp.service.ts (legacy) | optional |
| VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT | notifications (web push) | optional (push disabled otherwise) |
| SERVER_IP | domains (DNS verification; hard-coded fallback) | recommended |
| RESELLERCLUB_API_BASE | domains (defaults prod endpoint) | optional |
| OTP_DEV_ECHO | otp.service.ts:95 | MUST be unset in prod |
| NODE_ENV | customer.service.ts:62 | set to production by Dockerfile |
| Via PlatformSettings `envFallback` (platform-settings.constants.ts) | CLAUDE_API_KEY, OPENAI_API_KEY, STABILITY_API_KEY, SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY/SUPABASE_STORAGE_BUCKET, WHATSAPP_BSP_*, FAST2SMS_API_KEY/SENDER_ID/ENTITY_ID/SMS_MESSAGE_ID/WA_MESSAGE_ID, META_APP_ID/SECRET/ACCESS_TOKEN, GOOGLE_ADS_DEVELOPER_TOKEN/CLIENT_ID/CLIENT_SECRET, RUNWAY/HEYGEN/KLING_API_KEY, RESELLERCLUB_API_KEY/RESELLER_ID/CUSTOMER_ID/CONTACT_ID/NS1/NS2/REG_*, PRICE_* (pricing rate card), MSG91_AUTH_KEY/SENDER_ID | optional (DB value wins, env fallback) |
| Scripts only | MRTRAVELS_VENDOR_EMAIL/SUBDOMAIN/PASSWORD (scripts/migrate-mrtravels.ts) | n/a |

Locally present in backend-api/.env.local (names): PORT FRONTEND_URL DATABASE_URL DIRECT_URL JWT_SECRET RESEND_API_KEY RAZORPAY_KEY_ID RAZORPAY_KEY_SECRET RAZORPAY_WEBHOOK_SECRET CLAUDE_API_KEY VAPID_* COMPANY_* ADMIN_EMAIL (no PLATFORM_SETTINGS_KEY, no OPENAI/Supabase/Fast2SMS/ResellerClub in the local copy; production env not inspectable).

Frontend (get4domain_mvp): NEXT_PUBLIC_API_URL (15 uses), NEXT_PUBLIC_RAZORPAY_KEY_ID (4), NEXT_PUBLIC_VAPID_KEY, NEXT_PUBLIC_SITE_URL/PHONE/EMAIL/WHATSAPP (in .env.local.example), DEMO_ACCESS_SECRET (fallback to a known string), NODE_ENV. stepnrock: NEXT_PUBLIC_API_URL. allwin-tours: CLAUDE_API_KEY.

---------------------------------------------------------------------------------------------------

## 9. Test coverage
0 test files, 0 test scripts (backend or frontend), no test framework dependency, no CI. Coverage = 0%. Money-handling code (payments, wallet, public checkout, demo conversion) has no tests, which is how C1-C4 survived.

---------------------------------------------------------------------------------------------------

## 10. Technical debt inventory

Top 15 backend files by lines: ai/ai.service.ts 502; demo/demo.service.ts 366; demo/demo-content.ts 361; payments/payments.service.ts 332; domains/domains.service.ts 322; cms/cms.service.ts 260; auth/auth.service.ts 246; config/industries/index.ts 244; engine/action-registry.ts 236; domains/resellerclub.service.ts 235; whatsapp-bot/whatsapp-bot.service.ts 223; accounting/accounting.service.ts 223; vendor-comms/vendor-comms.service.ts 214; customer/customer.service.ts 214; invoices/invoices.service.ts 209. (Backend is well-factored; no god files.)

Top 15 frontend files (get4domain_mvp/src): data/demo-catalog.ts 1278; data/demo-site.ts 1220; app/dashboard/accounts/page.tsx 876; lib/api.ts 840 (single monolithic API client); components/telecrm/TeleCrmBoard.tsx 758; app/dashboard/ai-studio/page.tsx 668; app/admin/managed-services/page.tsx 613; data/industry-content.ts 599; data/content.ts 588; app/customer/page.tsx 560; app/admin/library/page.tsx 544; components/marketing/HeroMockup.tsx 490; app/dashboard/my-website/page.tsx 452; app/dashboard/layout.tsx 451; app/dashboard/campaigns/page.tsx 417.

Other debt:
- Duplicated mirrors: industry/operation config lives in backend (backend-api/src/config/industries/*.ts, 20 files + index) AND frontend (get4domain_mvp/src/config/industry-experience.ts, config/operations.ts), kept in sync by hand (per project memory "TWO mirrors"); demo catalog/content duplicated across `data/demo-*.ts` and backend `demo/demo-content.ts`.
- API base URL fallback duplicated in 10+ frontend files instead of one module.
- Three pricing sources (3.5 above).
- Two WhatsApp implementations (MSG91 legacy, Fast2SMS).
- 2 standalone vendor sites copy-pasted from Bolt with old Next versions (13.5.1, 14.2.35) and different stacks.
- Zip artefacts and ~80 dispatch .md files in repo root/docs.
- Frontend `any` x121; frontend lib/api.ts untyped `data` casts.
- Raw-SQL fallback for DomainCampaignRecord until prisma generate is run.
- Orphans: Storage module not imported; Stability setting without code; Meta/Google Ads mocks wired into Growth Hub.

---------------------------------------------------------------------------------------------------

## 11. Admin / platform control plane (PRD 87)

Admin frontend (get4domain_mvp/src/app/admin/*, 22 pages):

| Page | Status | Evidence |
|------|--------|----------|
| / (overview) | WORKING | 6 API refs (admin/page.tsx) |
| accounting | WORKING | platform accounting API |
| ai-studio | WORKING (re-export of vendor page) | admin/ai-studio/page.tsx:1-4; free for internal staff (ai.controller.ts:62-68) |
| api-settings (Integrations) | PARTIAL | data-backed, but Razorpay/Resend keys not honoured (sec. 4) and "test" is presence-only |
| campaigns | WORKING | |
| cms (platform CMS) | WORKING | |
| customers | WORKING | vendor list (raw hashes returned, 3.2 #6) |
| domains | WORKING (backend), registrar BLOCKED-EXTERNAL | ResellerClub client "NOT verified against a live account" (domains/resellerclub.service.ts:33-38) |
| invoices | PARTIAL | "View Invoice" is BROKEN: `window.open('https://gapi.get4domain.com/invoices/<id>/pdf')` (admin/invoices/page.tsx:228) is an unauthenticated browser GET to a Bearer-protected endpoint that returns JSON `{html}` inside the envelope -> 401; hard-coded URL. |
| leads / telecrm | WORKING | admin-crm endpoints |
| library (AI templates + themes) | WORKING | |
| managed-services | WORKING | quote/proposal tool |
| plans | UI-ONLY | hard-coded array of 2 plans, no API (admin/plans/page.tsx:4-7); real prices are in Pricing Manager |
| pricing | WORKING | platform-settings `pricing` category |
| renewals | PARTIAL | client-side filter; no renewal automation or enforcement |
| send-quote | WORKING | |
| settings | UI-ONLY | "Save Changes" only toggles a success message; defaults are hard-coded fake contact data (admin/settings/page.tsx:7-12,22-40) |
| support | WORKING | |
| team | WORKING | invite/accept; roles not enforced by API (C8) |
| utilization | WORKING | usage + platform accounting (analytics.controller.ts) |
| vendor-access | WORKING | per-vendor addon/module/theme-override toggles, comms settings |

Capability / feature flags: `VendorAddon`/`VendorModule` toggles exist (addons/addons.constants.ts:22-41; admin toggles via `POST /addons/vendor/:key/enable`) but there is NO server-side consumer (grep for isEnabled/hasAddon = 0), so flags are advisory/UI gating only. Plan management: plans hard-coded (UI-ONLY) + subscription CRUD by admin; no entitlement enforcement from plan, no subscription-expiry enforcement. Integration health: presence check only (MOCKED). Usage: `GET /analytics/usage` per vendor counts leads/calls/AI/messages (WORKING, static). Impersonation: MISSING. Audit trail: MISSING.

---------------------------------------------------------------------------------------------------

## 12. Integration matrix

| Provider | Capability | Connection | Permission / approval | Current status | Error handling | Production ready |
|----------|-----------|-----------|----------------------|----------------|----------------|------------------|
| Razorpay (platform) | Orders, checkout signature, payment links, webhook | SDK `razorpay` 2.9.5, keys from process.env only | Account KYC/live keys (external) | PARTIAL - flows exist but verification is replayable/unbound (C1-C3); only payment_link.paid webhook; no refunds/settlements | `toPaymentGatewayError` maps SDK errors (payments.service.ts:154-164); unconfigured guard for links only | NO |
| Razorpay (vendor-direct) | Per-vendor keys, public checkout | vendor keys encrypted (AES-GCM) | Vendor's own Razorpay account | BROKEN (client price trust, replay, no webhook) | generic 400s | NO |
| Resend | Transactional email | SDK, `RESEND_API_KEY` env only (admin setting ignored) | Domain/sender verification (external) | WORKING (static) | logs + rethrow (email.service.ts:173-182); callers often swallow; no bounce/complaint webhook, no suppression | PARTIAL |
| Fast2SMS | SMS, OTP, WhatsApp template/session | plain fetch to `fast2sms.com/dev/bulkV2` via settings key/env | DLT sender/entity/template ids; WhatsApp template approval (external) | PARTIAL / BLOCKED-EXTERNAL (falls back to MOCK log when key absent: sms.service.ts:40-44; whatsapp.service.ts:47) | returns `{status:'failed', error}` honestly | NO until DLT + keys confirmed; not verifiable statically |
| MSG91 | legacy WhatsApp template | env-only, fetch | template approval | PARTIAL (legacy duplicate) | returns false + log | NO (redundant) |
| WhatsApp BSP | inbound bot + outbound | Fast2SMS WhatsApp only; no Meta Cloud API/other BSP | per-vendor number verification field `waStatus`; BSP approval | PARTIAL (bot reads settings webhook secret; fail-open when unset) | swallow-and-log | NO |
| Supabase Storage | AI hero image rehosting | REST fetch with service key via settings | project/bucket set-up (external) | PARTIAL (only AI hero; vendor uploads on local disk) | returns `not_configured/failed` gracefully (storage.service.ts:20-26,63-70) | PARTIAL |
| Supabase Postgres | primary DB | Prisma pooled+direct URLs | RLS enabled via manual SQL script | WORKING (static); migrations not reproducible | n/a | PARTIAL |
| ResellerClub | Domain search/register | httpapi.com via settings key + reseller id | reseller account funding/approval (external) | BLOCKED-EXTERNAL (code present; "NOT verified against a live account", resellerclub.service.ts:33-38; project memory says creds still needed) | wallet-debit-first with failure refund (domains.service.ts:233-241) | NO |
| OpenAI | Text (gpt-4o-mini), images (dall-e-3) | fetch with settings key | billing | WORKING (static); no key in local env | HTTP errors logged -> ServiceUnavailable | PARTIAL (unmetered public chat) |
| Anthropic | Text (claude-haiku-4-5-20251001), allwin chat | fetch / SDK | billing | WORKING (static) | same | PARTIAL |
| Stability AI | primary images | settings entry only | - | MISSING (no code: grep = constants only) | - | NO |
| Video (Runway/HeyGen/Kling) | video gen | settings keys, provider abstraction | API access | MOCKED when unkeyed (video.service.ts:10-24); real calls "unverified" | mock clip URL | NO |
| Meta (FB/IG) | Publish posts | settings token | Meta App Review (external) | MOCKED - always returns fake post id, even when a token exists it reports `status:'published', mock:true` (meta.service.ts:31-42) | none | NO (misleading success) |
| Google Ads | Launch campaign | settings dev token | Developer-token approval (external) | MOCKED (google-ads.service.ts:31-41) | none | NO |
| Web Push (VAPID) | notifications | web-push lib, env/settings | - | WORKING (static) | | PARTIAL |

Platform-settings categories (platform-settings.constants.ts:21-200): company, payment, ai, storage, whatsapp, sms, fast2sms, email, meta, google_ads, push, video, domain, pricing (14 categories; secrets flagged `secret:true` are encrypted; pricing is non-secret rate card).

---------------------------------------------------------------------------------------------------

## 13. Status tally (items assessed in this audit)

Counting the discrete items rated above (sections 1-12, one status per item):

| Status | Count | Items |
|--------|-------|-------|
| WORKING | 15 | JWT access tokens; password hashing; login (multi-principal); tenancy isolation of vendor CRUD (industry/DomainApp/CMS/CRM); DTO validation; raw-SQL safety; Logger-only logging; secrets-at-rest AES-GCM (settings + vendor keys); Razorpay webhook HMAC; response envelope/global pipes; strict TS; GST invoices (static); usage analytics; Resend (static); OpenAI/Anthropic text (static) |
| PARTIAL | 24 | refresh token; revocation; RBAC; guards; platform OTP; customer portal data endpoints; Prisma/migrations; uploads; Dockerfiles; nginx; deployment docs; pricing source-of-truth; wallet debit/expiry; payment-link flow; subscription renewal (as MISSING→partial?) ; admin api-settings; admin renewals; admin invoices page; custom domains; plan management; Supabase storage; WhatsApp BSP; Fast2SMS; Razorpay platform integration |
| UI-ONLY | 3 | Admin Settings page; Admin Plans page; vendor Settings "Change Password" |
| BACKEND-ONLY | 0 | (feature flags are the nearest case: data exists, no consumer; classified under PARTIAL) |
| MOCKED | 4 | Meta publish; Google Ads launch; integration "Test connection"; video (unkeyed) |
| BROKEN | 7 | platform payment verify (C1); wallet top-up verify (C2); go-live/theme-unlock verify (C3); vendor-direct checkout (C4); customer OTP login security (C6); demo OTP gate bypass; admin "View Invoice" button |
| MISSING | 17 | password reset/change; email verification; rate limiting/lockout; 2FA; audit log; impersonation; health endpoint; error monitoring; backups; CI/CD; automated tests; refunds; settlement/reconciliation; subscription expiry/renewal automation; soft delete; Stability AI; per-vendor subdomain/host rewrite |
| BLOCKED-EXTERNAL | 3 | ResellerClub live verification; wildcard DNS/TLS for vendor subdomains; Fast2SMS DLT/WhatsApp template approvals (also Meta/Google approvals behind the MOCKED rows) |
| DEFERRED-APPROVED | 0 | nothing in the code is explicitly marked deferred-approved by the owner; the docs mark subdomain infra as "requirement only" |

(Counts are approximate groupings of the matrix above; the exact assignment per item is in the tables.)

---------------------------------------------------------------------------------------------------

## 14. Recommended remediation order (for the owner)
1. Money integrity (C1-C4): bind every Razorpay verify to a server-created order (store orderId -> {vendorId, purpose, invoiceId, amount} at creation; on verify fetch the order/payment from Razorpay, check amount, status=captured/paid, notes, and enforce UNIQUE(razorpayPaymentId)); remove or lock down `POST /payments/create-order`; recompute public checkout totals from `CatalogItem.price`; add idempotency.
2. Add `@nestjs/throttler` globally (+ stricter on login/register/OTP/public writes), helmet, per-IP caps, CAPTCHA/OTP on public lead and register, attempt counters on customer OTP, crypto-random OTP stored hashed in DB/Redis.
3. Strip password/inviteToken from every response (use `select`/serializer), add `VendorOwnerGuard` to vendor-payments, enforce `adminRole` in `AdminGuard` variants, extend `@RequireModule` to every vendor controller.
4. Add password reset/change flow + refresh-token rotation; shorten access token to <= 1 day.
5. Fail-closed webhook secrets; env validation at boot (JWT_SECRET, PLATFORM_SETTINGS_KEY, RAZORPAY_*).
6. Audit-log table + writer for admin and money actions; /health endpoint; Sentry; backup policy; CI with build+lint+tests; at least integration tests for payments/wallet/tenancy.
7. Reconcile migrations (baseline the 28 `db push` tables), adopt `migrate deploy` only; decide soft-delete policy (CLAUDE.md vs reality) and uuid-vs-cuid.
8. Persist uploads (volume or Supabase), disable SVG or sanitise, add magic-byte sniffing and quotas.
9. Wire host-based routing for vendor subdomains and custom domains (and TXT ownership proof).
10. Replace Meta/Google Ads mocks or relabel the UI honestly ("Pending integration"), fix Admin Settings/Plans/vendor Settings stubs and the admin invoice view.
