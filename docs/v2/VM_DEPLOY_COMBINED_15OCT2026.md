# One combined VM deploy: LeadSpace + Website Manager (KSM only)

Nothing here has been run. Paths and container names come from `DEPLOYMENT.md` sections 9, 10 and 11: repo `/srv/get4domain-site`, backend container `get4domain_backend` (service `backend`), frontend container `get4domain_frontend` (service `frontend`), API env file `/srv/get4domain-site/backend-api/.env.local`.

Migrations in play (all additive, applied in this order by `migrate deploy`; any already applied are skipped):

- `20261010100000_leadspace` (21 tables)
- `20261010110000_leadspace_page_stats` (1 table + 1 nullable column)
- `20261010120000_leadspace_followups` (2 columns + 1 index; section 10; included because `migrate deploy` applies every pending migration)
- `20261014100000_website_manager` (8 columns on "VendorCMS" + 3 tables)

## A. Check what is pending

**VM terminal**
```
ssh ksmwebtechservices@34.14.130.68
cd /srv/get4domain-site/backend-api
set -a; . ./.env.local; set +a
npx prisma migrate status
```
Read the list "Following migration(s) have not yet been applied". Everything in the list is applied in step D; if the list is empty, skip D and F's migration part. If it says "Database schema is not up to date" with a *failed* migration, stop and send the output to Claude.

## B. Backup

**VM terminal**
```
mkdir -p ~/backups
pg_dump "${DIRECT_URL:-$DATABASE_URL}" -Fc -f ~/backups/g4d_before_leadspace_websitemanager_$(date +%F_%H%M).dump
ls -lh ~/backups | tail -3          # the new file must be more than a few hundred KB
```
Also confirm a Supabase backup from today (Supabase dashboard, Database, Backups).

## C. Pull the code

**VM terminal**
```
cd /srv/get4domain-site && git pull origin get4domain-site
git log --oneline -1                 # expect the commit Claude reports as the pushed head
```

## D. Migrate

**VM terminal**
```
cd /srv/get4domain-site/backend-api
npx prisma migrate deploy && npx prisma generate
npx prisma migrate status            # expect "Database schema is up to date!"
```

## E. Row level security

**VM terminal**
```
cat prisma/sql/enable_rls_public.sql | head -80
grep -n 'DO \$\$' prisma/sql/enable_rls_public.sql
grep -n 'END \$\$;' prisma/sql/enable_rls_public.sql
```
Both greps must print a line. If either prints nothing, stop: the file is cut.

**Supabase SQL editor**: paste the whole content of `backend-api/prisma/sql/enable_rls_public.sql` and run it (covers every public table, including the 22 LeadSpace and 3 Website Manager tables). Expect "Success. No rows returned". Then, in the same editor:
```
SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity=false;
```
Expect 0 rows.

## F. nginx: accept pictures up to 10 MB on the API host

**VM terminal**
```
sudo grep -rl "gapi.get4domain.com" /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null
sudo nano <the file printed above>      # inside server { }, add:   client_max_body_size 10m;
sudo nginx -t && sudo systemctl reload nginx
```

## G. Environment (set before the rebuild; never commit these files)

**VM terminal**
```
cd /srv/get4domain-site
grep -c "^LEADSPACE_HASH_SALT=" backend-api/.env.local     # 0 = still to add
grep -c "^PUBLIC_APP_URL=" backend-api/.env.local
grep -c "^PUBLIC_API_URL=" backend-api/.env.local
grep -c "^RAZORPAY_WEBHOOK_SECRET=" backend-api/.env.local
grep -c "^REVALIDATE_SECRET=" backend-api/.env.local
grep -c "^FRONTEND_INTERNAL_URL=" backend-api/.env.local
```
For each line that printed 0, add it (only those):
```
echo "LEADSPACE_HASH_SALT=$(openssl rand -hex 32)" >> backend-api/.env.local     # set once, NEVER change afterwards
echo "PUBLIC_APP_URL=https://get4domain.com" >> backend-api/.env.local
echo "PUBLIC_API_URL=https://gapi.get4domain.com" >> backend-api/.env.local
# RAZORPAY_WEBHOOK_SECRET: add the value from the Razorpay dashboard (same secret for both webhooks)
SECRET=$(openssl rand -hex 32)
echo "REVALIDATE_SECRET=$SECRET" >> backend-api/.env.local
echo "FRONTEND_INTERNAL_URL=https://get4domain.com" >> backend-api/.env.local
echo "REVALIDATE_SECRET=$SECRET" > get4domain_mvp/.env      # the SAME value; the compose file passes it into the frontend container
```
Leave the `WHATSAPP_*` variables unset for the first test (the common number then shows "Awaiting approval"). Still needed outside the VM: in the Razorpay dashboard add a second webhook `https://gapi.get4domain.com/leadspace/refill/webhook` for `payment.captured`, same secret. Not yet needed: Razorpay plan ids and ResellerClub credentials (pricing/domain phase), Supabase/OpenAI keys (AI images).

## H. Rebuild both containers (backend first)

**VM terminal**
```
cd /srv/get4domain-site/backend-api && docker compose build --no-cache && docker compose up -d --force-recreate
docker compose logs --tail=50 backend           # look for "Nest application successfully started"
cd ../get4domain_mvp && docker compose build --no-cache && docker compose up -d --force-recreate
docker ps --format '{{.Names}}\t{{.Status}}' | grep get4domain
```

## I. Dry runs only (these write nothing)

**VM terminal**
```
cd /srv/get4domain-site/backend-api && npx nest build

# LeadSpace campaign merge, dry run (no --apply)
node scripts/leadspace-migrate-campaigns.js --vendor allwintours

# Website Manager site-document backfill, dry run (no --apply)
node scripts/site-document-backfill.js --vendor ksm-webtech-services
node scripts/site-document-backfill.js --vendor allwintours
node scripts/site-document-backfill.js --vendor stepnrock

# Switching ksm-webtech-services onto the new Website Manager, dry run (no --apply)
node scripts/site-doc-flag.js --on --vendor ksm-webtech-services
```
Paste all of this output to Claude. Expected: `allwintours` fills name, tagline, about, address, phone, WhatsApp, SEO title and description, hours, testimonials and layout, keeps its uploaded logo and adds 11 items; `stepnrock` adds a banner and a layout; `ksm-webtech-services` has nothing to copy; the flag dry run says "DRY RUN: nothing written".

Do **not** run anything with `--apply` until you have read the dry runs. The apply commands (backfill for one vendor, flag on, campaign merge) are in `DEPLOYMENT.md` section 9 and section 11 steps 8 and 9.

## J. Six checks on ksm-webtech-services (after its flag is on, section 11 step 9)

1. Website Manager, Logo and Banner: upload a PNG logo, Publish; the public page shows it and the browser tab shows its small icon.
2. Basic Info and About: change the tagline and the About text, press Preview (private), then Publish; the public page changes within seconds.
3. Theme and layout: pick another theme and layouts, Preview, Publish; nothing you wrote is lost.
4. SEO: change the SEO title, Publish; view the page source: the title tag changed.
5. Go-live readiness: the ticked items match what the public page shows.
6. Versions: open Versions, put an older version live; the page changes back; the newer one is still in the list.

If anything goes wrong: `SITE_DOC_CONFIRM=I_HAVE_READ_THE_DRY_RUN node scripts/site-doc-flag.js --off --vendor ksm-webtech-services --apply`; the migrations only add and can stay; to roll back the application, redeploy the previous commit.
