# V3 go-live checklist

## 1. Remove the `X-Robots-Tag: noindex, nofollow` from the V3 test hosts

On 25 Nov 2026 the header was added so the V3 test hostnames are not indexed as duplicates of the production domain. At go-live, remove it from the `v3site` and `v3directory` blocks. Keep it on `v3api` (an API host is never indexed).

Host `13.140.184.87` (nginx on the host, not in the `v3live` container). Files:

- `/etc/nginx/sites-available/v3site.get4domain.com.conf`
- `/etc/nginx/sites-available/v3directory.get4domain.com.conf`

In each file, inside `location / { ... }`, delete these two lines (they were added after the `include snippets/g4d-headers-site.conf;` line):

```
proxy_hide_header X-Robots-Tag;
add_header X-Robots-Tag "noindex, nofollow" always;
```

Removing `proxy_hide_header` lets the application's own robots rules (for example the noindex it sends for pages that are not published) reach the browser again.

Do not touch `v3-vendor-sites.get4domain.com.conf`, `v3app`, `v3partner`, `v3admin`, or any V2 file.

Rollback used on 25 Nov (puts all three files back to their state before the header, then tests and reloads). The backups are named `<file>.bak-noindex-20261125-165928`:

```
ssh contabo 'cd /etc/nginx/sites-available && for f in v3api v3site v3directory; do sudo -n cp -p $f.get4domain.com.conf.bak-noindex-20261125-165928 $f.get4domain.com.conf; done && sudo -n nginx -t && sudo -n systemctl reload nginx'
```

For go-live, the same command restores `v3site` and `v3directory` (restore only those two, drop `v3api` from the loop to keep the API noindex), then check:

```
curl -sI https://v3site.get4domain.com/ | grep -i x-robots-tag
```

No `X-Robots-Tag` line from nginx means the header is gone. The application may still send its own on some pages.

Also check, before go-live, that `robots.txt` and the sitemap name the host you want indexed (they name `get4domain.com` today).
