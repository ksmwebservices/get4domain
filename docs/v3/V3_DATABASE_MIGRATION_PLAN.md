# V3 Database Migration Plan (Phase V3.0 output)

> Plan only — **no migration was created, edited or run**, and no database (local or production) was queried by this audit. Facts below come from `backend-api/prisma/schema.prisma` and the migrations folder as read from disk.

## 1. Current state (from disk)

| Item | Value |
|---|---|
| Engine | PostgreSQL (Supabase), Prisma 6.19.3, pooled `DATABASE_URL` + `DIRECT_URL` |
| Schema | 3,757 lines, 150 `model`, 20 `enum` |
| Migration folders | 54 (latest `20261016100000_theme_packages`) |
| ID style | `String @id @default(cuid())` on all 148 id fields (CLAUDE.md says UUID — not followed) |
| Table naming | `g4d_*` via `@@map` |
| Tenant key | `vendorId` on business tables; `Vendor` is the tenant |
| Soft delete | Not universal (no blanket `deletedAt`) |
| RLS | Enabled by running `prisma/sql/enable_rls_public.sql` manually after migrations; verify with `pg_tables.rowsecurity=false` → 0 rows |
| Drift | `20260719093736_add_leads` applied in DB, no local folder; ~28 core tables were created by `prisma db push` (V2 `MIGRATION_PLAN.md`). Migrations are **not reproducible from scratch** |
| Dev/prod | V2 audit: dev and prod share one Supabase database |
| Guards | `verify:migrations`, `verify-migrations-additive.js`, `verify:raw-sql`, `verify:db-lock` |
| Hazards seen | A pasted Prisma update banner broke migration `20261007120000` (P3018); fixed and guarded |

## 2. Principles (spec Rules 3 and 8)

1. Additive only: new tables, new nullable/defaulted columns, new indexes. No drops, renames or type changes of live columns in V3. Retirements go through expand → backfill → switch → (later, separate approval) contract.
2. Every migration is rehearsed on a **copy of production** (restore from backup into a scratch database) before it runs live.
3. Backup before each phase's migration batch; restore drill is a V3.10 deliverable but a single pre-V3.1 backup is mandatory.
4. After every migration batch: `prisma migrate deploy` → `prisma generate` → run RLS script → check zero tables with RLS off → rebuild/restart API. (Existing VM sequence; documented in `docs/v2/DEPLOYMENT.md`.)
5. Backfills are scripts with `--dry-run` default, `--apply` explicit, and a written rollback (pattern already used by `site-document-backfill`, `bos-spine-backfill`, `leadspace-migrate-*`).
6. Raw SQL: use the existing `advisoryXactLock()` helper (the `void`-deserialization bug of 2026-10-08).

## 3. Step 0 — baseline reconciliation (before any V3 migration)

| Action | Detail |
|---|---|
| Read-only check | Compare `_prisma_migrations` on production against the 54 local folders. Record exactly which are applied / failed / rolled back |
| Resolve strays | Any failed row needs `prisma migrate resolve --rolled-back <name>` before `deploy` |
| Close the drift | Optionally baseline the `db push` tables with a `prisma migrate diff`-generated baseline migration marked as applied, so a fresh database can be built (needed for CI and for a proper staging DB) |
| Separate environments | Create a **staging database** distinct from production (V2 found them shared). Migration rehearsals run there |
| Backup | Full logical backup + note the Supabase point-in-time-recovery window |

## 4. Proposed schema changes by phase (additive)

Names are working titles; final DDL is written in each phase after approval. Existing tables to **extend rather than duplicate** are called out.

### V3.1 SaaS Foundation
| New / extended | Notes |
|---|---|
| `g4d_plans`, `g4d_plan_prices`, `g4d_features`, `g4d_plan_features` | Seed from `plan-pricing.constants.ts` + `registry/`. Existing `BillingPlanKey` enum stays; add `planId` nullable FK on `BillingTerm`/`Subscription`, backfilled from the enum. No change to historical rows |
| `g4d_entitlements` (tenant-level overrides/usage caps) | Extends the idea behind `PlanOverride`; do not duplicate — either generalise `PlanOverride` or reference it |
| `g4d_staff_roles`, `g4d_permissions`, `g4d_role_permissions` | Link `AdminTeamMember` → role(s). Keep the `AdminRole` enum column for backward compatibility during transition |
| `g4d_audit_logs` | Generalises `CommercialAuditLog`; old table untouched and dual-written until retired |
| `Vendor` provenance columns (`registeredByStaffId`, `source`) | nullable |
| Optional `g4d_branches` | Defer unless a spec requirement forces it (spec lists Branches under Core) |

### V3.2 Directory and Free Website
| New | Notes |
|---|---|
| `g4d_locations` (state → district → city tree, slug unique per parent) | Seed Tamil Nadu first |
| `g4d_directory_categories` (tree) **or** extend `Category` | Decide after reconciling `Category` / `CategoryPack` / vendor taxonomy (`20260924010000`) to avoid a third taxonomy |
| `g4d_directory_listings` (+ `_services`, `_products`, `_media`, `_placements`) | **Not** the existing real-estate `Listing`. Link `vendorId` nullable (unclaimed listings possible only if policy allows) |
| `g4d_reviews` | Only if reviews are in scope; moderation required |
| Slug uniqueness + indexes for `(locationId, categoryId)` browse queries | Plan explicit composite indexes |

### V3.3 Theme / Website Manager
| Change | Notes |
|---|---|
| `SiteVersion` / `VendorCMS` additions: `scheduledPublishAt`, `approvalState`, `approvedBy` (nullable) | Keeps the single-document model |
| `g4d_site_approvals` | Employee/vendor approval trail |
| Optional read-only projections for `WebsitePages`/`WebsiteSections` | Only if reporting needs them; avoid dual sources of truth |
| `ThemePackage` eligibility → plan references | Via V3.1 plan ids |

### V3.4 Domains
| New | Notes |
|---|---|
| `g4d_domains` (canonical domain record per vendor; today domain data lives on `Vendor`/`DomainRegistration`) | Backfill from `Vendor.customDomain` + `DomainRegistration`; keep old columns read-only until cutover |
| `g4d_domain_verifications`, `g4d_dns_records`, `g4d_ssl_records` | Verification token, status, last checked |
| `g4d_domain_transfers`, `g4d_migration_jobs`, `g4d_registrar_transactions`, `g4d_renewal_records` | Auth codes **encrypted** (reuse `crypto.util`), never logged, nulled on completion |

### V3.5 Webapps / CRM / Ecommerce
| Change | Notes |
|---|---|
| Apply pending `universal_catalogue_columns` + data migration per `UNIVERSAL_CATALOGUE_MODEL.md` §4 | Already designed; cutover is a separate approval |
| `g4d_product_variants`, `g4d_coupons` (vendor-scope), `g4d_shipments_ecom`, `g4d_return_requests` | Name `Shipment` is taken (logistics) — avoid collision |
| Lead pipeline: constrain `Lead.status` via enum/check **after** profiling the distinct values in production (it is a free string today) | Expand with a mapping table; never rewrite rows blindly |

### V3.6 Enquiry hub / chatbots
| New | Notes |
|---|---|
| `g4d_enquiries` (+ source/attribution) linked to existing `Lead` | Backfill link from `Lead.source` where derivable; leave the rest null |
| `g4d_bots`, `g4d_bot_channels`, `g4d_bot_configs`, `g4d_handover_records`, `g4d_conversations`, `g4d_conversation_messages` | Consolidate `WhatsappConversation`/`KnowledgeBaseEntry` by reference, not copy |

### V3.7 Communication and billing
| New | Notes |
|---|---|
| `g4d_usage_transactions` (idempotency key unique), `g4d_allowances`, `g4d_communication_packs`, `g4d_pack_purchases` (validity/expiry), `g4d_message_templates`, `g4d_email_messages`, `g4d_sms_messages` | Reuse wallet for money; keep message-unit credits separate from rupee balance |

### V3.8–V3.9 Social, marketing, SEO
Extend `SocialAccount` / `SocialPost` / `PostJob`; add `g4d_social_assets`, `g4d_publication_records`, `g4d_marketing_requests`, `g4d_seo_audits`, `g4d_keywords`, `g4d_redirects`, `g4d_feed_items`.

## 5. Data-risk register

| Risk | Impact | Mitigation |
|---|---|---|
| Production migration history unknown/unreconciled | Failed deploy, partial schema | Step 0 read-only check; staging copy rehearsal |
| Shared dev/prod database | Test writes hit real data | Separate staging DB before V3 work |
| `db push` drift | Cannot rebuild DB; CI impossible | Baseline migration |
| Free-form `Lead.status`, `Appointment.status`, etc. | Enum conversion breaks rows | Profile first; add mapping, no destructive cast |
| RLS forgotten on new tables | Cross-tenant data exposure via Supabase API | Make RLS script a mandatory post-step and a CI check |
| Plan model change vs live terms | Price changes for paying vendors | Plans as data with **grandfathered** price rows; never recompute existing terms |
| Dual sources of truth during expand/contract (domains, catalogue, audit) | Drift | Single writer per field; dual-write only with a reconcile script |
| Large backfills on hot tables | Lock contention | Batched, off-peak, advisory-lock guarded |
| Secrets in new tables (auth codes, OAuth tokens) | Leak | Encrypt with `PLATFORM_SETTINGS_KEY` pipeline; never return from APIs; add to secret-redaction list |

## 6. Rollback strategy

- Each migration folder ships a documented manual down-SQL in its PR description (Prisma has no automatic down). Since changes are additive, rollback = stop using the feature flag, then drop the new objects in a later, separately approved migration.
- Data backfills: dry-run output saved; `--rollback` mode for each script.
- Restore path: Supabase PITR / logical backup restore into staging first to prove it.
