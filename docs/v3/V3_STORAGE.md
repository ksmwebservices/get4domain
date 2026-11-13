# V3 storage (Block 4b, slice 1; Amendment 12 Q2)

Two stores behind ports. Nothing here has been run against a real provider: every test uses a fake, and every value starts unset, so an unconfigured store refuses (`STORAGE_NOT_CONFIGURED`) instead of pretending.

| Store | Port | Adapter | Holds | Reads |
|---|---|---|---|---|
| Public media | `MediaStoragePort` (existing) | `S3PublicStorage` (Cloudflare R2, S3 API) | logos, pictures, banners, theme assets | custom media domain only, never `r2.dev` |
| Private | `PrivateObjectStore` | `S3PrivateStorage` (any S3 endpoint: Contabo Object Storage, R2) | identity documents, payment proofs | signed links of a few minutes, or a server-side read that is logged first |

## Environment variable names (values are never printed, logged or returned)

| Name | What |
|---|---|
| `STORAGE_PUBLIC_ACCESS_KEY_ID` | token for the public bucket only (write, no list) |
| `STORAGE_PUBLIC_SECRET_ACCESS_KEY` | its secret |
| `STORAGE_PRIVATE_ACCESS_KEY_ID` | token for the private bucket only |
| `STORAGE_PRIVATE_SECRET_ACCESS_KEY` | its secret |
| `IDENTITY_DOC_KEY` | existing: AES-GCM key the registrar documents are sealed with before they reach the private store |

One least-privilege token per bucket. Rotation: create the new token, put it in the server environment, restart, check one upload and one signed link, delete the old token. Nothing else reads these names.

## Settings (g4d_plan_settings, SUPER_ADMIN, all start unset)

`storagePublicEndpoint`, `storagePublicBucket`, `storagePublicRegion` (R2 uses `auto`), `storagePublicBaseUrl` (the custom media domain, https, not r2.dev), `storagePrivateEndpoint`, `storagePrivateBucket`, `storagePrivateRegion`, `storageSignedUrlSeconds` (at most 3600), `storagePrivateMaxBytes`, `storagePrivateMaxPixels`. The public store is on only when all four public values and both public keys are present; the private store likewise.

## Owner checklist (Amendment 12 Q2) and where each item lives

| Item | How |
|---|---|
| Separate buckets, private by default | two settings sets, two token pairs; the private adapter never builds a public URL |
| Short-lived signed URLs | `PrivateFilesService.signedUrl`, clamped to `storageSignedUrlSeconds` and a 3600 s cap |
| Lifecycle deletion per retention | each private object carries `x-amz-meta-retain-until` (written from the caller's retention, which comes from settings set by counsel). **Owner action:** add the bucket lifecycle rule in the provider panel; the app also deletes through `PrivateFilesService.remove`. |
| CORS limited to our domains | **Owner action** in the provider panel (the app sends no browser upload directly) |
| Access log for the identity bucket | table `g4d_storage_access`, append-only (trigger), written BEFORE any put, read, signed link or delete; if the row cannot be written nothing happens |
| Size limits and image re-encoding | `storagePrivateMaxBytes`; pictures decoded and re-encoded through `ImagePort` (metadata and non-pixel data dropped) |
| Virus scan for non-image uploads | `ContentScanPort`. **No scanner is bound yet** (`NoScanner`), so a PDF is refused with `STORAGE_SCAN_UNAVAILABLE`, never stored unscanned. A ClamAV adapter is the next step. |
| Backups kept separately | **Owner action:** object storage is not a backup |

## Not done in this slice

The registrar still keeps its sealed document in the database column. `PrivateFilesService` is ready for it (the registrar seals with AES-GCM first, then hands the sealed bytes over), but switching the identity service over needs a column for the object key and a data move, which is a separate, reviewed change.
Note that sealed bytes are not a PDF or an image, so that switch also needs a `sealed` upload path with its own scan rule (the plain document is scanned before sealing).
