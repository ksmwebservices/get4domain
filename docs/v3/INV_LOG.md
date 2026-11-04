# STAGE 02 inventory run: log

Branch `v3-inv` (worktree `C:\Get4Domain\get4domain-inv`), based on `v3-b2` 3f9b169. Docs only. No code, migrations, seeds, production access, `.env` reading or network calls. The Batch 2 gate in the other worktree was not touched.

## INV-1 module map
Scanned `backend-api/src` (92 module folders, 736 non-spec files, 53,942 lines, 904 route decorators) with a read-only script that counts files, lines, controllers, routes and the Prisma delegates each module calls; descriptions and gating were checked against the controllers. Frontend: 432 files, 57,986 lines, 109 pages. Output: section INV-1 of `docs/v3/V2_INVENTORY.md`. Gates (lint, build, tests) are not applicable: no code changed.

## INV-2 TeleCRM and CRM
Read `crm`, `admin-crm`, `domainapp/contacts`, the engine action registry, `TeleCrmBoard.tsx` and the dashboard pages. Findings that matter for V3: TeleCRM works on `g4d_campaign_leads`, not on `g4d_contacts`; there is no telephony beyond a `tel:` link; `Contact` has no unique phone, no consent and no unsubscribe fields; import does not de-duplicate; no scripts, segments, team performance or reminders exist. Output: section INV-2 of `docs/v3/V2_INVENTORY.md`.

## INV-3 Accounts, billing and wallet
Compared the five invoice engines (platform, Commercial Engine, Domain App, BOS, V3), their numbering and tax rules, the BOS posting and GST code, the legacy wallet debit hardening and every Razorpay entry point. Finding that matters: `domainapp/invoices.service.ts` creates payment links with the platform Razorpay key, which breaks rule 4 (the same defect as the earlier S9). The legacy wallet has no lots, expiry or refund rule, so the V3 wallet is new. Output: section INV-3 of `docs/v3/V2_INVENTORY.md`.

## INV-4 Messaging
Read the email, SMS, Fast2SMS WhatsApp, Cloud API gateway, webhook, communication, vendor-comms, campaigns, bot and social code and the schedulers. Findings: two unrelated stacks; no consent, unsubscribe, block list or Do-not-contact for vendor messaging; campaigns charge the wallet on approval and send nothing; prices are hard-coded in code; no queue and no Instagram or Facebook assistant. Output: section INV-4 of `docs/v3/V2_INVENTORY.md`.

## INV-5 Sites and others
Traced the five render paths in the site page, the site document, packs, themes (bytes in the database), the 21 industry modules and their tables, team and staff roles, AI, ResellerClub and domains, the admin and marketing pages. Findings: `ModuleGuard` allows team members on every route without `@RequireModule` (all industry modules); ResellerClub prices are hard-coded; the 41-category list does not exist in the backend; the legacy site renderer, the iframe theme path and the database theme storage are the V3 replacement targets. Output: section INV-5 of `docs/v3/V2_INVENTORY.md`.

## INV-6 Replacement map
Checked the 22 rows of section 2 and five other statements against the code. Result: 12 CONFIRMED, 3 WRONG (rows 7, 8 and 10 are wrong or understated), plus row 1, 2, 4, 22 partly or wholly wrong, 2 UNKNOWN (row 11, price figures), and several rows stale because Batch 1 and 2 built the V3 piece (plans, provisioning, directory, domains). Row details in section INV-6 of `docs/v3/V2_INVENTORY.md`.

## INV-7 Verdicts
One row per backend module (92): KEEP 25, ADAPT 28, RETIRE 39 (all 21 industry modules RETIRE). Answered the two questions: the contact table can back `g4d_customers` through a link, not a copy, provided duplicates are counted first and the old screens are frozen per vendor; the TeleCRM gate table lists consent and entitlement per feature. While writing, six INV-1 module descriptions that had been written from the module name were corrected after reading the controllers (business-documents, design, customer, widget, growth-hub, managed-services).
Correction to the INV-6 entry above: the tally there was wrong. The INV-6 table has 14 rows CONFIRMED, 7 rows wrong in whole or part (1, 2, 4 wording, 7, 8, 10, 22), 1 row UNKNOWN (11), and of the five other statements 2 UNKNOWN, 1 WRONG, 1 partly exists, 1 confirmed.

## INV-8 Five clients
Named the candidates from the repo (Step N Rock, Deebi Photography, Allwin Tours, Indian Ambulance, MR Travels; KSM Quantum is the parent company, not a client), listed what each needs to move, and wrote `docs/v3/OWNER_READONLY_QUERIES.sql` (SELECT only, 351 lines, never run; table and column names taken from `schema.prisma` at 3f9b169; no password, token, key or hash column selected; no email, phone or address selected). Findings: the repo cannot say which clients are Pro or live; MR Travels was never launched per the Aug 2026 status; Step N Rock's agreed terms (Workspace, half-yearly, 599,400 paise, no GST) are in `activate-stepnrock-lib.js`; the five apps are bespoke designs with no V3 Pro theme to move to. The SQL was checked by text only (no statement other than SELECT/WITH, quoted identifiers, columns matched against the schema); it was not parsed by a database.

## INV-9 Themes status
Checked the worktree `C:\Get4Domain\get4domain-themes` (clean) and branch `v3-themes` (local and origin both a587473; an ancestor of `v3-b2`). Ran `node cli.mjs lint --all` in `themes/` of the inventory worktree: PASS for 6 of 6 packages (starter plus the five Standard themes, 41 presets, 41 distinct ids). Ran `node --test "test/*.test.mjs"`: 255 of 255 pass. The Bolt kit zip exists (318,941 bytes, current, git-ignored). I tried to unzip it and run its lint myself; the permission check refused that command and I did not work around it. The repo's own bolt-kit test does that (unzip outside the repo, empty node_modules, `npm run lint:all`) and passed. No Pro theme exists (no `themes/pro` or `themes/pro-incoming`). THEMES-CC-0, CC-1 and CC-2 are complete; open items are owner questions only. Added the combined list of questions for the owner. Output: section INV-9 and the questions of `docs/v3/V2_INVENTORY.md`.
