# Duplicate vendor-site check: findings (read-only, no code changed)

Branch `v3-dup-check`. Source read only; nothing run, no DB, no .env. Items I did not open are marked "not verified".

## 1. What exists today, per path

**P1 Self-registration.** `POST /auth/register` -> `AuthService.register` (auth/auth.service.ts) -> `VendorsService.create` (vendors/vendors.service.ts). V3 trial signup is the same route; it only swaps the subdomain step to `TrialSignupPolicy.resolveSubdomain` (v3-trial/trial-signup.policy.ts).
- Email: `Vendor.email @unique`, plus a `findUnique` pre-check. A same email + business + correct password is a replay (signs in, creates nothing).
- Subdomain: `validateSubdomainSlug` (site-domains/core/hostname.ts) with look-alike folding (`confusableKeys`), `MANDATORY_RESERVED_SUBDOMAINS` + editable `reservedSubdomains` + `blockedSubdomainWords`. Taken = `Vendor.subdomain` OR any `V3Domain.hostname` row. If the trial policy is not injected, the fallback `uniqueSubdomain` checks the vendor column only.
- Nothing else: phone stored raw, no GSTIN, no name/location/category match, no owner, address or pincode.

**P2 Admin / team on behalf.** Four sub-routes:
- `POST /vendors` (`VendorsService.create`): email only.
- Provisioning job `POST v3/admin/provisioning/jobs`, step `CREATE_VENDOR` (provisioning/steps/create-vendor.step.ts, `PrismaBusinessVendors.findDuplicate`): email + phone (last 10 digits; narrows by `contains` last 6 digits, `take: 50`). Refuses `DUPLICATE_BUSINESS`, permanent, no override. Subdomain taken-check on the vendor column only; reserved/blocked check not verified here.
- Seeded sites (`SeededSitesService.create`, seeded-sites/): the strongest check in the code. Phone hash, email hash, and `nameKey` = normalised `name|city`. Duplicate -> 409 `SEEDED_DUPLICATE`, never overridable. A SUPER_ADMIN override with a reason (audited `seeded.override_create`) exists, but only for the do-not-contact register, not duplicates.
- Deal prospect (`DealsService.resolveVendor`, commercial/deals.service.ts): attaches to an existing vendor by email or by demo subdomain; own local `RESERVED_SUBDOMAINS` set; no phone check.
- Go-live (`ClaimSetupService.approve` -> `RealSiteGoLive.buildAndPublish`): publishes only, no duplicate check. Also not examined: `demo.service.ts:313`, `site-doc/starter.service.ts:189` (both call `vendor.create`).

**P3 Referral.** A partner cannot create a vendor. `PartnersService.create` makes a partner (email unique, `PARTNER_EMAIL_TAKEN`). A referral-link signup is `/auth/register` with `referralCode`, so it inherits P1 exactly; `ReferralsService.attributeAtRegistration` only attributes, with `isSelfReferral` guard (details not verified). Staff on-behalf attribution (`setAttribution`) is audited with a reason.

**P4 Directory claim.** `ClaimStartService.start` needs status `UNCLAIMED` and a `vendorId`; the OTP goes to the phone/email on the record; a different phone needs `DirectoryAdminService.claimPhoneOverride` (reason required, stored in `V3DirectoryClaimOverride`, only while unclaimed). Gap: `CreateDirectoryProfileStep` only asks "does THIS vendor have a listing" (`getBusinessByVendor`); it never searches for an existing listing of the same business, so a second record is created. `V3DirectoryBusiness` has no unique on phone or name (only `vendorId` and `slug`; slug clash just gets a suffix). `pg_trgm` is used only for directory search (`similarity(name) > 0.3`, GIN index `g4d_directory_businesses_name_trgm_idx`, created in a guarded block so it may be absent), never for duplicates. I did not verify how the DRAFT_SITE and LIVE names map; the code uses listing status UNCLAIMED/CLAIMED and a seeded lifecycle.

## 2. Check by path (Yes / No / Partial)

| Check | P1 Self | P2 Admin | P3 Referral | P4 Claim |
|---|---|---|---|---|
| E-mail unique | Yes | Yes (seeded: hash) | Yes (via P1) | Partial (record email, no dup) |
| Phone normalised | No | Partial (provision, seeded) | No | Partial (E.164 for OTP only) |
| GSTIN | No | No | No | No |
| Existing site / custom domain mapped | Partial (V3Domain host only) | No | No | No |
| Name + location + category similarity | No | Partial (seeded exact key only) | No | No |
| Owner name | No | No | No | No |
| Address / pincode | No | No | No | No |
| Subdomain unique | Yes | Partial (vendor col) | Yes (via P1) | n/a |
| Reserved words / brands | Yes | Partial (deal yes, provision unverified) | Yes (via P1) | n/a |
| Similar-subdomain warning | No | No | No | No |
| Unclaimed listing found + attached | No | No | No | n/a (claim is by slug) |
| 2nd branch under one vendor | No (no model) | No | No | No |
| Admin override with logged reason | No | Partial (seeded DNC only) | Partial (attribution only) | Yes (claim phone) |

## 3. Smallest additive changes: ONE shared check

1. New `DuplicateCheckService` (new module, e.g. `v3-duplicates/`): `check({email, phone, gstin, businessName, city, categoryId, pincode, ownerName, subdomain, customDomain})` returns matches `{kind, vendorId?, directoryBusinessId?, strength}`. Reuse, do not rewrite: `normalisePhoneE164` + `hashPhone` (directory/core), `nameKey` (seeded-sites/core), `validateSubdomainSlug` and `TrialSignupPolicy.taken`.
2. Additive migration: `Vendor.phoneKey` (last 10 digits, indexed) to replace the `contains` scan; a GIN trigram index on `Vendor.businessName` (guarded like the directory one, falls back to exact key); GSTIN lookup against the existing firm-profile table (v3-firm), since I found no GSTIN column on `Vendor`.
3. New table `V3DuplicateOverride` (vendorId, matched kinds/ids, reason, staffId, createdAt) plus an audit row; override allowed for staff roles only, reason mandatory.
4. Call it from: `POST /auth/register` (block on email/phone/GSTIN, warn on similar name or subdomain), `POST /vendors`, `POST v3/admin/provisioning/jobs` (replace `findDuplicate`), `SeededSitesService.create`, `DealsService.resolveVendor`.
5. In `CreateDirectoryProfileStep`, look up an UNCLAIMED listing by phone hash or name key + city first and attach (set `vendorId`) instead of creating.
6. Public subdomain `check()` adds a `similarTo` field (confusable-key match to an existing host); advisory only.
7. Branches: no model exists. Needs an owner decision (nullable `Vendor.parentVendorId` or a branch table) before any code.

## 4. Footer: "Powered by Get4Domain"

- Rendered as hard-coded text in: `get4domain_mvp/src/engine/kit/KitRenderer.tsx:49` (theme kit), `engine/kit/design-sections.tsx:313,326`, `engine/shell/ShellFooter.tsx:43,56`, `engine/industries/retail/RetailSite.tsx:146`, `engine/industries/real-estate/sections/blocks.tsx:221`, and the legacy `app/site/[subdomain]/[[...rest]]/page.tsx:344`. The backend (`backend-api/src`), `themes/` and `registry/` contain no such string.
- Fixed: I found no plan flag, vendor setting or theme option (searched hidePowered, whiteLabel, removeBranding, showBranding). It cannot be removed per plan or by the vendor today.
- Link: the theme-kit, shell and industry footers are plain text with no link. Only the legacy site page links, to `href="/"`, which on a vendor host resolves to the vendor's own site, not get4domain.com. No footer links to get4domain.com.
