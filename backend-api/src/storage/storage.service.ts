import { Injectable, Logger } from '@nestjs/common';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';

export type StorageStatus = 'ok' | 'not_configured' | 'failed';
export interface StorageResult {
  url: string | null;
  status: StorageStatus;
  error?: string;
}

const DEFAULT_BUCKET = 'vendor-media';

/**
 * Persists media into Supabase Storage via its REST API (no extra SDK — plain fetch,
 * same style as the DALL-E call in AiService). Its reason to exist: AI image providers
 * hand back TEMPORARY URLs (DALL-E expires them in ~1h), so anything that must back a
 * live website — a generated hero banner — has to be re-hosted somewhere durable and
 * the permanent URL stored on the vendor CMS.
 *
 * Config resolves from the `storage` settings category (DB value or env fallback),
 * exactly like every other provider key. When creds are absent it returns
 * `not_configured` rather than throwing, so callers degrade gracefully (fall back to
 * the curated sample image) instead of failing site creation.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(private readonly settings: PlatformSettingsService) {}

  private async config(): Promise<{ baseUrl: string; key: string; bucket: string } | null> {
    const rawUrl = await this.settings.getResolvedValue('storage', 'supabase_url');
    const key = await this.settings.getResolvedValue('storage', 'supabase_service_key');
    if (!rawUrl || !key) return null;
    const baseUrl = rawUrl.replace(/\/+$/, '');
    const bucket = (await this.settings.getResolvedValue('storage', 'bucket')) || DEFAULT_BUCKET;
    return { baseUrl, key, bucket };
  }

  /** True when Supabase Storage credentials are configured (URL + service key). */
  async isConfigured(): Promise<boolean> {
    return (await this.config()) !== null;
  }

  /**
   * Download an image from a (possibly temporary) source URL and re-host it in the
   * bucket at `destPath`, returning the permanent public URL. `x-upsert` so a repeated
   * path overwrites rather than 409s.
   */
  async uploadFromUrl(sourceUrl: string, destPath: string): Promise<StorageResult> {
    const cfg = await this.config();
    if (!cfg) {
      this.logger.warn('Supabase Storage not configured (storage/supabase_url + supabase_service_key)');
      return { url: null, status: 'not_configured' };
    }

    let bytes: ArrayBuffer;
    let contentType = 'image/png';
    try {
      const src = await fetch(sourceUrl);
      if (!src.ok) {
        return { url: null, status: 'failed', error: `source fetch HTTP ${src.status}` };
      }
      contentType = src.headers.get('content-type') || contentType;
      bytes = await src.arrayBuffer();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'network error';
      this.logger.error(`Storage source download failed: ${message}`);
      return { url: null, status: 'failed', error: message };
    }

    return this.uploadBytes(Buffer.from(bytes), destPath, contentType, cfg);
  }

  /** Upload raw bytes to `destPath`. Resolves its own config when not supplied. */
  async uploadBytes(
    body: Buffer,
    destPath: string,
    contentType: string,
    preResolved?: { baseUrl: string; key: string; bucket: string },
  ): Promise<StorageResult> {
    const cfg = preResolved ?? (await this.config());
    if (!cfg) return { url: null, status: 'not_configured' };

    const cleanPath = destPath.replace(/^\/+/, '');
    try {
      const res = await fetch(`${cfg.baseUrl}/storage/v1/object/${cfg.bucket}/${cleanPath}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfg.key}`,
          apikey: cfg.key,
          'Content-Type': contentType,
          'x-upsert': 'true',
          'cache-control': '31536000',
        },
        body: new Uint8Array(body),
      });
      if (!res.ok) {
        const text = (await res.text()).slice(0, 400);
        this.logger.error(`Supabase upload ${res.status}: ${text}`);
        return { url: null, status: 'failed', error: `upload HTTP ${res.status}` };
      }
      return {
        url: `${cfg.baseUrl}/storage/v1/object/public/${cfg.bucket}/${cleanPath}`,
        status: 'ok',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'network error';
      this.logger.error(`Supabase upload failed: ${message}`);
      return { url: null, status: 'failed', error: message };
    }
  }
}
