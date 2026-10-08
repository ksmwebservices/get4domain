/**
 * Reels and video are not offered yet (KSM, Release 1A): the reel renderer is not installed in the container and video runs in mock mode.
 * ONE switch for the whole product. While it is on, the reel and video endpoints answer "coming soon" BEFORE touching the wallet, so nobody
 * is ever charged for something that cannot be delivered. Reel SCRIPT writing (plain text) is a different feature and keeps working.
 */
export const REEL_VIDEO_COMING_SOON = true;
export const REEL_VIDEO_COMING_SOON_MESSAGE = 'Reels and video are coming soon. Nothing was charged to your wallet. You can still write reel scripts and captions in AI Studio.';
