# MIGRATION_PLAN — Get4Domain V2 (database + data)

> Plan only. **Nothing in this document has been applied.** The live database is shared by local development and production (`backend-api/.env.local` points at the production Supabase instance), so every migration decision is a production decision. Hard stop (standing): no `prisma migrate deploy` / destructive change without KSM.

## 1. Current state (verified 2026-10-02)

Read-only comparison of `backend-api/prisma/migrations/*` with the live `_prisma_migrations` table and `information_schema`:

| Check | Result |
|---|---|
| Local migration folders | 38 |
| Applied rows in the DB | 41 (includes pre-baseline/other rows) |
| Local folders not applied / unfinished | **0** |
| Applied in DB with **no** local folder | 1 — `20260719093736_add_leads` |
| Tables in `public` | 100 (schema declares 99 models) |
| `g4d_domain_campaign_records` | present |
| `Subscription.themeChangesUsed/Limit/ResetAt` | present |
| Local folder awaiting application | `20261002120000_domain_campaign_custom_fee` (new, **not applied**) |

## 2. Known problems

| # | Problem | Impact | Source |
|---|---|---|---|
| M1 | **28 schema tables have no `CREATE TABLE` in any migration** (created by `prisma db push` on the VM; the deploy runbook still instructs `db push`): `g4d_leads`, `g4d_wallets`, `g4d_wallet_transactions`, `g4d_campaign_pages`, `g4d_campaign_leads`, `g4d_call_logs`, `g4d_campaigns`, `g4d_team_members`, `g4d_notifications`, `g4d_platform_income`, `g4d_contacts`, `g4d_messages`, `g4d_catalog_items`, `g4d_records`, `g4d_generic_invoices`, `g4d_vendor_addons`, `g4d_vendor_modules`, `g4d_platform_settings`, `g4d_quotes`, `g4d_admin_team_members`, `g4d_ai_templates`, `g4d_website_themes`, `g4d_vendor_payment_config`, `g4d_vendor_template_unlock`, `g4d_expenses`, `g4d_stationery`, `g4d_lead_call_logs`, `g4d_push_subscriptions` (names per platform audit; some may differ — confirm with a schema diff) | A fresh database built by `migrate deploy` is **missing core tables**; no staging parity; disaster recovery by migrations impossible | evidence/platform.md §1.3 |
| M2 | One applied migration lacks a local folder | Migration history cannot be replayed | verified |
| M3 | Hand-written SQL + `migrate resolve --applied` is the working practice for additive changes | Fragile; no checksum review | session practice |
| M4 | RLS enabled by a manual SQL script (`prisma/sql/enable_rls_public.sql`) that must be re-run after each `db push` | Tables created later lack RLS until re-run | evidence/platform.md |
| M5 | CLAUDE.md conventions vs schema: UUID ids 0/99; `deletedAt` 1/99; `createdAt` 94%; `updatedAt` 88% | Rule/reality drift; blocks "never hard delete" | schema analysis |
| M6 | Money stored as `Float` rupees in vendor tables (`GenericInvoice`, `Expense`, `PosSale`, `PaymentRecord`, `RetailProduct`) but `Int` paise in platform tables | Rounding risk in a GST/accounting engine | evidence/bos.md |
| M7 | Orphan models with no code: `VendorTask`, `KitchenTicket`, `Appointment`; `OperationType` / `IndustryExperience` are write-only | Dead schema / unread registry | evidence/bos.md, industry.md |
| M8 | Raw SQL for `DomainCampaignRecord` because the Prisma client wasn't regenerated | Typed accessor absent | evidence/platform.md §6 |

## 3. Plan

### Step 0 — safety (before any V2 migration)
1. Take a verified database backup/PITR point (Supabase) and document the restore procedure — currently **MISSING** (no backup policy in repo or runbook).
2. Create a **separate non-production database** (CI + staging). All migration rehearsals happen there.
3. Freeze `prisma db push` on production; update `docs/VM_DEPLOY_RUNBOOK.md` to `migrate deploy` only.

### Step 1 — baseline (V2.0b / T-020)
1. In the non-prod DB, generate the true current schema: `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` → review → commit as `00000000000000_baseline` (documented command; **do not run against production**).
2. Reconcile production: mark the baseline as applied (`prisma migrate resolve --applied <baseline>`) **only after** a schema diff proves production == baseline (`prisma migrate diff --from-url <prod> --to-schema-datamodel …` must be empty).
3. Resolve M2: restore the missing `20260719093736_add_leads` folder from the DB definition (or squash it into the baseline) so history is replayable.
4. Verify: a fresh DB from `migrate deploy` + seed passes the app smoke tests.

### Step 2 — policy decisions (KSM) then migrate (T-021)
| Decision | Options | Recommendation |
|---|---|---|
| ID strategy | keep cuid (already 98/99) vs convert to uuid | **Keep cuid; update CLAUDE.md** — converting 99 tables' PKs/FKs on a live DB is high-risk, low-value |
| Soft delete | add `deletedAt` to all vs money/audit tables only | **Money, audit, customer, and master tables first**; keep hard delete for ephemeral data; reversal/credit-note for financial records (PRD §63AB) |
| Money type | `Float` → integer paise (or Decimal) | **Integer paise everywhere** via additive new columns + backfill + switch + drop in separate releases |
| Registry tables | read from DB vs delete | Make the backend read them (capability engine, T-024) or drop the tables |

### Step 3 — forward migrations for V2 (additive, expand→migrate→contract)
Each release's tables, in dependency order (details at release start):

| Release | New / changed structures |
|---|---|
| V2.0a | `PaymentOrder` (server-side order binding) + `UNIQUE(razorpayPaymentId)` on payment/wallet tables; invite-token expiry; refresh-token table; OTP store (DB/Redis) |
| V2.0b | Business Master fields, `Branch`, numbering/FY settings, `Role`, `Permission`, `RolePermission`, `AuditLog`, entitlement fields |
| V2.1 | domain/host mapping fields, booking/order tables per priority industry, order lifecycle, vendor webhook ledger |
| V2.2 | `SearchQuery`, `ShareLink`/click events, `SocialAccount` (encrypted tokens), `SocialPublication`, `MarketingAsset`, `DocumentTemplate`/`DocumentVersion`, `Offer`/`Coupon`/`LoyaltyAccount`/`LoyaltyTransaction`/`Affiliate`/`Referral` |
| V2.3 | `MessageTemplate`, `Consent`, `MessageLog` (queue + DLR), `Conversation`/`Thread`, `AutomationRule`/`AutomationRun` |
| V2.4 | lead/task fields, activate `VendorTask`, `Employee`/`Attendance`/`Leave`/`Payroll`/`Payslip`, product variants/barcode/HSN, `Warehouse`/`StockMovement`, `Supplier`/`PurchaseOrder`/`GoodsReceipt`/`PurchaseInvoice`, `Quotation`/`QuotationVersion`, `TaxRate`/GST fields/`CreditNote`, ledger (`Account`/`JournalEntry`/`JournalLine`) |
| V2.5 | per-industry state/availability tables, case/job engine |

### Step 4 — rules for every migration (PRD §65.3, §90, session practice)
- Additive and defaulted; destructive changes only via expand→backfill→switch→contract across separate releases, with a rollback script.
- Written, reviewed and **rehearsed on the non-prod DB first**; applied to production by KSM (`cd backend-api && npx prisma migrate deploy`).
- **Deploy order:** apply the additive migration **before** deploying the code that needs it (learned the hard way with `isCustomFee`); after deploy, run a read-only status check (script in session notes: compare folders vs `_prisma_migrations`).
- Never mix `db push` with migrations.
- **Generating migration SQL (2026-10-07 incident):** a Prisma "Update available … npm i …" box captured into `migration.sql` made Postgres reject `20261007120000_commercial_engine` (P3018, syntax error). When generating SQL: `export PRISMA_HIDE_UPDATE_MESSAGE=true`, write **straight to the file** with stdout only (`npx prisma migrate diff … --script > migration.sql 2>/dev/null` — never paste or `tee` terminal output that may include banners), then run **`npm run verify:migrations`** (also part of `verify:commercial`) **before committing**. It fails on box-drawing characters, "Update available", "npm i", pris.ly URLs outside `--` comments, a BOM or NUL bytes.
- **Rehearse on real Postgres even without Docker:** `@electric-sql/pglite` (Postgres in WASM) in a scratch folder outside the repo can replay the baseline DDL (`prisma migrate diff --from-empty --to-schema-datamodel <previous schema>`) followed by the new migration(s). The migration *history* cannot be replayed from empty (`20260722000000_web_push_subscriptions` assumes a table the earlier files never create), so rehearse on the baseline DDL, not on `migrate deploy` from scratch.
- Backfill scripts idempotent, batched, logged; each reports row counts before/after.
- Preserve existing data and compatibility; changing industry mode must never delete or hide historical data (PRD §63I).

## 4. Data migrations / compatibility notes
- **Plans:** vendors who bought under the old structure keep their paid term; new fields (`themeChangesLimit`) are `NULL` for them and the check fails open (unrestricted). Decide whether to grandfather or map them to Workspace at renewal.
- **Legacy `Subscription.plan` enum** (`STARTUP|ENTERPRISE|STARTER|BUSINESS`) does not encode Workspace/BOS; tier is inferred from `amount`. Add an explicit `tier` column in V2.0b and backfill from amount.
- **Vendor password hashes / invite tokens** returned by APIs today should be treated as potentially exposed: force-rotate invite tokens and consider a password-reset campaign after S4 is fixed.
- **Domain Campaign:** verified read-only on 2026-10-02 — `g4d_domain_campaign_records` has **0 rows** and there are **0** `DOMAIN_CAMPAIGN` subscriptions, so no fees were ever recorded under the old 10%/₹9,999 model and `20261002120000` needs no backfill (new column defaults to `false`).
