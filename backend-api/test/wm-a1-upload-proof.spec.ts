import * as http from 'http';
import { AddressInfo } from 'net';
import sharp from 'sharp';
import { toRendererInput } from '../src/site-publish/content/content-adapter';
import { SourceDocument } from '../src/site-publish/content/content-types';
import { MediaUploadService } from '../src/v3-media-upload/media-upload.service';
import { S3PublicStorage } from '../src/v3-storage/s3.adapters';
import { StorageSettings, StorageSettingsService, UPLOAD_TYPES } from '../src/v3-storage/settings/storage-settings';
import { SharpImagePort } from '../src/v3-website/media/media.ports';
import { applyToSource, emptyDoc, validateBrand, writeField, writeList } from '../src/v3-website/core/managed-doc';
import { MemoryMediaUploadStore } from './support/memory-media-upload-store';

/**
 * Website Manager lane A, item b: the upload path end to end against a LOCAL S3-compatible target (a small HTTP server that speaks the path-style PUT, GET and DELETE of the S3 API).
 * Real code under test: the upload rules, the real picture re-encoder (sharp), the real AWS SDK adapter (S3PublicStorage), the content-hash key. The keys below are test strings,
 * not secrets. Nothing leaves this machine.
 */
jest.setTimeout(120_000);

type Stored = { body: Buffer; contentType: string; cacheControl: string };
let server: http.Server; let base = ''; const objects = new Map<string, Stored>(); const calls: string[] = [];

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const key = decodeURIComponent((req.url ?? '').split('?')[0]);
      calls.push(`${req.method} ${key}`);
      if (req.method === 'PUT') {
        // the SDK may send the body as aws-chunked; unwrap it to the plain bytes
        let body = Buffer.concat(chunks);
        if (String(req.headers['content-encoding'] ?? '').includes('aws-chunked') || /^[0-9a-f]+;chunk-signature=/.test(body.subarray(0, 80).toString('latin1'))) {
          const parts: Buffer[] = []; let i = 0;
          while (i < body.length) { const eol = body.indexOf('\r\n', i); const size = parseInt(body.subarray(i, eol).toString('latin1').split(';')[0], 16); if (!size) break; parts.push(body.subarray(eol + 2, eol + 2 + size)); i = eol + 2 + size + 2; }
          body = Buffer.concat(parts);
        }
        objects.set(key, { body, contentType: String(req.headers['content-type'] ?? ''), cacheControl: String(req.headers['cache-control'] ?? '') });
        res.writeHead(200, { ETag: '"fake"' }); res.end();
      } else if (req.method === 'DELETE') { objects.delete(key); res.writeHead(204); res.end(); }
      else if (req.method === 'GET') { const o = objects.get(key); if (!o) { res.writeHead(404); res.end(); } else { res.writeHead(200, { 'content-type': o.contentType }); res.end(o.body); } }
      else { res.writeHead(405); res.end(); }
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { await new Promise<void>((r) => server.close(() => r())); });
beforeEach(() => { objects.clear(); calls.length = 0; });

const settings = (): StorageSettings => ({
  storagePublicEndpoint: base, storagePublicBucket: 'media', storagePublicRegion: 'auto', storagePublicBaseUrl: `${base}/media`,
  storagePrivateEndpoint: null, storagePrivateBucket: null, storagePrivateRegion: null, storageSignedUrlSeconds: null, storagePrivateMaxBytes: null, storagePrivateMaxPixels: null,
  mediaUploadMaxBytes: 2_000_000, mediaUploadMaxPixels: 10_000_000, mediaUploadAllowedTypes: [...UPLOAD_TYPES],
});
const settingsSvc = { get: async () => settings() } as unknown as StorageSettingsService;
const env = () => ({ STORAGE_PUBLIC_ACCESS_KEY_ID: 'test-key-id', STORAGE_PUBLIC_SECRET_ACCESS_KEY: 'test-secret-value-not-real' });
const make = () => new MediaUploadService(new MemoryMediaUploadStore(), new S3PublicStorage(settingsSvc, env), new SharpImagePort(), settingsSvc);
const png = (w: number, h: number, rgb: [number, number, number]) => sharp({ create: { width: w, height: h, channels: 3, background: { r: rgb[0], g: rgb[1], b: rgb[2] } } }).png().toBuffer();
const actor = { type: 'VENDOR' as const, id: 'u1', ip: null };
const scope = { kind: 'VENDOR' as const, vendorId: 'v1' };
const file = (b: Buffer) => ({ buffer: b, mimetype: 'image/png', size: b.length });

describe('upload end to end against a local S3-compatible target', () => {
  it('a logo upload: stored under a key made from ids and the content hash, served from the media base, re-encoded, cached for a year', async () => {
    const svc = make();
    const m = await svc.upload(scope, actor, file(await png(200, 100, [10, 120, 200])), 'Our logo');
    expect(m).toMatchObject({ kind: 'IMAGE', contentType: 'image/png', width: 200, height: 100, altText: 'Our logo' });
    expect(m.url).toMatch(new RegExp(`^${base}/media/vendors/v1/uploads/[0-9a-f]{64}\\.png$`));
    expect(calls).toEqual([expect.stringMatching(/^PUT \/media\/vendors\/v1\/uploads\/[0-9a-f]{64}\.png$/)]);
    const got = await fetch(m.url);
    expect(got.status).toBe(200); expect(got.headers.get('content-type')).toBe('image/png');
    const meta = await sharp(Buffer.from(await got.arrayBuffer())).metadata();
    expect(meta).toMatchObject({ format: 'png', width: 200, height: 100 });
    expect([...objects.values()][0].cacheControl).toContain('immutable');
  });

  it('the same file twice is one stored object; removing it deletes the object', async () => {
    const svc = make(); const bytes = await png(120, 60, [200, 30, 30]);
    const a = await svc.upload(scope, actor, file(bytes), 'Banner'); const b = await svc.upload(scope, actor, file(bytes), 'Banner');
    expect(b.id).toBe(a.id); expect(calls.filter((c) => c.startsWith('PUT'))).toHaveLength(1);
    await svc.remove(scope, a.id, actor);
    expect(calls.filter((c) => c.startsWith('DELETE'))).toHaveLength(1); expect(objects.size).toBe(0);
  });

  it('a file that is not a picture, a missing description and a switched-off store are refused before anything is sent', async () => {
    const svc = make();
    await expect(svc.upload(scope, actor, { buffer: Buffer.from('MZ not a picture'), mimetype: 'image/png', size: 16 }, 'x')).rejects.toBeTruthy();
    await expect(svc.upload(scope, actor, file(await png(20, 20, [1, 2, 3])), '')).rejects.toBeTruthy();
    expect(calls).toEqual([]);
    const off = new MediaUploadService(new MemoryMediaUploadStore(), new S3PublicStorage(settingsSvc, () => ({})), new SharpImagePort(), settingsSvc);
    await expect(off.upload(scope, actor, file(await png(20, 20, [1, 2, 3])), 'x')).rejects.toMatchObject({ response: { code: expect.stringMatching(/STORAGE_NOT_CONFIGURED/) } });
    expect(calls).toEqual([]);
  });

  it('banner, logo and gallery: the stored address is accepted into hero.image, brand.logo and the gallery, and reaches the page content', async () => {
    const svc = make();
    const banner = await svc.upload(scope, actor, file(await png(300, 120, [5, 5, 5])), 'Shop front');
    const logo = await svc.upload(scope, actor, file(await png(80, 80, [50, 60, 70])), 'Logo');
    const shot = await svc.upload(scope, actor, file(await png(160, 90, [90, 10, 10])), 'A finished job');
    // the live media base is an https custom domain; the local one is http, so the same stored paths are used under an https base for the document check
    const live = (u: string) => u.replace(base, 'https://media.example.test');
    expect(writeField(emptyDoc(), 'hero.image', banner.url).ok).toBe(false);   // an http address is refused: the real base is https
    let doc = emptyDoc();
    const f = writeField(doc, 'hero.image', live(banner.url)); if (!f.ok) throw new Error(f.message); doc = f.doc;
    const b = validateBrand({ logo: live(logo.url) }, []); if (!b.ok) throw new Error(b.message); doc = { ...doc, brand: b.brand };
    const g = writeList(doc, 'gallery', [{ src: live(shot.url), alt: shot.altText ?? 'A finished job' }]); if (!g.ok) throw new Error(g.message); doc = g.doc;
    const src: SourceDocument = {
      vendor: { id: 'v1', subdomain: 'v1', businessName: 'Shop', name: 'Owner', phone: '+919800000000', email: 'o@example.test', status: 'ACTIVE', industry: 'plumber' },
      cms: { businessName: 'Shop', tagline: 't', about: 'a', logo: null, banner: null, favicon: null, phone: '+919800000000', email: 'o@example.test', address: '1 Main Road', businessHours: null, whatsapp: null, facebook: null, instagram: null, linkedin: null, youtube: null, googleMaps: null, portfolio: null, testimonials: null, pages: null, extras: null, packKey: 'plumber', siteStatus: 'DRAFT', ogImage: null, seoTitle: null, seoDesc: null },
      items: [], claimed: true,
    };
    const input = toRendererInput(applyToSource(src, doc), { categoryId: 'plumber', lang: 'en', year: 2026, siteBase: 'g4d.test' });
    const c = input.content as { hero: { image: string }; gallery: Array<{ src: string; alt: string }> };
    expect(c.hero.image).toBe(live(banner.url));
    expect(input.settings.logo).toBe(live(logo.url));
    expect(c.gallery).toEqual([{ src: live(shot.url), alt: 'A finished job', title: '' }]);
  });
});
