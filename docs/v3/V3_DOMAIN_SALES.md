# V3 Domains: own-domain automation, domain sales and transfer-in (Batch 11, Stage 15)

Branch `v3-b11` (worktree `get4domain-b11`), built on `origin/v3-b9` (Stage 14 is skipped in Release 1). Slices: 5.6c own-domain automation, 5.6d domain sales, 5.6e transfer-in. Rules: `V3_DOMAINS_AUTOMATION.md`. Owner inputs applied: Stage 15 file, Amendments 07, 09 (context), 10 Part D, 11, and the owner's overrides and addendum for this run. Run log: `B11_LOG.md`. API: `V3_API_DOCUMENTATION.md`, section Batch 11.

**Nothing in this run made a live call.** No ResellerClub, Cloudflare, email, SMS or payment request was made; no key was read, printed or logged. Every provider runs through a port; the fakes live in `backend-api/test/support` only. The ResellerClub documentation could not be fetched (HTTP 403), so every registrar path and parameter is written from names and is marked TO VERIFY (section 9).

## 1. What was built

| Slice | What | Commit |
|---|---|---|
| B11.0 | Rules document and run log | `9474396` |
| 5.6c | Custom hostname connection (www first, bare domain flagged), certificate watch, connect or forward mode, per-registrar steps, canonical switch through the existing service in both directions, plan lapse after grace (owner answer Q11), per-vendor domain log | `cbc0188` |
| 5.6d | Registrar port with the gated ResellerClub adapter, identity validation, price book, purchase from the wallet (hold, registrar, charge, release), renewal before expiry only, recovery, daily reconciliation, expiry alerts, GST invoice, sales list, register on behalf | `1c950bd` |
| 5.6e | Transfer-in into the owner's registrar account (Pro only) | `d632d10` |

## 2. Data dictionary (all additive; RLS on, no policy)

Migration `20261206100000_v3_domain_connection` (5.6c) and `20261207100000_v3_registrar` (5.6d). 5.6e needs no migration: `g4d_domain_orders.kind` already holds `TRANSFER_IN`.

| Table | Purpose | Key columns and rules |
|---|---|---|
| `g4d_domain_connections` | The automatic connection of one custom domain | `domainId` unique; `status` PENDING, VERIFYING, ACTIVE, NEEDS_ATTENTION, LAPSED; `certStatus`; `mode` CONNECT or FORWARD; `bareDomain` flag; `cfHostnameId`; `failureReason` |
| `g4d_domain_margins` | The price book of domain margins (platform wide) | `tld` (or `privacy`, or `transfer.<tld>`); `kind` PERCENT_BP or FIXED_PAISE; `status` PROPOSED, APPROVED, REJECTED, RETIRED; `effectiveFrom`; unique (`tld`, `effectiveFrom`) |
| `g4d_registrar_customers` | The vendor as a registrar customer and contact | one per vendor, created at the first purchase |
| `g4d_registrants` | Registrant details and the identity check | `status` INCOMPLETE, IN_REVIEW, APPROVED, REJECTED; verification times; the document is AES-256-GCM ciphertext with its IV and tag; a masked Aadhaar copy keeps only its last four digits; `docPurgedAt` |
| `g4d_identity_otps` | One-time codes | only a keyed hash of the code; attempts; consumed time |
| `g4d_identity_access` | Append-only access log | upload, view, approve, reject, purge, with staff id and reason |
| `g4d_registered_domains` | A domain held through us | unique `domain`; `expiresAt`; `status` ACTIVE or EXPIRED; `alertsSent` thresholds |
| `g4d_domain_orders` | One purchase, renewal or transfer | `kind` REGISTER, RENEW, TRANSFER_IN; `status` CREATED, HELD, SUBMITTED, COMPLETED, FAILED, UNKNOWN; exact `amountPaise` (GST included); `holdLedgerId`, `chargeLedgerId`, `releaseLedgerId`; unique (`vendorId`, `idempotencyKey`); unique nullable `openKey` (= the name while a REGISTER or TRANSFER_IN order is live) |
| `g4d_domain_invoices` | The invoice Get4Domain issues for a completed order | one per order; gap-free number `DINV/<financial year>/<n>`; snapshot of the price and the GST lines |
| `g4d_registrar_runs` | One reconciliation run | counts, mismatches, balance |

Foreign keys to the vendor cascade (the repository convention, so the staging cleanup reaches zero). Money history is kept by the application, which never deletes it.

## 3. Rules (as built)

1. **Pro only** (Q2, Q9): register, renew and transfer-in need an ACTIVE Pro plan (not the grace period, not suspended). A Free vendor gets `state: LOCKED_PREVIEW` and nothing is asked of the registrar.
2. **Price**: registrar cost, plus an approved effective-dated margin from the price book (percentage in basis points rounded half up, or a fixed amount per year), plus privacy protection if chosen (its own approved fixed price under `privacy`), then GST from the tax table as its own line (IGST, or CGST plus SGST by state; category `DOMAIN`, falling back to `ALL`). Prices exclude GST (Q1). No price is invented: a missing margin, cost, rate or state refuses the quote.
3. **Wallet** (Q8): the exact total including GST is held and charged, no rounding. A failure releases the hold (a RELEASE entry, not a refund). A purchase needs the wallet open; the shortfall is reported with the top-up that covers it.
4. **Idempotency**: the same key returns the same order; the same key for another domain is a conflict; a second live purchase of one name is refused by the database (`openKey`) and by the service; a domain is never bought or charged twice.
5. **Unsure answers**: only a definite registrar refusal releases the hold. A timeout, a server fault after a write, an unreadable answer, or any error we did not expect, leaves the hold and the order UNKNOWN. Recovery and reconciliation ask the registrar and settle it (charge if it happened, release if not). Found by a test: an unexpected error used to release the hold.
6. **Renewal before expiry only**: at or after the expiry time a renewal is refused (`DOMAIN_EXPIRED`); there is no cheaper path. A renewal uses the registrar's renewal cost.
7. **Reserve**: a purchase is refused when the reseller balance after its cost would fall below the staff minimum; staff are alerted by a domain event; with no minimum set purchases are refused.
8. **Identity before the first purchase**: details, email and phone one-time codes, one government document (PAN, GST certificate, Udyam, business registration, or a masked Aadhaar copy with its last four digits; a full Aadhaar number is refused in every text field), the vendor's confirmation, staff review. Documents are encrypted at rest; opening one needs a reason and is logged first; retention is a setting with no default (nothing is deleted while it is unset).
9. **Plan expiry** (Q11): after grace a custom domain stops serving and redirects (302) to the Get4Domain subdomain, the canonical host returns to the subdomain (even with the promotion add-on), and the domain stays the vendor's. A live connection becomes LAPSED and returns to checking its certificate when Pro returns.
10. **Transfer-in** (5.6e): price is the registrar's transfer cost plus an approved margin under `transfer.<tld>`; the registrar must say the name is eligible (unlocked, not recently registered or moved); the hold stays while the registrar works (days) and is charged when the transfer completes, or released when it fails or is cancelled; the authorisation code is passed once and never stored, logged or audited.
11. **Live safety**: both flags default OFF and are separate (section 8). A startup guard refuses live mode without the keys. The adapter is the only code that touches the network, and the only code that names the key variables.

## 4. Settings (staff, SUPER_ADMIN, `g4d_plan_settings`; every value starts unset)

5.6c: `customHostnameTarget`, `connectionWatcherEnabled`, `connectionMaxChecks`, `connectionCheckMinIntervalSeconds`.
5.6d: `registrarNameServers`, `registrarMinBalancePaise`, `identityOtpTtlSeconds`, `identityOtpMaxAttempts`, `identityOtpMinIntervalSeconds`, `identityDocMaxBytes`, `identityDocRetentionDays`, `domainExpiryAlertDays`, `registrarReconcileEnabled`, `registrarRecoverAfterMinutes`.
Existing settings used: `walletSellerStateCode`, wallet top-up limits, tax rate rows.

## 5. Events (activity log; the DOMAIN_CHANGED alert rule picks up every `domain.` key)

`domain.connection_started`, `connection_active`, `connection_forwarding`, `connection_lost`, `connection_mode_changed`, `connection_retried`, `connection_ended`, `redirect_on_lapse`, `connection_restored`, `identity_details_saved`, `identity_code_sent`, `identity_contact_verified`, `identity_document_uploaded`, `identity_submitted`, `identity_approved`, `identity_rejected`, `registered`, `renewed`, `transfer_completed`, `purchase_failed`, `registrar_balance_low`, `expiry_alert`, `expired`, `reconcile_mismatch`. The per-vendor domain log (Q12) is the vendor's `domain.` activity, newest first, with time and actor.

## 6. API contract

See `V3_API_DOCUMENTATION.md`, section Batch 11: 42 routes (vendor 25, staff 17). Roles: staff routes are OPERATIONS and SUPER_ADMIN; approving or rejecting a price is SUPER_ADMIN only; MARKETING is denied on all of them. Vendor routes are OWNER ONLY and name no vendor id.

## 7. Decision log

- **D-1 Roles.** Amendment 11 names SUPPORT; that role does not exist (as in Batch 9). OPERATIONS and SUPER_ADMIN, MARKETING denied.
- **D-2 No fake in the product.** The registrar binding is the gated ResellerClub adapter; with both flags OFF every call is refused before the adapter is reached. The Cloudflare binding is an "unavailable" port that says automatic connection is not switched on. The identity OTP sender is "not connected" until the message providers are wired, so **identity codes cannot be sent in production yet**.
- **D-3 Q11 replaces an older rule.** The earlier tests asserted that a custom domain keeps serving after a downgrade. Two assertions (`domain-host.spec.ts`, `domain-api.spec.ts`) were changed to the owner's new rule (302 to the subdomain); nothing else was weakened.
- **D-4 One live purchase per name** uses a nullable unique `openKey` (the repository's own pattern), not a partial index, because the drift gate allows only two known differences.
- **D-5 Order states.** A transfer in progress is SUBMITTED with its registrar order id; `REGISTRAR_IN_PROGRESS` lets an unsure initiation become in progress.
- **D-6 Margins** round half up in whole paise; a fixed margin is per year. Privacy protection is a fixed approved price. A transfer covers one year.
- **D-7 Invoice** series `DOMAIN_INVOICE` with the prefix `DINV` is a code constant pending the accountant's wording; numbering is gap-free through the wallet's counter and issued in the same unit as the charge.
- **D-8 Dependency injection.** Classes with plain constructor arguments (`FetchHttp`, `AesGcmDocCrypto`) are built by factories; a test over the provider lists found the first version would not have started.
- **D-9 Red first, honestly.** 5.6c core, 5.6d core, identity and transfer specs ran red first (module missing). The 5.6d service spec and the Q11 additions were written after the code they test because their world needed the module surface first; they then ran against the code and found one real defect (D-5 in section 3 rule 5) and two test mistakes of mine.
- **D-10 No cancel path for a transfer** is built (no registrar cancel call is known): a stuck transfer is settled by staff with recovery. An open question.

## 8. Live flags and the first live test (owner checklist, no values)

Set on the server whose IP is whitelisted at ResellerClub (a maximum of three addresses, no ranges, and the change takes time to apply):

1. Environment variables: `RESELLERCLUB_AUTH_USERID`, `RESELLERCLUB_API_KEY`, `RESELLERCLUB_API_BASE` (point it at the TEST base first; the default is the test base), `IDENTITY_DOC_KEY` (32 bytes: 64 hex or 44 base64 characters; identity documents cannot be stored without it), `OTP_HASH_PEPPER` (or the existing `JWT_SECRET`).
2. Flags, both default OFF and separate: `REGISTRAR_LIVE_SEARCH` (reads: search, price list, order lookups, balance, transfer eligibility and status) and `REGISTRAR_LIVE_PURCHASE` (writes: customer, contact, register, renew, privacy, name servers, transfer). The server refuses to start with a flag on and a key missing, naming the missing variable only.
3. Admin settings (section 4) and the price book: approve a margin for each extension, for `privacy`, and for each `transfer.<tld>`; tax rows (IGST, CGST, SGST) and `walletSellerStateCode`.
4. Order: (a) test base and demo credentials, search flag only; check every TO VERIFY path (section 9) against the live documentation and fix the adapter and fixtures; (b) purchase flag with the demo account: register, renew, privacy, name servers, a transfer; (c) switch to the production base and real keys; one small real purchase; run a reconciliation and read the run; (d) only then open it to vendors.
5. Not connected yet: delivery of identity codes (email and SMS), the real Cloudflare adapter, object storage for documents (documents are encrypted in the database for now).

## 9. TO VERIFY (every one is in the adapter's comments and covered by fixtures that were NOT recorded from ResellerClub)

Search `GET /domains/available.json`; price list `GET /products/reseller-cost-price.json` (answer shape, product keys per extension, the transfer price key); customer `POST /customers/v2/signup.json`; contact `POST /contacts/add.json`; register `POST /domains/register.json` (`invoice-option`, `purchase-privacy`, `protect-privacy`, `ns`); renew `POST /domains/renew.json` (`exp-date` unit); privacy `POST /domains/modify-privacy-protection.json`; name servers `POST /domains/modify-ns.json`; lookup `GET /domains/orderid.json` and `GET /domains/details.json` (status words, `endtime` unit); balance `GET /billing/reseller-balance.json`; eligibility `GET /domains/validate-transfer.json`; transfer `POST /domains/transfer.json`; transfer progress through `details.json`. Also the selling currency of the price list (paise are assumed), the wording that classifies a refusal, and the lock and recent-registration rules, which the registrar enforces.

## 10. Differences from the Stage 15 file

- The real ResellerClub adapter is written (owner override 2), behind two flags; the stage file said fakes only.
- No fake search in the product (Amendment 10 Part D); a Free vendor sees a locked preview.
- Slice 5.6c is fake-only and its product binding is "unavailable"; no real Cloudflare adapter exists.
- Added: identity validation, reconciliation, expiry alerts, transfer-in (5.6e), the domain log route, plan-expiry behaviour (Q11).
- Not built: visit analytics per host (Q12 says not in this run), the vendor screens (Bolt), real message delivery, the legal texts (counsel).

## 11. OPEN QUESTIONS for the owner

ResellerClub account funding and the minimum reserve; the margins per extension and for privacy and transfers; the renewal reminder wording; the retention of identity documents (counsel); consent and transfer-out wording (counsel); the invoice wording, the SAC code and the DOMAIN tax category (accountant); whether a stuck transfer needs a cancel call; the unit of the plan prices (still open from Amendment 10); how identity codes are delivered.

## 12. Merge risks

`site-domains` changed in `core/canonical.ts` and `host-directory.ts` (Q11; two older assertions changed); `plans/admin/extra-settings.ts`, `app.module.ts`, `admin-role-matrix.ts` and the shared test app gained additive lines that other branches also touch; `schema.prisma` gained two blocks at the end and one block of relation lines in `Vendor`. No frontend, themes repo, Stage 9 or Stage 13 code changed except additive wiring.
