# Vendor address routing: install and rollback steps (E11d)

Written 27 Nov 2026. **Nothing here has been installed or run on any server.** The script was tested only on the PC, in a temporary folder with a fake nginx, a fake systemctl and a local test web server. Apply it only while the owner watches.

Design: `C:Get4Domainget4domain-w2docs3ROUTING_AUTOMATION_DESIGN.md` (owner approval D1). Files: `deploy/v3live/vendor-hosts/` on branch `v3-eng-e11`.

## What it does

Once a minute the host asks the V3 API for the host names that have a published V3 site, writes them into **one** nginx file, tests nginx, reloads, checks, and puts the old file back if anything is wrong. Names not in the list stay with Version 2.

| New file on the host | Purpose |
|---|---|
| `/usr/local/sbin/g4d-v3-vendor-hosts-sync` | the script |
| `/etc/systemd/system/g4d-v3-vendor-hosts-sync.service` and `.timer` | runs it every minute |
| `/etc/nginx/conf.d/v3-vendor-hosts.conf` | written by the script only |
| `/var/lib/g4d/` | reserved names, status, lock, force flag |
| `/var/backups/g4d-nginx/` | copies before each change (20 kept, and the first copy of the hand-made file for ever) |

The only removal: the hand-made V3 file `/etc/nginx/sites-enabled/v3-vendor-sites.get4domain.com.conf`, which the first successful run moves into the backup folder. **No Version 2 or shared nginx file is edited.**

## Before you start (all must be true)

1. **The V3 API on the server has the route** `GET /v3/public/site/hosts`. It is on `v3-eng-e11` and is **not** in the release deployed on 26 Nov (`d584d6fc`). Deploy a release containing it first.
2. You have **root on the host** `13.140.184.87` (not only inside the `v3live` container). Every "HOST" command below is run there as root.
3. **The Version 2 vendor names are exported** (step 2). Without that file the script refuses to do anything.

## Step 1. HOST: look, change nothing

```
command -v python3 && python3 --version
nginx -t
ls -l /etc/nginx/sites-enabled/v3-vendor-sites.get4domain.com.conf
cat /etc/nginx/sites-enabled/v3-vendor-sites.get4domain.com.conf
ls /etc/nginx/snippets/ | grep -E 'cloudflare-realip|g4d-gzip|g4d-v3-proxy|g4d-headers-site'
curl -sS -m 10 http://10.77.0.50:3008/v3/public/site/hosts
curl -s -o /dev/null -w '%{http_code}\n' -H 'Host: get4domain.com' http://127.0.0.1/
```
Expect: Python 3.8 or newer; `nginx -t` successful; the four snippet files; a JSON answer whose `data.hosts` holds `plumberboy.get4domain.com`; a status below 500 on the last line. **Anything else: stop.**

## Step 2. The Version 2 names

Version 3 cannot see Version 2's vendors, so you give it the list. On the **Version 2** database, read only, export every vendor address. The query below assumes Version 2 keeps them in the table `"Vendor"`, column `"subdomain"` (as the shared code does); **check this on Version 2 before trusting the result**, and add any Version 2 site that is served under a `get4domain.com` name from another place.

```
SELECT subdomain FROM "Vendor" WHERE subdomain IS NOT NULL ORDER BY subdomain;
```

HOST: put one name per line (the name alone, or `name.get4domain.com`; lines starting with `#` are ignored):

```
mkdir -p /var/lib/g4d /var/backups/g4d-nginx && chmod 755 /var/lib/g4d && chmod 700 /var/backups/g4d-nginx
nano /var/lib/g4d/v2-reserved-names.txt
grep -vc -E '^\s*(#|$)' /var/lib/g4d/v2-reserved-names.txt
```
The count must match the export. Then, in the V3 admin (Super admin), add the same names to the plan setting `reservedSubdomains` (`PUT /v3/admin/plan-settings/reservedSubdomains` with `{"valueJson": [ ...the current list plus these names... ]}`), so that no one can register one on V3. The setting takes up to 500 names. **Repeat this step monthly.**

If a business already on V3 uses one of these names, it will stay on Version 2. Find that out now, not later.

## Step 3. Copy the files

PC (PowerShell), from a checkout of the released commit:
```
cd C:\Get4Domain\get4domain-w2\.lanes\e11\deploy\v3live\vendor-hosts
ssh contabo "mkdir -p /tmp/g4d-vendor-hosts"
scp g4d_v3_vendor_hosts_sync.py g4d-v3-vendor-hosts-sync.service g4d-v3-vendor-hosts-sync.timer contabo:/tmp/g4d-vendor-hosts/
```
HOST:
```
cd /tmp/g4d-vendor-hosts && sed -i 's/\r$//' *
sha256sum *
install -o root -g root -m 0755 g4d_v3_vendor_hosts_sync.py /usr/local/sbin/g4d-v3-vendor-hosts-sync
cp -a /etc/nginx /root/nginx.bak-$(date +%Y%m%d-%H%M%S)
```
Write down the name of the nginx copy.

## Step 4. HOST: dry run (writes nothing)

```
python3 /usr/local/sbin/g4d-v3-vendor-hosts-sync --dry-run
```
Read every line. **Compare the printed `server` block with the hand-made file from step 1: only the first comment and the `server_name` line may differ.** If any `include`, `listen`, log or `proxy_pass` line differs, stop: the script's template must be corrected first. Check that `plumberboy.get4domain.com` is in the new list and that no Version 2 name is. Names left out are listed with the reason.

## Step 5. HOST: the first real run, by hand

```
python3 /usr/local/sbin/g4d-v3-vendor-hosts-sync; echo exit=$?
cat /var/lib/g4d/v3-vendor-hosts.status
nginx -t
ls /etc/nginx/sites-enabled/ | grep v3-vendor
curl -s -o /dev/null -w '%{http_code}\n' -H 'Host: get4domain.com' http://127.0.0.1/
```
PC:
```
curl.exe -sI https://plumberboy.get4domain.com/
curl.exe -s -o NUL -w "%{http_code}\n" https://get4domain.com/
curl.exe -s -o NUL -w "%{http_code}\n" https://stepnrock.get4domain.com/
```
Expect: `exit=0`, result `updated`; the hand-made file gone; plumberboy `200` with `X-Robots-Tag: noindex, nofollow`; the Version 2 sites as before. Check each Version 2 site you care about in a browser.

## Step 6. HOST: switch on the timer

```
cd /tmp/g4d-vendor-hosts
install -o root -g root -m 0644 g4d-v3-vendor-hosts-sync.service g4d-v3-vendor-hosts-sync.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now g4d-v3-vendor-hosts-sync.timer
systemctl list-timers --all | grep g4d-v3
journalctl -u g4d-v3-vendor-hosts-sync -n 20 --no-pager
```
After two minutes the journal should show `unchanged: the file already matches the list` once a minute.

## Step 7. Prove it with one business

Publish one V3 test business whose address is free on both versions. Within two minutes the journal shows `updated: added 1`, and its address shows the V3 site. Watch the Version 2 front page once more.

## Rollback

**Stop the automation, keep today's routing:**
```
systemctl disable --now g4d-v3-vendor-hosts-sync.timer
```

**Go back to the hand-made file** (HOST):
```
systemctl disable --now g4d-v3-vendor-hosts-sync.timer
ls /var/backups/g4d-nginx/*.replaced
cp "$(ls /var/backups/g4d-nginx/*.replaced | head -1)" /etc/nginx/sites-enabled/v3-vendor-sites.get4domain.com.conf
rm -f /etc/nginx/conf.d/v3-vendor-hosts.conf /var/lib/g4d/v3-vendor-hosts.pending
nginx -t && systemctl reload nginx
curl -s -o /dev/null -w '%{http_code}\n' -H 'Host: plumberboy.get4domain.com' http://127.0.0.1/
```
The first (oldest) `.replaced` file is the original. If `nginx -t` fails, restore the copy of `/etc/nginx` from step 3.

**Remove everything** (after the rollback above): delete the script, the two unit files, then `systemctl daemon-reload`. `/var/lib/g4d` and the backups may stay.

The API route is harmless without the script.

## Day to day

| What you see | Meaning and action |
|---|---|
| exit 0 `unchanged` or `updated` | normal |
| exit 1 `refused` | nothing was changed; the message says why (API down, reserved file missing, large removal, another run) |
| exit 2 `rolled-back` | a change failed and the old file is back; read the message. The new address stays on Version 2 until it is fixed. The publish itself is not undone |
| exit 3 `undo-failed` | **act now**: run `nginx -t`, then use the rollback above |
| "removes N of M names" | if the removal is really wanted: `touch /var/lib/g4d/force-once` (used once) |

Status: `/var/lib/g4d/v3-vendor-hosts.status`. History: `journalctl -u g4d-v3-vendor-hosts-sync`.

## What is left out of the list, on purpose

Names over 40 characters; reserved platform names and their look-alikes; names starting `v3` or `t3-`; Version 2 names from your file or declared in another nginx file; removed businesses; custom domains (a different path). A business under a legal takedown **stays** in the list so its address shows the notice. This differs from the design text, which would have sent the address back to Version 2.

## Limits

- Never tried against a real nginx. Steps 4 and 5 are the first real test.
- The check after a reload asks for one new name and the Version 2 front page; an old nginx worker could still answer for a moment, so look in a browser too.
- nginx's default name table suits a few hundred names. If it overflows, `nginx -t` fails and the script rolls back; the fix is `server_names_hash_max_size` in `nginx.conf`, a shared file, which needs your approval.
- Registration does not yet refuse names starting `v3` or `t3-`; such a business is simply never routed.
