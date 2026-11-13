import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { isHttpsEndpoint, isSafeMediaBaseUrl, isSafeName } from '../core/storage-core';

/**
 * Storage settings (Amendment 12 Q2, stored in g4d_plan_settings). Only NON-secret values live here: endpoints, bucket names, the custom media domain and limits. The access keys live ONLY in the
 * server environment (names in docs/v3/V3_STORAGE.md). Nothing has an invented default: an unset value keeps its store switched off, and a store that is off refuses instead of pretending.
 */
export interface StorageSettings {
  /** S3-compatible endpoint of the public bucket (Cloudflare R2: https://<account>.r2.cloudflarestorage.com); null = public storage is off */
  storagePublicEndpoint: string | null;
  storagePublicBucket: string | null;
  /** the custom media domain pictures are served from (https, never the r2.dev address); null = public storage is off */
  storagePublicBaseUrl: string | null;
  /** signing region of the public store (R2 uses "auto"); null = public storage is off */
  storagePublicRegion: string | null;
  /** S3-compatible endpoint of the PRIVATE bucket (Contabo Object Storage, R2 or any S3 endpoint); null = the private store is off */
  storagePrivateEndpoint: string | null;
  storagePrivateBucket: string | null;
  storagePrivateRegion: string | null;
  /** how long a signed download link lives, in seconds; null = signed links are refused */
  storageSignedUrlSeconds: number | null;
  /** the biggest private file in bytes; null = private uploads are refused */
  storagePrivateMaxBytes: number | null;
  /** the most pixels an image kept in the private store may have; null = private image uploads are refused */
  storagePrivateMaxPixels: number | null;
}
export const DEFAULT_STORAGE_SETTINGS: Readonly<StorageSettings> = {
  storagePublicEndpoint: null, storagePublicBucket: null, storagePublicBaseUrl: null, storagePublicRegion: null, storagePrivateEndpoint: null, storagePrivateBucket: null, storagePrivateRegion: null,
  storageSignedUrlSeconds: null, storagePrivateMaxBytes: null, storagePrivateMaxPixels: null,
};
export const STORAGE_SETTING_KEYS = Object.keys(DEFAULT_STORAGE_SETTINGS) as Array<keyof StorageSettings>;
export const isStorageSettingKey = (key: string): key is keyof StorageSettings => (STORAGE_SETTING_KEYS as string[]).includes(key);
const whole = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0;
/** A signed link may not outlive an hour: short-lived links are on the Amendment 12 checklist. */
export const MAX_SIGNED_URL_SECONDS = 3600;

export function storageSettingProblem(key: keyof StorageSettings, v: unknown): string | null {
  switch (key) {
    case 'storagePublicEndpoint': case 'storagePrivateEndpoint': return typeof v === 'string' && isHttpsEndpoint(v) ? null : 'must be an https address of the storage endpoint';
    case 'storagePublicBaseUrl': return typeof v === 'string' && isSafeMediaBaseUrl(v) ? null : 'must be an https custom media domain (not an r2.dev address)';
    case 'storagePublicBucket': case 'storagePrivateBucket': case 'storagePublicRegion': case 'storagePrivateRegion': return typeof v === 'string' && isSafeName(v) ? null : 'must be letters, digits, dots and hyphens';
    case 'storageSignedUrlSeconds': return whole(v) && v <= MAX_SIGNED_URL_SECONDS ? null : `must be a whole number of seconds, at most ${MAX_SIGNED_URL_SECONDS}`;
    default: return whole(v) ? null : 'must be a whole number above zero';
  }
}
export function validateStorageSetting(key: string, value: unknown): void {
  if (!isStorageSettingKey(key)) throw new BadRequestException(`${key}: is not a known plan setting`);
  const problem = storageSettingProblem(key, value);
  if (problem) throw new BadRequestException(`${key}: ${problem}`);
}
export function resolveStorageSettings(rows: Map<string, unknown>): StorageSettings {
  const out = { ...DEFAULT_STORAGE_SETTINGS } as unknown as Record<string, unknown>;
  for (const k of STORAGE_SETTING_KEYS) if (rows.has(k) && storageSettingProblem(k, rows.get(k)) === null) out[k] = rows.get(k);
  return out as unknown as StorageSettings;
}

@Injectable()
export class StorageSettingsService {
  private cached: { at: number; v: StorageSettings } | null = null;
  clock: () => number = () => Date.now();
  constructor(private readonly prisma: PrismaService) {}
  invalidate(): void { this.cached = null; }
  async get(): Promise<StorageSettings> {
    const now = this.clock();
    if (this.cached && now - this.cached.at < 15_000) return this.cached.v;
    const rows = await this.prisma.v3PlanSetting.findMany({ where: { key: { in: STORAGE_SETTING_KEYS as string[] } } });
    const v = resolveStorageSettings(new Map(rows.map((r) => [r.key, r.valueJson])));
    this.cached = { at: now, v };
    return v;
  }
}
