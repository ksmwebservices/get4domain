# Stage 0 / Stage 1 auto-run log

Branch `v3-step0`. One block per task. Written by the cmd Claude Code session. Nothing here is pushed until FINISH (PUSH RULE).
Owner's 72 pre-existing modified files: untouched (verified against a saved list after each task).

---

## 0.1 S8-B owner-only money and purchase routes — `d552718`
Files (9): the 6 controllers (`commercial/commercial.controllers.ts`, `payments/payments.controller.ts`, `website-themes/website-themes.controller.ts`, `wallet/wallet.controller.ts`, `leadspace/wallet.controllers.ts`, `site-doc/packs.controller.ts`), `test/route-classification.spec.ts`, `test/baselines/route-classification.json`, new `test/owner-only-money.int.spec.ts`.

| Check | Red | Green |
|---|---|---|
| Route-classification static scan | 2 failed (16 routes + 1 area gate listed) | 161/161 |
| Baseline diff | | 770 routes; exactly 16 `ownerOnly` + 1 `module: website` |
| New HTTP spec (real controllers, mocked services, staging JWT) | mutation: guard removed on `POST /wallet/topup` gave 201 instead of 403, 1 test failed | 52/52 |
| Full staging int | | 217/217 |

Decisions: reads stay area-gated; wallet-spending feature routes stay area-gated (owner decision). Production had 0 team members.
Incident (disclosed): a `git checkout` on six of my own files partly failed on Windows; recovered from a saved patch. After that the owner added the rule: never `checkout`/`restore`/`stash`/`reset`.

## 0.2 S7 tightening — `033f1eb`
Matrix: SUPER_ADMIN only on `GET /analytics/platform-accounting`, `GET /leads`, `PUT /leads/:id/status`, `DELETE /vendors/:id`; support tickets OPERATIONS + SUPER_ADMIN; suspend/activate unchanged. Files (3): `admin-role-matrix.ts`, `admin-role-matrix.spec.ts`, `admin-guard.int.spec.ts`.

| Check | Red | Green |
|---|---|---|
| Matrix unit | 11 failed / 79 passed | 90/90 |
| Staging end-to-end | 7 failed / 16 passed | 23/23 |

## 0.3 S13 password reset, change, rotating refresh tokens — `d5331b2`
Files (20): new `src/account-security/` (9 files), `prisma/schema.prisma`, migration `20261103120000_account_security` (**staging only**), `jwt.strategy.ts`, `app.module.ts` (one import), `common/throttling.ts`, `email/email.service.ts`, `scripts/staging/test-tenant-cleanup.js`, `test/support/staging-env.ts`, route baseline, 2 new specs.

Rules and the test that proves each (staging, real accounts of all three kinds: vendor owner, team member, Get4Domain staff):

| Rule | Proof |
|---|---|
| Reset token single-use | replay gives 400; 4 simultaneous uses give exactly one 200 |
| Stored hashed | row `tokenHash` equals SHA-256 of the token; token absent from the row |
| Short-lived and configurable | `PASSWORD_RESET_TTL_MINUTES=7` gives expiresAt-createdAt = 7 min; expired token refused; newer request voids older link |
| Forgot / login never reveal existence | known vs unknown email: identical status and body; unknown email, wrong password and suspended account (correct password): identical 401 body and each at least the minimum time |
| Rate limits | per-account cap 3 mails/hour (extra requests identical, send nothing); 10 failures lock IP+email (429 even for the right password), other accounts unaffected; per-IP `@Throttle` declared on all 6 routes (unit-checked) |
| Refresh rotation + reuse detection | old token 401 after use; replay revokes the whole family including the newest token; simultaneous use leaves at most one winner and revokes the family; suspended account cannot refresh; logout revokes family |
| Password change/reset revokes everything | all refresh tokens 401; access tokens issued before the change get 401 (`passwordChangedAt` in JwtStrategy, all three account kinds); change returns a fresh session |
| No secrets in logs | log-capture test across login, forgot, reset, reuse, replay and a failing mail provider: no password, reset token, refresh or access token appears |
| Mail behind the provider, test mode | `EmailService` test mode (`EMAIL_MODE=test`, ignored when `NODE_ENV=production`) captures into an outbox; provider failure never changes the HTTP answer |

| Check | Red | Green |
|---|---|---|
| Unit `account-security.spec.ts` | suite could not load (module missing) | 18/18 |
| Staging `account-security.int.spec.ts` | suite could not load | 29/29 |
| Mutation checks | reuse-detection removed and revoke-on-change removed: exactly those 2 tests failed | restored by hand, 29/29 |
| Full staging int | | 246/246 (8 suites); unit 179/179; lint 0 errors; build, verify:migrations (111), verify:raw-sql exit 0 |
| Gates | | drift: none; migrate-status up to date; RLS-off tables 0; synthetic tenants 0 |
| Route baseline | | 770 to 776 (5 public + 1 authenticated, all in `/auth/session/*` and `/auth/password/*`) |

Decisions (owner had not specified; safest option taken):
1. **New routes, legacy untouched.** `auth.service.ts` and `auth.module.ts` hold the owner's uncommitted work, so the safe flows live in new `POST /auth/session/login|refresh|logout` and `POST /auth/password/forgot|reset|change`. `/auth/login` and `/auth/refresh` keep working unchanged.
2. **Access token lifetime stays 7d by default** (`ACCESS_TOKEN_TTL`). Shortening it now would sign out the current frontend, which does not use refresh tokens yet.
3. Token ledger tables have no `updatedAt`/`deletedAt`: append-only security records, kept so a replayed token is still recognised as used.
4. `refreshToken` is on the global response-redaction list; the three token-issuing routes opt out explicitly by returning a typed response object, so no other endpoint can leak one.
5. Failed-login limiter is in memory (per backend process); the per-IP throttle stays as the outer limit.
6. Reset and change mail the user a "password changed" notice (best effort).

Open items:
- **Frontend**: no `/reset-password` page and no forgot-password form exist yet; the emailed link will 404 until the frontend adds them. The frontend must also move from `/auth/login` to `/auth/session/login` and use refresh tokens; then set `ACCESS_TOKEN_TTL=15m` and retire `/auth/refresh`.
- **Legacy `/auth/login`** still tells a suspended account's owner "This account has been suspended" before checking the password (an existence signal) and has no timing floor. Fix needs the owner to commit `auth.service.ts` first, or the frontend to switch routes.
- **Real email delivery is unverified**: no real mail is sent in tests (stop-line). It depends on `RESEND_API_KEY` and a verified sending domain in production. `FRONTEND_URL` must be set correctly there.
- Migration `20261103120000_account_security` is applied to **staging only**; production needs separate approval.

---

## 0.4 S7-B inline admin checks moved onto the role matrix — `8ba8ba4`
Files (20): `auth/guards/staff-access.ts` (new: `isStaffPrincipal`, `staffRoleOf`, `routeKeyOf`, `staffMayUse`, `assertOwnerOrStaff`), `common/decorators/route-key.decorator.ts` (new `@RouteKey()`), `STAFF_VENDOR_ACCESS_MATRIX` in `admin-role-matrix.ts`, `admin.guard.ts` (shares the helpers), the 11 controllers (cms, invoices, subscriptions, support, addons, modules, notifications, stock, ai, video, reels), scanner + baseline + 2 new specs.

Found 8 controllers that decided "staff or owner" inline (cms 10 handlers, invoices 4, subscriptions 1, support 1, addons 1, modules 1, notifications 4, stock 2) plus ai/video/reels (free internal allowance). All now ask the matrix, keyed by route, deny by default; SUPER_ADMIN behaviour unchanged.

| Check | Red | Green |
|---|---|---|
| `staff-vendor-access.spec.ts` (unit: oracle, matrix, helpers, source scan) | 3 failed: scanner found 0 asking routes; inline offenders listed | 53 tests pass |
| Baseline drift now compares `staffMatrix` | red: 29 routes listed | green after regenerate: exactly 29 `staffMatrix:true`, total 776 unchanged |
| `staff-vendor-access.int.spec.ts` (staging, real staff + vendor JWTs, mocked services) | mutation to the old inline rule: 8 failed (MARKETING got 200/201 on another vendor's invoices, subscription, tickets, CMS, stock) | 17/17 |
| Full | | unit 220/220, staging int 263/263 (9 suites), lint 0 errors / 12 warnings (unchanged), build, verifies exit 0, drift none, RLS-off 0, leftovers 0 |

Decisions (owner had not specified; least privilege, consistent with the S7 matrix):
1. Cross-vendor data (CMS, invoices, subscription, tickets, add-ons, modules, stock): OPERATIONS + SUPER_ADMIN. **MARKETING loses access** to these (it was open before).
2. The shared admin notification inbox: OPERATIONS + SUPER_ADMIN; a MARKETING staff member now reads their own (empty) inbox instead.
3. Free internal AI / video / reel generation: kept for every staff role (existing behaviour, documented design).
4. `GET /stock/low` still refuses any staff member ("open a vendor first"), unchanged.
5. Allow-listed, not moved (each has its own reason, listed in the spec): AdminGuard/SuperAdminGuard, JWT strategy and login (build the principal), `resolve-tenant.ts` (tenant guard), `leadspace/staff.guard.ts` and `commercial/foundation.services.ts` (their own staff guards), `bos/entitlements.service.ts` (staff bypass of plan gating), `registry/dashboard-context.service.ts` (refuses staff), `admin-team.controller.ts` (echoes own role).

Open items:
- The admin UI (`lib/admin-nav.ts`, frontend) may still show MARKETING staff links to screens whose data they now cannot load; they get a 403. Frontend follow-up.
- `leadspace/staff.guard.ts` and the commerce guards still allow any staff role by their own rules (S7 notes them as out of scope); worth a later pass.

---

## 0.5 Baseline commit-group plan — no commit (as instructed)
`docs/v3/BASELINE_COMMIT_GROUPS.md` (new, uncommitted). Eight groups in dependency order: G2 backend (13), G1 sign-up (3), G3 dashboard (2), the four client apps one commit each in rollout order KSM Quantum, Deebi, Allwin, Step N Rock (10 + 17 + 16 + 9), G5 deployment doc and verify wiring (2) = 72. Each has files, why, risk, companions, tests to run and a commit message.
Findings: the 72 files are untouched by this run (checked after every task); none of this run's commits edits a file in G1 or G2 (`cms.controller.ts` is not `cms.service.ts`); committing G1 first unlocks the legacy-login follow-up from task 0.3. Recommendation unchanged from `BASELINE_CHANGES.md`: keep them off the V3 branches, on a feature branch from the V2 line, moved by patch (not checkout/stash/reset).

---

# Stage 1 — SEO-0 (frontend `get4domain_mvp/`)

How it was tested: `get4domain_mvp/scripts/seo-check.mjs` (34 checks, five groups) against a **local, frontend-only** production build (`next build` and `next start` on 127.0.0.1:3100 with `NEXT_PUBLIC_API_URL` / `INTERNAL_API_URL` pointed at an unreachable local port, so no request could reach a backend; throw-away `DEMO_ACCESS_SECRET`). The script refuses any non-loopback host. It was never run against the live site. Frontend `next lint` is not configured (it stops at an interactive prompt), so `tsc --noEmit` and the type/lint step of `next build` were used.

Baseline (unmodified code): **4 passed, 26 failed** of 30 checks, each for the intended reason (legacy prices in the root title, no noindex, 680 demo URLs in the sitemap, no redirects, structured data on every page, `/_next/` blocked, three orphan pages).

## 1.1 Legacy removal — `5a6e49e`
Files (8): `src/app/layout.tsx`, `(marketing)/page.tsx`, `(marketing)/industries/[id]/page.tsx`, `src/constants/site.ts`, `src/lib/metadata.ts`, `src/lib/retired-wording.ts` (new), `src/components/marketing/Faq.tsx`, `public/llms.txt`.
Red to green: legacy group 7 failing, then 7 passing. Decisions: tagline "Your Online Visible Partner"; home title `absolute`; no prices anywhere in meta or schema. **FAQPage structured data now skips any question or answer that still uses retired wording** (the visible FAQ is untouched, as instructed; the FAQ schema is generated from the visible copy, so it would otherwise have carried "What is LeadSpace?" and the old prices). `Organization.sameAs` is omitted (TODO in `SiteJsonLd.tsx`). `og-banner.jpg` not touched.

## 1.2 Demo handling — `1073e7f`
Files (6): `visit-demo/{page,VisitDemoForm,VisitDemoIntro}.tsx`, `middleware.ts`, `next.config.ts`, `sitemap.ts`.
Red to green: demo group 7 failing, then 7 passing. `/visit-demo` is a server page (noindex, own title and description, heading and text in the raw HTML, form skeleton as the Suspense fallback; still a static route). `X-Robots-Tag: noindex` on `/visit-demo` for every query variant and on every `/demo/*` response (both 307s and pages served with a valid pass). `/demo/*` out of the sitemap. **No robots Disallow for `/demo/` or `/visit-demo`** (checked).

## 1.3 Canonicals and redirects — `4839fcf`
Files (6): `lib/site-canonical.ts` (new), `components/seo/SiteJsonLd.tsx` (new), root and marketing layouts, `site/[subdomain]/[[...rest]]/page.tsx`, `middleware.ts`.
Red to green: canon group 7 failing (2 already passing), then 9 passing. 301 `get4domain.com/site/<sub>...` to `https://<sub>.get4domain.com...` (apex and www; query kept); vendor host `/site/<same-sub>/x` to `/x`; GET/HEAD only. Self-canonical on every vendor page for every renderer (legacy had none; the new renderer pointed inner pages at the home page; the theme-package branch was already correct). Organization, WebSite and SoftwareApplication JSON-LD only in the marketing layout (never vendor sites, LeadSpace pages, app screens, 404s); no offers, no SearchAction.

## 1.3b Robots, noindex, links, metadata helper — `faf37a9`
Files (9): `robots.ts`, `next.config.ts`, `sitemap.ts`, `lib/metadata.ts`, cart and order-success pages, `Footer.tsx`, two removed dead pages (`/products`, `/digital-growth`).
Red to green: robots + links groups 9 failing, then 11 passing; **all 34 pass**. `/_next/` no longer blocked; every AI-crawler rule disallows `/admin/ /dashboard/ /app/ /api/`; noindex header on private, token and transactional addresses; footer links to `/how-it-works`, `/portfolio`, `/templates`; `createPageMetadata` requires `path` (type and runtime); sitemap without request-time dates or priorities; `/products` and `/digital-growth` now answer a real 308 (a static page calling `redirect()` answered 200 with a meta refresh).

## 1.4 `seo-check.mjs` — `d3ca48a`; plan doc — `14e25a1`
`scripts/seo-check.mjs` + `npm run seo:check`. A4 (www/https) is **plan only** and written into `docs/v3/SEO_0_PLAN.md` section 7; nothing in code, nginx or Cloudflare changed.

Decisions: 301 as dispatched (the plan draft said 308); `foundingDate` left as live with a TODO; A6 (shortening long titles) and the "20 industry links in server HTML" half of A9 **not done** (A6 needs wording the owner should choose; A9 as dispatched covered the three orphan pages); `/pay/*` added to the noindex list (token payment pages).

Open items: the `TODO(owner)` items in `SiteJsonLd.tsx` (`sameAs` URLs, `foundingDate`); `og-banner.jpg` may carry a price in the image; Q-SEO-1 (pricing copy) blocked on the V3 price source; a frontend ESLint configuration does not exist; vendor-page rendering was verified through middleware, the pure canonical function and source checks only, because vendor pages need the API (never started locally).

---

# FINISH — summary

## Commits on `v3-step0` made in this auto-run (oldest first)
| Task | Commit |
|---|---|
| 0.2 S7 tightening | `033f1eb` |
| 0.1 S8-B owner-only money routes | `d552718` |
| 0.3 S13 password reset + rotating refresh tokens | `d5331b2` |
| 0.4 S7-B staff access via the role matrix | `8ba8ba4` |
| 1.1 legacy removal | `5a6e49e` |
| 1.2 demo handling | `1073e7f` |
| 1.3 canonicals, redirects, JSON-LD | `4839fcf` |
| 1.3b robots, noindex, links, helper | `faf37a9` |
| 1.4 seo-check script | `d3ca48a` |
| SEO plan doc (A4 plan, as built) | `14e25a1` |
| This log (+ SEO plan hash fix) | the FINISH commit |

Earlier, already on the branch: `755a1e3` (pushed before), `963e793` S12, `6a67bdd` S8-A, `aae5782` S7, and docs commits including the owner's desktop ones (`dcbb64e`, `5642cc4`, `634514d`).

## Test totals
Backend unit 220/220; backend staging integration 263/263 (9 suites); lint 0 errors (12 pre-existing warnings); build, `verify:migrations` (111 files) and `verify:raw-sql` exit 0; staging drift none, RLS-off tables 0, synthetic tenants 0. Frontend: `tsc --noEmit` clean, `next build` ok, `seo-check` 34/34. (The backend state is unchanged since `8ba8ba4` apart from docs and frontend; the final pre-push re-run is recorded in the final report.)

## Migrations created (staging only, additive)
- `20261102120000_wallet_idempotency` (S12, previous session): one nullable column and a unique index.
- `20261103120000_account_security` (S13): three nullable `passwordChangedAt` columns; tables `g4d_password_resets` and `g4d_refresh_tokens` (RLS on). **Not applied to production.**

## Skipped or not done, and why
Nothing was skipped silently. Not done: SEO A6 (title shortening, needs wording), the industry-link half of A9, A12-A15 (deferred or superseded by the plan), A4 (plan only, as instructed), production migrations, the frontend token-storage move, the legacy `/auth/login` fix (needs the owner's uncommitted `auth.service.ts`). The 0.5 commit-groups document is **uncommitted** by instruction.

## The owner must do
1. **Production migrations (needs your explicit approval; none were run):** apply `20261102120000_wallet_idempotency` and `20261103120000_account_security` after a backup, then the RLS script. Verify with `migrate status`.
2. **Backend settings for S13:** `FRONTEND_URL` (reset link base), `RESEND_API_KEY` and a verified sending domain (real mail delivery is untested), optionally `PASSWORD_RESET_TTL_MINUTES`, `REFRESH_TOKEN_TTL_DAYS`, `ACCESS_TOKEN_TTL` (leave the default 7d until the frontend uses refresh tokens). `EMAIL_MODE=test` is ignored in production.
3. **Frontend work that S13, S8-B and S7-B need (nothing was built):** a `/reset-password` page and a forgot-password form (the emailed link 404s until then); switch login to `/auth/session/login` and use `/auth/session/refresh`; hide Payments, Domain, theme-purchase, billing-pay and wallet top-up UI for team members; hide admin screens a MARKETING staff member can no longer load.
4. **Behaviour changes to be aware of:** MARKETING staff lose access to other vendors' invoices, subscriptions, tickets, CMS, add-ons, modules, stock and the admin inbox (S7-B); team members get 403 on the 16 money and purchase routes (S8-B; production has 0 team members); `GET /website-themes/mine` needs the website area.
5. **Deploy the frontend** (your normal steps). Before it, check `public/og-banner.jpg` by eye for a baked-in price. After deploy, in **Search Console**: inspect `/visit-demo?to=/demo/clinic` (should show noindex), submit the sitemap (now 37 URLs), expect "Page with redirect" or "Crawled - not indexed" for the old demo URLs for some weeks, and watch the `/site/<sub>` copies drop in favour of `<sub>.get4domain.com`. Do **not** add `Disallow: /demo/` or `/visit-demo` to robots.txt yet.
6. **Cloudflare / nginx (plan in `docs/v3/SEO_0_PLAN.md` section 7):** inventory hostnames and vhosts, then Origin CA certificate and :443 blocks, then Full (strict) per hostname and zone, then `www` to apex 301 as a Cloudflare Redirect Rule, Always Use HTTPS, HSTS in stages. Rollback is setting SSL back to Flexible.
7. **Decisions waiting for you:** V3 prices (unblocks Q-SEO-1 and re-enables the FAQ schema for the rewritten items); title wording for A6; `sameAs` URLs and `foundingDate`; whether the four legacy client sites are still to be migrated (then follow `docs/v3/BASELINE_COMMIT_GROUPS.md`); the monthly spend cap per team member; the follow-up on legacy `/auth/login` once `auth.service.ts` is committed.
