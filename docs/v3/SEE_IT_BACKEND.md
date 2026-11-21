# SEE IT: the backend work of Dispatch G1

PowerShell. Run each block exactly as written, one block at a time. Nothing here prints a password or token.

## (a) The theme gallery: every theme for every pack, in a browser, no server

**Window B** (the only window needed):

```powershell
cd C:\Get4Domain\get4domain-w2\backend-api
node scripts/build-theme-gallery.js
```

It writes `C:\Get4Domain\w2-theme-gallery\` (outside the repository; never committed) and prints `5 themes x 16 packs, 80 rendered, 0 MISSING`. Open it:

```powershell
Start-Process C:\Get4Domain\w2-theme-gallery\index.html
```

The index lists the 16 packs; each row is a theme with links to its home, services, about and contact pages. A row says whether the theme was **designed for that pack's category** or is shown with its **default look**, and a theme that cannot draw a page says **MISSING**. Content is the pack's sample business (invented, no price, no offer). To redo one pack: `node scripts/build-theme-gallery.js --packs PHARMACY --pages home`.

## (b) The local smoke API on staging, with throwaway logins

**Window B**, once: build and make the throwaway logins.

```powershell
cd C:\Get4Domain\get4domain-w2\backend-api
npm.cmd run build
```

```powershell
node scripts/staging/smoke-seed.js
```

**Window A**: start the API (it stays busy; Ctrl+C stops it).

```powershell
cd C:\Get4Domain\get4domain-w2\backend-api
node scripts/staging/smoke-api.js
```

**Window B**: check it is up.

```powershell
curl.exe -s http://localhost:3008/health
```

The vendor logins are in `C:\Get4Domain\smoke\users.json` (never open or paste it). The paid vendor `vendorPaid` has subdomain `smoke-paid-site`, a Pro plan and so takes enquiries.

## (c) Post a test enquiry and see it in the vendor inbox

**Window B**, with the API running. The host is the paid smoke vendor's site. This is exactly what the theme form posts:

```powershell
curl.exe -s -i -X POST "http://localhost:3008/v3/public/sites/smoke-paid-site.get4domain.com/enquire" --data-urlencode "name=Smoke Visitor" --data-urlencode "phone=9876500123" --data-urlencode "message=Do you repair geysers?" --data-urlencode "consent=on" --data-urlencode "source=site"
```

Expect `HTTP 200` and `{"received":true,...}`. Post it again: the same reference comes back and nothing new is stored. A browser-style post (`-H "Accept: text/html"`) answers `303` with `Location: /?enquiry=sent`. Leaving out `consent=on` answers `400 REQUEST_INVALID`.

Now read it as the vendor. Sign in with the `vendorPaid` e-mail and password from `users.json` (read them yourself; do not paste them here), then:

```powershell
$login = curl.exe -s -X POST http://localhost:3008/auth/login -H "Content-Type: application/json" -d "{\"email\":\"PASTE-EMAIL\",\"password\":\"PASTE-PASSWORD\"}" | ConvertFrom-Json
$token = $login.data.accessToken
curl.exe -s http://localhost:3008/v3/me/inbox -H "Authorization: Bearer $token"
curl.exe -s http://localhost:3008/v3/me/requests -H "Authorization: Bearer $token"
```

The first list is the inbox the vendor's Enquiries screen reads (one row, state `NEW`, forward status `SKIPPED_FLAG_OFF` because the e-mail flag is the owner's); the second is the same enquiry as a request with status `DELIVERED`. To see the tab badge: `curl.exe -s http://localhost:3008/v3/me/inbox/waiting -H "Authorization: Bearer $token"` (this one shows the held count only).

When finished, in Window A press Ctrl+C, then in Window B remove what the seed made:

```powershell
npm.cmd run test:cleanup-staging
node scripts/staging/test-tenant-cleanup.js --count
```
