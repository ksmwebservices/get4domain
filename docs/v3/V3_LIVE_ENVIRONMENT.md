# V3 live environment: deploy, health checks, rollback, backup and restore

Job L. This is the runbook for putting the V3 API on its own live server. **It contains no real value**: the live domain is the variable `V3_DOMAIN`, secrets are made on the server, and `.env.live` (the real file) is never committed.
Commands are for a Linux server with Docker, nginx, `openssl` and the PostgreSQL client tools (`pg_dump`, `pg_restore`, `psql`, the same major version as the database). Commands run from the `backend-api` folder of the checkout.

## 0. What was built (all committed, none of it run anywhere yet)

| Piece | File | What it does |
|---|---|---|
| Production image | `Dockerfile.v3live` (+ `Dockerfile.v3live.dockerignore`) | Multi-stage (dependencies, build with `prisma generate`, production-only dependencies, runtime). Non-root user (uid 1001), health check on `/health`, clean stop (tini). Bakes in no value. |
| Compose file | `docker-compose.v3live.yml` | The API only. It listens on `0.0.0.0` INSIDE the container; **no port is published to the host**: the container has a fixed address on its own private network (`172.28.30.10` by default) and the host's nginx connects to `http://<that address>:3008`. `restart: unless-stopped`, log rotation (5 files of 10 MB), `no-new-privileges`, all capabilities dropped, `env_file: .env.live`. |
| Variable list | `.env.live.example` | Every variable name the API reads, one comment each, no values. A test keeps it complete. |
| Startup check | `src/common/startup-check.ts`, called first in `src/main.ts` | The live process refuses to boot with a missing or placeholder variable, a secret under 32 characters, an address that is not https on `V3_DOMAIN`, or a staging, test or local database. It prints names, never values. |
| Pre-flight | `scripts/live/check-live-env.js` | The same check, run before you start the container. |
| Migrations | `scripts/live/migrate-live.js` | `status`, `deploy`, `drift`, `rls` against the LIVE database only. Refuses a staging, test or local database. `deploy` needs `LIVE` typed in a terminal. |
| Data loaders | `scripts/live/seed-live.js` | Runs one `seed-v3-*.js` loader against the live database (dry run by default, `--apply` needs `LIVE` typed). |
| First administrator | `scripts/bootstrap-super-admin.js` | Asks for the email and the password at the prompt, never from an argument or a file, never prints them, refuses when an administrator exists. |
| Schema baseline, step A | `scripts/live/dump-staging-schema.js` | On the owner's PC: asks for the STAGING connection string at a prompt that does not echo, refuses any other project, checks staging has every migration and no unexpected drift, then runs `pg_dump --schema-only --no-owner --no-privileges` into a local file that is never committed. Prints counts only. |
| Schema baseline, step B | `scripts/live/baseline-live.js` | Refuses anything that is not the live database (the same guards as `migrate-live`), refuses a database that is not empty, needs `LIVE` typed, creates the extensions, applies the schema in one transaction, marks every migration folder applied in order, then runs the row level security and drift checks. Prints counts only. |
| Backup | `scripts/live/backup-live-db.js` | `pg_dump` piped through `openssl` (AES-256) into an encrypted file, read back and checked before it is kept, old ones rotated. |

**The startup check applies only to the live process.** The image sets `NODE_ENV=production` and `V3_LIVE=true`; any other deployment (the Version 2 containers, staging, tests, a developer machine) does not set `V3_LIVE=true` and boots exactly as before.

## 1. Before you start: decisions that change the steps

1. **The live database is a NEW Supabase project (decided in job M).** `migrate deploy` cannot build an empty database (the early migration history is not replayable), so the schema is taken from staging and the migration history is marked as applied: section 6a. `migrate-live` (section 6) is for LATER releases, once the baseline is done.
2. **Who serves the public site and the vendor app?** Their addresses must be on `V3_DOMAIN` (the check refuses others). `TRUSTED_PROXIES` must name the server that connects to the API (nginx, and the public site's server if it calls the API from outside).
3. **Nothing sends or spends until you switch it on** (section 9). Leave every switch off for the first boot.

## 1a. The order of work for a new live database (read this first)

1. **Create a new Supabase project** for live (a new, empty database; note its region and the pooled and direct connection strings). Do not touch the staging project.
2. Prepare the server and the environment file (sections 2 to 4): `.env.live` holds the NEW project's `DATABASE_URL` and `DIRECT_URL`; `node scripts/live/check-live-env.js` must pass.
3. **Back up** (section 5) is skipped on an empty database; from the first data onward it is daily (section 12).
4. **Schema baseline** (section 6a): step A on the owner's PC (dump the staging schema), step B (apply it to the empty live database, mark every migration applied, check).
5. **Seeds in order** with `seed-live` (section 7): the pack engine, then the pack tab fields, then the profile fields, then the catalogue categories (the reference data the plan, wallet, payment, terms, alert and mail loaders and the directory categories come before, as listed there).
6. **Build and start the API** (section 8), then **bootstrap the first SUPER_ADMIN** (section 8).
7. **Health checks** (section 9).

## 2. Prepare the server (once)

```
sudo mkdir -p /srv/get4domain/backups && sudo chmod 700 /srv/get4domain/backups
git clone <your repository address> /srv/get4domain/app        # or git pull in an existing checkout
cd /srv/get4domain/app/backend-api
git checkout <the release branch>
npm ci
npm run build
```

`npm ci` and `npm run build` on the host give the scripts in `scripts/live/` the Prisma CLI and the compiled startup check. The image builds its own copy.

## 3. Make the live environment file

```
cp .env.live.example .env.live
chmod 600 .env.live
```

Fill every active line in `.env.live` (the ones without a leading `#`). Make each secret on the server, at least 32 random characters, all different:

```
openssl rand -base64 48 | tr -d '\n' ; echo        # run three times: JWT_SECRET, PLATFORM_SETTINGS_KEY, REVALIDATE_SECRET
```

- `V3_DOMAIN` is the live domain only (no `https://`, no path). `FRONTEND_URL`, `PUBLIC_APP_URL` and `PUBLIC_API_URL` are `https://` addresses on it; `SITE_BASE_DOMAIN` is it or a subdomain.
- `DATABASE_URL` is the pooled connection of the live database, `DIRECT_URL` the direct one. **Never a staging or test database**: the check refuses them by name and by the staging project's hash.
- `SERVER_IP` is the server's public IPv4 address (custom domains point at it).
- `V3_API_SUBNET` and `V3_API_IP` (optional, commented in the example): the private network of the container and its fixed address. The defaults are `172.28.30.0/24` and `172.28.30.10`; change them only if they clash with another network on the server (`docker network ls`, `ip route`).
- `TRUSTED_PROXIES`: the address nginx connects from, as the container sees it. The host's nginx reaches the container through the private network's gateway, which is the first address of the subnet: `172.28.30.1` with the defaults. Check it after the first start:
  ```
  docker network inspect get4domain-v3live_v3live_net --format '{{(index .IPAM.Config 0).Gateway}}'
  ```
  If the public site's server also calls the API from another machine, add that machine's address.
- Leave every sending and spending switch **unset** (section 9).

Load the file into your shell for the scripts below (nothing is printed):

```
set -a; . ./.env.live; set +a
node scripts/live/check-live-env.js
```

Expect: `The live environment is complete: no missing or placeholder variable, no staging or test database.` Any fault is listed by name; fix it and run it again.

## 4. Backup directory and passphrase (once)

```
umask 077
openssl rand -base64 48 > /srv/get4domain/backup-passphrase.txt     # keep a copy OFF this server (a password manager); without it no backup can be opened
chmod 600 /srv/get4domain/backup-passphrase.txt
```

Add to `.env.live` (the API ignores them; the backup script reads them): `BACKUP_DIR=/srv/get4domain/backups`, `BACKUP_PASSPHRASE_FILE=/srv/get4domain/backup-passphrase.txt`, `BACKUP_KEEP=14` (optional). Re-run `set -a; . ./.env.live; set +a`.

## 5. Back up before every change

```
node scripts/live/backup-live-db.js
```

Expect `Backup written: v3live-<UTC time>.dump.enc (... KiB), verified. Rotated out: N.` A backup that cannot be decrypted and read back is deleted and the script fails; do not go on until it succeeds. Do this **before step 6 whenever the database already holds data**.

## 6. Migrations: the live database only

**This section is for LATER releases.** On a new, empty live database do the schema baseline first (section 6a): it applies the schema and marks every migration applied, so the first run of this section finds nothing pending.

```
npm run verify:migrations
npm run verify:raw-sql
node scripts/live/migrate-live.js status        # lists what is pending; changes nothing (a pending migration makes the exit code non-zero)
node scripts/live/migrate-live.js deploy        # applies the pending migrations in order; asks you to type LIVE
node scripts/live/migrate-live.js status        # expect: Database schema is up to date
node scripts/live/migrate-live.js drift         # expect exit 0 and "No difference detected"
node scripts/live/migrate-live.js rls           # expect: Every public table has row level security on.
```

All migrations are additive. There are no down migrations: the way back is the restore in section 11. If `deploy` stops partway, **do not re-run it blindly**: read the error, run `status`, and restore from the backup of step 5 if the schema is half applied.

## 6a. The schema baseline for an EMPTY live database (new Supabase project)

Why: the early migration history cannot be replayed on an empty database, so `migrate deploy` cannot build one. Instead the structure of STAGING (which has every migration applied and no unexpected drift) is dumped once and applied to the empty live database; then every migration folder is marked as applied, so later releases are ordinary `migrate-live deploy` runs. This is done **once**, on a database with **no tables**.

**Before step A**, staging must be at the head of THIS checkout: `npm run db:staging:migrate-status` (none pending) and `npm run db:staging:drift` (no drift beyond the allowed items). The migration `20261219200000_v3_wave2_index_name_63` must be applied to staging first. Step A checks both again and refuses if either fails.

**Step A: on the owner's PC** (needs `pg_dump` of the same major version as staging, and `npm ci` in this checkout):

```
cd backend-api
node scripts/live/dump-staging-schema.js
```

It asks for the **direct** connection string of the STAGING database (port 5432) at a prompt that does not echo. It is not read from an argument, a file or the environment, and it is never printed or stored. It refuses production and the live project (only the staging project is accepted), checks `prisma migrate status` and the drift, and then runs this for you (shown so you can run it by hand if you prefer; use the `PG*` variables, not a connection string on the command line):

```
pg_dump --schema-only --no-owner --no-privileges --schema=public --exclude-table=public._prisma_migrations > live-baseline/staging-schema.sql
```

The public schema only (not Supabase's own schemas), and not the `_prisma_migrations` table (Prisma makes it when the folders are marked applied). It writes `live-baseline/staging-schema.sql` and `live-baseline/staging-schema.manifest.json` (a table count, the number of migration folders and a hash). **The folder `backend-api/live-baseline/` is in `.gitignore`: it is never committed and never printed.** The script prints counts only, for example `Schema dumped: 150 tables, 6x migration folders, 2 documented drift item(s) in staging.`

Copy the two files to the machine that will run step B (a private copy, for example `scp`), into the same folder name, and delete them from both machines once the baseline is verified.

**Step B: on the machine that has `.env.live`** (needs `psql`, `npm ci` and `npm run build`):

```
set -a; . ./.env.live; set +a
node scripts/live/check-live-env.js
node scripts/live/baseline-live.js
```

In this order, stopping at the first failure and saying which step failed:

1. The same refusals as `migrate-live`: a staging, test or local database, a placeholder, a missing connection.
2. The schema file must be a schema-only dump (no data statement, no `DROP` or `TRUNCATE`, no role or database statement, no other schema, no psql command) and must match step A's manifest (hash and table count) and this checkout's number of migration folders.
3. **The database must be empty**: no table in `public` and no migration history table. A database that has either is refused **before anything is changed** and before the prompt.
4. You type `LIVE`.
5. **Extensions.** The schema needs `pgcrypto`, `uuid-ossp` and `pg_trgm` in the schema `extensions` (a Supabase project has that schema, and usually the first two already). The script creates only the missing ones. `pg_trgm` is needed by the directory name search index (migration `20261107100000_v3_directory`); `pgcrypto` and `uuid-ossp` by id and hash defaults.
6. The schema is applied by `psql --single-transaction` with `ON_ERROR_STOP`: all of it or none of it.
7. The table count must equal the manifest; then every migration folder is marked applied, oldest first (`prisma migrate resolve --applied <folder>` for each).
8. The row level security check (no public table without it) and the drift check run.

It prints counts only, for example `Baseline done: 150 tables, 1 extension(s) created, N of N migrations marked applied, 0 tables without row level security, 2 documented drift item(s), 0 unexpected.`

**The two documented drift items** are intentional and the drift check allows exactly these and nothing else (see `scripts/staging/drift-allowlist.js`, `B2_LOG.md`): the `pg_trgm` index `g4d_directory_businesses_name_trgm_idx` (Prisma cannot express an operator-class index) and the generated column `searchVector` on `g4d_directory_businesses` (declared `Unsupported("tsvector")`). Both come across in the dump, so the live drift check reports the same two items as staging. Any third difference fails the baseline.

**How to verify afterwards** (each is read only):

```
node scripts/live/migrate-live.js status     # expect: Database schema is up to date
node scripts/live/migrate-live.js drift      # expect only the two allowed items (it prints a diff of exactly those; any other statement is a fault)
node scripts/live/migrate-live.js rls        # expect: Every public table has row level security on.
```

and compare the table count printed by step A with the one printed by step B (they must be equal: step B checks it itself).

**If step B stops after the schema was applied** (a failed table count or a failed mark): do not repair it by hand. The database is no longer empty, so a second run refuses. Delete the Supabase project, create a new one, update `.env.live`, and start step B again. If it stopped before the schema was applied (steps 1 to 5), nothing was written: fix the cause and run it again.

## 7. Load the reference data (dry run first, then apply)

Each loader is idempotent: a row that exists is never changed, nothing is deleted, and a dry run is the default. In this order:

```
node scripts/gen-catalogue-categories.js --check                         # offline: expect "up to date (196 categories)"
for s in seed-v3-plans seed-v3-wallet-settings seed-v3-pay-settings seed-v3-services seed-v3-terms seed-v3-alert-rules seed-v3-mail-rules seed-v3-directory seed-v3-pack-engine seed-v3-pack-tab-fields seed-v3-profile-fields seed-v3-catalogue-categories; do
  echo "== $s (dry run)"; node scripts/live/seed-live.js $s.js || break
done
```

Read the counts of each dry run. Then apply them one by one (each asks you to type `LIVE`):

```
node scripts/live/seed-live.js seed-v3-plans.js --apply
node scripts/live/seed-live.js seed-v3-wallet-settings.js --apply
node scripts/live/seed-live.js seed-v3-pay-settings.js --apply
node scripts/live/seed-live.js seed-v3-services.js --apply
node scripts/live/seed-live.js seed-v3-terms.js --apply
node scripts/live/seed-live.js seed-v3-alert-rules.js --apply
node scripts/live/seed-live.js seed-v3-mail-rules.js --apply
node scripts/live/seed-live.js seed-v3-directory.js --apply
node scripts/live/seed-live.js seed-v3-pack-engine.js --apply
node scripts/live/seed-live.js seed-v3-pack-tab-fields.js --apply
node scripts/live/seed-live.js seed-v3-profile-fields.js --apply
node scripts/live/seed-live.js seed-v3-catalogue-categories.js --apply
```

Run each dry run again afterwards: it must say there is nothing left to create. Prices stay PENDING and tier rules stay as proposed until you set them in the admin app.

## 8. Build and start the API

```
docker compose -f docker-compose.v3live.yml --env-file .env.live up -d --build
docker compose -f docker-compose.v3live.yml --env-file .env.live ps          # State: running, Health: healthy (after about a minute)
docker compose -f docker-compose.v3live.yml --env-file .env.live logs --tail=50 api
```

If the container stops at once, the log lists the faults of the startup check by name (never a value): fix `.env.live` and run the same `up -d` again.

Create the first administrator (once; it asks at the prompt and prints nothing secret):

```
docker compose -f docker-compose.v3live.yml --env-file .env.live run --rm -it api node scripts/bootstrap-super-admin.js
```

It refuses to run if any administrator exists, takes no arguments, and needs a terminal. Password rule: 12 to 72 characters with a lower case letter, a capital, a number and a symbol.

nginx: one server block for `api.<V3_DOMAIN>` (certificate by your usual way) that proxies to `http://172.28.30.10:3008` (the container's address, `V3_API_IP`), sets `proxy_set_header Host $host;`, `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`, `proxy_set_header X-Forwarded-Proto $scheme;`, and **passes `Access-Control-Expose-Headers` through** (downloads keep their file name only if it is not stripped). Reload nginx.

## 9. Health checks (read only)

```
curl -fsS http://172.28.30.10:3008/health                   # {"status":"ok",...}  the process is up (from the host, by the container address)
curl -fsS http://172.28.30.10:3008/health/ready             # {"status":"ready","database":"up",...}  the database answers
curl -fsS https://api.<V3_DOMAIN>/health/ready              # the same through nginx and TLS
curl -fsS https://api.<V3_DOMAIN>/v3/public/firm            # the company profile answers
curl -sI -H "Origin: https://<V3_DOMAIN>" https://api.<V3_DOMAIN>/v3/public/firm | grep -i expose     # Access-Control-Expose-Headers: Content-Disposition
docker inspect --format '{{.State.Health.Status}}' get4domain_v3live_api                              # healthy
docker port get4domain_v3live_api                              # must print NOTHING: no port is published to the host
ss -ltn | grep ':3008 ' || echo "nothing listens on 3008 on the host (correct)"
```

Then, from the admin app, sign in as the first SUPER_ADMIN, and check `GET /v3/admin/seeded-sites/categories` (total 200) and `GET /v3/me/media/limits` (answers `configured: false` until the upload settings are set).

## 10. Everything that stays OFF until the owner enables it

Nothing below is on after this runbook. Each is switched on deliberately, one at a time, and checked.

| What | Where it is set | Off means | To switch on |
|---|---|---|---|
| System and vendor mail (claim code, password reset, notices) | env `EMAIL_LIVE_SEND` | unset or not `true`: nothing is sent; the claim code and reset routes answer `MAIL_DISABLED` (503) | set `EMAIL_LIVE_SEND=true` and a real `RESEND_API_KEY` and `RESEND_FROM_EMAIL`; restart |
| Enquiry forwarding to vendors' own mailboxes | env `EMAIL_FORWARD_LIVE` | not forwarded | set to `true` after mail is proven |
| SMS | env `SMS_LIVE_SEND`, env `SMS_LIVE_ENABLED` and the plan setting `smsAdapterMode` | sandbox: messages are kept, nothing is sent | DLT entity, sender and template ids first, then all three |
| Order messages | env `MESSAGING_LIVE_ENABLED` | sandbox (note: no live adapter exists in this build; `true` makes them fail) | leave off |
| WhatsApp | env `WHATSAPP_PROVIDER` | `sandbox`: nothing is sent | `cloud` plus the Meta credentials, after approval |
| Vendors' own payment gateways | env `VENDOR_GATEWAY_LIVE_ENABLED`, `VENDOR_GATEWAY_WEBHOOK_ENABLED` | UPI-only recording; no gateway money | after counsel and the accountant agree |
| Domain search and purchase at the registrar | env `REGISTRAR_LIVE_SEARCH`, `REGISTRAR_LIVE_PURCHASE` | no real search, no purchase, no money spent | credentials and a test registration first |
| Directory pages in search engines | plan setting `directoryPagesIndexable` (default `false`) | every directory page says noindex and the sitemaps are empty | SUPER_ADMIN, after counsel approves the wording |
| Unclaimed listings in search engines | plan setting `directoryIndexUnclaimed` (default `false`) and the seeded indexing mode (`PUT /v3/admin/seeded-sites/indexing-mode`, `OFF` or `QUALITY`, SUPER_ADMIN, reason required) | not indexed | same approval |
| Add-on pack prices, mailbox prices, domain margins | admin app (PENDING or PROPOSED until a SUPER_ADMIN approves) | the UI shows no number | approve each |
| Razorpay live keys for plans and wallet top-ups | env `RAZORPAY_*` | no real payment | the V3 plans must be created in Razorpay first |
| AI providers | env `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` | no live model calls | set when wanted |
| Development switches | `OTP_DEV_ECHO`, `THROTTLE_DISABLED`, `EMAIL_MODE=test` | the API **refuses to start** if any is on | never |

## 11. Rollback and restore

**The code (the image).** Migrations are additive, so the previous image runs against the new schema.

```
docker compose -f docker-compose.v3live.yml --env-file .env.live ps                  # note the running image
docker tag get4domain-api:v3live get4domain-api:before-<date>                         # before every deploy
# to go back: set V3_API_IMAGE=get4domain-api:before-<date> in .env.live, then
docker compose -f docker-compose.v3live.yml --env-file .env.live up -d --no-build
```

**The data (a restore).** Never restore over the live database. Restore into a NEW database, check it, and switch to it.

```
docker compose -f docker-compose.v3live.yml --env-file .env.live stop api                         # stop writes
node scripts/live/backup-live-db.js                                                                # keep the current state too, if the database still answers
ls -1 "$BACKUP_DIR"                                                                                # choose the backup: v3live-<UTC time>.dump.enc
# create an empty database on the server (your provider's console) and give its connection as PG* variables for this shell only:
export PGHOST=<new host> PGPORT=5432 PGUSER=<user> PGDATABASE=<new empty database> PGSSLMODE=require
read -rs PGPASSWORD; export PGPASSWORD                                                              # typed, not shown, not in history
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -pass file:"$BACKUP_PASSPHRASE_FILE" -in "$BACKUP_DIR/<chosen file>" | pg_restore --no-owner --no-acl --exit-on-error --dbname "$PGDATABASE"
psql -c "select count(*) from \"Vendor\"" -c "select count(*) from \"_prisma_migrations\""      # compare with what you expect
unset PGPASSWORD
```

Then put the new database's `DATABASE_URL` and `DIRECT_URL` in `.env.live`, run `node scripts/live/check-live-env.js`, `node scripts/live/migrate-live.js status` (expect up to date) and `rls`, and start the API (`up -d`). Check section 9 again. Keep the old database untouched until you are sure.

**Practise it.** Do the restore into a scratch database once before go-live and once a month after, and write down the time it took. A backup that was never restored is not yet a backup.

## 12. Backups every day

```
crontab -e
15 2 * * *  cd /srv/get4domain/app/backend-api && set -a && . ./.env.live && set +a && node scripts/live/backup-live-db.js >> /var/log/get4domain-backup.log 2>&1
```

The script prints one line (file name, size, how many were rotated out) and never a connection or a passphrase. Check the log each week, and copy the newest file off the server (the server's own disk is not a backup).

## 13. What was tested, and what was not

Tested by the unit suite: the startup check (every required name, placeholders, short secrets, domain and https rules, staging by name and by hash, no value in any message), the example file (complete, no values), the bootstrap (creates once, refuses a second, never prints the password, refuses a weak one, no argument, no file), the backup's pure parts (connection handling, names, rotation, masking), the live migrate and seed doors (refuse a staging database, need `LIVE`), and the compose and Docker files (read as text: non-root, health check, loopback port, no value).
**Not run:** the Docker build (no Docker on the build machine), `pg_dump`, `psql` and `openssl` themselves, step A against staging, step B against any database, a real restore, the migrations and loaders against a live database, and the nginx block. The baseline's order and refusals (empty database, schema file, manifest, extensions, table count, marking order, checks) are tested with injected functions. The first real run is the owner's, in the order above.
