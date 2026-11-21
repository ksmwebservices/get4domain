import { SiteSettingsRow } from '../publish/site.repository';

/** Headers on every preview page: never indexed, never cached, marked as a preview. */
export const previewHeaders = (contentType: string): Record<string, string> => ({
  'Content-Type': contentType, 'X-Robots-Tag': 'noindex, nofollow, noarchive', 'Cache-Control': 'no-store', 'X-Preview': '1',
  'Content-Security-Policy': "default-src 'none'; style-src 'self' 'unsafe-inline'; img-src https: data:; font-src https: data:; frame-ancestors 'self'",
});

export const settingsView = (s: SiteSettingsRow) => ({ themeId: s.themeId, language: s.language, variant: s.variant, motionIntensity: s.motionIntensity, forceNoindex: s.forceNoindex });
