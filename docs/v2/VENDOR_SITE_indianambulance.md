# Vendor site: Indian Ambulance (`indianambulance.get4domain.com`)

Folder `indianambulance/` (Next.js 16, App Router, Tailwind 4). Added 22 Oct 2026. The design is the exported one: layout, classes, colours and animations are unchanged (the rendered page body matches the export, checked by building both and comparing the HTML).

| | |
|---|---|
| Subdomain | `indianambulance` (the vendor is resolved from it; no vendor id is in the code) |
| Port | **3017** (taken so far: 3000/3001 MR Travels, 3002, 3003, 3006 website, 3008 API, 3010 Allwin, 3012 hidude-backend, 3014 KSM Quantum, 3015 Step N Rock, 3016 Deebi) |
| Container | `indianambulance` (compose service `frontend`, network `indianambulance_net`) |
| nginx file | `deployment/nginx/indianambulance.conf` (plain HTTP on :80, Cloudflare Flexible SSL, `client_max_body_size 10m`) |

## What is connected to the backend

The site reads `GET <api>/cms/site/indianambulance` (public, published content; the owner's draft only through a signed `?preview=` link). It is cached 60 seconds and dropped at once when the owner presses Publish (`POST /api/revalidate-site` with `x-revalidate-secret`). The same three shared files as the other four client apps (`lib/site-connect.ts`, `middleware.ts`, `app/api/revalidate-site/route.ts`), plus this app's `lib/content.ts`, which says which field goes where.

| Shown on the site | Edited in Website Manager |
|---|---|
| Business name (header, hero headline once changed, footer, copyright, WhatsApp greeting, search data) | Business name |
| Hero line under the headline | Tagline |
| About paragraph | About |
| Logo (header), favicon | Logo, Favicon |
| Hero picture | Banner |
| Call buttons (`tel:`) | Phone |
| WhatsApp buttons and the per-service "Enquire on WhatsApp" links | WhatsApp |
| Address in the Contact block | Address |
| "Open 24 hours" blocks (two places) | Business hours (first line is the title, the rest the small line) |
| Directions buttons | Google Maps link (built from the address when empty and the address was changed) |
| Photos section and the two About pictures | Portfolio (photos) |
| The eleven service cards | Items (services). Once the vendor has any item, the cards are their items only |
| Footer links to Facebook, Instagram, YouTube, LinkedIn, X | Social links (a row appears only when something is filled in) |
| Page title, description, keywords, share picture, noindex | SEO fields |
| Extra pages at `/p/<slug>` (linked in the footer) | Pages (within the plan's page limit) |

Until the vendor is switched to connected mode, or while a field was never touched and is empty, the site shows the exported words. A cleared field stays empty.

**Not editable in Website Manager (written in the app):** the section headings, the three quick-action cards (Call, WhatsApp, Directions), the "Have you used our service" block and its Google link, the area line in the About section ("Tindivanam, Tamil Nadu"). **Email** is not shown anywhere on this design, so there is no field for it. **Testimonials** are not shown on this design either.

**Forms and orders: none exist in this design.** The export has no enquiry, booking, contact or checkout form; every enquiry is a `tel:` or `wa.me` link, which goes to the phone and WhatsApp numbers above and does not pass through our servers. So this site creates no CRM leads and no orders today. Adding a form would change the design, so it is not done here. If you want leads in the CRM, the existing public flow is `POST /engine/public/indianambulance/actions/engine.enquiry` with `{ name, phone, message, industry }` (used by Deebi's booking form).

## Environment variables (names only)

| Name | Where | Meaning |
|---|---|---|
| `REVALIDATE_SECRET` | `indianambulance/.env` on the VM; the same value as in `backend-api/.env.local` | lets Publish refresh the site at once |
| `SITE_URL` | optional, in the same `.env` | public origin for canonical, Open Graph, sitemap, robots. Default `https://indianambulance.get4domain.com`. Set it to the business's own domain when that points here, then rebuild (it is a build argument too) |
| `SITE_CONNECT_API` | optional | where the site reads the site document. Default `https://gapi.get4domain.com` |
| `PORT`, `NODE_ENV` | fixed in `docker-compose.yml` | 3017, production |

Backend, already configured for the other four apps: `REVALIDATE_SECRET`, `CLIENT_APP_HOST` (and optional `CLIENT_APP_URLS`, `CLIENT_APP_PUBLIC`).

## VM steps

**Before you start.** (1) The vendor with subdomain `indianambulance` must exist in the database (create it from the admin area if it does not; the site is resolved by that subdomain). (2) For connected mode the backend must carry the client-app registry (`backend-api/src/site-doc/connected-apps.ts`, with the `indianambulance` entry, port 3017) from the existing-clients release, section 13 of `DEPLOYMENT.md`. Without it the site still works and shows its own words.

**1. VM terminal: pull the code**

```
ssh ksmwebtechservices@34.14.130.68
cd /srv/get4domain-site && git pull origin get4domain-site
git log --oneline -1
```

**2. VM terminal: the shared secret, copied from the backend (the value is not shown)**

```
cd /srv/get4domain-site/backend-api && grep -c '^REVALIDATE_SECRET=' .env.local        # must print 1
grep '^REVALIDATE_SECRET=' .env.local > ../indianambulance/.env
git -C /srv/get4domain-site status --short | grep '\.env' || echo "env files are not tracked: good"
```

**3. VM terminal: build in the background, then start**

```
cd /srv/get4domain-site/indianambulance && nohup docker compose build --no-cache > ~/build-indianambulance.log 2>&1 &
tail -3 ~/build-indianambulance.log          # run again until the build finished
cd /srv/get4domain-site/indianambulance && docker compose up -d
docker compose logs --tail=20 frontend          # look for "Ready"
```

**4. VM terminal: add the nginx file and reload**

```
sudo cp /srv/get4domain-site/deployment/nginx/indianambulance.conf /etc/nginx/sites-available/indianambulance
sudo ln -s /etc/nginx/sites-available/indianambulance /etc/nginx/sites-enabled/indianambulance
sudo nginx -t && sudo systemctl reload nginx
```

Cloudflare: add a proxied DNS record `indianambulance` for the zone (same as the other vendor subdomains) if the wildcard does not already cover it. Do not run certbot for this host.

**5. VM terminal: test with curl (read only)**

```
curl -s -o /dev/null -w "direct: %{http_code}\n" http://127.0.0.1:3017/                                                         # 200
curl -s -o /dev/null -w "via nginx: %{http_code}\n" -H "Host: indianambulance.get4domain.com" http://127.0.0.1/                   # 200
curl -s -H "Host: indianambulance.get4domain.com" http://127.0.0.1/robots.txt                                                    # Allow: /  and the sitemap address
curl -s -H "Host: indianambulance.get4domain.com" http://127.0.0.1/sitemap.xml | grep -o '<loc>[^<]*</loc>'
curl -s -H "Host: indianambulance.get4domain.com" http://127.0.0.1/ | grep -o '<title>[^<]*</title>'
curl -s -o /dev/null -w "refresh without secret: %{http_code}\n" -X POST http://127.0.0.1:3017/api/revalidate-site             # 401 = up and asking for the secret
```

**6. Connect it to Website Manager (VM terminal, one vendor, dry run first).** Same commands as `DEPLOYMENT.md` section 13, step 6, with `SUB=indianambulance`:

```
cd /srv/get4domain-site/backend-api && SUB=indianambulance
node scripts/site-doc-flag.js --on --vendor $SUB
SITE_DOC_CONFIRM=I_HAVE_READ_THE_DRY_RUN node scripts/site-doc-flag.js --on --vendor $SUB --apply
node scripts/site-document-backfill.js --vendor $SUB
SITE_DOC_CONFIRM=I_HAVE_READ_THE_DRY_RUN node scripts/site-document-backfill.js --vendor $SUB --apply
node scripts/site-mode.js --connected --vendor $SUB
SITE_DOC_CONFIRM=I_HAVE_READ_THE_DRY_RUN node scripts/site-mode.js --connected --vendor $SUB --apply
```

Read each dry run before its apply line. Then in the browser: the site looks as before; log in as the vendor, change the tagline in Website Manager, press Publish, and the site shows it within seconds; change it back.

## Rollback

```
SITE_DOC_CONFIRM=I_HAVE_READ_THE_DRY_RUN node scripts/site-mode.js --engine --vendor indianambulance --apply      # the site shows its own words again at once, nothing deleted
cd /srv/get4domain-site/indianambulance && docker compose down                                                       # stop and remove the container
sudo rm /etc/nginx/sites-enabled/indianambulance && sudo nginx -t && sudo systemctl reload nginx                     # take the host out of nginx
```

No other site, port or database table is touched by this release, so nothing else needs undoing. To return to the earlier code: `git checkout <earlier commit>` in `/srv/get4domain-site` and rebuild the affected app only.

## Notes for whoever maintains it

- `app/api/revalidate-site/route.ts` differs from `site-connect/revalidate-route.ts` in one line: Next 16's `revalidateTag` takes a second argument (`{ expire: 0 }`, drop the cache at once). `scripts/existing-clients-guard.mjs` allows exactly that difference.
- `middleware.ts` still works on Next 16 (it prints a deprecation notice at build); renaming it to `proxy.ts` is a later change for all apps together.
- The lock file is `package-lock.json` (npm, like the other apps). The export's `pnpm-lock.yaml` is left in place and unused.
