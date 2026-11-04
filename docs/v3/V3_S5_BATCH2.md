# V3 Batch 2: consolidated design record

Branch `v3-b2` (from `origin/v3-s54`, `70e83ea`). Slices 5.6 (domains), 5.7 (directory and claim by OTP), 5.1b (plan purchase, Razorpay TEST only), 5.11 (AI Studio). Backend only. Nothing here touches production, a registrar, DNS, a certificate, a real payment, a real SMS or email, or a real AI model. Every migration is additive and staging only. Per-task detail and numbers: `B2_LOG.md`.

## Rules that apply to all four slices
- Legacy billing, BOS, commercial, wallet, domain-campaign, vendor-payments and menu-gating tables and constants are never read or written (decision D1); a static test per slice enforces it. Generic helpers only (advisory locks, the AES helper, token hashing, the error filter, the audit service).
- New tables are `g4d_`, RLS on, foreign keys only to `Vendor` and each other. Tables with a vendor id are registered in the tenant model registry.
- Every public or vendor-facing refusal that could leak existence is uniform (taken host, bad token, wrong code, other vendor's id).
- Money is integer paise. No rupee price, retired product name or old tagline appears in any generated or seeded text.
- Each slice ships a pure core, a repository port with a Prisma implementation and an in-memory twin, editable settings with documented defaults (registered in `plans/admin/extra-settings.ts`, so the one `PUT /v3/admin/plan-settings/:key` validates them), and three staging suites that are written and type-checked but NOT RUN.

## 5.6 Subdomain rules and domain mapping (`src/site-domains`)
**Data.** `g4d_domains` (unique host; `primaryVendorId` and `subdomainVendorId` are nullable unique, so the database allows one primary and one free subdomain per vendor), `g4d_domain_verifications` (TXT expected value, public by design), `g4d_redirects`.
**Rules.** Host normalisation to lowercase punycode; free-subdomain slug rules (length, charset, no edge or double hyphen, reserved names and a blocked-word list folded for look-alikes such as `adm1n`); canonical host: a custom domain is primary only while ACTIVE and the plan allows custom domains, so a downgrade changes the answer and never deletes a row; redirect plan (non-primary hosts 301 to the primary, www and apex by `wwwPolicy`, path kept by the caller). A released free subdomain is never given to another vendor (it redirects to the new one). Verification is a DNS TXT check over an injected resolver; the real resolver is created lazily and only while `domainDnsLiveChecks` is true (default false, then verify answers DISABLED and staff set the state with a reason). `sslStatus` is a recorded field only.
**Integration.** `HostDirectory.resolveHost` replaces the slice 5.4 placeholder behind the same by-host contract (plus a 301). `toRenderEntitlements.customDomain` is true only with an ACTIVE verified custom domain, and the build uses the primary host as the canonical address.
**Routes (14).** Vendor `/v3/me/domains` (7, owner only). Staff `/v3/admin/domains...` and `PUT /v3/admin/vendors/:id/domains/subdomain` (7, OPERATIONS and SUPER_ADMIN, reads included).
**Examples.** `PUT /v3/me/domains/subdomain {"slug":"sri-ganesh"}` -> the ACTIVE row. `POST /v3/me/domains/custom {"hostname":"shop.example.in"}` -> `instructions: {type:"TXT", name:"_g4d-verify.shop.example.in", value:"g4d-verify=..."}`. Free plan -> 403 `FEATURE_LOCKED` with the upsell text. Taken, quarantined or blocked -> 409 `HOST_UNAVAILABLE` (same body).
**Decisions.** `src/domains` is the legacy ResellerClub module, so the new code is `src/site-domains`. `Vendor.subdomain` (read by the legacy site renderer) is kept equal to the free subdomain in the same transaction. A vendor may hold `domainMaxPerVendor` (5) custom domains: an abuse cap, not a plan feature.

## 5.7 Public directory, claim by phone OTP, removal links (`src/directory`, plus `src/provisioning/claims` and `steps`)
**Data.** Location and category trees (slug unique per parent through a non-null `parentKey`), businesses (nullable unique `vendorId`, generated `tsvector` + GIN, guarded `pg_trgm` index), services, media, labelled sponsored placements, OTP challenges (keyed hashes only), removal requests (hashed token, `confirmedAt`), claim-phone overrides, single-use account-setup grants, and one new value on `V3StepKey`.
**Search.** Full text always; trigram only when the extension could be created (the migration does not fail without it; expect `db:staging:drift` to list the trigram index). Organic order is relevance then name; sponsored items are inserted at fixed positions on page 1 only and always carry their label.
**Visibility.** An UNCLAIMED business shows only name, category, area and description; phone, street address, hours, map position, services and media appear after the claim. No email, owner name, vendor id, internal id or staff field is ever public. Removed = 410.
**Claim.** `POST /v3/claim/:token/otp/request` (always the same answer) and `/otp/verify` (every failure the same 400). The code goes to the phone on the business record, or the vendor's phone, or a number staff approved with a reason. Six digits from `crypto.randomInt`, HMAC-hashed with a per-row salt, compare-and-set attempt counting (max 5), resend cooldown and per-phone and per-IP hourly limits. Success redeems the slice 5.3 claim link exactly once, marks the business CLAIMED and returns a 30-minute single-use account-setup grant; no password is set. SMS is sandbox by default; live needs the setting AND `SMS_LIVE_ENABLED=true` and still has no provider wired (fails with ADAPTER_NOT_CONFIGURED).
**Removal.** Anyone may ask (uniform 202); a link to the phone on file confirms; staff approve (only when confirmed) or reject; execute hides the profile and keeps the row and audit.
**Provisioning.** Optional step `CREATE_DIRECTORY_PROFILE` behind `provisioningDirectoryProfileEnabled` (default false), registered through a separate injection token; the five slice 5.3 steps and tests are unchanged.
**Routes (31).** Public 10, vendor 2 (`/v3/me/directory`, owner only), staff 19 (reads open to all staff, MARKETING without personal fields; writes, override and removal queue OPERATIONS and SUPER_ADMIN).
**Seed.** `prisma/seed/v3-directory.seed.json`: Tamil Nadu, 38 districts, 19 cities, 12 families and the kit's 41 categories, all `proposed: true`; loader `scripts/seed-v3-directory.js` (dry run by default).

## 5.1b Plan purchase and renewal (`src/plan-billing`)
**Data.** `g4d_plan_orders` (quote snapshot, integer paise, unique provider order id, idempotency key per vendor, refund record fields), `g4d_payment_events` (provider event id unique, payload stored redacted by a whitelist), `g4d_plan_invoices` + `g4d_invoice_counters` (gap-free per financial year, the counter row is locked by the increment), `g4d_reminder_log` (unique per subscription, offset and end date).
**Flow.** Create (terms 3, 6, 12; public ACTIVE PRO plan of the vendor's track; approved effective price; tax from `g4d_tax_rates`; discounts from approved rules; provider order) -> confirm (signature checked AND the provider asked: captured, same order, exact amount and currency) or signed raw-body webhook (replay-safe, 200 for duplicates, 401 for a bad signature) or staff mark-paid, all through ONE settlement: per-vendor lock, amount check, subscription through the slice 5.1 `SubscriptionsService`, invoice, PAID, audit, or nothing. Mismatches and money for closed orders go to REVIEW and never activate.
**Rules.** Renewal extends from the later of now and the current end. Upgrade credit (`upgradeProration = PRORATE`) = unused whole months at the old monthly rate; the seeded default is NONE. Mid-term downgrades are refused (they take effect at term end). Reminders are off by default, sandbox only, never repeat, and carry no price.
**Provider.** `RazorpayPort`: fake in every test; the real TEST adapter only when `paymentsMode = test` and `rzp_test_` keys are in the environment; live refused (flag plus no adapter).
**Routes (9).** Vendor 4 (owner only), public webhook 1, staff 4 (reads OPERATIONS and SUPER_ADMIN; mark-paid and refund record SUPER_ADMIN only).

## 5.11 AI Studio providers and credits (`src/ai-studio`)
**Data.** `g4d_ai_providers` (secret as ciphertext, iv, tag via the existing helper; last four only), `g4d_ai_usage`, `g4d_ai_prompts` (versioned, one ACTIVE per key), `g4d_ai_credit_grants`.
**Flow.** Validate -> plan gate (`ai.credits_included`) -> reserve credits under a per-vendor lock -> model call outside the lock -> scan -> settle DONE, or FAILED / REFUNDED (credits return). Idempotent by key. Four enumerated features. Instructions are a fixed template with three safe placeholders; user text only in a `<data>` block. Output is labelled AI-generated, length capped, scanned for banned words, prices and personal data (a hit blocks), never published.
**Live calls.** Off by default (`aiLiveCalls`); adapters are built only in `AiProviderGate`; with live on and nothing usable the request fails with AI_NOT_CONFIGURED.
**Routes (11).** Vendor 2 (`/v3/me/ai`), staff 9 (providers, prompts, grants SUPER_ADMIN only; usage OPERATIONS and SUPER_ADMIN).
**Gap.** Wallet-purchased credits are not counted (legacy wallet, decision D1).

## Differences from the dispatch (every one)
1. `src/site-domains` instead of `src/domains` (name clash with the legacy module).
2. Extra settings: `domainMaxPerVendor`; `confirmedAt` on removal requests; `resultText` on AI usage; a fifth billing table `g4d_invoice_counters`; a fourth AI table `g4d_ai_credit_grants`.
3. `upgradeProration` default stays NONE (seeded in 5.1); the dispatch's "default: credits unused months" is available by setting PRORATE.
4. The claim OTP service and the optional step live in `src/provisioning` (they need the claim link and the runner), not in the directory module.
5. SMS and payment live paths exist as guarded refusals, not integrations.
6. The route-baseline files and role oracle were extended in each slice (route classification before entries, deny by default).
7. Live DNS, SMS, payment and AI paths and every staging suite are NOT RUN here (no `.env.staging`).
