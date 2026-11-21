# RUNBOOK: put V3 on the v3live container (E1d)

**Nothing in this runbook has been run.** It was written and statically tested without a server, Docker, a database or a network. The first real run is the owner's. Where a step is doubtful it says so.

It replaces sections 2, 6a and 8 of `docs/v3/V3_LIVE_ENVIRONMENT.md` for this container (that file assumes a Supabase database, a build on the host and a bridge address nginx cannot reach). Its sections 5 (backup), 6 (later migrations), 9 (health), 10 (what stays off) and 11 (restore) still apply. Reasons and the shape are in `docs/v3/DEPLOY_V3LIVE_PLAN.md`.

## How to read it

Three windows. **Every block starts with the window it runs in.** One command per block.

| Label | Window | Prompt |
|---|---|---|
| **PC** | PowerShell on the owner's PC, in `C:\Get4Domain\get4domain-w2\backend-api` | `PS C:\...>` |
| **HOST** | the Contabo server | `root@vmi3551049:~#` |
| **CONTAINER** | inside the LXD container | `root@v3live:~#` |

Marks: **[OWNER]** needs the owner's decision or a value only the owner has. **[SECRET]** touches a secret; the command never prints it. **[ROLLBACK]** says how to undo the step.

Nothing here touches the wildcard `*.get4domain.com`, the V2 sites, the V2 database, or the public flag (it stays OFF). `{PLACEHOLDERS}` in braces are for you to replace; they are never real values in this file.

## Before you start: five things to have in hand

1. **[OWNER]** Where the three repos live on GitHub (their addresses), and permission to add one read-only deploy key to each.
2. **[OWNER]** The name of the Postgres container (step 4 shows it) and that the database `get4domain_v3`, user `g4d_live` and the file `/opt/v3live/secrets/pg_password` exist.
3. **[OWNER]** The path of the TLS certificate and key that nginx uses today for `*.get4domain.com` (step 31 shows it).
4. **[OWNER]** The server's public IPv4 address (`SERVER_IP`).
5. **[OWNER]** The R2 keys and Resend keys are **not** needed for the first start. Media uploads and mail stay off until they are set (`V3_LIVE_ENVIRONMENT.md` section 10).

---

# PART A. The container and the source

### 1. HOST: confirm the container is running and read its address
```
lxc list v3live -c ns4 --format csv
```
Expect `v3live,RUNNING,<address> (eth0)`. **Write the address down: it is `V3_BIND_IP`.** [ROLLBACK] none (read only).

### 2. HOST: read the LXD bridge subnet (nginx connects from it)
```
lxc network list --format csv | cut -d, -f1,3
```
Find the bridge `v3live` is on (usually `lxdbr0`), then:
```
lxc network get lxdbr0 ipv4.address
```
**Write down the subnet** (for example `10.x.x.1/24`). It goes into `TRUSTED_PROXIES` in step 9.

### 3. HOST: enter the container (this window becomes CONTAINER from here)
```
lxc exec v3live -- bash
```

### 4. CONTAINER: find the Postgres container name and the Docker network subnets
```
docker ps --format '{{.Names}}  {{.Image}}  {{.Ports}}'
```
**Write down the Postgres container's name: it is `{PG_CONTAINER_NAME}`.** The API must reach the database **by this name, never by its IP** (the startup check refuses private IPs).
```
docker network inspect v3net --format '{{(index .IPAM.Config 0).Subnet}}'
```
Write down the `v3net` subnet. Then:
```
docker network inspect bridge --format '{{(index .IPAM.Config 0).Subnet}}'
```
Write down the default bridge subnet too (traffic published by Docker can appear to come from its gateway).

### 5. CONTAINER: make the folders
```
mkdir -p /opt/v3live/src /opt/v3live/env /opt/v3live/secrets/deploy_keys /opt/v3live/secrets/ops /opt/v3live/ops-backups /opt/v3live/live-baseline && chmod 700 /opt/v3live/env /opt/v3live/secrets /opt/v3live/secrets/deploy_keys /opt/v3live/secrets/ops
```
[ROLLBACK] `rm -rf` of the folders you made (nothing else lives in `src`, `env`, `deploy_keys`, `ops`, `ops-backups`, `live-baseline`; do not remove `/opt/v3live/secrets/pg_password`, `/opt/v3live/postgres` or `/opt/v3live/backups`).

### 6. CONTAINER: make three read-only deploy keys [OWNER] [SECRET]
One command per key (no passphrase, because the server pulls unattended; each key can read one repo only).
```
ssh-keygen -t ed25519 -N "" -C "v3live-backend-readonly" -f /opt/v3live/secrets/deploy_keys/backend
```
```
ssh-keygen -t ed25519 -N "" -C "v3live-apps-readonly" -f /opt/v3live/secrets/deploy_keys/apps
```
```
ssh-keygen -t ed25519 -N "" -C "v3live-site-readonly" -f /opt/v3live/secrets/deploy_keys/site
```
Show each **public** key (the `.pub` file is meant to be shared; the private file is never shown):
```
cat /opt/v3live/secrets/deploy_keys/backend.pub
```
**[OWNER]** On GitHub: the backend repo, Settings, Deploy keys, Add deploy key, paste, **leave "Allow write access" OFF**. Repeat for `apps.pub` and `site.pub` on their repos.

Tell ssh which key goes with which repo:
```
printf 'Host gh-backend\n  HostName github.com\n  User git\n  IdentityFile /opt/v3live/secrets/deploy_keys/backend\n  IdentitiesOnly yes\nHost gh-apps\n  HostName github.com\n  User git\n  IdentityFile /opt/v3live/secrets/deploy_keys/apps\n  IdentitiesOnly yes\nHost gh-site\n  HostName github.com\n  User git\n  IdentityFile /opt/v3live/secrets/deploy_keys/site\n  IdentitiesOnly yes\n' >> /root/.ssh/config
```
```
chmod 600 /root/.ssh/config
```
(If `/root/.ssh` does not exist: `mkdir -p /root/.ssh && chmod 700 /root/.ssh` first.) [ROLLBACK] delete the three keys on GitHub and the files in `deploy_keys`.

*Fallback if the owner does not want keys on the server:* on the PC run `git archive --format=tar.gz -o backend.tar.gz HEAD` in each repo, `scp` the three files to the HOST, `lxc file push` them into `/opt/v3live/src/`, and unpack to the same three folders. Everything after step 7 is unchanged; type the release tag by hand in step 10.

### 7. CONTAINER: clone the three repos
```
git clone git@gh-backend:{OWNER}/{BACKEND_REPO}.git /opt/v3live/src/backend
```
```
git clone git@gh-apps:{OWNER}/{APPS_REPO}.git /opt/v3live/src/apps
```
```
git clone git@gh-site:{OWNER}/{SITE_REPO}.git /opt/v3live/src/site
```
The first connection asks to trust github.com's fingerprint: compare it with the one GitHub publishes, then answer `yes`.

Check out the **release** of each (the backend branch must contain `deploy/v3live/`; the one this runbook came from is `v3-pack`):
```
git -C /opt/v3live/src/backend checkout {BACKEND_RELEASE_BRANCH_OR_TAG}
```
```
git -C /opt/v3live/src/apps checkout {APPS_RELEASE_BRANCH_OR_TAG}
```
```
git -C /opt/v3live/src/site checkout {SITE_RELEASE_BRANCH_OR_TAG}
```
Each tree must be clean, and write the three commits down (they go in the release notes):
```
for r in backend apps site; do echo "== $r"; git -C /opt/v3live/src/$r status --short; git -C /opt/v3live/src/$r log --oneline -1; done
```
Nothing may be listed under `status`. [ROLLBACK] `git checkout {previous}`; the clones can be deleted and redone.

---

# PART B. Environment files

### 8. CONTAINER: create the four env files from the templates [SECRET]
```
cp /opt/v3live/src/backend/deploy/v3live/env/compose.env.example /opt/v3live/env/compose.env && cp /opt/v3live/src/backend/deploy/v3live/env/api.env.example /opt/v3live/env/api.env && cp /opt/v3live/src/backend/deploy/v3live/env/site.env.example /opt/v3live/env/site.env && cp /opt/v3live/src/backend/deploy/v3live/env/site.build.env.example /opt/v3live/env/site.build.env && chmod 600 /opt/v3live/env/*.env
```
Generate the secrets on the server. Each command writes into the file and **prints nothing**:
```
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 32)|" /opt/v3live/env/api.env
```
```
sed -i "s|^PLATFORM_SETTINGS_KEY=.*|PLATFORM_SETTINGS_KEY=$(openssl rand -hex 32)|" /opt/v3live/env/api.env
```
```
sed -i "s|^REVALIDATE_SECRET=.*|REVALIDATE_SECRET=$(openssl rand -hex 32)|" /opt/v3live/env/api.env
```
The public site must hold the **same** `REVALIDATE_SECRET`:
```
sed -i "s|^REVALIDATE_SECRET=.*|REVALIDATE_SECRET=$(grep '^REVALIDATE_SECRET=' /opt/v3live/env/api.env | cut -d= -f2-)|" /opt/v3live/env/site.env
```
```
sed -i "s|^DEMO_ACCESS_SECRET=.*|DEMO_ACCESS_SECRET=$(openssl rand -hex 32)|" /opt/v3live/env/site.env
```
The database password comes from the existing file, never typed. First confirm it is safe to place in a URL (letters and digits only):
```
grep -Eq '^[A-Za-z0-9]+$' /opt/v3live/secrets/pg_password && echo "password is URL-safe" || echo "NOT URL-safe: percent-encode it by hand"
```
If it printed `password is URL-safe`:
```
sed -i "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://g4d_live:$(cat /opt/v3live/secrets/pg_password)@{PG_CONTAINER_NAME}:5432/get4domain_v3?sslmode=disable|; s|^DIRECT_URL=.*|DIRECT_URL=postgresql://g4d_live:$(cat /opt/v3live/secrets/pg_password)@{PG_CONTAINER_NAME}:5432/get4domain_v3?sslmode=disable|" /opt/v3live/env/api.env
```
[ROLLBACK] before any change to an env file: `cp /opt/v3live/env/api.env /opt/v3live/env/api.env.$(date +%Y%m%d%H%M%S)`; restore by copying back.

### 9. CONTAINER: fill the remaining names by hand [OWNER]
Open each file and fill every active line that is still empty (nothing here is a secret except where marked). `nano` shows the file; save with Ctrl+O, leave with Ctrl+X.
```
nano /opt/v3live/env/compose.env
```
`IMAGE_TAG` is set in step 11. `V3_BIND_IP` = step 1. `API_PUBLIC_URL` = `https://api.get4domain.com`. `STORAGE_BASE_URL` stays empty until a media host exists.
```
nano /opt/v3live/env/api.env
```
| Name | Value |
|---|---|
| `V3_DOMAIN` | `get4domain.com` |
| `SITE_BASE_DOMAIN` | `get4domain.com` (**[OWNER]**: the vendors' site domain; this decides where `vendorname.` sites live) |
| `FRONTEND_URL` | `https://get4domain.com` (**[OWNER]**: where e-mail links to the public site point; the main site stays on V2 until switched) |
| `PUBLIC_APP_URL` | `https://app.get4domain.com` |
| `PUBLIC_API_URL` | `https://api.get4domain.com` |
| `DIRECTORY_PUBLIC_BASE_URL` | `https://directory.get4domain.com` |
| `FRONTEND_INTERNAL_URL` | `http://g4d-v3-site:3006` |
| `SERVER_IP` | the public IPv4 (**[OWNER]**) |
| `TRUSTED_PROXIES` | the LXD bridge subnet (step 2), the `v3net` subnet and the default bridge subnet (step 4), comma separated, no spaces |
| `CORS_EXTRA_ORIGINS` | `https://app.get4domain.com,https://admin.get4domain.com,https://partner.get4domain.com,https://get4domain.com` |
| `APP_VERSION`, `GIT_COMMIT` | the release tag and the backend commit from step 7 |

Leave the R2 names empty for now. Leave **every `false` as `false`**.
```
nano /opt/v3live/env/site.env
```
| Name | Value |
|---|---|
| `API_BASE_URL`, `INTERNAL_API_URL` | `http://g4d-v3-api:3008` |
| `MAIN_HOST` | `get4domain.com` |
| `DIRECTORY_HOST` | `directory.get4domain.com` |
| `APP_HOST`, `ADMIN_HOST`, `API_HOST` | `app.get4domain.com`, `admin.get4domain.com`, `api.get4domain.com` |
| `MEDIA_HOST` | empty until a media host exists |
| `V3_PUBLIC_SITE_ORIGIN` | `https://get4domain.com` |
| `NEXT_PUBLIC_SITE_BASE_DOMAIN` | the same as `SITE_BASE_DOMAIN` |
| `NEXT_PUBLIC_VENDOR_APP_URL` | `https://app.get4domain.com` |
| the six `V3_PUBLIC_*` firm-contact names | **[OWNER]** support e-mail and phone, grievance officer name, e-mail and phone, the firm's CIN. Empty means the page prints nothing for it. |

Keep `V3_PUBLIC_ENABLED=false` and `V3_PUBLIC_USE_MOCKS=false`.
```
nano /opt/v3live/env/site.build.env
```
`NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_API_BASE_URL` = `https://api.get4domain.com`; `NEXT_PUBLIC_SITE_BASE_DOMAIN` as above; `NEXT_PUBLIC_SITE_URL` = `https://get4domain.com`; `NEXT_PUBLIC_VENDOR_APP_URL` = `https://app.get4domain.com`. The Razorpay public key, VAPID, analytics and contact names stay empty until used. **These are baked into the build: changing one means rebuilding the site image (step 17).**

### 10. CONTAINER: no value may still be missing
```
grep -n -E '^(V3_DOMAIN|DATABASE_URL|DIRECT_URL|JWT_SECRET|PLATFORM_SETTINGS_KEY|REVALIDATE_SECRET|SITE_BASE_DOMAIN|TRUSTED_PROXIES|FRONTEND_URL|PUBLIC_APP_URL|PUBLIC_API_URL|SERVER_IP)=$' /opt/v3live/env/api.env | sed 's/=$/ IS EMPTY/'
```
It must print nothing. (This prints names only. The real check is step 15.)

---

# PART C. Build the images

Build **one at a time** (2 CPUs, 6 GiB shared with Postgres). Each build runs from a clean, committed tree. Watch the first one for an error: **none of these builds has been run before** (no Docker on the build machine).

### 11. CONTAINER: set the release tag and keep it
```
export IMAGE_TAG="$(date +%Y%m%d)-$(git -C /opt/v3live/src/backend rev-parse --short HEAD)"; echo "$IMAGE_TAG"
```
```
sed -i "s|^IMAGE_TAG=.*|IMAGE_TAG=$IMAGE_TAG|" /opt/v3live/env/compose.env
```
(If you open a new shell later, run the `export` line again.)

### 12. CONTAINER: check disk and memory before building
```
df -h / && free -m
```
Need roughly 10 GB free. If memory is short, build while the apps are stopped. [ROLLBACK] `docker image prune` removes dangling layers only (never remove an image still in use).

### 13. CONTAINER: build the operator image (also the first proof that the API builds)
```
cd /opt/v3live/src/backend && docker build -f deploy/v3live/api/Dockerfile --target ops -t get4domain-v3-ops:$IMAGE_TAG .
```
If this stops at `npm run build`, copy the last 30 lines of the error to the owner. Do not edit the Dockerfile on the server.

### 14. CONTAINER: build the API image
```
cd /opt/v3live/src/backend && docker build -f deploy/v3live/api/Dockerfile --target runner -t get4domain-v3-api:$IMAGE_TAG .
```

### 15. CONTAINER: check the environment with the real startup check
```
docker run --rm --network v3net --env-file /opt/v3live/env/api.env get4domain-v3-ops:$IMAGE_TAG node scripts/live/check-live-env.js
```
Expect `The live environment is complete: no missing or placeholder variable, no staging or test database.` Any fault is listed **by name**; fix it in `api.env` (step 9) and run it again. A fault about the database is usually step 8's host name: it must be the container name.

### 16. CONTAINER: build the three SPAs (two builds each: the apps repo's image, then the non-root wrapper)
```
cd /opt/v3live/src/apps && docker build -f apps/vendor/Dockerfile -t get4domain-vendor-base:$IMAGE_TAG .
```
```
docker build -f /opt/v3live/src/backend/deploy/v3live/spa/Dockerfile --build-arg BASE_IMAGE=get4domain-vendor-base:$IMAGE_TAG -t get4domain-v3-vendor:$IMAGE_TAG /opt/v3live/src/backend/deploy/v3live/spa
```
```
cd /opt/v3live/src/apps && docker build -f apps/admin/Dockerfile -t get4domain-admin-base:$IMAGE_TAG .
```
```
docker build -f /opt/v3live/src/backend/deploy/v3live/spa/Dockerfile --build-arg BASE_IMAGE=get4domain-admin-base:$IMAGE_TAG -t get4domain-v3-admin:$IMAGE_TAG /opt/v3live/src/backend/deploy/v3live/spa
```
```
cd /opt/v3live/src/apps && docker build -f apps/partner/Dockerfile -t get4domain-partner-base:$IMAGE_TAG .
```
```
docker build -f /opt/v3live/src/backend/deploy/v3live/spa/Dockerfile --build-arg BASE_IMAGE=get4domain-partner-base:$IMAGE_TAG -t get4domain-v3-partner:$IMAGE_TAG /opt/v3live/src/backend/deploy/v3live/spa
```
The wrapper's `RUN` fails the build on purpose if the `listen 80` or `pid` line it edits is not where it expects: that is a signal the apps repo's nginx file changed; report it, do not work around it.

### 17. CONTAINER: build the public site image
```
set -a; . /opt/v3live/env/site.build.env; set +a
```
```
cd /opt/v3live/src/site && docker build -f /opt/v3live/src/backend/deploy/v3live/site/Dockerfile --build-arg NEXT_PUBLIC_API_URL --build-arg NEXT_PUBLIC_API_BASE_URL --build-arg NEXT_PUBLIC_SITE_BASE_DOMAIN --build-arg NEXT_PUBLIC_SITE_URL --build-arg NEXT_PUBLIC_VENDOR_APP_URL --build-arg NEXT_PUBLIC_RAZORPAY_KEY_ID --build-arg NEXT_PUBLIC_VAPID_KEY --build-arg NEXT_PUBLIC_GA_MEASUREMENT_ID --build-arg NEXT_PUBLIC_PHONE --build-arg NEXT_PUBLIC_EMAIL --build-arg NEXT_PUBLIC_WHATSAPP -t get4domain-v3-site:$IMAGE_TAG .
```
(A `--build-arg NAME` with no value takes it from the shell, which step 17's first block set.) [ROLLBACK for the whole part] images are only added; the old tag stays. Remove a bad one with `docker rmi get4domain-v3-<name>:$IMAGE_TAG`.

---

# PART D. The database

The live database is **empty**. These steps make its schema, then load the reference data. Never run any of them against another database: the scripts refuse staging, test and local names, but read the host before pressing Enter.

### 18. CONTAINER: the shell helper for the operator image (run once per shell)
```
ops() { docker run --rm -it --network v3net --env-file /opt/v3live/env/api.env -e BACKUP_DIR=/backups -e BACKUP_PASSPHRASE_FILE=/run/secrets/backup_passphrase -v /opt/v3live/live-baseline:/repo/backend-api/live-baseline -v /opt/v3live/ops-backups:/backups -v /opt/v3live/secrets/ops:/run/secrets:ro get4domain-v3-ops:$IMAGE_TAG "$@"; }
```
The operator image runs as uid 1000, so give it its folders:
```
chown -R 1000:1000 /opt/v3live/ops-backups /opt/v3live/live-baseline /opt/v3live/secrets/ops
```

### 19. CONTAINER: can the operator image reach the database?
```
ops sh -c 'psql "$DIRECT_URL" -At -c "select version()"'
```
Expect a line starting `PostgreSQL 17`. If it cannot connect: wrong container name in step 8, or the Postgres container is not on `v3net` (`docker network inspect v3net`).

### 20. CONTAINER: prepare the database for the baseline [OWNER if a permission is refused]
The baseline script expects a schema named `extensions` (a Supabase habit) and creates three extensions in it. Plain Postgres has no such schema, so create it, and put it on the search path so `pg_trgm` and `uuid-ossp` functions work without a prefix:
```
ops sh -c 'psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -c "CREATE SCHEMA IF NOT EXISTS extensions"'
```
```
ops sh -c 'psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -c "ALTER DATABASE get4domain_v3 SET search_path = \"\$user\", public, extensions"'
```
`g4d_live` must own the database. If either command says `permission denied`, the **[OWNER]** runs the same statements as the Postgres administrator: `docker exec -it {PG_CONTAINER_NAME} psql -U {ADMIN_USER} -d get4domain_v3`. [ROLLBACK] `DROP SCHEMA extensions` (empty at this point) and `ALTER DATABASE get4domain_v3 RESET search_path`.

### 21. PC: baseline step A, dump the STAGING schema [OWNER] [SECRET]
Run on the PC, in a checkout at **the same commit as the server's backend** (the dump must match this release's migrations). Staging must be at that commit's head first (`V3_LIVE_ENVIRONMENT.md` section 6a).
```
npm.cmd run db:staging:migrate-status
```
Expect none pending. Then:
```
node scripts/live/dump-staging-schema.js
```
It asks for the **staging** direct connection string at a prompt that does not echo (typed, never stored). It writes `live-baseline\staging-schema.sql` and `staging-schema.manifest.json` (git ignores the folder). It prints counts only.

Copy them to the server (the HOST first, then into the container):
```
scp live-baseline\staging-schema.sql live-baseline\staging-schema.manifest.json root@vmi3551049:/tmp/
```
**HOST:**
```
lxc file push /tmp/staging-schema.sql /tmp/staging-schema.manifest.json v3live/opt/v3live/live-baseline/
```
**CONTAINER:**
```
chown 1000:1000 /opt/v3live/live-baseline/*
```
**HOST**, remove the copy on the host:
```
rm -f /tmp/staging-schema.sql /tmp/staging-schema.manifest.json
```
[ROLLBACK] the files are inert until step 22 runs.

### 22. CONTAINER: baseline step B, apply it to the empty live database [OWNER types LIVE]
```
ops node scripts/live/baseline-live.js
```
It refuses a non-empty database **before** changing anything, asks you to type `LIVE`, creates the three extensions, applies the schema in one transaction, marks every migration applied and checks row level security and drift. It prints counts only, for example `Baseline done: N tables, 3 extension(s) created, M of M migrations marked applied, 0 tables without row level security, 2 documented drift item(s), 0 unexpected.`

If it stops with `could not create the extension`, the **[OWNER]** creates the three as the Postgres administrator (same `docker exec ... psql` as step 20): `CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;` and the same for `"uuid-ossp"` and `pg_trgm`, then runs this step again (it only creates what is missing).

**If it stops after the schema was applied** (table count or marking): do not repair by hand. The database is no longer empty. Drop and recreate the **empty** database (the **[OWNER]** as administrator: `DROP DATABASE get4domain_v3; CREATE DATABASE get4domain_v3 OWNER g4d_live;`), repeat step 20, and run this step again. [ROLLBACK] exactly that.

### 23. CONTAINER: verify the schema (read only), then remove the dump
```
ops node scripts/live/migrate-live.js status
```
Expect `Database schema is up to date`.
```
ops node scripts/live/migrate-live.js drift
```
Expect only the two documented items (`V3_LIVE_ENVIRONMENT.md` section 6a).
```
ops node scripts/live/migrate-live.js rls
```
Expect `Every public table has row level security on.` Then delete the dump copies, here and on the PC:
```
rm -f /opt/v3live/live-baseline/staging-schema.sql /opt/v3live/live-baseline/staging-schema.manifest.json
```
**PC:**
```
Remove-Item live-baseline\staging-schema.sql, live-baseline\staging-schema.manifest.json
```

### 24. CONTAINER: load the reference data (dry run, then apply) [OWNER types LIVE for each]
First the offline check:
```
ops node scripts/gen-catalogue-categories.js --check
```
Expect `up to date (196 categories)`. Dry run of all twelve loaders (changes nothing):
```
for s in seed-v3-plans seed-v3-wallet-settings seed-v3-pay-settings seed-v3-services seed-v3-terms seed-v3-alert-rules seed-v3-mail-rules seed-v3-directory seed-v3-pack-engine seed-v3-pack-tab-fields seed-v3-profile-fields seed-v3-catalogue-categories; do echo "== $s (dry run)"; ops node scripts/live/seed-live.js $s.js || break; done
```
Read the counts. Then apply them in the same order; each asks you to type `LIVE`:
```
for s in seed-v3-plans seed-v3-wallet-settings seed-v3-pay-settings seed-v3-services seed-v3-terms seed-v3-alert-rules seed-v3-mail-rules seed-v3-directory seed-v3-pack-engine seed-v3-pack-tab-fields seed-v3-profile-fields seed-v3-catalogue-categories; do echo "== $s (apply)"; ops node scripts/live/seed-live.js $s.js --apply || break; done
```
Run the dry-run loop again: every loader must say there is nothing left to create. Prices stay PENDING until set in the admin app. [ROLLBACK] each loader only adds rows, and nothing else has been written yet (no administrator, no vendor): the way back is to drop and recreate the empty database as in step 22 and repeat from step 20. After step 27 the way back is a backup (steps 38 and 39).

---

# PART E. Start the apps

### 25. CONTAINER: check the compose file reads cleanly
```
docker compose -f /opt/v3live/src/backend/deploy/v3live/docker-compose.apps.yml --env-file /opt/v3live/env/compose.env config -q && echo compose-ok
```
Expect `compose-ok`. A message about a missing variable names it.

### 26. CONTAINER: start the five apps
```
docker compose -f /opt/v3live/src/backend/deploy/v3live/docker-compose.apps.yml --env-file /opt/v3live/env/compose.env up -d --no-build
```
```
docker compose -f /opt/v3live/src/backend/deploy/v3live/docker-compose.apps.yml --env-file /opt/v3live/env/compose.env ps
```
All five should reach `healthy` within about a minute (the API and site take longest). If the API stops at once, the log lists the startup-check faults by name:
```
docker logs --tail 50 g4d-v3-api
```
[ROLLBACK] `docker compose ... down` (data lives in the named volumes and the database; `down` does not touch them).

### 27. CONTAINER: create the first SUPER_ADMIN [OWNER] [SECRET]
```
ops node scripts/bootstrap-super-admin.js
```
It asks for the e-mail and the password at the prompt (the password is not shown, not stored in any file or history). Password rule: 12 to 72 characters with a lower case letter, a capital, a number and a symbol. It refuses to run if an administrator already exists. [ROLLBACK] none by script; a mistaken first administrator is changed through the admin app or, as a last resort, by restoring a backup (steps 38 and 39).

### 28. CONTAINER: health checks inside the container (read only)
```
curl -fsS http://{V3_BIND_IP}:3008/health
```
```
curl -fsS http://{V3_BIND_IP}:3008/health/ready
```
Expect `{"status":"ready","database":"up",...}`.
```
curl -fsS http://{V3_BIND_IP}:3101/runtime-config.js
```
It must show the API address you set (`https://api...`), not `__API_BASE_URL__`. Repeat for the admin and partner ports:
```
curl -fsS http://{V3_BIND_IP}:3102/runtime-config.js && curl -fsS http://{V3_BIND_IP}:3103/runtime-config.js
```
```
curl -sI http://{V3_BIND_IP}:3101/ | grep -i -E 'content-security|x-frame|x-robots'
```
The container's own CSP must be there. Nothing may be published except on the container address:
```
docker ps --format '{{.Names}}  {{.Ports}}' | grep g4d-v3
```
Every line must show `{V3_BIND_IP}:` in front of each port and no `0.0.0.0`.
```
curl -sI http://{V3_BIND_IP}:3006/manifest.webmanifest | head -1
```
Expect `HTTP/1.1 200`.

---

# PART F. Host nginx, DNS, and the checks per host

The five host names get **explicit** rules; the wildcard `*.get4domain.com` and the V2 names are **not changed**.

### 29. CONTAINER: leave the container (this window becomes HOST again)
```
exit
```

### 30. HOST: back up the nginx configuration [ROLLBACK for this whole part]
```
cp -a /etc/nginx /etc/nginx.bak-$(date +%Y%m%d%H%M%S)
```
**Write down the backup folder's name.** To undo everything in this part: `rm -rf /etc/nginx && cp -a /etc/nginx.bak-<stamp> /etc/nginx && nginx -t && systemctl reload nginx`.

### 31. HOST: look for rules that already use these names [OWNER decides]
```
nginx -T 2>/dev/null | grep -n -E 'server_name'
```
Look for `api.`, `app.`, `admin.`, `partner.`, `directory.` `get4domain.com`. If any of them is **in use by V2 today** (for example a V2 `app.` or `admin.`), **stop and ask the owner**: installing the V3 block would take that name away from V2. The same output shows the certificate paths (`ssl_certificate` lines) used for `*.get4domain.com`: write those two paths down.

### 32. HOST: bring the nginx files over from the container
```
mkdir -p /root/g4d-deploy && lxc file pull -r v3live/opt/v3live/src/backend/deploy/v3live/nginx /root/g4d-deploy/
```
```
cp /root/g4d-deploy/nginx/snippets/*.conf /etc/nginx/snippets/
```
```
sh /root/g4d-deploy/nginx/update-cloudflare-ips.sh
```
It writes `/etc/nginx/snippets/cloudflare-realip.conf` from Cloudflare's own lists (the server must be able to reach `www.cloudflare.com`).

### 33. HOST: make the five server files with the placeholders filled [OWNER gives the values]
Set the three values for this shell (the paths from step 31 and the address from step 1):
```
export V3_BIND_IP={V3_BIND_IP} TLS_CERT={CERT_PATH_FROM_STEP_31} TLS_KEY={KEY_PATH_FROM_STEP_31}
```
```
for h in api app admin partner directory; do sed -e "s|__V3_BIND_IP__|$V3_BIND_IP|g" -e "s|__TLS_CERT__|$TLS_CERT|g" -e "s|__TLS_KEY__|$TLS_KEY|g" /root/g4d-deploy/nginx/$h.get4domain.com.conf > /etc/nginx/sites-available/$h.get4domain.com.conf; done
```
No placeholder may be left:
```
grep -l '__' /etc/nginx/sites-available/api.get4domain.com.conf /etc/nginx/sites-available/app.get4domain.com.conf /etc/nginx/sites-available/admin.get4domain.com.conf /etc/nginx/sites-available/partner.get4domain.com.conf /etc/nginx/sites-available/directory.get4domain.com.conf
```
It must print nothing. (The `mrtravels` and `s2travels` files are **not** installed here; install them only if step 31 showed no rule for those names, with the upstream filled in. `nginx -t` fails on an unfilled one, on purpose.)

### 34. HOST: enable, test, reload (never reload without the test)
```
for h in api app admin partner directory; do ln -sf /etc/nginx/sites-available/$h.get4domain.com.conf /etc/nginx/sites-enabled/$h.get4domain.com.conf; done
```
```
nginx -t
```
It must print `syntax is ok` and `test is successful`. If not, **do not reload**: fix it, or roll back (step 30).
```
systemctl reload nginx
```

### 35. [OWNER] DNS and Cloudflare
The wildcard record already resolves every `*.get4domain.com` name. Check in Cloudflare that `api`, `app`, `admin`, `partner` and `directory` resolve to this server and are **proxied** (orange cloud), and that SSL/TLS mode is **Full (strict)**. Add explicit records only if the wildcard does not exist. [ROLLBACK] remove an explicit record you added.

### 36. PC: health per host (from outside, through Cloudflare, nginx and TLS)
```
curl.exe -fsS https://api.get4domain.com/health/ready
```
Expect `{"status":"ready","database":"up",...}`.
```
curl.exe -fsS https://api.get4domain.com/v3/public/firm
```
The company profile answers (empty fields are fine at this stage).
```
curl.exe -sI -H "Origin: https://app.get4domain.com" https://api.get4domain.com/v3/public/firm
```
Look for `Access-Control-Allow-Origin` and `Access-Control-Expose-Headers: Content-Disposition`, **one** `Strict-Transport-Security`, and `X-Content-Type-Options`.
```
curl.exe -sI https://app.get4domain.com/
```
Expect `200`, **one** `X-Robots-Tag: noindex, nofollow`, a `Content-Security-Policy` naming only the API origin, and no second CSP.
```
curl.exe -sI https://admin.get4domain.com/
```
```
curl.exe -sI https://partner.get4domain.com/
```
Same expectations as `app.`.
```
curl.exe -s https://app.get4domain.com/runtime-config.js
```
It must show `https://api.get4domain.com`.
```
curl.exe -sI https://directory.get4domain.com/
```
With the public flag **off** the new routes answer `404`: that is correct and expected. A `502` or `503` means nginx or the site container is wrong.

Open `https://admin.get4domain.com` in a browser and sign in with the SUPER_ADMIN of step 27. If sign-in fails with a network or CORS error, check `CORS_EXTRA_ORIGINS` (step 9) and `docker logs g4d-v3-api`.

### 37. [OWNER] The day-one admin checklist
Follow the project document **`V3_ADMIN_DAY_ONE_SETUP`** (it is not in this repository's `docs/`; use the owner's copy): set prices, the firm profile, the upload settings, mail, and so on. Nothing sends or charges until the switches in `V3_LIVE_ENVIRONMENT.md` section 10 are turned on, one at a time.

---

# PART G. Backups and restore

The owner's existing nightly encrypted backups in `/opt/v3live/backups` keep running unchanged. This part adds an on-demand backup with the repo's own script into a different folder, and proves a restore.

### 38. CONTAINER: make the backup passphrase for the on-demand backup [SECRET]
```
openssl rand -base64 48 > /opt/v3live/secrets/ops/backup_passphrase && chmod 400 /opt/v3live/secrets/ops/backup_passphrase && chown 1000:1000 /opt/v3live/secrets/ops/backup_passphrase
```
(Run `ops()` of step 18 in this shell first if it is a new one.)

### 39. CONTAINER: take a backup now
```
ops node scripts/live/backup-live-db.js
```
Expect `Backup written: v3live-<UTC time>.dump.enc (... KiB), verified.` A backup that cannot be read back is deleted and the script fails; do not go on until it succeeds. Take one **before every later change**.

### 40. CONTAINER: prove a restore into a scratch database [OWNER may need the administrator for CREATE DATABASE]
Create an empty scratch database (the administrator, if `g4d_live` may not create databases):
```
docker exec -it {PG_CONTAINER_NAME} createdb -U {ADMIN_USER} -O g4d_live g4d_restore_check
```
Restore the newest backup into it (the script's own format: openssl then `pg_restore`):
```
ops sh -c 'f=$(ls -1t /backups/v3live-*.dump.enc | head -1); openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -pass file:/run/secrets/backup_passphrase -in "$f" | pg_restore --no-owner --no-acl --exit-on-error --dbname="${DIRECT_URL%/get4domain_v3*}/g4d_restore_check?sslmode=disable"'
```
Count something real in it and compare with the live database (both numbers must match what you expect):
```
ops sh -c 'psql "${DIRECT_URL%/get4domain_v3*}/g4d_restore_check?sslmode=disable" -At -c "select count(*) from \"_prisma_migrations\""'
```
Note the **time it took**: write it in the release notes. Then remove the scratch database:
```
docker exec -it {PG_CONTAINER_NAME} dropdb -U {ADMIN_USER} g4d_restore_check
```
Repeat this once a month. A backup that was never restored is not yet a backup. (The restore of the **live** database itself follows `V3_LIVE_ENVIRONMENT.md` section 11: always into a new database, never over the live one.)

### 41. Copy the backups off the server [OWNER]
The server's own disk is not a backup. **CONTAINER:** nothing to run; **HOST**, pull the newest backup file out of the container:
```
lxc file pull v3live/opt/v3live/ops-backups/{NEWEST_FILE}.dump.enc /root/
```
**PC**, bring it home and then remove the host copy:
```
scp root@vmi3551049:/root/{NEWEST_FILE}.dump.enc .
```
**HOST:**
```
rm -f /root/{NEWEST_FILE}.dump.enc
```
The passphrase must be kept **off the server** too (without it no backup opens). **HOST**, then **PC**, move the file without printing it:
```
lxc file pull v3live/opt/v3live/secrets/ops/backup_passphrase /root/backup_passphrase
```
```
scp root@vmi3551049:/root/backup_passphrase .
```
Put it in a password manager, delete the PC copy, and on the **HOST**:
```
shred -u /root/backup_passphrase
```
Do the same for the nightly job's own passphrase (the owner knows where it is). Make a weekly habit of copying the newest file off the server.

---

# PART H. Later and separately

### Turn the public flag on later [OWNER, when ready]
Do this only after the day-one checklist, the legal wording and the directory approvals (`V3_LIVE_ENVIRONMENT.md` section 10). **CONTAINER:**
```
cp /opt/v3live/env/site.env /opt/v3live/env/site.env.$(date +%Y%m%d%H%M%S) && sed -i 's|^V3_PUBLIC_ENABLED=.*|V3_PUBLIC_ENABLED=true|' /opt/v3live/env/site.env
```
```
docker compose -f /opt/v3live/src/backend/deploy/v3live/docker-compose.apps.yml --env-file /opt/v3live/env/compose.env up -d --no-build site
```
The site reads the flag when it starts, so recreating the one container is enough (no rebuild). Check `https://directory.get4domain.com/` and the pages the owner expects. Search engines still see `noindex` until the admin settings `directoryPagesIndexable` and `directoryIndexUnclaimed` are turned on separately. [ROLLBACK] set `V3_PUBLIC_ENABLED=false` (or copy back the dated file) and run the same `up -d` line.

### The wildcard and the main site
Not part of this runbook. See `deploy/v3live/nginx/WILDCARD_SWITCH_LATER.md`. The main site `get4domain.com` needs one more server block (the public site on `{V3_BIND_IP}:3006`, headers from `g4d-headers-site.conf`) at the same time; the owner decides when.

---

# Releasing a later version

1. **CONTAINER:** `git pull` (or checkout the new tag) in the three clones; check `git status` is clean.
2. **CONTAINER:** take a backup (step 39).
3. **CONTAINER:** `export IMAGE_TAG=...` (step 11) and rebuild what changed (steps 13 to 17). The old images stay.
4. **CONTAINER:** if the release has migrations: `ops node scripts/live/migrate-live.js status`, then `deploy` (asks for `LIVE`), then `status`, `drift`, `rls` (`V3_LIVE_ENVIRONMENT.md` section 6).
5. **CONTAINER:** set the new `IMAGE_TAG` in `compose.env`, run the `up -d --no-build` line of step 26.
6. Repeat step 28 and the checks of step 36.

# Rollback table

| Step | Undo |
|---|---|
| 1 to 4, 19, 23, 25, 28, 36 | read only: nothing to undo |
| 5 to 7 | delete the folders or clones you made; delete the deploy keys on GitHub |
| 8 to 10 | restore the dated copy of the env file |
| 11 to 17 | `docker rmi get4domain-v3-<name>:<tag>`; older tags are untouched |
| 20 | `DROP SCHEMA extensions` (while empty); `ALTER DATABASE get4domain_v3 RESET search_path` |
| 21 to 22 | drop and recreate the empty database (administrator), repeat step 20 |
| 24 | restore from the step 39 backup into a new database (`V3_LIVE_ENVIRONMENT.md` section 11) |
| 26 | `docker compose ... down` |
| 27 | admin app, or restore |
| 30 to 34 | `rm -rf /etc/nginx && cp -a /etc/nginx.bak-<stamp> /etc/nginx && nginx -t && systemctl reload nginx` |
| 38 to 41 | delete the files made; nothing else changed |
| public flag | set `V3_PUBLIC_ENABLED=false` and `up -d site` |
| a bad release | put the previous tag in `compose.env`, `up -d --no-build`; images and migrations are additive, so the older image runs on the newer schema |

# What was and was not checked

Checked by unit tests (`backend-api/test/live-apps-deploy-files.spec.ts`, `live-nginx-files.spec.ts`): the compose file (health checks, non-root users, ports only on `V3_BIND_IP`, external network, no value), the Dockerfiles (themes copied, non-root, health checks, ops tools), the env templates (names only, flags off, every required name present), and the nginx files (no secret, balanced braces, one block per host, headers, placeholders, noindex).
**Not run:** any Docker build (all six images), compose, nginx, the Cloudflare script, any database command, the SPA wrapper's `sed` edits against the real apps image, `postgresql17-client` being available in the Alpine release `node:20-alpine` currently uses (if the build says it is not found, the owner chooses `postgresql16-client` for a 17 server only after checking compatibility, or a Debian-based ops image), and the real permission model of `g4d_live` in the Postgres container.
