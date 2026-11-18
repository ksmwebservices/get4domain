# SEE IT: the theme marketplace backend (Dispatch TM1)

PowerShell. Run each block exactly as written, **one block at a time**. Nothing here prints a password or a token. Two windows: **Window A** runs the local API and stays busy (Ctrl+C stops it); **Window B** is where you type everything else.

## (a) The theme gallery: every theme for every pack, in a browser, no server

**Window B**

```powershell
cd C:\Get4Domain\get4domain-w2\backend-api
```

```powershell
node scripts/build-theme-gallery.js
```

It writes `C:\Get4Domain\w2-theme-gallery\` (outside the repository, never committed) and prints `theme gallery: 37 themes x 16 packs, 144 rendered, 0 MISSING, 577 files`. Open it:

```powershell
Start-Process C:\Get4Domain\w2-theme-gallery\index.html
```

At the top is the list of **combinations** (clinic with pharmacy, lab and home sample; cloud kitchen with delivery; handyman with a shop; service with a shop; and the rest). Below, each of the 16 packs lists **every theme for it**: the 5 library themes (marked "designed for this category" or "default look") and the **starter themes** built by the team (marked "starter theme", with their add-ons and combinations). Every pack has at least 4 starters. Every page is drawn by the real renderer with an invented sample business; no price is shown. Only the library: `node scripts/build-theme-gallery.js --library-only`.

## (b) Build the starter theme packages (real zip files)

**Window B**

```powershell
node ..\themes\cli.mjs starter --lint --out C:\Get4Domain\w2-theme-gallery\starter-packages
```

It prints one line per theme (`ok starter-clinic-teal (23965 bytes) validator ok, lint ok`) and `32 starter package(s) in ...`. These are the zips the admin screen uploads. A single theme: add `--only starter-clinic-teal`. The list without building: `node ..\themes\cli.mjs starter --list`.

## (c) Start the local API (staging database, throwaway logins)

**Window B**, once:

```powershell
npm.cmd run build
```

```powershell
node scripts/staging/smoke-seed.js
```

**Window A**: start the API (it stays busy).

```powershell
cd C:\Get4Domain\get4domain-w2\backend-api
```

```powershell
node scripts/staging/smoke-api.js
```

**Window B**: check it is up.

```powershell
curl.exe -s http://localhost:3008/health
```

## (d) Sign in as the throwaway SUPER_ADMIN (nothing is printed)

**Window B.** The first line reads the throwaway file into a variable (it prints nothing); the next two make the login and keep the token in `$token` (the password never reaches the screen); the last removes the temporary file.

```powershell
$u = (Get-Content C:\Get4Domain\smoke\users.json -Raw | ConvertFrom-Json).users.superAdmin
```

```powershell
@{ email = $u.email; password = $u.password } | ConvertTo-Json -Compress | Set-Content -Path $env:TEMP\g4d-login.json -NoNewline -Encoding ascii
```

```powershell
$token = (curl.exe -s -X POST http://localhost:3008/auth/login -H "Content-Type: application/json" --data-binary "@$env:TEMP\g4d-login.json" | ConvertFrom-Json).data.accessToken
```

```powershell
Remove-Item $env:TEMP\g4d-login.json
```

Check you are in without printing the token (this prints `True`):

```powershell
$token.Length -gt 20
```

## (e) Check a package, then upload it

**Window B.** First the dry run: every rule is checked, nothing is stored. A good package answers `ok: true`.

```powershell
curl.exe -s -X POST http://localhost:3008/v3/admin/theme-market/validate -H "Authorization: Bearer $token" -F "file=@C:\Get4Domain\w2-theme-gallery\starter-packages\starter-clinic-teal-1.zip;type=application/zip"
```

Now upload it for the marketplace (it becomes a `DRAFT`; the answer has the theme `id`):

```powershell
$up = curl.exe -s -X POST http://localhost:3008/v3/admin/theme-market/themes -H "Authorization: Bearer $token" -F "file=@C:\Get4Domain\w2-theme-gallery\starter-packages\starter-clinic-teal-1.zip;type=application/zip" | ConvertFrom-Json
```

```powershell
$id = $up.data.theme.id
```

```powershell
$up.data.theme | Select-Object key, version, status, visibility, packs, addons, tags
```

Send the same file again: the answer says `replayed: true` and nothing new is stored.

```powershell
(curl.exe -s -X POST http://localhost:3008/v3/admin/theme-market/themes -H "Authorization: Bearer $token" -F "file=@C:\Get4Domain\w2-theme-gallery\starter-packages\starter-clinic-teal-1.zip;type=application/zip" | ConvertFrom-Json).data.replayed
```

## (f) A bad package is refused with every problem named

**Window B.** Make a copy of the package with a script file added (three blocks):

```powershell
Copy-Item C:\Get4Domain\w2-theme-gallery\starter-packages\starter-clinic-teal-1.zip C:\Get4Domain\w2-theme-gallery\bad-theme.zip
```

```powershell
Set-Content -Path C:\Get4Domain\w2-theme-gallery\run.js -Value "alert(1)"
```

```powershell
Compress-Archive -Path C:\Get4Domain\w2-theme-gallery\run.js -Update -DestinationPath C:\Get4Domain\w2-theme-gallery\bad-theme.zip
```

Upload it:

```powershell
curl.exe -s -X POST http://localhost:3008/v3/admin/theme-market/themes -H "Authorization: Bearer $token" -F "file=@C:\Get4Domain\w2-theme-gallery\bad-theme.zip;type=application/zip"
```

Expect HTTP 422, `"code":"THEME_PACKAGE_INVALID"` and `problems` containing `{"file":"run.js","rule":"executable-file","message":".js files are not allowed in a theme",...}`. Nothing was stored. (Every problem of a package is listed in one answer, not one at a time.)

## (g) Preview it, as the admin, before it is published

**Window B.** The preview of a **draft**: the stored package drawn with the sample business of the pack. The headers are printed (look for the strict `Content-Security-Policy` with `sandbox`, `X-Robots-Tag: noindex`, `Cache-Control: private, no-store`, and **no** `Set-Cookie`); the page is saved to a file.

```powershell
curl.exe -s -D - -o C:\Get4Domain\w2-theme-gallery\preview-draft.html "http://localhost:3008/v3/admin/theme-market/themes/$id/preview?pack=CLINIC" -H "Authorization: Bearer $token"
```

```powershell
Start-Process C:\Get4Domain\w2-theme-gallery\preview-draft.html
```

Other pages and packs: change `pack=LAB` or add `&page=about`, `&page=services`, `&page=contact`.

## (h) Send it through review, publish it, and see it appear (no restart)

**Window B.**

```powershell
curl.exe -s -X POST "http://localhost:3008/v3/admin/theme-market/themes/$id/submit" -H "Authorization: Bearer $token"
```

```powershell
curl.exe -s -X POST "http://localhost:3008/v3/admin/theme-market/themes/$id/publish" -H "Authorization: Bearer $token"
```

Now anyone (no sign-in) can list it by pack and by combination, with no restart of the API:

```powershell
curl.exe -s "http://localhost:3008/v3/public/theme-market/themes?pack=CLINIC&tag=clinic-pharmacy-lab-home-sample"
```

The public preview (no sign-in), saved and opened:

```powershell
curl.exe -s -o C:\Get4Domain\w2-theme-gallery\preview-public.html "http://localhost:3008/v3/public/theme-market/themes/starter-clinic-teal/preview?pack=CLINIC"
```

```powershell
Start-Process C:\Get4Domain\w2-theme-gallery\preview-public.html
```

A business on a paid plan and the professional track (not the smoke plumber) sees it in `GET /v3/me/theme-market/themes?pack=CLINIC` and chooses it with the existing `POST /v3/me/site/theme/switch`.

## (i) Put it away

**Window B.** Archive the sample theme (it is no longer offered; the row stays, rows are never deleted):

```powershell
curl.exe -s -X POST "http://localhost:3008/v3/admin/theme-market/themes/$id/archive" -H "Authorization: Bearer $token"
```

In **Window A** press Ctrl+C. Then in **Window B** remove the throwaway logins and check that none are left (the count must print 0):

```powershell
npm.cmd run test:cleanup-staging
```

```powershell
node scripts/staging/test-tenant-cleanup.js --count
```

The archived sample theme row stays in the staging table `g4d_theme_market_packages` (staging only). Delete the helper files with `Remove-Item C:\Get4Domain\w2-theme-gallery -Recurse` when you no longer need the gallery.
