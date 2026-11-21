/**
 * The vendor app: one web manifest per vendor (name, icon, colours) and the install flow. The install button is a PWA install: the browser's own prompt on Android,
 * a short "Add to Home Screen" guide on iOS. No service worker is needed (installability today needs only a manifest with icons, a start address and a display mode).
 * Pure helpers: the page and the route use them, and the tests reach every rule.
 */
export const MANIFEST_PATH = '/app-manifest';
export const ICON_PATH = '/app-icon';
export const ICON_SIZES = [180, 192, 512] as const;

export interface ManifestInput { name: string; shortName?: string | null; description?: string | null; accent: string; background: string; lang?: string }

const clean = (s: string, max: number): string => s.replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

/** The short name an app icon label can hold (about 12 characters, cut at a word where it can). */
export function shortNameOf(name: string): string {
  const n = clean(name, 80);
  if (n.length <= 12) return n;
  const cut = n.slice(0, 12);
  const sp = cut.lastIndexOf(' ');
  return (sp >= 5 ? cut.slice(0, sp) : cut).trim();
}

/** The vendor's web app manifest. `start_url` and `scope` are "/" of the vendor's own host; icons are drawn by the /app-icon route (same host). */
export function buildWebManifest(i: ManifestInput): Record<string, unknown> {
  const name = clean(i.name, 80) || 'Website';
  return {
    id: '/', name, short_name: clean(i.shortName ?? '', 12) || shortNameOf(name), description: clean(i.description ?? '', 200) || undefined,
    start_url: '/', scope: '/', display: 'standalone', orientation: 'portrait', lang: i.lang ?? 'en-IN',
    theme_color: /^#[0-9a-f]{6}$/i.test(i.accent) ? i.accent : '#2563eb', background_color: /^#[0-9a-f]{6}$/i.test(i.background) ? i.background : '#ffffff',
    prefer_related_applications: false,
    icons: [
      { src: `${ICON_PATH}?s=192`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `${ICON_PATH}?s=512`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `${ICON_PATH}?s=512&m=1`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

/** The first letter or digit of a name (upper case), for the icon. */
export function iconLetter(name: string): string {
  const m = /[\p{L}\p{N}]/u.exec(name.trim());
  return (m ? m[0] : 'W').toUpperCase();
}
/** The icon size asked for, kept to the sizes the manifest names. */
export function iconSize(raw: string | null | undefined): number {
  const n = Number(raw);
  return (ICON_SIZES as readonly number[]).includes(n) ? n : 192;
}

export type InstallPlatform = 'ios' | 'android' | 'other';
/** What kind of device is this, from its user agent. iPadOS reports "Macintosh" with touch points, so touch is checked too. */
export function detectPlatform(ua: string, maxTouchPoints = 0): InstallPlatform {
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Macintosh/i.test(ua) && maxTouchPoints > 1) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}
/** Does the install button show? Only on a phone or tablet, and only when the site is not already running as an installed app. */
export function installAvailable(platform: InstallPlatform, standalone: boolean): boolean {
  return !standalone && platform !== 'other';
}
/** The short guide shown on iOS (Safari has no install prompt) and as the Android fallback when the browser has not offered one. */
export function installSteps(platform: InstallPlatform): string[] {
  if (platform === 'ios') return ['Tap the Share button at the bottom of Safari.', 'Scroll down and tap "Add to Home Screen".', 'Tap "Add". The app icon appears on your home screen.'];
  return ['Open the browser menu (the three dots).', 'Tap "Install app" or "Add to Home screen".', 'Confirm. The app icon appears on your home screen.'];
}
