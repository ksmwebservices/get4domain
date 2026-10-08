# Custom domain for a standalone vendor site (Step N Rock) — runbook for KSM

> Claude Code did **not** run any of this. Every command below is for **you (KSM)** to paste. Where each one goes is written next to it: **[VM]** = the production VM terminal (SSH), **[CF]** = the Cloudflare dashboard, **[REG]** = the domain registrar's DNS panel, **[LOCAL]** = your PC.
> Replace `<DOMAIN>` with the vendor's domain (for example `stepnrock.in`) and `<VM_IP>` with the VM's public IPv4. Nothing here is secret.

## 0. What is already true (so you know what you do **not** have to do)

| Question | Answer | Evidence |
|---|---|---|
| Does the storefront care which domain it is served on? | **No** for data: it always asks the API for the `stepnrock` shop. **Yes** only for the "official address" it prints (canonical link, Open Graph, sitemap) — that now comes from `SITE_URL`. | `stepnrock/lib/site-url.ts`, `app/sitemap.ts`, `app/robots.ts` |
| Does the API accept a new domain? | **Yes, with no change.** The API reflects any browser origin (it is Bearer-token authed, there is no cookie login, so CORS is not the security boundary). `CORS_EXTRA_ORIGINS` only matters if you switch the API to `CORS_MODE=strict`. | `backend-api/src/common/cors.ts`, test `verify-cors.js` |
| Do uploaded images load on the new domain? | **Yes.** Images are `https://gapi.get4domain.com/uploads/…` and the storefront uses plain `<img>` tags (no image-host allow-list). | `stepnrock/next.config.js` (`images.unoptimized`) |
| What SSL mode are we in? | Cloudflare **Flexible** on the get4domain.com zone: visitors get Cloudflare's certificate, Cloudflare talks plain HTTP to the VM. The VM serves port 80 only and **must not redirect to HTTPS**. | `stepnrock/nginx-stepnrock.conf` header |

**Decision first — pick ONE path** (A is what every other site on this VM does):

| | Path A — domain on Cloudflare (recommended) | Path B — DNS only at the registrar |
|---|---|---|
| Visitors' HTTPS | Cloudflare certificate (free, automatic) | Let's Encrypt certificate **on the VM** (certbot) |
| Origin config | plain HTTP :80, **no certbot, no redirect** | HTTP→HTTPS redirect + certificate (certbot does it) |
| Extra benefit | DDoS/CDN, same behaviour as get4domain.com | none |

> ⚠️ **Never run certbot on a hostname that is proxied by Cloudflare in Flexible mode** — certbot adds a port-80 `return 301 https://…`, Cloudflare (talking HTTP) is redirected forever, and the site loops. This already happened once (ksmquantum). Use certbot **only** in Path B.

---

## 1. DNS

### Path A — Cloudflare **[CF]**
1. Cloudflare dashboard → **Add a site** → `<DOMAIN>` → Free plan.
2. At the registrar **[REG]**, change the domain's **nameservers** to the two Cloudflare gives you. (Propagation: minutes to a few hours.)
3. In Cloudflare → **DNS → Records**, add (both **Proxied**, orange cloud ON):

| Type | Name | Content | Proxy |
|---|---|---|---|
| A | `@` | `<VM_IP>` | Proxied |
| A | `www` | `<VM_IP>` | Proxied |

4. Cloudflare → **SSL/TLS → Overview** → set **Flexible** (same as the get4domain.com zone). **SSL/TLS → Edge Certificates → Always Use HTTPS = On**.

### Path B — registrar only **[REG]**
Add two **A** records: `@` → `<VM_IP>` and `www` → `<VM_IP>`. Nothing else.

**Check DNS has arrived** **[LOCAL]** (PowerShell or any terminal):
```bash
nslookup <DOMAIN>
nslookup www.<DOMAIN>
```
Path A shows Cloudflare addresses (104.x / 172.x); Path B shows `<VM_IP>`. Wait until it does before step 2.

---

## 2. nginx on the VM **[VM]**

The live file is `/etc/nginx/sites-available/stepnrock` (template in the repo: `stepnrock/nginx-stepnrock.conf`). Only the `server_name` line changes.

```bash
sudo cp /etc/nginx/sites-available/stepnrock /etc/nginx/sites-available/stepnrock.bak.$(date +%F)
sudo sed -i 's/^\(\s*server_name\) .*;/\1 stepnrock.get4domain.com <DOMAIN> www.<DOMAIN>;/' /etc/nginx/sites-available/stepnrock
grep -n server_name /etc/nginx/sites-available/stepnrock      # must show all three names
sudo nginx -t && sudo systemctl reload nginx
```
Expected: `syntax is ok` / `test is successful`. Keeping `stepnrock.get4domain.com` in the list means the old address keeps working.

**Path B only** — get the certificate (Cloudflare is *not* in front of this name):
```bash
sudo certbot --nginx -d <DOMAIN> -d www.<DOMAIN>
sudo nginx -t && sudo systemctl reload nginx
```
**Path A: skip certbot entirely.**

---

## 3. Tell the site its official address (`SITE_URL`) **[VM]**

`SITE_URL` is read when the storefront is **built** (canonical, Open Graph, sitemap, robots) and again at run time. Choose the one public form (apex or `www`) and use it everywhere.

```bash
cd /srv/get4domain-site && git pull origin get4domain-site
cd stepnrock
export SITE_URL=https://<DOMAIN>          # or https://www.<DOMAIN> — pick one and keep it
docker compose build --no-cache && docker compose up -d --force-recreate
docker compose logs --tail=20
```
`docker-compose.yml` already forwards `SITE_URL` to both the build and the container, and falls back to `https://stepnrock.get4domain.com` when you do not set it.

To make it permanent instead of an `export`, put the line in `/srv/get4domain-site/stepnrock/.env` (next to `docker-compose.yml`): `SITE_URL=https://<DOMAIN>`.

---

## 4. API / CORS **[VM]** — usually nothing to do

The API currently accepts every origin, so **no change is needed** for the site to talk to `gapi.get4domain.com` from the new domain. Only if you ever tighten it:

```bash
cd /srv/get4domain-site/backend-api
# add to the .env file the backend container reads:
#   CORS_MODE=strict
#   CORS_EXTRA_ORIGINS=https://<DOMAIN>          # comma-separated for several; apex and www are both allowed from one entry
docker compose up -d --force-recreate
```
`CORS_EXTRA_ORIGINS` accepts `https://stepnrock.in`, or just `stepnrock.in` (https assumed); several are comma-separated. **Do not set `CORS_MODE=strict` while any vendor's embedded chat/booking widget is live on a domain you have not listed** — the widget runs on arbitrary vendor domains and strict mode would block it.

There are no cookie or redirect allow-lists anywhere in the API (checked: `FRONTEND_URL` is only the base of links inside emails).

---

## 5. Verify **[LOCAL]** (any terminal)

```bash
# 1. the site answers on the new name (200)
curl -s -o /dev/null -w "%{http_code}\n" https://<DOMAIN>/
curl -s -o /dev/null -w "%{http_code}\n" https://www.<DOMAIN>/

# 2. the official address is the new one (expect your https://<DOMAIN>, NOT stepnrock.com)
curl -s https://<DOMAIN>/ | grep -o 'rel="canonical" href="[^"]*"'
curl -s https://<DOMAIN>/robots.txt                      # last lines: Sitemap: https://<DOMAIN>/sitemap.xml
curl -s https://<DOMAIN>/sitemap.xml | head -c 400

# 3. the API accepts the new origin (expect an access-control-allow-origin line echoing your domain)
curl -s -i -H "Origin: https://<DOMAIN>" https://gapi.get4domain.com/cms/site/stepnrock | grep -i "^access-control-allow-origin"

# 4. the old address still works
curl -s -o /dev/null -w "%{http_code}\n" https://stepnrock.get4domain.com/

# 5. no redirect loop (Path A): must print 200, not 301/310
curl -s -o /dev/null -w "%{http_code} %{num_redirects}\n" -L https://<DOMAIN>/
```
In a browser: open `https://<DOMAIN>/shop`, add a product, open the cart → **Place order request** works and the order appears in Suresh's dashboard → Orders.

## 6. Rollback **[VM]**
```bash
# put the previous nginx server_name back
sudo cp /etc/nginx/sites-available/stepnrock.bak.<DATE> /etc/nginx/sites-available/stepnrock   # the file name printed in step 2
sudo nginx -t && sudo systemctl reload nginx
# rebuild the site with the platform address
cd /srv/get4domain-site/stepnrock && unset SITE_URL && docker compose build --no-cache && docker compose up -d --force-recreate
```
Cloudflare/registrar DNS can simply be left or removed; the old `stepnrock.get4domain.com` address is untouched throughout.

## 7. Common problems
| Symptom | Cause | Fix |
|---|---|---|
| Browser: "too many redirects" on the new domain | certbot was run under Cloudflare Flexible (Path A) | Remove the `return 301 https://…` block certbot added in `/etc/nginx/sites-available/stepnrock`, reload nginx. Or switch Cloudflare SSL to **Full** after installing an origin certificate. |
| 502 Bad Gateway | the stepnrock container is down | `docker ps | grep stepnrock`; `cd /srv/get4domain-site/stepnrock && docker compose up -d` |
| Canonical / sitemap still show the old address | `SITE_URL` not set at **build** time | repeat step 3 (the `--no-cache` build is what bakes it in) |
| Site loads but shows no products | the browser blocked the API call | check `curl -i -H "Origin: https://<DOMAIN>" https://gapi.get4domain.com/cms/site/stepnrock` returns data; if `CORS_MODE=strict` is set, add the domain to `CORS_EXTRA_ORIGINS` |
| Images missing | an image URL is `http://` on an `https://` page | uploaded image URLs must be `https://gapi.get4domain.com/uploads/…` (set `PUBLIC_API_URL=https://gapi.get4domain.com` in the backend `.env`; today's stored URLs already are) |
