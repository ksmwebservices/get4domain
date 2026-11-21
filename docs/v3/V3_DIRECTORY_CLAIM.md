# V3 Directory, claim and team (Amendment 13 Part B)

What Part B added on top of what the code already had. Most of Part B existed before it was asked for (seeded sites, the do-not-contact register, CSV batches, claim links, the claim code, the account-setup grant, directory removal requests, the indexing default), so this slice **filled the gaps** and did not rebuild them. Everything is additive; every new flag defaults OFF.

## 1. What existed, and where (so nobody builds it twice)

| Part B item | Already in the code |
|---|---|
| B1 removal request endpoint and log | `V3DirectoryRemovalRequest`, `DirectoryRemovalService`, the staff queue under `/v3/admin/directory/removal-requests` |
| B2 create on behalf, CSV import (dry run default), duplicate check, activity | `SeededSitesService`: `POST /v3/admin/seeded-sites`, `batches/dry-run`, `batches/apply`; `findDuplicates`; a quality check; the do-not-contact register |
| B3 claim link, per-phone and per-email limits | `ClaimsService` (hashed single-use link), `ClaimOtpService` (code, limits, lock after wrong tries), `AccountSetupGrantService` |
| B4 indexing control | `directoryIndexUnclaimed` (default false) in `evaluateBusinessIndexing`; the sitemap lists only indexable, public businesses; SUPER_ADMIN switches the seeded mode |
| B5 roles | `AdminRole` enum and the central matrix in `auth/guards/admin-role-matrix.ts` |

## 2. Roles (B5, B8)

Report of what exists before this change: SUPER_ADMIN, OPERATIONS, MARKETING (staff, `AdminRole`); the seeded admin row is a Vendor with `role SUPER_ADMIN`.
- **SALES is MARKETING.** Every rule written for SALES is the rule for the `MARKETING` value; no value is renamed or removed.
- **SUPPORT and ADMIN are added** to the enum (migration `20261215100000_v3_staff_roles`, two `ADD VALUE` statements, nothing else).
- **The base matrix is untouched.** ADMIN and SUPPORT are data on top of it: `STAFF_ROLE_EXTENSIONS` in `admin-role-matrix.ts`, read by `effectiveRolesFor` (what `AdminGuard` asks).
  - ADMIN = everything OPERATIONS may do, except the routes in `deny` (plan settings, pack settings, seeded indexing mode, mail rules, domain margins, price proposals, platform content, demo switches), plus pack, tab and category edits. Never a route the base table gives to SUPER_ADMIN only. Cannot edit the tier matrix, the two pack switches or an add-on for a vendor.
  - SUPPORT = tickets (the desk and the older routes, alongside OPERATIONS), CRM leads and calls, `GET /admin-team/me`, and a vendor's tab list. Nothing that holds money, a price, a setting or a domain.
- **SALES** may create listings and draft sites on behalf, import a CSV (dry run first), log calls, record consent, follow up and issue the claim link. The register, removals and the indexing mode stay OPERATIONS and SUPER_ADMIN. MARKETING still sees the non-personal fields only (redaction is by role and unchanged).
- **The commerce guards became whitelists** (`CommercialAdminGuard`, `MoneyAdminGuard`): they used to refuse MARKETING by name, so a new role would have walked in. Now only SUPER_ADMIN, OPERATIONS and the seeded admin row pass. The LeadSpace staff guard also refuses SUPPORT.
- Tests: `staff-roles.spec.ts` checks every AdminGuard route the scanner finds (SUPPORT and SALES never reach billing or settings, ADMIN never reaches a SUPER_ADMIN-only route).

## 3. Listing states (B1)

`listingStateOf` (pure, `seeded-sites/core/seeded.ts`) gives the four words of Amendment 13 V8, shown as `listingState` on every staff view of a seeded site:

| lifecycle | site published now | state |
|---|---|---|
| SEEDED, INVITED | no | `DRAFT_SITE` |
| SEEDED, INVITED | yes | `UNCLAIMED_LISTING` |
| CLAIMED_FREE | no | `CLAIMED` |
| CLAIMED_FREE | yes | `LIVE` |
| PRO | any | `LIVE` |
| REMOVED | any | `REMOVED` (never shown as one of the four) |

**Conflict, not resolved here.** Amendment 10 made seeded pages public by design; Amendment 13 says a draft site is private. The existing seeded pages are therefore reported as `UNCLAIMED_LISTING` while published, and `DRAFT_SITE` is reported only when nothing is published. Making a not-yet-claimed draft invisible to the public is an owner and counsel decision (it changes the public pages), so nothing was switched.

## 4. Claim flow (B3, B7)

1. Staff issue a claim link (consent recorded, not on the register). Shown once, hashed in the database.
2. `POST /v3/claim/:token/otp/request` now takes an optional `{ "channel": "SMS" | "EMAIL" }` (default SMS, as before). `EMAIL` sends to the owner's login email **on the record** (never an address the caller types), on the system lane as kind `OTP`. The lane's own switch `EMAIL_LIVE_SEND` is OFF by default; while it is OFF the code is revoked, so nobody can use a code that was never sent. A business made on its behalf has no real email: the answer is the same uniform one. Enum migration `20261215120000_v3_claim_email_channel` (one `ADD VALUE`). The recipient hash goes in the existing hash column with an `email:` prefix, under the same limits.
3. `POST /v3/claim/:token/otp/verify` (unchanged): marks the business CLAIMED and returns the account-setup grant.
4. **New** `POST /v3/claim/setup` (public, the grant is the credential): `{ setupToken, password, acceptTerms: true, email? }`. Accepts the current Terms and policy versions, sets the password (stamps `passwordChangedAt`), and for a business with no real email takes the login email (refused if used by another account). Everything is checked **before** the grant is spent; a bad, used or expired grant is the same 404. Answer: `{ vendorId, loginEmail, passwordSet, termsAccepted, next: 'LOGIN' }`.
5. **New** `POST /v3/me/claim/approve` (owner, signed in): the business must be CLAIMED and the required documents accepted; the site is built and published through the go-live port. Repeating it changes nothing (`alreadyLive`). A site engine failure is `CLAIM_GO_LIVE_UNAVAILABLE`, retryable.
- Code lives in `src/claim-setup/` (its own module) because `provisioning` and `directory` are tested never to write to Vendor or use the registration path (decision D1); the one write is `ClaimAccountStore`.
- Error codes (registered with the exception filter through `DIRECTORY_ERROR_CODES`): `CLAIM_EMAIL_REQUIRED`, `CLAIM_EMAIL_TAKEN`, `CLAIM_NOT_CLAIMED`, `CLAIM_TERMS_REQUIRED`, `CLAIM_GO_LIVE_UNAVAILABLE`.
- Not built: sending the claim **link** by WhatsApp (later, as Amendment 13 says); a session issued straight after setup (the owner logs in with the email and password).

## 5. Indexing (B4)

Already as asked: an unclaimed listing is not indexable by default (`directoryIndexUnclaimed` false); the sitemap lists indexable public businesses only; the seeded mode is OFF unless SUPER_ADMIN sets it. Pinned by a test (`claim-setup.spec.ts`). No new flag was needed.

## 6. Team access, the paused plan, the domain screen (B9 to B13)

See `V3_PACK_ENGINE.md` section 13.
