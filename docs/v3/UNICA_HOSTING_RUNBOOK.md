# UNICA hosting runbook — unicatherapy.get4domain.com (static, by hand)

For the OWNER to run. Nothing here has been run by Claude: no server, DNS or Cloudflare access was used.

- Package: `docs/v3/unicatherapy-static/` (index.html, css/, fonts/, images/, robots.txt, sitemap.xml). About 330 KB, no external requests, no JavaScript, no forms.
- Source of the content: the Bolt export in `project/` (UNICA Multi Speciality Therapy Centre) — see "Content notes" at the end.
- Conventions copied from `deployment/nginx/indianambulance.conf` and `docs/v2/CUSTOM_DOMAIN_RUNBOOK.md`: vhost files in `/etc/nginx/sites-available`, symlinked to `sites-enabled`, plain HTTP on :80, Cloudflare in **Flexible** mode.

Markers: **[LOCAL]** your PC, **[VM]** the server, **[CF]** Cloudflare dashboard.

> Assumption to confirm: the web root `/var/www/unicatherapy` is a new directory chosen here. Use another path if you prefer, but change it in every step.

---

## 1. Copy the folder to the server

**[LOCAL]** (PowerShell, from the repo root; replace `<USER>` and `<VM_IP>`):
```powershell
scp -r docs\v3\unicatherapy-static <USER>@<VM_IP>:/tmp/unicatherapy-static
```

**[VM]**
```bash
sudo mkdir -p /var/www/unicatherapy
sudo rsync -a --delete /tmp/unicatherapy-static/ /var/www/unicatherapy/
sudo chown -R root:root /var/www/unicatherapy
sudo find /var/www/unicatherapy -type d -exec chmod 755 {} \;
sudo find /var/www/unicatherapy -type f -exec chmod 644 {} \;
ls -R /var/www/unicatherapy | head -30
rm -rf /tmp/unicatherapy-static
```
Expected: `index.html css fonts images robots.txt sitemap.xml`.

## 2. See how the app currently catches the host **[VM]**
```bash
grep -Rn "server_name" /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2>/dev/null
```
Look for the vhost that serves the platform (probably `*.get4domain.com` or `_` / `default_server`). Note its file name.

Why this works: nginx picks the **exact** `server_name` match before any wildcard (`*.get4domain.com`) or `default_server`, regardless of file order. So the new vhost only has to exist and be enabled; the app's wildcard vhost needs **no edit**. If the app's vhost lists `unicatherapy.get4domain.com` explicitly, remove that name there (otherwise nginx warns about a conflicting server name and the first one wins).

## 3. Add the nginx server block **[VM]**

Create `/etc/nginx/sites-available/unicatherapy`:
```nginx
# UNICA Multi Speciality Therapy Centre - static site, served from disk.
# Cloudflare SSL mode is Flexible: plain HTTP on :80 only. No redirect to HTTPS, no certbot for this host.
server {
    listen 80;
    server_name unicatherapy.get4domain.com;

    root /var/www/unicatherapy;
    index index.html;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location / {
        try_files $uri $uri/ =404;
    }

    location /fonts/  { expires 30d; add_header Cache-Control "public, max-age=2592000"; }
    location /images/ { expires 7d;  add_header Cache-Control "public, max-age=604800"; }
    location /css/    { expires 1d;  add_header Cache-Control "public, max-age=86400"; }
}
```
Note: `add_header` inside a `location` replaces the server-level headers for that location; that is acceptable for static assets.

Enable and reload:
```bash
sudo ln -s /etc/nginx/sites-available/unicatherapy /etc/nginx/sites-enabled/unicatherapy
sudo nginx -t && sudo systemctl reload nginx
```
Expected: `syntax is ok` and `test is successful`. If `nginx -t` fails, **do not reload**; run the rollback in section 7 step 1, then fix.

## 4. Cloudflare notes **[CF]**
- **DNS:** the zone should already have a wildcard `*` record (A, pointing at the VM, Proxied/orange cloud) — check DNS → Records. If it exists, no new record is needed. If it does not, add `A  unicatherapy  <VM_IP>  Proxied`.
- **SSL/TLS → Overview:** keep **Flexible** (same as the rest of the get4domain.com zone). Cloudflare serves HTTPS to visitors and talks plain HTTP to the VM, which is exactly what the server block above serves.
- **Do not run certbot** for this host and **do not add** `return 301 https://…`: under Flexible that creates a redirect loop (this already happened once with ksmquantum).
- Wildcard certificates: Cloudflare's Universal certificate covers `*.get4domain.com` (one level), so `unicatherapy.get4domain.com` is covered.
- After first publish, if Cloudflare shows an older page: Caching → Configuration → **Purge Everything** (or purge just the URLs below).

## 5. Check commands

**[VM]** (bypasses Cloudflare and DNS, tests nginx directly):
```bash
curl -sI -H "Host: unicatherapy.get4domain.com" http://127.0.0.1/ | head -5
curl -s  -H "Host: unicatherapy.get4domain.com" http://127.0.0.1/ | grep -o "<title>.*</title>"
curl -s  -H "Host: unicatherapy.get4domain.com" http://127.0.0.1/ | grep -c "rel=\"canonical\" href=\"https://unicatherapy.get4domain.com/\""
for p in css/styles.css fonts/inter-latin-wght-normal.woff2 fonts/plus-jakarta-sans-latin-wght-normal.woff2 images/team.jpg images/logo.png images/icon-192.png robots.txt sitemap.xml; do
  curl -s -o /dev/null -w "$p %{http_code}\n" -H "Host: unicatherapy.get4domain.com" http://127.0.0.1/$p; done
# the app must still own other hosts (replace with a real vendor host you know):
curl -sI -H "Host: indianambulance.get4domain.com" http://127.0.0.1/ | head -3
```
Expected: `200`, title `UNICA Multi Speciality Therapy Centre | Villupuram`, canonical count `1`, every asset `200`, and the other host still answers from the app.

**[LOCAL]** (through Cloudflare):
```bash
curl -sI https://unicatherapy.get4domain.com/ | head -8
curl -s  https://unicatherapy.get4domain.com/robots.txt
curl -s  https://unicatherapy.get4domain.com/sitemap.xml
```
Expected: `HTTP/2 200`, a `server: cloudflare` header, robots.txt that allows everything and names the sitemap, and a one-URL sitemap. Then open the URL in a browser at phone and desktop width.

Confirm no redirect loop: `curl -sIL https://unicatherapy.get4domain.com/ | grep -ci "^location"` should print `0`.

## 6. After going live (optional, owner decision)
Submit `https://unicatherapy.get4domain.com/sitemap.xml` in Google Search Console only if the owner wants the platform subdomain indexed. The page's canonical already points at itself.

## 7. Rollback (exact) **[VM]**

Step 1 — take the host back to the app (this is all that is needed; it is instant and reversible):
```bash
sudo rm /etc/nginx/sites-enabled/unicatherapy
sudo nginx -t && sudo systemctl reload nginx
```
Result: the exact-match vhost is gone, so the app's wildcard vhost catches `unicatherapy.get4domain.com` again, as before this change. If you edited the app's vhost in section 2 (removed a name), restore it from your backup of that file:
```bash
sudo cp /etc/nginx/sites-available/<APP_VHOST>.bak.<DATE> /etc/nginx/sites-available/<APP_VHOST>
sudo nginx -t && sudo systemctl reload nginx
```
(Take that backup before editing, e.g. `sudo cp <file> <file>.bak.$(date +%F)`.)

Step 2 — optional cleanup, only after step 1 is verified:
```bash
sudo rm /etc/nginx/sites-available/unicatherapy
sudo rm -rf /var/www/unicatherapy
```
Step 3 — verify:
```bash
curl -sI -H "Host: unicatherapy.get4domain.com" http://127.0.0.1/ | head -3
```
It should now be answered by the app, not the static page.

Cloudflare needs no rollback: DNS and SSL mode are unchanged by this procedure. If you added a specific `unicatherapy` A record in step 4 that was not there before, delete it only if you want the name gone entirely.

---

## Content notes (decisions for the owner to confirm)
1. **Address mismatch.** The sign in the team photo reads "No: 2, Chairman Sobburayalu Street, Near Bharani Hospital". The flyer and the Bolt `clinic.ts` say "No. 12, Chairman Subburayallu Street, GRT Backside, Villupuram - 605 602". The page uses the flyer/`clinic.ts` address. Please confirm it, since the photo (an old sign) is still on the page.
2. **Removed from the Bolt design on purpose:** appointment booking and its database, the chat assistant, the WhatsApp button, install/offline app files, the "Free Screening" section and flyer (the camp ran 27–31 Oct 2026 and has passed, and "free" is a payment promise), the four paraphrased "parent reviews" with 5 stars (unattributed, not verifiable), and the stats strip.
3. **Kept from the source:** brand, tagline, seven services and their descriptions, director name, both branches, "5th anniversary" (from the flyer), phone numbers, email and address as plain text.
4. **Tindivanam** is named as a branch but no address for it exists in the source, so none is shown.
5. Phone, email and address are plain text: no `tel:`, `mailto:`, map link or form.
6. Fonts (Inter, Plus Jakarta Sans, latin subset) are self-hosted under the SIL Open Font License, taken from the `@fontsource-variable` packages on npm. The OFL text is not bundled in the folder; add a LICENSE file if you want to redistribute strictly to the letter.
7. Screenshots (not committed, `themes/.shots/` is git-ignored): `themes/.shots/unica/unica-360.png`, `unica-768.png`, `unica-1280.png`.
