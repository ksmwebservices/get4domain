# V3 slice 5.3: provisioning engine, claim links, invites (design note)

Status: written first (S53.1), updated at the end of the slice (section 11). Spec: `docs/v3/SLICE_5_3_PROVISIONING_ENGINE_SPEC.md`. Branch `v3-s53` on top of the pushed slice 5.1 (`origin/v3-s51`). Only `backend-api/` and `docs/v3/` change. Legacy billing, BOS, commercial and menu-gating tables are out of scope (decision D1); nothing here reads or writes them.

## 1. What it does

Staff create a business. One JOB runs five STEPS, in order, each safe to run twice:

```
CREATE_VENDOR -> ASSIGN_FREE_PLAN -> CREATE_FREE_SITE_DRAFT -> CREATE_CLAIM_LINK -> SEND_INVITE
```

Jobs live in the database. A runner claims a due job with `FOR UPDATE SKIP LOCKED` and a lease, runs the next unfinished step, records the result and goes on or schedules a retry. A crash leaves a lease that expires; the next runner continues the same job. Nothing is rolled back automatically.

## 2. Data dictionary (all additive; RLS on; `@@map` names as specified)

Enums (Prisma names carry `V3`): `V3JobKind{BUSINESS_FREE_SITE}`, `V3JobStatus{QUEUED,RUNNING,WAITING,SUCCEEDED,FAILED,CANCELLED}`, `V3StepKey{CREATE_VENDOR,ASSIGN_FREE_PLAN,CREATE_FREE_SITE_DRAFT,CREATE_CLAIM_LINK,SEND_INVITE}`, `V3StepStatus{PENDING,RUNNING,DONE,FAILED,SKIPPED}`, `V3ClaimPurpose{CLAIM}`, `V3ClaimStatus{ACTIVE,USED,REVOKED,EXPIRED}`, `V3InviteChannel{EMAIL}`, `V3InviteMode{SANDBOX,LIVE}`, `V3InviteStatus{QUEUED,SENT,FAILED,BOUNCED}`. The existing `V3ActorType{STAFF,VENDOR,SYSTEM}` is reused for `createdByType` (the spec allows STAFF and SYSTEM only; the service refuses VENDOR).

| Table | Columns (besides id, createdAt, updatedAt) | Notes |
|---|---|---|
| `g4d_provisioning_jobs` (`V3ProvisioningJob`) | kind, status, `idempotencyKey` UNIQUE, `vendorId` NULL (FK Vendor, SET NULL), input JSON, currentStep NULL, attempt, maxAttempts, nextRunAt, lockedBy, lockedUntil, lastErrorCode, lastErrorMessage, createdByType, createdById, finishedAt | platform table, staff only. Carries `vendorId` once the vendor step succeeds, so the tenant model list contains it (see 3). |
| `g4d_provisioning_steps` (`V3ProvisioningStep`) | jobId (FK Cascade), stepKey, status, attempts, startedAt, finishedAt, outputRef JSON (ids only), errorCode | UNIQUE (jobId, stepKey). |
| `g4d_claim_tokens` (`V3ClaimToken`) | vendorId (FK Cascade), `tokenHash` UNIQUE (SHA-256 hex), purpose, status, expiresAt, usedAt, createdByType, createdById, `activeKey` NULL UNIQUE | `activeKey` = `<vendorId>:CLAIM` while ACTIVE, NULL otherwise: the database allows at most one ACTIVE token per vendor and purpose (same device as `currentVendorId` in slice 5.1, no hand-written partial index to drift). |
| `g4d_invites` (`V3Invite`) | vendorId (FK Cascade), channel, toAddress, claimTokenId (FK Cascade), adapterMode, status, providerMessageId NULL, subject, bodyPreview, `sandboxBody` NULL, sentAt | `bodyPreview` has the token masked. `sandboxBody` holds the full message ONLY in sandbox mode (spec requirement, see decision D-5). |

Foreign keys go only to `Vendor` and to each other. No column or key references a legacy table.

## 3. Tenant scope (Part A)

`VENDOR_SCOPED_MODELS` is computed from the Prisma data model: every model with a scalar `vendorId` is in it. So `V3ClaimToken`, `V3Invite` and `V3ProvisioningJob` are registered the moment they exist. Part A adds the safety net the spec asks for (`test/tenant-model-registry.spec.ts`): it fails if (a) any model with a `vendorId` is not in `VENDOR_SCOPED_MODELS`, or (b) a model with a `vendorId` is in neither the explicit TENANT list nor the explicit PLATFORM_ONLY list (jobs). A new table therefore cannot arrive unclassified. The cross-tenant test for the new tables is in S53.8.

## 4. State machine (text)

```
job:   QUEUED --claim--> RUNNING --all steps DONE--> SUCCEEDED
                           |  \--step fails, retryable, attempt < max--> WAITING (nextRunAt = now + backoff) --due--> RUNNING
                           |  \--step fails, permanent OR attempts exhausted--> FAILED
                           \--lease expires (crash)--> picked up again as RUNNING
       QUEUED|WAITING|FAILED --cancel--> CANCELLED (PENDING steps -> SKIPPED; DONE steps stay)
       FAILED --retry (staff)--> QUEUED (attempt reset to 0, FAILED step -> PENDING)
step:  PENDING -> RUNNING -> DONE | FAILED ;  PENDING -> SKIPPED (cancel)
```

`decide(job, steps, now, ctx)` (pure) returns one of: `RUN_STEP(step)`, `COMPLETE`, `WAIT` (not due yet), `STOP` (terminal). It chooses the first step that is not DONE or SKIPPED. Special rule: the raw claim token only exists in memory during one run. If `SEND_INVITE` is next and `ctx.hasRawToken` is false, the decision is to run `CREATE_CLAIM_LINK` again (it revokes the old token and issues a new one), then `SEND_INVITE`. `nextBackoff(attempt, schedule, random)` gives the delay: the schedule entry for the attempt (the last entry repeats), with plus or minus 20 percent jitter.

Failure classification: a step throws `StepError(code, retryable)`. Retryable = transient (database busy, adapter timeout, lease lost). Permanent = `DUPLICATE_BUSINESS`, validation, unknown track, adapter refused (`LIVE_DISABLED`). Any other error is retryable (until attempts run out) and recorded as `UNEXPECTED` with a fixed sanitised sentence; raw error text is never stored (spec: no raw provider text).

## 5. Step contracts

Each step is a class behind `ProvisioningStep { key; run(ctx): Promise<StepResult> }`. `ctx` = `{ job, input, vendorId, rawToken?, actor, settings, now }`. `StepResult` = `{ outputRef, vendorId?, rawToken? }` (ids only).

| Step | Does | Idempotent because | Errors |
|---|---|---|---|
| CREATE_VENDOR | duplicate check by normalised email and phone, then one transaction: create `Vendor` (status PENDING, source `STAFF`, `registeredByStaffId`, unusable random password hash, unique subdomain from the business name) and set `job.vendorId` | if `job.vendorId` is set the step returns it; email is unique, so a lost race becomes `DUPLICATE_BUSINESS` | `DUPLICATE_BUSINESS` permanent (names the existing vendor id in the step's outputRef, staff only) |
| ASSIGN_FREE_PLAN | `provisionFreeSubscription(vendorId, track, 'STAFF')` | that function returns the existing subscription | `UNKNOWN_PLAN` permanent |
| CREATE_FREE_SITE_DRAFT | `SiteProvisioner.createDraftSite({vendorId, track, category, businessName, language, city?, phone?}) -> {siteId}` | the adapter returns the existing site row for the vendor | transient errors retryable |
| CREATE_CLAIM_LINK | `ClaimsService.issue(vendorId)`: token = `randomBytes(32)` base64url; only SHA-256 stored; expiry from `claimLinkExpiryDays`; the previous ACTIVE token is revoked in the same transaction | in a run it only issues when `ctx.rawToken` is absent | none expected |
| SEND_INVITE | render template, send through the `EmailAdapter` in the configured mode, record an invite row | one invite row per claim token (find-or-create), a SENT invite is never sent again | adapter timeout retryable, `LIVE_DISABLED` / bad address permanent |

Every step writes a `g4d_audit_logs` row (actor SYSTEM, or the staff member who created the job) with ids only. The free plan assignment also writes its `g4d_subscription_events` row (slice 5.1 code).

## 6. Token and secret rules

1. The raw token is `crypto.randomBytes(32)` as base64url (43 characters). Only `sha256(raw)` is stored.
2. The raw token lives in a local variable of one run and in the rendered message. It is never written to the job input, steps, `outputRef`, audit rows, error messages or logs, and it is passed between the two steps in memory only.
3. If the process dies between CREATE_CLAIM_LINK and SEND_INVITE, the retry sees no in-memory token and issues a new one (rule in section 4). The older token is revoked by the new issue.
4. Sandbox mode stores the whole rendered message in `g4d_invites.sandboxBody` (the spec wants staff and tests to read it). That is the one place a raw token can exist in the database; it exists only in sandbox mode (staging), is never stored in live mode, is cleared when the token is used or revoked, and is shown to staff only when the invite is a sandbox one and `NODE_ENV` is not production. Tests prove the raw token is absent from every other table, every log line and every audit row.
5. Comparison: the token is hashed, the row found by its unique hash, and the stored and computed hashes compared with `timingSafeEqual`.
6. Unknown, used, revoked and expired tokens all answer the same 404 with the same body (no oracle). The route is rate limited per IP.

## 7. Settings (decision D-1: the slice 5.1 `g4d_plan_settings` table)

Plan settings is the right place: it already has an admin API, optimistic concurrency and an audit trail, and the owner edits it. `validateSettingValue` is extended (additively) with these keys; a missing row means the default.

| Key | Default | Meaning |
|---|---|---|
| `provisioningRunnerEnabled` | false | the cron tick runs jobs only when true |
| `provisioningMaxAttempts` | 5 | attempts per job before FAILED |
| `provisioningBackoffSeconds` | [30,120,600,1800] | delay before attempt n+1 (last value repeats) |
| `claimLinkExpiryDays` | 14 | token lifetime |
| `inviteAdapterMode` | "sandbox" | "sandbox" or "live" (live also needs the env flag `V3_INVITE_LIVE_ENABLED=true`, which is not set anywhere) |
| `publicAppUrl` | "https://staging.get4domain.invalid" | claim URL = `<publicAppUrl>/claim/<token>`; placeholder until the owner sets the real one |
| `inviteSubjectTemplate` | English placeholder | variables `{{businessName}}` |
| `inviteBodyTemplate` | English placeholder, includes a line that the link expires | variables `{{businessName}}`, `{{claimUrl}}`, `{{expiryDays}}` |

The wording is a placeholder marked proposed. No Tamil text is written: it needs a Tamil speaker.

## 8. API contract

All staff routes are under `AdminGuard` and the role matrix: reads and writes for OPERATIONS and SUPER_ADMIN; MARKETING is refused on every one (decision D-3). Responses use the standard envelope. Lists: `?page=1&pageSize=25` (max 100).

| Route | Who | Notes |
|---|---|---|
| POST /v3/admin/provisioning/jobs | staff | header `Idempotency-Key` required (8 to 100 chars); body below; returns the job (200 with the existing job when the key repeats, 201 for a new one) |
| GET /v3/admin/provisioning/jobs | staff | filters `status`, `from`, `to` |
| GET /v3/admin/provisioning/jobs/:id | staff | job + steps + sanitised error; never tokens |
| POST /v3/admin/provisioning/jobs/:id/retry | staff | FAILED only, else 409 `JOB_NOT_RETRYABLE` |
| POST /v3/admin/provisioning/jobs/:id/cancel | staff | 409 `JOB_NOT_RETRYABLE` if already SUCCEEDED or CANCELLED |
| POST /v3/admin/provisioning/jobs/:id/run | staff | runs this job now, synchronously (staging and tests); not available in production unless the runner setting is on |
| POST /v3/admin/vendors/:id/claim-link/reissue | staff | revokes the old token, issues a new one, sends a new invite |
| POST /v3/admin/vendors/:id/claim-link/revoke | staff | |
| GET /v3/admin/invites | staff | addresses masked; `sandboxBody` only for sandbox invites outside production |
| GET /v3/claim/:token/status | public, rate limited | `{valid:true, businessName, expiresAt}` or the uniform 404 |

Create body: `{ businessName, track: "handyman|professional|ecommerce", category, ownerName, phone, email, city, language }`. Example response:

```json
{ "success": true, "statusCode": 201, "data": { "id": "cl...", "kind": "BUSINESS_FREE_SITE", "status": "QUEUED", "vendorId": null, "currentStep": null, "attempt": 0, "maxAttempts": 5, "nextRunAt": "2026-11-04T09:00:00.000Z" } }
```

Job detail adds `steps: [{ stepKey, status, attempts, errorCode, outputRef }]`, `lastErrorCode`, `lastErrorMessage`. Error codes (added to the passthrough list): `DUPLICATE_BUSINESS` (409), `JOB_NOT_FOUND` (404), `JOB_NOT_RETRYABLE` (409), `CLAIM_INVALID` (404 public, 409 staff).

## 9. Internal API for later slices

`ClaimsService.redeemClaim(token, ctx?) -> { vendorId }`: marks the token USED exactly once, with `updateMany({ id, status: ACTIVE, expiresAt > now })` and a count check; a second call, a race loser, or an expired token throws `CLAIM_INVALID`. It creates no account and sets no password (slice 5.7).

## 10. Decision log

- D-1 Settings live in `g4d_plan_settings` (section 7).
- D-2 The vendor row is created by a V3 service, not by `VendorsService.create`. The existing method sends a real welcome email containing a plaintext password and grants wallet credit, which stop-line 2 forbids and which has no meaning for an unclaimed business. The new row mirrors what `StarterService.createSite` (the existing staff path) already does: status PENDING, an unusable random password hash. Real owner email is stored as the vendor email so that duplicates are detected by the existing unique column.
- D-3 Staff writes for provisioning are OPERATIONS and SUPER_ADMIN (spec). MARKETING is denied on reads too: the matrix gives MARKETING no V3 read, and a job holds a phone number and an email.
- D-4 No `site_doc_v2` add-on row is created (that table is legacy, D1). The draft site is a `VendorCMS` row in DRAFT state seeded through the existing `StarterService.seed(..., 'draft')`; whether the renderer needs the flag is a slice 5.4 question.
- D-5 Sandbox invites keep the full message including the raw token in `sandboxBody`, because the spec asks for it. Mitigation in section 6 rule 4. Open question for the owner.
- D-6 Duplicate detection blocks (permanent `DUPLICATE_BUSINESS`). The spec asks the owner whether it should warn instead; block is the safe default.
- D-7 `phone` is stored normalised (digits, with country code 91 for a 10-digit Indian number); duplicates compare the last 10 digits.
- D-8 Compensation (rollback of a half-built business) is a manual staff action and is not built.
- D-9 Retry of a FAILED job resets `attempt` to 0 and keeps DONE steps.

## 11. Differences from the spec

(Filled in as the slice is built; see end of file.)
