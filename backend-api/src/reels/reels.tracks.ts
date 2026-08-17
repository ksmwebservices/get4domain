export interface MusicTrack {
  id: string;
  name: string;
  /** Served URL of the audio file (e.g. /reel-tracks/uplift.mp3). */
  url: string;
  /** Human note on the license permitting multi-vendor reuse. */
  licenseNote: string;
}

/**
 * Reel background-music registry — EMPTY on purpose.
 *
 * No track is bundled by engineering, because a track must not be added to this
 * shared multi-vendor library without a license permitting that reuse. KSM adds
 * cleared tracks here (with license proof) — see backend-api/remotion/tracks/README.md.
 * Until then, reels render silent (which is valid).
 */
export const MUSIC_TRACKS: MusicTrack[] = [];
