import { BadRequestException } from '@nestjs/common';

/**
 * The Website manager's plan settings (Batch 9). Every number starts UNSET (null): no cap is invented. A feature that needs a setting refuses to work until staff set it
 * (PUT /v3/admin/plan-settings/:key, SUPER_ADMIN). Each slice of this batch adds its own keys here.
 */
export const RASTER_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

export interface WebsiteSettings {
  /** the biggest upload, in bytes; null = media uploads are off */
  mediaMaxBytes: number | null;
  /** the image types an upload may be (a subset of RASTER_TYPES); null = media uploads are off */
  mediaAllowedTypes: string[] | null;
  /** the most pixels (width x height) an image may have; protects the server from decompression bombs; null = media uploads are off */
  mediaMaxPixels: number | null;
}

export const DEFAULT_WEBSITE_SETTINGS: Readonly<WebsiteSettings> = { mediaMaxBytes: null, mediaAllowedTypes: null, mediaMaxPixels: null };
export const WEBSITE_SETTING_KEYS = Object.keys(DEFAULT_WEBSITE_SETTINGS) as Array<keyof WebsiteSettings>;
export const isWebsiteSettingKey = (key: string): key is keyof WebsiteSettings => (WEBSITE_SETTING_KEYS as string[]).includes(key);

const wholeNumber = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1;

export function websiteSettingProblem(key: keyof WebsiteSettings, v: unknown): string | null {
  switch (key) {
    case 'mediaMaxBytes': case 'mediaMaxPixels': return wholeNumber(v) ? null : 'must be a whole number above zero';
    case 'mediaAllowedTypes':
      if (!Array.isArray(v) || v.length === 0 || new Set(v).size !== v.length) return 'must be a list of different image types';
      return v.every((t) => (RASTER_TYPES as readonly string[]).includes(t as string)) ? null : `must only use ${RASTER_TYPES.join(', ')}`;
  }
}

export function validateWebsiteSetting(key: string, value: unknown): void {
  if (!isWebsiteSettingKey(key)) throw new BadRequestException(`${key}: is not a known plan setting`);
  const problem = websiteSettingProblem(key, value);
  if (problem) throw new BadRequestException(`${key}: ${problem}`);
}

/** Stored values over the defaults; an invalid stored value falls back to unset. */
export function resolveWebsiteSettings(stored: Map<string, unknown>): WebsiteSettings {
  const out: Record<string, unknown> = {};
  for (const key of WEBSITE_SETTING_KEYS) { const v = stored.get(key); out[key] = v !== undefined && websiteSettingProblem(key, v) === null ? v : DEFAULT_WEBSITE_SETTINGS[key]; }
  return out as unknown as WebsiteSettings;
}
