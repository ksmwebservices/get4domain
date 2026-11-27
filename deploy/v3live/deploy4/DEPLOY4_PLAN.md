# Deploy 4 plan: E11 and theme delete to the V3 URL

Written 27 Nov 2026. **Not run. Waiting for the owner's go.** Nothing has been written to the server.

Server: `ssh contabo` (user `signbotai`), LXD container `v3live`. V2, all nginx files and `signbot-prod` stay untouched. No env file is printed.

## What goes out

| Part | Value |
|---|---|
| Branch | `release-v3-27nov-d4` (repo `get4domain`) |
| Code commit (what is built) | `1401165cac9bd3da6322ef1c0ff79f3822945fe6` = merge of `dcf9d939` (E11) and `9a972193` (theme delete) |
| New tag | `20261127-1401165c` |
| `api` | new image, built on the server. Running now: `20261126-d584d6fc` |
| `site` | **same image**, new tag name (site source, recipe and compose file are unchanged since `d584d6fc`). Running now: `20261126-d584d6fc` |
| `vendor`, `admin`, `partner` | **not restarted**. Their running images only also get the new tag name |
| Database | one migration, `20270112100000_v3_theme_delete`: 134 to 135 |
| New environment variables | none needed. The E11 payment link stays off |

**Not in this deploy:** the Themes screen Delete button (UI repo, `v3-theme-delete` `3a842bc`). Its confirm text says only one version is removed; the server removes **all versions**. Fix that text before the UI is deployed. The E11 vendor-host routing script is not installed.

**E11 behaviour that goes live:** a staff site rollback needs a reason; the last Super admin cannot be demoted, switched off, removed, suspended or deleted; a vendor address is at most 40 characters.

## The migration

```sql
ALTER TABLE "g4d_theme_market_packages" ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "deletedById" TEXT;
ALTER TABLE "g4d_theme_market_packages" ADD CONSTRAINT "g4d_theme_market_packages_deleted_check" CHECK (...);
```

* Additive: two nullable columns without a default (no table rewrite) and one check that every existing row passes (the new column is empty). The table had 12 rows, 2.4 MB, on 27 Nov. The lock on this one table is expected to be very short.
* The running (old) API keeps working with it, so the database is never rolled back.

## Before the go (PC, recommended)

The full backend suite has **not** run on this release. What is known from GitHub CI (Linux), on the two branches before the merge:

| Branch and commit | Suites | Failing |
|---|---|---|
| `v3-eng-e11` `dcf9d939` | 356 passed, 1 failed (6605 tests passed, 2 failed, 2 skipped) | `smoke-kit.spec.ts` |
| `v3-lane-e1-theme-delete` `9a972193` | 333 passed, 1 failed (6260 tests passed, 2 failed, 1 skipped) | `smoke-kit.spec.ts` |

That suite uses Windows file paths, so its 2 tests fail on Linux; it passes on this PC (16 of 16) and no smoke file changed since `d584d6fc`. To run the full suite on the merged release (about 10 minutes and 4 GB; close other programs first):
```
cd C:\Get4Domain\get4domain-w2\.lanes\rel27d4\backend-api
npm run test:ci
```
A failed suite: do not deploy.

## Steps

All commands run on the PC, one at a time. **Go on only after the stated last line.** Let each command finish; do not close the window during a swap.

### 0. Put the scripts on the server (changes only `/opt/v3live/deploy4` and the source clone's fetched objects)
```
ssh contabo "sudo -n lxc exec v3live -- sh -c 'cd /opt/v3live/src/backend && git fetch origin release-v3-27nov-d4 && mkdir -p /opt/v3live/deploy4 && git archive FETCH_HEAD deploy/v3live/deploy4 | tar -x -C /opt/v3live/deploy4 --strip-components=3 && cd /opt/v3live/deploy4 && sha256sum *.sh'"
```
Compare with `SCRIPTS.sha256` in this folder. Any difference: stop.

### 1. Preflight (read only)
```
ssh contabo "sudo -n lxc exec v3live -- sh /opt/v3live/deploy4/preflight-deploy4.sh"
```
Last line `PREFLIGHT-OK`.

### 2. Backup first
```
ssh contabo "sudo -n lxc exec v3live -- sh /opt/v3live/deploy4/backup-deploy4.sh"
```
Runs `/opt/v3live/backup.sh`, then checks that the new file decrypts to a complete dump holding the theme and migration tables. Last line `BACKUP-OK <file> ...`. **Write the file name down.** (`backup.sh` also removes backups older than 14 days, as every night.) A restore is not tested.

### 3. Build (nothing running changes)
```
ssh contabo "sudo -n lxc exec v3live -- sh -c 'sh /opt/v3live/deploy4/build-deploy4.sh > /opt/v3live/deploy4/build.log 2>&1; cat /opt/v3live/deploy4/build.log'"
```
Last line `BUILD-ALL-OK`. It moves the source clone to `1401165c`.

### 4. Migration (the owner types `LIVE`; must be within 2 hours of step 2)
```
ssh -t contabo "sudo -n lxc exec v3live -- sh /opt/v3live/deploy4/migrate-deploy4.sh"
```
Last line `MIGRATE-OK: 135 applied ...`.

| Exit | Meaning | Do |
|---|---|---|
| 9 | not started, nothing changed | read the reason |
| 2 | the migration command failed | **stop**. The running API is unchanged. If Prisma recorded a failed migration, resolving it is a separate decision |
| 3 | applied, but a check failed | **do not swap**; the old API keeps running |

### 5. Swap `api` (one restart, about 20 seconds in Deploy 3)
```
ssh contabo "sudo -n lxc exec v3live -- sh -c 'sh /opt/v3live/deploy4/swap-deploy4.sh api > /opt/v3live/deploy4/swap-api.log 2>&1; cat /opt/v3live/deploy4/swap-api.log'"
```
It runs `IMAGE_TAG=20261127-1401165c docker compose ... up -d --no-build --no-deps api`, then checks: healthy; image name and id; `/health/ready` with database up; public theme list; three new routes (401, 401, 200; today they answer 404); the theme-read error is not in the log; **all eight V3 addresses 200 with noindex**; 0 restarts; every other container unchanged.

Last line `PASSED api`. **Anything else: do not run step 6.**

### 6. Swap `site`
```
ssh contabo "sudo -n lxc exec v3live -- sh -c 'sh /opt/v3live/deploy4/swap-deploy4.sh site > /opt/v3live/deploy4/swap-site.log 2>&1; cat /opt/v3live/deploy4/swap-site.log'"
```
Checks: healthy; image; manifest; all eight addresses 200 with noindex; 0 restarts; API ready; other containers unchanged. Last line `PASSED site`.

| Last line of a swap | Meaning |
|---|---|
| `PASSED <service>` | passed |
| `ROLLED-BACK <service>` | a check failed, **that service was put back automatically** and confirmed |
| `ROLLBACK-FAILED` or `ROLLBACK-UNCONFIRMED` | failed and the rollback is **not confirmed**: look at once (whole rollback below) |
| `SWAP-NOT-STARTED` or `only api or site` | nothing changed |

If `site` rolls back, `api` stays on the new image (it passed). Stop there and decide.

### 7. `compose.env` (only after both swaps passed)
```
ssh contabo "sudo -n lxc exec v3live -- sh /opt/v3live/deploy4/set-tag-deploy4.sh"
```
Line `SET-TAG-OK`. Only the `IMAGE_TAG` line changes; copy at `compose.env.pre-deploy4`. The dry run printed after it is expected to show **vendor, admin and partner "Recreate"** (same images, new tag name) and `api` and `site` unchanged. They are not recreated by this deploy. Until the owner chooses to, always name the service and use `--no-deps`.

**Between step 5 and step 7, do not run a plain `up -d`:** it would put `api` and `site` back on the old images.

### 8. After (owner, signed in)
Sign in to the staff app; open the Themes list and one theme preview; open one vendor site. These are not covered by the scripts. Do not delete a real theme as a test: a deleted theme's files cannot be brought back.

## Rollback

**Automatic:** each swap puts back only the service that failed.

**Whole deploy** (`site`, then `api`, and `compose.env`):
```
ssh contabo "sudo -n lxc exec v3live -- sh /opt/v3live/deploy4/rollback-deploy4.sh"
```
Last line `ROLLED-BACK`.

* **The database stays at 135.** The old API works with the two new columns.
* A theme deleted while the new API ran would show again in the old API's lists, with an empty file: it cannot be previewed or published there.
* Restoring the backup erases everything written since it was taken. Last resort, and not tested.
* After a rollback `compose.env` names `20261127-d0e0b62` again. `api` and `site` run the same images under `20261126-d584d6fc`, so a later plain `up -d` restarts them once (as today).
* Before any later build of the old code: `git -C /opt/v3live/src/backend checkout release-v3-27nov`.

## Script tests (PC)

`bash test-deploy4.sh` in this folder: the scripts run under `dash` with fake `docker`, `curl`, `git`, `df`, `openssl` and `sleep`, with a failure injected at each check. On Windows run the harness with `bash`.

## Results on 27 Nov, before the go

| Check | Result |
|---|---|
| Release tests (theme market, role, route list) | 18 suites, 739 of 739 |
| Backend build; lint on the files changed since `d584d6fc` | passed; 0 errors, 3 warnings in `http-exception.filter.ts` |
| Live database, read only | 134 applied, none unfinished or rolled back; all 134 checksums match this release; only the new migration is pending |
| Additive guard `verify-migrations-additive.js` | the new migration passes (4 older folders fail it, already on live) |
| Rehearsal, local PostgreSQL 17.12 | deployed structure plus the live checks, 134 recorded; `prisma migrate deploy` applied only the new one; 12 made-up rows unchanged; the check refuses stamping a published row; inserts and publishes without the new columns still work; no drift against the new schema |
| Theme delete against that database (built code) | all-or-nothing, bought theme blocked, rows kept, files emptied, one audit row |
| Deploy script tests | 899 of 899 |
| Broken copies of the scripts | 12 of 12 caught |
| `preflight-deploy4.sh` on the real server, read only, sent over stdin | `PREFLIGHT-OK` |

**Not run:** the full backend suite, `int` (staging) tests, theme and site app tests, the image build, the migration on live, any swap or rollback on the server, a backup restore, any signed-in screen. The rehearsal used the table's real structure but made-up rows.
