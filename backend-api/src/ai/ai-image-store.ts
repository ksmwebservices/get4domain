import { mkdirSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { detectImage, uploadsDir } from '../uploads/uploads.util';

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Providers hand back a temporary image URL (DALL-E's expires in about an hour). Copy the picture into OUR uploads folder and return
 * our permanent URL, so a post, banner or product photo never breaks later. Returns null if it could not be saved (the caller then keeps
 * the temporary URL rather than failing the whole generation). Only real image bytes are written — never whatever the URL served.
 */
export async function persistGeneratedImage(sourceUrl: string, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  try {
    if (!/^https:\/\//i.test(sourceUrl)) return null;
    const res = await fetchImpl(sourceUrl, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_BYTES) return null;
    const kind = detectImage(buf);
    if (!kind || kind.ext === '.svg') return null; // a generated picture is raster; never store text a browser could run
    const dir = uploadsDir();
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const name = `ai_${Date.now()}_${randomBytes(6).toString('hex')}${kind.ext}`;
    writeFileSync(join(dir, name), buf);
    const base = (process.env.PUBLIC_API_URL ?? 'https://gapi.get4domain.com').replace(/\/+$/, '');
    return `${base}/uploads/${name}`;
  } catch {
    return null;
  }
}
