# GET4DOMAIN — VM DEPLOY RUNBOOK (consolidated, one clean pass)
# Covers every pending schema change + config from the Aug-2026 run
# (Phase 1 CMS editor → Track A → Track B → Track C 3A–3D + 3E scaffolding).
# Run this top-to-bottom on the VM. All schema changes are ADDITIVE / non-destructive.

Branch: `get4domain-site`  ·  Latest commit at time of writing: `2de3729`

---

## 0. HARD RULES (do not break)
- **Never touch ports 3000/3001** (MR Travels legacy) — leave those containers alone.
- Prisma stays **6.19.3** (do not upgrade).
- Supabase **pooler URL** for the app (6543); **DIRECT_URL** (5432) is what `prisma db push` uses for DDL — the schema already points `directUrl = env("DIRECT_URL")`, so no manual switch needed.
- `npm run build` was already 0-errors on both apps before every commit; no code changes needed on the VM.
- Test **MR Travels + Allwin Tours** health after the deploy (step 6).

---

## 1. WHAT THIS DEPLOY APPLIES

**New additive columns** (all nullable / unique-nullable — no data loss on existing rows):
| Table | Column | From |
|---|---|---|
| `VendorProduct` | `customFields Json?` | Phase 1 CMS editor |
| `VendorCMS` | `banner String?` | Phase 1 CMS editor |
| `VendorCMS` | `themeId String?` | Track A 2.3 |
| `Vendor` | `configOverride Json?` | Track C 3C |
| `Vendor` | `widgetKey String? @unique` | Track C 3B |
| `TeamMember` | `department String?` | Track C 3D |

**New tables** (all `g4d_`-prefixed):
| Table | From |
|---|---|
| `g4d_ai_templates` | Track A 2.2 |
| `g4d_website_themes` | Track A 2.3 |
| `g4d_expenses` | Track B 2C |
| `g4d_stationery` | Track B 2D |

> Adding a **unique nullable** column (`Vendor.widgetKey`) to a populated table is safe in Postgres — existing rows are all `NULL`, and Postgres allows multiple NULLs under a unique index (same as the existing `subdomain`).

---

## 2. SSH IN + PULL

```bash
ssh ksmwebtechservices@34.14.130.68
cd /srv/get4domain-site      # adjust if the checkout lives elsewhere
git fetch origin
git checkout get4domain-site
git pull origin get4domain-site
git log --oneline -1         # expect the latest commit (2de3729 or newer)
```

---

## 3. REBUILD + RESTART CONTAINERS
(same pattern as prior deploys; MR Travels on 3000/3001 is a separate stack — untouched)

```bash
docker compose build --no-cache
docker compose up -d --force-recreate
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
# backend container is `get4domain_backend` (3008), frontend `get4domain_frontend` (3006)
# per MASTER_STATUS — confirm the names match your output before the next step.
```

---

## 4. APPLY SCHEMA — `prisma db push` (STOP-5 SAFEGUARD)

All changes are additive, so **plain `db push` (no `--accept-data-loss`)** must apply cleanly.

```bash
docker exec -it get4domain_backend npx prisma db push
```

- ✅ Expected: "Your database is now in sync with your Prisma schema" — it should report **added** columns/tables only.
- 🛑 **If it warns about dropping/altering a column or losing data → STOP and report.** Nothing in this run is destructive; a data-loss prompt means something unexpected. Do **not** pass `--accept-data-loss` to force it.

_If the container lacks the Prisma CLI/schema, run from the host repo instead (needs node + the `.env` with `DATABASE_URL`/`DIRECT_URL`):_
```bash
cd /srv/get4domain-site/backend-api && npx prisma db push
```

---

## 5. POST-DEPLOY CONFIG (Admin panel)

- **Free credit (₹499):** already correct — the gate check confirmed **no `pro_free_credit` row exists in prod**, so the code default (`49900` paise = ₹499) applies to new signups. No action needed. (If you ever want to pin it: Admin → Pricing → "Pro plan — free credit" = `499`. It stores **rupees**, so the value is `499`, never `49900`.)
- **New integration slots now visible** (Admin → Integrations) — enter keys only when accounts are funded:
  - `ai / stability_api_key` (Stability AI — 3E primary images) — **parked, awaiting KSM funded-account confirmation**.
  - `video / kling_api_key` (Kling — 3E) — **parked, same**.
  - (Existing `ai/openai_api_key`, `ai/anthropic_api_key`, `video/runway_api_key`, `video/heygen_api_key` unchanged.)

> **3E real provider wiring and Decision 2 (Razorpay subscriptions) are intentionally NOT in this deploy** — both are parked pending KSM (funded-provider list; Razorpay `plan_id`).

---

## 6. HEALTH CHECKS (must all pass)

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}'   # RestartCount 0 on all app containers
# Public endpoints:
curl -I https://get4domain.com                         # 200
curl -s -o /dev/null -w '%{http_code}\n' https://gapi.get4domain.com/cms/platform   # 200 (API health; root "/" 404 is normal)
curl -I https://allwintours.get4domain.com             # 200  (verify legacy still healthy)
curl -I https://mrtravels.get4domain.com               # 200  (LEGACY 3000/3001 — untouched)
# New surfaces spot-check (need auth for most; embed.js is public):
curl -s -o /dev/null -w '%{http_code}\n' https://gapi.get4domain.com/widget/embed.js  # 200, application/javascript
```

Then **purge Cloudflare cache** (frontend assets) after the frontend container is up.

---

## 7. SMOKE-TEST THE NEW FEATURES (as a real user — don't just trust a clean build)

- **Pricing:** get4domain.com shows **₹999/month** and **₹499** free credit (not ₹6,999 / ₹999 credit).
- **Vendor dashboard:** industry KPI banner + colorful KPI cards; **Accounts** tab (log an expense → P&L + GST update; download a voucher); **Stationery** tab; **Embed / Widget** tab (copy snippet, paste on a test page → chat bubble + enquiry both submit; a lead appears in TeleCRM).
- **AI Studio:** template picker prefills a brief (add a template via Admin → Content Library first).
- **my-website → Logo & Banner** + **Template** (theme picker).
- **Support:** ask the bot → "No, call me back" creates an **Escalation** → appears in Admin → Support (Escalations filter) and drives Admin → Utilization.
- **Admin → Utilization:** cross-vendor tool usage + platform GST totals (no per-vendor private expenses).
- **Admin → Vendor Access:** select a vendor → set a per-vendor override (accent/welcome) → it applies live on that vendor's dashboard.
- **Customer portal** (`/customer`): OTP login (session survives a backend restart now — JWT).
- **The two blocked verifications** (need real accounts, do on the VM): a **real AI Studio image generation** as a test vendor (works, or fails on OpenAI billing); and confirm which **AI/video providers are funded** to unblock 3E.

---

## ROLLBACK
Code: `git checkout <previous-commit> && docker compose build --no-cache && up -d`. Schema changes are additive — leaving the new columns/tables in place is harmless even on an older code build (they're simply unused).
