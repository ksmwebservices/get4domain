# Host nginx files for the V3 live hosts (E1c)

These are plain text templates. Nothing here was installed or tested against a real nginx. `RUNBOOK.md` (one level up) installs them, one command per block.

| File | Host | Goes to | Notes |
|---|---|---|---|
| `api.get4domain.com.conf` | `api.` | API, port 3008 | 25 MB body limit; API security headers |
| `app.get4domain.com.conf` | `app.` | vendor SPA, port 3101 | noindex; the container owns the CSP |
| `admin.get4domain.com.conf` | `admin.` | admin SPA, port 3102 | noindex |
| `partner.get4domain.com.conf` | `partner.` | partner SPA, port 3103 | noindex |
| `directory.get4domain.com.conf` | `directory.` | public site, port 3006 | robots rules come from the application |
| `mrtravels.get4domain.com.conf`, `s2travels.get4domain.com.conf` | V2 clients | the owner's upstream | install only if no rule exists; `nginx -t` fails until the upstream is filled |
| `snippets/*.conf` | shared | `/etc/nginx/snippets/` | proxy headers, gzip, per-kind security headers |
| `update-cloudflare-ips.sh` | | run once on the host | writes `/etc/nginx/snippets/cloudflare-realip.conf` from Cloudflare's own lists |
| `WILDCARD_SWITCH_LATER.md` | | not part of the first deploy | the wildcard `*.get4domain.com` stays on V2 |

Placeholders to fill (with `sed`, see the runbook): `__V3_BIND_IP__` (the LXD container's address), `__TLS_CERT__`, `__TLS_KEY__`, `__MRTRAVELS_UPSTREAM__`, `__S2TRAVELS_UPSTREAM__`. A file still holding a `__` placeholder must not be enabled; the runbook checks with `grep`.

Design choices, once:

- **One `location /` per server.** `add_header` in a location replaces, not adds to, the server's headers; one location means nothing is lost.
- **`proxy_hide_header` before `add_header`**, so a header the upstream already sends is replaced, never duplicated. The SPA hosts hide and set only `X-Robots-Tag` and HSTS: the container's own CSP, frame and referrer headers pass through untouched.
- **`X-Forwarded-For` is set to the real address, not appended**, and the real address comes from `CF-Connecting-IP` only for Cloudflare peers. The API's `TRUSTED_PROXIES` must contain the address the host nginx connects from (the LXD bridge address) and the Docker network subnet the public site calls from.
- **`listen 443 ssl http2;`** is the form that works on Ubuntu 24.04's nginx 1.24 (newer versions only warn that it is deprecated).
- **No HSTS `includeSubDomains` or `preload`**: the V2 hosts share the domain and must not be pinned by a V3 header.
