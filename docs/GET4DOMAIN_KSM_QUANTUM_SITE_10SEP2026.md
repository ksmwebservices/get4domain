# KSM Quantum Technologies — corporate site (new app) — 10 Sep 2026

## ⚠ Domain assumption to confirm
Built for **`ksmquantum.get4domain.com`** (`.com`, to match every other domain
in this project). KSM's brief said `.in` — assumed a typo. **If `.in` is actually intended**,
change it in ONE place and rebuild: `SITE.url` in `ksm-quantum/src/data/site.ts` (drives metadata,
canonicals, sitemap, OG). Also update the `host` line in `ksm-quantum/src/app/robots.ts` and the
absolute URLs in `ksm-quantum/public/llms.txt`.

## STEP 0 — infra pattern (followed, not reinvented)
Every sibling app is a self-contained dir with a Next **standalone** `Dockerfile` + its own
`docker-compose.yml` (service `frontend`, unique `container_name`, own port + bridge network,
`restart: unless-stopped`). Ports in use on the VM: **3000/3001** mrtravels, **3006** get4domain,
**3008** backend-api, **3010** allwintours, **3011** vallavan-backend, **3012** hidude-backend.
New app uses **3014** (`container_name: ksm_quantum`, net `ksm_quantum_net`) — same pattern, no new
convention. (Originally scoped to 3012, but that port is legitimately owned by hidude-backend on the
VM, so ksm-quantum was moved to the confirmed-free 3014.)

**DNS/SSL:** nginx/DNS are VM-level (not in this repo). Per
`docs/GET4DOMAIN_SUBDOMAIN_INFRA_REQUIREMENT.md`, a wildcard `*.get4domain.com` cert/DNS is **NOT
confirmed**. Treat this as: the new subdomain needs its **own DNS A record + nginx server block +
TLS cert** (same as adding any sibling host). See STEP 5.

## What was built — `ksm-quantum/` (new Next.js 15 App Router app, TS + Tailwind)
Pages (all server-rendered / statically prerendered):
- `/` Home — hero "Technology that builds what's next.", stats, 4 products, capabilities, approach, FAQ, CTA
- `/about` — Our Story, Founder & CEO (K. S. Murugavel), Vision & Mission, FAQ
- `/products` — Get4Domain, SignBot, NextBOS, HiDude (cards + detail rows, external links)
- `/technology` — Software Eng, AI, Cloud, Web, Mobile, Automation + stack + principles
- `/contact` — email/address/company cards + mailto contact form + product links

**Design:** dark, premium, engineering-grid + slow gradient-sweep motif (deliberately NOT
blur-blobs/glassmorphism), Space Grotesk display + Inter body + JetBrains Mono labels (via
`next/font`, self-hosted), hairline borders, gradient accents, scroll-reveal animation
(lightweight IntersectionObserver — no animation library), mobile-first with hamburger nav.
Justification for dark direction: parent technology/"quantum" company positioning, and it reads
distinct from get4domain.com's lighter SMB look.

**SEO/GEO/AEO from day one** (applying the get4domain lessons):
- Per-page **self-referencing canonical** (incl. home) — NO global-canonical bug.
- `robots.ts` explicitly **Allows the AI crawlers** (GPTBot, ClaudeBot, Google-Extended, Perplexity,
  etc.) + Sitemap line — reused pattern.
- `sitemap.xml` (5 real routes), `llms.txt` (GEO), Organization + WebSite JSON-LD site-wide,
  **FAQPage** JSON-LD on home + about (AEO), ItemList on products, per-page meta + OG.

## STEP 4 — verify (done)
- `tsc` clean; **production build succeeded** (10 static routes incl. robots.txt + sitemap.xml).
- **Visually verified** (screenshots): home hero + products (desktop), about "Our Story" (reveal
  works), and **mobile 375px** (hamburger nav + single-column hero + 2-col stats).
- Routes checked live: robots allows GPTBot + has sitemap; sitemap 5 URLs; llms.txt 200; home
  JSON-LD = Organization + WebSite + FAQPage (all parse).

## STEP 5 — deploy (no VM access here → run these in the VM terminal)
```bash
# 1. Pull the new app
cd /srv/get4domain-site && git pull origin get4domain-site

# 2. Build & run the container (same pattern as the other apps)
cd /srv/get4domain-site/ksm-quantum && docker compose build frontend && docker compose up -d frontend
# → serves on 127.0.0.1:3014
```
Then wire the subdomain (VM/registrar level — KSM, not automated here):
```bash
# 3a. DNS: add an A record  ksmquantum.get4domain.com → <VM public IP>
#     (or confirm the wildcard *.get4domain.com already resolves)

# 3b. nginx server block (e.g. /etc/nginx/sites-available/ksmquantum):
server {
  server_name ksmquantum.get4domain.com;
  location / {
    proxy_pass http://127.0.0.1:3014;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
# ln -s .../sites-available/ksmquantum /etc/nginx/sites-enabled/ && nginx -t && systemctl reload nginx

# 3c. TLS cert for the new host:
certbot --nginx -d ksmquantum.get4domain.com
```
- **Cloudflare note (GEO):** if this subdomain is proxied through the same Cloudflare zone that has
  the "managed robots.txt / block AI bots" setting, it will inject the same AI-bot block over our
  origin robots.txt. Verify that setting is off for this hostname if AI crawlers should reach it.

## Honest status
Complete: all 5 pages built, styled, responsive, SEO/GEO/AEO wired, tsc + build clean, visually
verified (home + about + mobile). Not done by me (needs VM/registrar access): the actual container
deploy, DNS record, nginx block and TLS cert — commands above.
