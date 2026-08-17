# Reel music tracks — licensed only

This folder holds the background-music tracks offered in the reel builder.

**It ships empty on purpose.** No track is bundled by the engineering build, because
a track must not be added to a shared, multi-vendor library without a license that
permits that reuse.

## How KSM adds a track (per track)

1. Obtain a royalty-free track whose license explicitly allows use in end-vendor
   commercial content across all Get4Domain vendors (e.g. a purchased license or a
   clearly-permissive CC0 track). Keep the license proof.
2. Drop the audio file here (e.g. `tracks/uplift.mp3`).
3. Register it in the backend track registry (`src/reels/reels.tracks.ts`): add
   `{ id, name, file, licenseNote }`. The reel builder then lists it.

Until a track is registered, reels render **silent** (no music) — which is valid.

Do NOT commit any track whose license you cannot produce on request.
