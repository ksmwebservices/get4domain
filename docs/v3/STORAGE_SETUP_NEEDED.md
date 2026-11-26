# Storage setup the owner must do for picture uploads (names only, never values)

Uploads of a logo, banner and gallery pictures (`POST /v3/me/media`, `POST /v3/me/site/media`, staff `POST /v3/admin/vendors/:id/site/media`) are **refused until every item below is set**. There are no defaults. Set the values yourself; never paste a value into chat, a commit or a document.

The upload path was proved end to end on 25 Nov 2026 against a local S3-compatible server (`backend-api/test/wm-a1-upload-proof.spec.ts`): rules, picture re-encoding, the AWS SDK adapter, the content-hash key, the stored address, delete, and the address being accepted into `hero.image`, `brand.logo` and the gallery.

## 1. Server environment (secret, `api.env` of the API container; names only)

| Name | What it is |
|---|---|
| `STORAGE_PUBLIC_ACCESS_KEY_ID` | access key id of the PUBLIC media bucket |
| `STORAGE_PUBLIC_SECRET_ACCESS_KEY` | secret of that key |
| `STORAGE_PRIVATE_ACCESS_KEY_ID` | access key id of the PRIVATE bucket (identity and payment documents; not needed for site pictures) |
| `STORAGE_PRIVATE_SECRET_ACCESS_KEY` | secret of that key |
| `MEDIA_STORAGE_MODE` | must be **unset** (or anything but `fake`). `fake` keeps pictures in memory and loses them |

## 2. Staff plan settings (not secret; stored in `g4d_plan_settings`; written by SUPER_ADMIN with `PUT /v3/admin/plan-settings/:key`)

Public picture store (required for site pictures):

| Setting key | Rule |
|---|---|
| `storagePublicEndpoint` | https address of the S3-compatible endpoint (Cloudflare R2: `https://<account>.r2.cloudflarestorage.com`) |
| `storagePublicBucket` | bucket name: letters, digits, dots, hyphens |
| `storagePublicRegion` | signing region (R2 uses `auto`) |
| `storagePublicBaseUrl` | the https **custom media domain** pictures are served from; **not** an `r2.dev` address |
| `mediaUploadMaxBytes` | largest file in bytes, a whole number above zero |
| `mediaUploadMaxPixels` | most pixels a picture may have, a whole number above zero |
| `mediaUploadAllowedTypes` | list from `image/jpeg`, `image/png`, `image/webp`, `image/svg+xml`, `application/pdf` |

Private store (only for private documents): `storagePrivateEndpoint`, `storagePrivateBucket`, `storagePrivateRegion`, `storageSignedUrlSeconds` (at most 3600), `storagePrivateMaxBytes`, `storagePrivateMaxPixels`.

## 3. Outside the code

- The bucket exists, the custom media domain points at it over https, and the key pair can put and delete objects in it.
- After setting, one real upload on the V3 site (logo, then banner, then a gallery picture) is the last check: the returned address opens in a browser.
