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
