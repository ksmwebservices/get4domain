# Switching the wildcard `*.get4domain.com` to V3 later (E1c). NOT part of the first deploy.

Today the wildcard serves the **V2** vendor sites. Until the owner decides, it must keep doing so. This file is the exact procedure for the day the owner says "switch". Nothing in `RUNBOOK.md` does any of it.

**Do not start unless every box is true:**

- [ ] The V3 apps have been live and healthy for at least a few days with the public flag still off (`RUNBOOK.md` steps 1 to 14).
- [ ] The public flag has been turned on and checked (`RUNBOOK.md`, "Turn the public flag on later").
- [ ] Section 1 below has been run and **every V2 vendor name is covered** (has its own explicit rule, or is deliberately moving to V3).
- [ ] The owner has a recent backup of the host nginx configuration and of the V2 database.
- [ ] The wildcard certificate and DNS (`*.get4domain.com` through Cloudflare) already exist (they do today).

Window legend: **PC** = PC PowerShell, **HOST** = `root@vmi3551049:~#`, **V2DB** = wherever the owner reads the V2 database.

## 1. List every V2 vendor name from the V2 database (read only)

Window **V2DB**. One query; it only reads. The table and column names are those of the shared Prisma schema (`Vendor.subdomain`); if the V2 database differs, adjust the names, never write.

```
psql "$V2_READONLY_URL" -At -c 'SELECT subdomain FROM "Vendor" WHERE subdomain IS NOT NULL AND "deletedAt" IS NULL ORDER BY subdomain' > v2-vendor-names.txt
```

`$V2_READONLY_URL` is a **read-only** connection string the owner already has; type it into the shell, never into a file. If the `deletedAt` column does not exist there, drop that condition.

Then decide, name by name, one of:

1. **It stays on V2.** It needs an explicit server block (copy `mrtravels.get4domain.com.conf`, change the name and the upstream) **before** the wildcard moves.
2. **It moves to V3.** Nothing to add: the wildcard will send it to the public site, which serves it from `/site/<name>`.

The names that must always have their own rule (the V2 client names and the platform names): `www app admin api gapi directory media partner mail send allwintours deebiphotography indianambulance ksmquantum stepnrock jscomputersmobiles unicatherapy mrtravels s2travels`. Of these, `app admin api directory partner` are the five V3 files in this folder; `mrtravels` and `s2travels` have files here; `www` and the bare `get4domain.com` follow the main-site decision; `gapi`, `media`, `mail`, `send` and the five other client names keep whatever rule they have today (check with `nginx -T | grep -n server_name`).

## 2. Look at what the wildcard does today (read only)

Window **HOST**:

```
nginx -T 2>/dev/null | grep -n -B2 -A25 'server_name .*\*\.get4domain\.com'
```

Note the file name, the `proxy_pass` target, and the certificate paths. The new block keeps the certificate paths and replaces only the `proxy_pass`.

## 3. Back up the nginx configuration

Window **HOST**:

```
cp -a /etc/nginx /etc/nginx.bak-$(date +%Y%m%d%H%M%S)
```

Write the backup folder's name down. It is the rollback.

## 4. Edit the wildcard block (the one change)

Window **HOST**. Open the file found in step 2:

```
nano /etc/nginx/sites-available/<the wildcard file>
```

Change only the line `proxy_pass http://<V2 target>;` inside `location /` to:

```
proxy_pass http://<V3_BIND_IP>:3006;
```

and add, inside the same `location /`, the two lines `include snippets/g4d-proxy.conf;` and `include snippets/g4d-headers-site.conf;`. Keep `server_name *.get4domain.com;` and the certificate lines. Save.

## 5. Test, then reload (never reload without the test)

Window **HOST**:

```
nginx -t
```

It must print `syntax is ok` and `test is successful`. If it does not, **stop and go to the rollback** (step 7); do not reload.

```
systemctl reload nginx
```

## 6. Check a V2 name, a V3 name and a reserved name

Window **PC** (each should answer from the right app; the second needs a V3 vendor to exist):

```
curl.exe -sI https://mrtravels.get4domain.com/ | findstr /i "HTTP server"
curl.exe -sI https://<a V3 vendor name>.get4domain.com/ | findstr /i "HTTP"
curl.exe -sI https://api.get4domain.com/health | findstr /i "HTTP"
```

Open a V2 vendor's site and a V3 vendor's site in a browser.

## 7. Rollback (restore the backup; takes seconds)

Window **HOST**:

```
rm -rf /etc/nginx
cp -a /etc/nginx.bak-<the stamp from step 3> /etc/nginx
nginx -t
systemctl reload nginx
```

Then repeat step 6's first check: the V2 sites answer again. Tell the owner what failed before trying a second time.
