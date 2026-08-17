export interface MusicTrack {
  id: string;
  name: string;
  /** MP3 filename inside backend-api/remotion/tracks/ — resolved at render time via
   *  Remotion's staticFile() (that folder is the render's public dir). */
  file: string;
  /** Short note on licensing (these were added license-cleared by KSM). */
  licenseNote: string;
}

/**
 * Reel background-music registry.
 *
 * These 14 tracks were dropped into backend-api/remotion/tracks/ by KSM as
 * license-cleared royalty-free music. Register only tracks whose license permits
 * multi-vendor reuse (see backend-api/remotion/tracks/README.md). The reel builder
 * lists these by id + name; the renderer plays the file via staticFile().
 *
 * NOTE: a duplicate download `miromaxmusic-…-513944 (1).mp3` (byte-identical to
 * `…-513944.mp3`) is intentionally NOT registered — only the canonical file is.
 */
const LICENSE = 'License-cleared royalty-free (added by KSM)';

export const MUSIC_TRACKS: MusicTrack[] = [
  { id: 'joyful-welcome', name: 'Joyful Welcome', file: 'alex-morgan-joyful-welcome-intro-music-583240.mp3', licenseNote: LICENSE },
  { id: 'news-headline', name: 'News Headline', file: 'alex-morgan-news-intro-headline-broadcast-open-575875.mp3', licenseNote: LICENSE },
  { id: 'vlog-hook', name: 'Vlog Hook', file: 'alex-morgan-vlog-intro-quick-hook-opener-578466.mp3', licenseNote: LICENSE },
  { id: 'breaking-news', name: 'Breaking News', file: 'grand_project-breaking-news-background-music-505617.mp3', licenseNote: LICENSE },
  { id: 'easy-background', name: 'Easy Background', file: 'ikoliks_aj-background-music-320427.mp3', licenseNote: LICENSE },
  { id: 'promo-upbeat', name: 'Promo Upbeat', file: 'miromaxmusic-music-promotion-no-copyright-513944.mp3', licenseNote: LICENSE },
  { id: 'ambient-flow', name: 'Ambient Flow', file: 'nastelbom-background-music-463062.mp3', licenseNote: LICENSE },
  { id: 'soft-background', name: 'Soft Background', file: 'paulyudin-background-background-music-574010.mp3', licenseNote: LICENSE },
  { id: 'news-alert', name: 'News Alert', file: 'paulyudin-breaking-news-494566.mp3', licenseNote: LICENSE },
  { id: 'intro-sting', name: 'Intro Sting', file: 'paulyudin-intro-intro-music-573973.mp3', licenseNote: LICENSE },
  { id: 'corporate', name: 'Corporate', file: 'sigmamusicart-background-music-corporate-551330.mp3', licenseNote: LICENSE },
  { id: 'news-drama', name: 'News Drama', file: 'sigmamusicart-breaking-news-551355.mp3', licenseNote: LICENSE },
  { id: 'uplift-intro', name: 'Uplift Intro', file: 'the_mountain-intro-intro-song-576574.mp3', licenseNote: LICENSE },
  { id: 'background-vibe', name: 'Background Vibe', file: 'verclub_music-background-music-571037.mp3', licenseNote: LICENSE },
];
