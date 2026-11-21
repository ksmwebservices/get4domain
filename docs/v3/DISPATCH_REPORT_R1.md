# Dispatch report: lane R1 (integration settings and the read-only registrar)

Branch `v3-lane-r1` (from `v3-lane-s3`), worktree `get4domain-w2`. Nothing pushed. No `.env` file or secret read or printed. Staging only. **ResellerClub, Resend and Anthropic were never called**: every test and the staging check use a scripted HTTP port, a fake probe or a fake fetch; nothing in this lane can reach a real provider (the domain-search switch is off by default and the check scripts are for the owner to run).

## R1.1 Integration settings (SUPER_ADMIN only)
Module `v3-integrations`; routes under `/v3/admin/integrations`: `GET` (all providers), `GET :provider`, `PUT :provider`, `DELETE :provider`, `POST :provider/test`. Role matrix: SUPER_ADMIN in every method (ADMIN, OPERATIONS, sales, support, field labels, vendor, partner and anonymous refused; test checks the data and the guard). Route baseline updated (5 admin routes).
- **Storage follows the payment gateway keys exactly** (`GatewayCredentialsService`): one row per field in the platform settings table, AES-GCM with the `PLATFORM_SETTINGS_KEY` master key, in its own category `v3_integrations` (the old settings screen has a fixed category list and cannot list or write it). A set is replaced whole; a value that cannot be decrypted reads as "not set".
- **Providers:** ResellerClub (`resellerId`, `apiKey`, `mode` demo or live), e-mail (`apiKey` must start `re_`, `sender`), WhatsApp and SMS (status `NOT_AVAILABLE`, nothing can be saved), Claude (`apiKey`, `monthlyCapRupees`; a setting only, nothing uses it).
- **Write-only:** a secret field reads `set` / `not set`; the status adds who saved the provider and when. Plain fields (mode, sender, cap, reseller id) may be shown; the reseller id also shows its last 4 characters.
- **Audit:** `integration.set`, `integration.cleared` (only when something was there) and `integration.tested` (with the state) go to the activity log with field names or a state only.
- **TEST route:** one harmless read at the provider with the SAVED set; answers a state (`OK`, `NOT_CONFIGURED`, `NOT_AVAILABLE`, `ACCESS_DENIED`, `REJECTED`, `TIMEOUT`, `UNREACHABLE`, `REGISTRAR_OFF`, `UNKNOWN`) and a plain sentence. Resend: `GET /domains` (a sending-only key answers "restricted", which counts as OK, so nothing is sent). Claude: `GET /v1/models`. ResellerClub: one availability read, and only while `REGISTRAR_LIVE_SEARCH` is on, so a switched-off server makes no call.
- **Tests (22):** no secret in any response, error, audit row or log line (a test runs every operation with log spies and searches everything, including the master key); registered error codes are on the filter list.

## R1.2 Registrar (read only in this lane)
Built on the existing `RegistrarPort` and `ResellerClubAdapter` (slice 5.6d), which were already gated by `REGISTRAR_LIVE_SEARCH` / `REGISTRAR_LIVE_PURCHASE`.
- **Keys:** the adapter reads the SAVED ResellerClub keys and mode first (demo base `https://test.httpapi.com/api`, live base `https://httpapi.com/api`), then falls back to the server environment. The startup guard accepts saved keys when the environment has none.
- **Read calls:** availability (existing), **name suggestions** (new, `GET /domains/v5/suggest-names.json`, only names the registrar marks available), **TLD price list** (existing `reseller-cost-price.json`).
- **Distinct honest states:** not configured (`REGISTRAR_KEYS_MISSING`), access denied (`REGISTRAR_NOT_AUTHORISED`: HTTP 401/403 or the text "Access Denied. You are not allowed to perform this action"), key refused (`REGISTRAR_BAD_KEYS`), timeout (`REGISTRAR_TIMEOUT`), unreachable, registrar off (`REGISTRAR_LIVE_DISABLED`). The adapter never copies the registrar's words into an error.
- **Public route `GET /v3/public/domain-availability`** now answers `REGISTRAR_OFF`, `NOT_CONFIGURED`, `ACCESS_DENIED`, `TIMEOUT`, `UNKNOWN`, `AVAILABLE`, `TAKEN` and still says AVAILABLE only when the registrar said so. The public sentence for not-configured and access-denied is the same calm line and never mentions a whitelist, an address or a key (the detail is for the admin TEST route and the check script). A TAKEN answer carries up to five suggestions, all marked available by the registrar; a failing suggestion never changes the answer.
- **Timeouts, retries, throttle:** 20 s per call; a READ is tried up to three times (timeout, dropped connection, server fault), a write never; the public route is capped at 30 registrar calls a minute across all visitors (beyond it an uncached name answers UNKNOWN), on top of the existing per-visitor throttle and the 60 s answer cache. No key is logged.

## R1.3 `scripts/live/registrar-check.js` (needs `npm run build`; no arguments, no staging mode)
Refuses non-live and staging databases (the live scripts' own guard), reads which settings exist (saved settings, environment keys, the switch), makes ONE availability read for the fixed name `get4domain-registrar-check.com`, prints `PASS` (with the registrar's word for the name) or `NOT_CONFIGURED`, `ACCESS_DENIED` (this machine's IP is probably not whitelisted), `REJECTED`, `TIMEOUT`, `UNREACHABLE`, `UNKNOWN`. Never prints a key or a reseller id; a test checks it contains no write call.

## R1.4 Contract tests (fake responses)
`r1-registrar-contract.spec.ts` (26): each state above from the adapter and from the public route, retries for reads only, saved keys and base by mode, the real HTTP class with fetch replaced (timeout code), the three read calls against recorded shapes, suggestions only when available, the call cap and its reset, and a full-run check that no key reaches a log line or an error. Shapes are the ones the adapter assumes (still marked TO VERIFY in the adapter).

## Choices I made (change any)
1. The registrar switches stay in the server environment (`REGISTRAR_LIVE_SEARCH`, `REGISTRAR_LIVE_PURCHASE`), not in the settings screen: a leaked admin session cannot turn on buying.
2. The Claude cap is whole rupees per calendar month (no token count).
3. `mode demo` is the default reading of any value other than `live`.
4. ACCESS_DENIED and BAD_KEYS are one public state (the public cannot tell them apart usefully); the admin states differ.
5. 30 registrar calls a minute across the public route.
6. Existing tests that assumed one attempt for a read were changed for three (one `registrar-adapter-transfer` test), and a stale `registrar-guard` expectation (the public availability service reads the switch from `process.env`) was corrected.

## Staging check
`node scripts/staging/r1-check.js`: **15 of 15 passed**, nothing left. Real settings table and activity log on staging; scripted registrar HTTP; fake probe. It refuses to start if any integration row already exists, uses a random master key if staging has none, and removes its rows and its 10 audit rows.

## R1.5 Plan for R2 (not built here)
1. **Switch on and prove the registrar in demo.** Owner saves the demo reseller id and key (mode demo), whitelists the server IP at ResellerClub (control panel, API settings), runs `registrar-check.js`, then the TEST route. Verify every `TO VERIFY` path and shape against ResellerClub's documentation with real demo answers; fix the adapter and the fixtures together.
2. **Domain purchase from the wallet after the identity check.** The flow exists (slice 5.6d: identity, price from cost plus approved margin, wallet hold, register, privacy, name servers, ambiguity handling and reconciliation). R2 turns on `REGISTRAR_LIVE_PURCHASE` against the demo base only, runs the whole journey for a fixture vendor, checks the debit, the GST line and the invoice, the refund path on failure, and the ambiguous-write recovery with a real timeout. Live only after the demo journey is clean.
3. **Renewal.** Existing renew and expiry alerts: verify `renew.json` and `endtime` shapes; add an optional auto-renew from the wallet with a reminder and a grace rule; show the redemption period honestly.
4. **Transfer in.** Existing eligibility, auth-code and status polling: verify `validate-transfer.json` and the status words in demo.
5. **DNS A and CNAME records.** ResellerClub's DNS API (activate DNS for the order, add and delete A, CNAME, TXT and MX records, list records). One adapter behind a `DnsPort`, vendor screen limited to the domains the vendor owns with us. Defaults the product writes: apex A to the Get4Domain sites address, `www` CNAME to the vendor's Get4Domain host, nothing else without the vendor's choice. Every change is audited and reversible, and only records of the vendor's own domain can be touched.
6. **E-mail products.** Resell ResellerClub's business e-mail (for example Titan or Google Workspace): list price from the API, margin and approval like domains, purchase from the wallet after the domain exists, then the MX, SPF and verification records through item 5, and the mailbox list for the vendor. Needs its own slice because cost, renewal and per-mailbox changes differ from domains.
7. **A vendor pointing their OWN domain (bought elsewhere) at their Get4Domain site, with HTTPS.** The connection flow and verification exist (domain tables, TXT proof, `DnsGate`, a Cloudflare port with no live binding). R2 decides and builds one path: (a) Cloudflare for SaaS custom hostnames (the vendor adds one CNAME to our fallback host and one TXT proof; Cloudflare issues and renews the certificate; the unavailable port gets a real adapter), or (b) our own edge with on-demand certificates (the vendor points A or CNAME to our server; the first request after DNS verification obtains a certificate; needs a certificate store and rate-limit care). Recommended: (a). Either way the page the vendor sees shows the exact records to add, checks them live, shows "waiting for DNS", "certificate being issued" and "active" honestly, and a failed check says which record is missing. `www` and apex both work; the canonical host and the redirect plan already exist.

## Read-only live steps (you run these; I touched nothing live)
1. Deploy the lane (no migration), `npm run build` in `backend-api`.
2. In the admin app as SUPER_ADMIN save the **ResellerClub demo** reseller id and key with mode `demo`. (No demo credentials exist yet; until they do, skip to step 5 and expect `NOT_CONFIGURED`.)
3. Ask ResellerClub to whitelist the public IP of the machine that will run step 4 (and later the API server).
4. From that machine, with the live environment exported (including the live `PLATFORM_SETTINGS_KEY`): `node scripts/live/registrar-check.js`. Expect `ACCESS_DENIED` until the IP is whitelisted, then `PASS`.
5. Optional: in the admin app press TEST on ResellerClub (it makes the same single read, and only if `REGISTRAR_LIVE_SEARCH=true` is set on the server; leave it off until step 4 passes), and on e-mail (it lists domains at Resend; nothing is sent).
6. Leave `REGISTRAR_LIVE_SEARCH` and `REGISTRAR_LIVE_PURCHASE` OFF until R2 has proved the demo journey.

## Limits
- Every ResellerClub path, parameter and answer shape is still unverified (the adapter says so); only a real demo answer settles them.
- The Resend `GET /domains` and Anthropic `GET /v1/models` probe shapes are from memory of their public APIs and untested against the real services.
- Sender domain verification at Resend and any Claude usage tracking are out of scope.
