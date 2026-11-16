import { HttpException, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { APP_GUARD } from '@nestjs/core';
import { AdminGuard } from '../src/auth/guards/admin.guard';
import { ModuleGuard } from '../src/common/guards/module.guard';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { buildValidationPipe } from '../src/common/pipes/edit-validation.pipe';
import { throttlerGuardProvider, throttlerImport } from '../src/common/throttling';
import { BUSINESS_ERROR_CODES } from '../src/v3-business/business.errors';
import { AdminMediaUploadController, MeMediaUploadController } from '../src/v3-media-upload/api/media-upload.controllers';
import { checkUpload, detectUpload, pdfProblem, scopeKeyOf, uploadKeyFor, UploadCaps } from '../src/v3-media-upload/core/media-upload-core';
import { MediaUploadService } from '../src/v3-media-upload/media-upload.service';
import { MediaUploadStore } from '../src/v3-media-upload/media-upload.store';
import { storageSettingProblem, UPLOAD_TYPES } from '../src/v3-storage/settings/storage-settings';
import { FakeImagePort, FakeMediaStorage, ImagePort, MediaStoragePort, sha256Hex } from '../src/v3-website/media/media.ports';
import { StorageSettingsService } from '../src/v3-storage/settings/storage-settings';
import { MemoryMediaUploadStore } from './support/memory-media-upload-store';

/** Wave 2 Part D, uploads of pictures and documents: the rules, the service over in-memory twins, and the routes over HTTP with the real guards. No real storage is ever called. */
jest.setTimeout(120_000);

const PNG = (n = 64, seed = 1): Buffer => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(n, seed)]);
const JPG = (n = 64, seed = 2): Buffer => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(n, seed)]);
const WEBP = (): Buffer => Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBP'), Buffer.alloc(32, 3)]);
const SVG = (extra = ''): Buffer => Buffer.from(`<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/>${extra}</svg>`);
const PDF = (body = ''): Buffer => Buffer.from(`%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n${body}\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n`);
const GIF = (): Buffer => Buffer.from('GIF89a' + 'x'.repeat(30));
const caps = (over: Partial<UploadCaps> = {}): UploadCaps => ({ mediaUploadMaxBytes: 5000, mediaUploadMaxPixels: 4_000_000, mediaUploadAllowedTypes: [...UPLOAD_TYPES], ...over });
const codeOf = async (p: Promise<unknown>): Promise<{ status: number; code?: string }> => { try { await p; } catch (e) { if (e instanceof HttpException) return { status: e.getStatus(), code: (e.getResponse() as { code?: string }).code }; throw e; } throw new Error('expected a refusal'); };

describe('the rules (pure)', () => {
  it('judges a file by its bytes: five types are known, a gif, an exe and an empty file are not', () => {
    expect(detectUpload(PNG())).toMatchObject({ kind: 'IMAGE', contentType: 'image/png', ext: 'png' }); expect(detectUpload(JPG())).toMatchObject({ contentType: 'image/jpeg', ext: 'jpg' }); expect(detectUpload(WEBP())).toMatchObject({ contentType: 'image/webp', ext: 'webp' });
    expect(detectUpload(SVG())).toMatchObject({ contentType: 'image/svg+xml', ext: 'svg' }); expect(detectUpload(PDF())).toMatchObject({ kind: 'DOCUMENT', contentType: 'application/pdf', ext: 'pdf' });
    expect(detectUpload(GIF())).toBeNull(); expect(detectUpload(Buffer.from('MZ\x90\x00' + 'x'.repeat(40)))).toBeNull(); expect(detectUpload(Buffer.alloc(0))).toBeNull();
  });
  it('refuses in a fixed order: not switched on, empty, too large, type not allowed, type mismatch, then anything active', () => {
    expect(checkUpload(caps({ mediaUploadMaxBytes: null }), { bytes: PNG(), declared: 'image/png' })).toMatchObject({ ok: false, code: 'UPLOAD_NOT_CONFIGURED' });
    expect(checkUpload(caps(), { bytes: Buffer.alloc(0), declared: 'image/png' })).toMatchObject({ code: 'UPLOAD_EMPTY' });
    expect(checkUpload(caps({ mediaUploadMaxBytes: 10 }), { bytes: PNG(), declared: 'image/png' })).toMatchObject({ code: 'UPLOAD_TOO_LARGE' });
    expect(checkUpload(caps({ mediaUploadAllowedTypes: ['image/png'] }), { bytes: PDF(), declared: 'application/pdf' })).toMatchObject({ code: 'UPLOAD_TYPE_NOT_ALLOWED' });
    expect(checkUpload(caps(), { bytes: GIF(), declared: 'image/gif' })).toMatchObject({ code: 'UPLOAD_TYPE_NOT_ALLOWED' });
    expect(checkUpload(caps(), { bytes: PNG(), declared: 'image/jpeg' })).toMatchObject({ code: 'UPLOAD_TYPE_MISMATCH' });
    expect(checkUpload(caps(), { bytes: PNG(), declared: 'image/png' })).toMatchObject({ ok: true });
    expect(checkUpload(caps(), { bytes: JPG(), declared: 'image/jpg' })).toMatchObject({ ok: true });   // the one common alias of jpeg
  });
  it('an SVG that can run is refused, never cleaned; a plain one passes', () => {
    for (const bad of ['<script>alert(1)</script>', '<rect onload="x()"/>', '<foreignObject/>', '<a href="javascript:alert(1)"><rect/></a>', '<image href="https://evil.example/x.png"/>']) expect(checkUpload(caps(), { bytes: SVG(bad), declared: 'image/svg+xml' })).toMatchObject({ ok: false, code: 'UPLOAD_UNSAFE' });
    expect(checkUpload(caps(), { bytes: SVG(), declared: 'image/svg+xml' })).toMatchObject({ ok: true });
  });
  it('a PDF that can run something or is cut short is refused', () => {
    for (const bad of ['<< /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >>', '<< /S /Launch >>', '<< /Type /EmbeddedFile >>', '<< /AA << >> >>']) expect(checkUpload(caps(), { bytes: PDF(bad), declared: 'application/pdf' })).toMatchObject({ ok: false, code: 'UPLOAD_UNSAFE' });
    expect(pdfProblem(Buffer.from('%PDF-1.4\nno end'))).toContain('cut short'); expect(checkUpload(caps(), { bytes: PDF('/Title (Brochure)'), declared: 'application/pdf' })).toMatchObject({ ok: true });
  });
  it('the key is built from ids and the hash, never from a name: the folder, the file and the extension are all the server\'s', () => {
    const sha = 'a'.repeat(64);
    expect(uploadKeyFor({ kind: 'VENDOR', vendorId: 'v_1' }, sha, 'png')).toBe(`vendors/v_1/uploads/${sha}.png`); expect(uploadKeyFor({ kind: 'DRAFT', staffId: 's-9' }, sha, 'pdf')).toBe(`drafts/s-9/${sha}.pdf`);
    for (const bad of ['../x', 'a/b', 'a b', '', 'x'.repeat(65)]) expect(() => uploadKeyFor({ kind: 'VENDOR', vendorId: bad }, sha, 'png')).toThrow();
    expect(() => uploadKeyFor({ kind: 'VENDOR', vendorId: 'v1' }, 'not-a-hash', 'png')).toThrow(); expect(scopeKeyOf({ kind: 'DRAFT', staffId: 's1' })).toBe('draft:s1');
  });
  it('the three caps are settings, off until set, and the type list only holds the five known types', () => {
    expect(storageSettingProblem('mediaUploadMaxBytes', 5_000_000)).toBeNull(); expect(storageSettingProblem('mediaUploadMaxBytes', 0)).not.toBeNull(); expect(storageSettingProblem('mediaUploadMaxPixels', 1.5)).not.toBeNull();
    expect(storageSettingProblem('mediaUploadAllowedTypes', ['image/png', 'application/pdf'])).toBeNull(); expect(storageSettingProblem('mediaUploadAllowedTypes', ['image/gif'])).not.toBeNull(); expect(storageSettingProblem('mediaUploadAllowedTypes', [])).not.toBeNull(); expect(storageSettingProblem('mediaUploadAllowedTypes', ['image/png', 'image/png'])).not.toBeNull();
  });
  it('the new error codes are registered', () => { for (const c of ['UPLOAD_NOT_CONFIGURED', 'UPLOAD_TOO_LARGE', 'UPLOAD_TYPE_NOT_ALLOWED', 'UPLOAD_UNSAFE', 'UPLOAD_ALT_INVALID', 'UPLOAD_NOT_FOUND', 'UPLOAD_LISTING_NOT_FOUND']) expect(BUSINESS_ERROR_CODES).toContain(c); });
});

describe('the service over in-memory twins', () => {
  let store: MemoryMediaUploadStore; let storage: FakeMediaStorage; let image: FakeImagePort; let svc: MediaUploadService; let activity: Array<{ actionKey: string; vendorId: string | null }>; let settings: UploadCaps;
  const V = (id: string) => ({ kind: 'VENDOR' as const, vendorId: id }); const owner = { type: 'VENDOR' as const, id: 'v1', ip: null }; const staff = { type: 'STAFF' as const, id: 'staff-1', ip: null };
  const file = (buffer: Buffer, mimetype: string) => ({ buffer, mimetype, size: buffer.length });
  beforeEach(() => {
    store = new MemoryMediaUploadStore(); storage = new FakeMediaStorage(); image = new FakeImagePort({ width: 800, height: 600 }); activity = []; settings = caps();
    svc = new MediaUploadService(store, storage, image, { get: async () => settings } as unknown as StorageSettingsService, { record: async (i: { actionKey: string; vendorId: string | null }) => { activity.push(i); return null; } } as never);
  });

  it('stores a picture under the vendor\'s folder named by its content, reads its size, and keeps its description', async () => {
    const png = PNG(); const v = await svc.upload(V('v1'), owner, file(png, 'image/png'), 'The shop front');
    expect(v).toMatchObject({ kind: 'IMAGE', contentType: 'image/png', width: 800, height: 600, altText: 'The shop front' });
    expect(storage.puts).toEqual([`vendors/v1/uploads/${sha256Hex(png)}.png`]); expect(v.url).toContain(`vendors/v1/uploads/${sha256Hex(png)}.png`);
    expect(store.rows[0]).toMatchObject({ vendorId: 'v1', ownerKind: 'VENDOR_SITE', scopeKey: 'vendor:v1', uploadedByType: 'VENDOR' }); expect(activity).toEqual([]);   // a vendor's own upload is not a staff write
  });
  it('the same file twice is one row and one stored object; a removed file comes back when uploaded again', async () => {
    const a = await svc.upload(V('v1'), owner, file(PNG(), 'image/png'), 'Shop'); const b = await svc.upload(V('v1'), owner, file(PNG(), 'image/png'), 'Shop again');
    expect(b.id).toBe(a.id); expect(store.rows).toHaveLength(1); expect(storage.puts).toHaveLength(1);
    await svc.remove(V('v1'), a.id, owner); expect(storage.files.size).toBe(0);
    const c = await svc.upload(V('v1'), owner, file(PNG(), 'image/png'), 'Back'); expect(c.id).toBe(a.id); expect(storage.files.size).toBe(1); expect(store.rows).toHaveLength(1);
  });
  it('a picture needs its description, a document does not; markup in a description is refused', async () => {
    expect(await codeOf(svc.upload(V('v1'), owner, file(PNG(), 'image/png'), ''))).toMatchObject({ status: 400, code: 'UPLOAD_ALT_INVALID' });
    expect(await codeOf(svc.upload(V('v1'), owner, file(PNG(), 'image/png'), '<b>x</b>'))).toMatchObject({ code: 'UPLOAD_ALT_INVALID' });
    const d = await svc.upload(V('v1'), owner, file(PDF(), 'application/pdf'), undefined); expect(d).toMatchObject({ kind: 'DOCUMENT', contentType: 'application/pdf', width: null, altText: null }); expect(image.calls).toBe(0);   // a pdf is never decoded as a picture
    expect(storage.puts).toHaveLength(1);
  });
  it('an SVG is stored as it is (nothing active in it) with no size; an unsafe one never reaches storage', async () => {
    const v = await svc.upload(V('v1'), owner, file(SVG(), 'image/svg+xml'), 'Logo'); expect(v).toMatchObject({ contentType: 'image/svg+xml', width: null, height: null }); expect(image.calls).toBe(0);
    expect(await codeOf(svc.upload(V('v1'), owner, file(SVG('<script>x</script>'), 'image/svg+xml'), 'Logo'))).toMatchObject({ status: 422, code: 'UPLOAD_UNSAFE' }); expect(storage.puts).toHaveLength(1);
  });
  it('a refused file stores nothing: off, too large, wrong type, a picture that cannot be read', async () => {
    settings = caps({ mediaUploadAllowedTypes: null }); expect(await codeOf(svc.upload(V('v1'), owner, file(PNG(), 'image/png'), 'x'))).toMatchObject({ status: 503, code: 'UPLOAD_NOT_CONFIGURED' });
    settings = caps({ mediaUploadMaxBytes: 20 }); expect(await codeOf(svc.upload(V('v1'), owner, file(PNG(), 'image/png'), 'x'))).toMatchObject({ status: 413, code: 'UPLOAD_TOO_LARGE' });
    settings = caps(); expect(await codeOf(svc.upload(V('v1'), owner, file(GIF(), 'image/gif'), 'x'))).toMatchObject({ status: 415, code: 'UPLOAD_TYPE_NOT_ALLOWED' });
    image.reencode = async () => { throw new Error('unreadable'); };
    expect(await codeOf(svc.upload(V('v1'), owner, file(PNG(), 'image/png'), 'x'))).toMatchObject({ status: 422, code: 'UPLOAD_INVALID' });
    expect(await codeOf(svc.upload(V('v1'), owner, undefined, 'x'))).toMatchObject({ code: 'UPLOAD_EMPTY' }); expect(storage.puts).toHaveLength(0); expect(store.rows).toHaveLength(0);
  });
  it('one vendor never sees, lists or removes another vendor\'s uploads', async () => {
    const a = await svc.upload(V('v1'), owner, file(PNG(), 'image/png'), 'Shop');
    expect((await svc.list(V('v2'))).total).toBe(0); expect(await codeOf(svc.remove(V('v2'), a.id, { ...owner, id: 'v2' }))).toMatchObject({ status: 404, code: 'UPLOAD_NOT_FOUND' }); expect(store.rows[0].status).toBe('ACTIVE');
    const same = await svc.upload(V('v2'), { ...owner, id: 'v2' }, file(PNG(), 'image/png'), 'Mine'); expect(same.id).not.toBe(a.id); expect(store.rows).toHaveLength(2);   // the same bytes in two businesses are two rows
  });
  it('a staff draft upload (no listing yet) has no vendor, belongs to the staff member, and is audited', async () => {
    const d = await svc.upload({ kind: 'DRAFT', staffId: 'staff-1' }, staff, file(JPG(), 'image/jpeg'), 'Front');
    expect(store.rows[0]).toMatchObject({ vendorId: null, ownerKind: 'LISTING_DRAFT', scopeKey: 'draft:staff-1', uploadedByType: 'STAFF', uploadedById: 'staff-1' }); expect(storage.puts[0]).toMatch(/^drafts\/staff-1\//);
    expect(activity).toEqual([{ actionKey: 'media.uploaded', vendorId: null, actor: expect.anything(), entityType: 'media', entityId: d.id, summary: expect.anything() }]);
    expect((await svc.list({ kind: 'DRAFT', staffId: 'staff-2' })).total).toBe(0); expect((await svc.list({ kind: 'DRAFT', staffId: 'staff-1' })).total).toBe(1);
    expect(await codeOf(svc.remove({ kind: 'DRAFT', staffId: 'staff-2' }, d.id, staff))).toMatchObject({ code: 'UPLOAD_NOT_FOUND' });
  });
  it('staff upload for a listing goes into the library of the business behind it, audited against that business; an unknown or removed listing is a plain 404', async () => {
    store.listings.set('seed1', 'v9');
    const v = await svc.uploadForListing('seed1', staff, file(PNG(), 'image/png'), 'Shop');
    expect(store.rows[0]).toMatchObject({ vendorId: 'v9', scopeKey: 'vendor:v9', uploadedByType: 'STAFF' }); expect(activity[0]).toMatchObject({ actionKey: 'media.uploaded', vendorId: 'v9' });
    expect((await svc.listForListing('seed1')).items.map((x) => x.id)).toEqual([v.id]);
    expect(await codeOf(svc.uploadForListing('nope', staff, file(PNG(), 'image/png'), 'x'))).toMatchObject({ status: 404, code: 'UPLOAD_LISTING_NOT_FOUND' });
    await svc.removeForListing('seed1', v.id, staff); expect(activity.map((a) => a.actionKey)).toEqual(['media.uploaded', 'media.removed']);
  });
});

describe('the routes over HTTP', () => {
  let app: INestApplication; let store: MemoryMediaUploadStore; let storage: FakeMediaStorage;
  const as = (p: string) => ({ 'x-test-principal': p });
  beforeEach(async () => {
    store = new MemoryMediaUploadStore(); storage = new FakeMediaStorage(); store.listings.set('seed1', 'v1');
    const mod = await Test.createTestingModule({
      imports: [throttlerImport], controllers: [MeMediaUploadController, AdminMediaUploadController],
      providers: [
        throttlerGuardProvider, AdminGuard, { provide: MediaUploadStore, useValue: store }, { provide: MediaStoragePort, useValue: storage }, { provide: ImagePort, useValue: new FakeImagePort() },
        { provide: StorageSettingsService, useValue: { get: async () => caps() } }, MediaUploadService,
      ],
    }).compile();
    app = mod.createNestApplication();
    app.use((req: { headers: Record<string, string>; user?: unknown }, _res: unknown, next: () => void) => {
      const p = req.headers['x-test-principal'];
      if (p === 'owner-1') req.user = { sub: 'v1', email: 'a@x.invalid', role: 'VENDOR' };
      else if (p === 'owner-2') req.user = { sub: 'v2', email: 'b@x.invalid', role: 'VENDOR' };
      else if (p) req.user = { sub: `staff-${p}`, email: 's@x.invalid', role: 'ADMIN', kind: 'admin_member', adminRole: p };
      next();
    });
    app.useGlobalPipes(buildValidationPipe()); app.useGlobalInterceptors(new TransformInterceptor()); app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });
  afterEach(async () => { await app.close(); });

  it('a vendor uploads with multipart, and a hostile file name is never used anywhere', async () => {
    const r = await request(app.getHttpServer()).post('/v3/me/media').set(as('owner-1')).field('alt', 'Shop front').attach('file', PNG(), { filename: '../../etc/passwd<script>.png', contentType: 'image/png' });
    expect(r.status).toBe(200); expect(r.body.data).toMatchObject({ kind: 'IMAGE', contentType: 'image/png', altText: 'Shop front' });
    expect(storage.puts[0]).toMatch(/^vendors\/v1\/uploads\/[a-f0-9]{64}\.png$/); expect(JSON.stringify([...storage.files.keys(), store.rows])).not.toMatch(/passwd|script/);
  });
  it('a file whose bytes are not what its label says is refused, and a script labelled as a picture is refused', async () => {
    const lie = await request(app.getHttpServer()).post('/v3/me/media').set(as('owner-1')).field('alt', 'x').attach('file', PDF(), { filename: 'photo.png', contentType: 'image/png' });
    expect(lie.status).toBe(415); expect(JSON.stringify(lie.body)).toContain('UPLOAD_TYPE_MISMATCH');
    const js = await request(app.getHttpServer()).post('/v3/me/media').set(as('owner-1')).field('alt', 'x').attach('file', Buffer.from('alert(1)'), { filename: 'a.png', contentType: 'image/png' });
    expect(js.status).toBe(415); expect(storage.puts).toHaveLength(0);
  });
  it('list and remove are the vendor\'s own; another vendor gets a plain 404', async () => {
    const up = await request(app.getHttpServer()).post('/v3/me/media').set(as('owner-1')).field('alt', 'Shop').attach('file', PNG(), { filename: 'a.png', contentType: 'image/png' });
    expect((await request(app.getHttpServer()).get('/v3/me/media').set(as('owner-1'))).body.data.total).toBe(1); expect((await request(app.getHttpServer()).get('/v3/me/media').set(as('owner-2'))).body.data.total).toBe(0);
    expect((await request(app.getHttpServer()).delete(`/v3/me/media/${up.body.data.id}`).set(as('owner-2'))).status).toBe(404);
    expect((await request(app.getHttpServer()).delete(`/v3/me/media/${up.body.data.id}`).set(as('owner-1'))).body.data).toEqual({ removed: true });
  });
  it('SALES (MARKETING) may upload for a listing and keep a draft upload; SUPPORT may not; a vendor may not use the staff routes', async () => {
    const up = (role: string, path: string) => request(app.getHttpServer()).post(path).set(as(role)).field('alt', 'x').attach('file', PNG(), { filename: 'a.png', contentType: 'image/png' });
    for (const role of ['MARKETING', 'OPERATIONS', 'ADMIN', 'SUPER_ADMIN']) expect((await up(role, '/v3/admin/seeded-sites/seed1/media')).status).toBe(200);
    expect((await up('MARKETING', '/v3/admin/media/drafts')).status).toBe(200);
    expect((await up('SUPPORT', '/v3/admin/seeded-sites/seed1/media')).status).toBe(403); expect((await up('SUPPORT', '/v3/admin/media/drafts')).status).toBe(403);
    expect((await up('owner-1', '/v3/admin/seeded-sites/seed1/media')).status).toBe(403);
    expect((await request(app.getHttpServer()).get('/v3/admin/media/drafts').set(as('MARKETING'))).body.data.total).toBe(1); expect((await request(app.getHttpServer()).get('/v3/admin/media/drafts').set(as('OPERATIONS'))).body.data.total).toBe(0);
  });
});

describe('K2: the upload limits a screen checks before sending a file', () => {
  const { uploadLimitsView, UPLOAD_TRANSPORT_LIMIT } = jest.requireActual('../src/v3-media-upload/core/media-upload-core') as typeof import('../src/v3-media-upload/core/media-upload-core');
  it('the pure view: not configured until all three caps are set, with nothing invented', () => {
    for (const c of [caps({ mediaUploadMaxBytes: null }), caps({ mediaUploadMaxPixels: null }), caps({ mediaUploadAllowedTypes: null }), caps({ mediaUploadAllowedTypes: [] })]) expect(uploadLimitsView(c)).toMatchObject({ configured: false, maxBytes: null, settingMaxBytes: null, maxPixels: null, allowedTypes: [], images: [], documents: [] });
    expect(uploadLimitsView(caps({ mediaUploadMaxBytes: null })).transportLimitBytes).toBe(16 * 1024 * 1024);
  });
  it('the pure view: the caps as the upload enforces them, types split into pictures and documents, the byte limit never above what one request can carry', () => {
    expect(uploadLimitsView(caps())).toEqual({ configured: true, maxBytes: 5000, settingMaxBytes: 5000, maxPixels: 4_000_000, allowedTypes: [...UPLOAD_TYPES], images: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'], documents: ['application/pdf'], transportLimitBytes: UPLOAD_TRANSPORT_LIMIT, altRequiredForImages: true, altMaxLength: 160 });
    expect(uploadLimitsView(caps({ mediaUploadMaxBytes: 50 * 1024 * 1024 }))).toMatchObject({ maxBytes: UPLOAD_TRANSPORT_LIMIT, settingMaxBytes: 50 * 1024 * 1024 });
    expect(uploadLimitsView(caps({ mediaUploadAllowedTypes: ['image/png'] }))).toMatchObject({ allowedTypes: ['image/png'], images: ['image/png'], documents: [] });
  });
  it('what the view says is what the upload does: a file of exactly maxBytes passes the size check and one byte more is refused; a type not listed is refused', () => {
    const c = caps({ mediaUploadMaxBytes: 200, mediaUploadAllowedTypes: ['image/png'] }); const v = uploadLimitsView(c);
    expect(checkUpload(c, { bytes: PNG(v.maxBytes! - 8), declared: 'image/png' }).ok).toBe(true); expect(checkUpload(c, { bytes: PNG(v.maxBytes! - 7), declared: 'image/png' })).toMatchObject({ ok: false, code: 'UPLOAD_TOO_LARGE' });
    expect(checkUpload(c, { bytes: PDF(), declared: 'application/pdf' })).toMatchObject({ ok: false, code: 'UPLOAD_TYPE_NOT_ALLOWED' }); expect(v.allowedTypes).not.toContain('application/pdf');
  });

  describe('over HTTP', () => {
    let app: INestApplication; let current: UploadCaps;
    const as = (p: string) => ({ 'x-test-principal': p });
    beforeEach(async () => {
      current = caps({ mediaUploadMaxBytes: 2_000_000, mediaUploadMaxPixels: 12_000_000, mediaUploadAllowedTypes: ['image/jpeg', 'image/png', 'application/pdf'] });
      const mod = await Test.createTestingModule({
        imports: [throttlerImport], controllers: [MeMediaUploadController, AdminMediaUploadController],
        providers: [throttlerGuardProvider, { provide: APP_GUARD, useClass: ModuleGuard }, AdminGuard, { provide: MediaUploadStore, useValue: new MemoryMediaUploadStore() }, { provide: MediaStoragePort, useValue: new FakeMediaStorage() }, { provide: ImagePort, useValue: new FakeImagePort() }, { provide: StorageSettingsService, useValue: { get: async () => current } }, MediaUploadService],
      }).compile();
      app = mod.createNestApplication();
      app.use((req: { headers: Record<string, string>; user?: unknown }, _res: unknown, next: () => void) => {
        const p = req.headers['x-test-principal'];
        if (p === 'owner-1') req.user = { sub: 'v1', email: 'a@x.invalid', role: 'VENDOR' };
        else if (p === 'member-web') req.user = { sub: 'v1', email: 'm@x.invalid', role: 'VENDOR', kind: 'team_member', memberId: 'm1', modules: ['website'] };
        else if (p === 'member-none') req.user = { sub: 'v1', email: 'm@x.invalid', role: 'VENDOR', kind: 'team_member', memberId: 'm2', modules: ['communication'] };
        else if (p) req.user = { sub: `staff-${p}`, email: 's@x.invalid', role: 'ADMIN', kind: 'admin_member', adminRole: p };
        next();
      });
      app.useGlobalPipes(buildValidationPipe()); app.useGlobalInterceptors(new TransformInterceptor()); app.useGlobalFilters(new HttpExceptionFilter()); await app.init();
    });
    afterEach(async () => { await app.close(); });
    const expected = { configured: true, maxBytes: 2_000_000, settingMaxBytes: 2_000_000, maxPixels: 12_000_000, allowedTypes: ['image/jpeg', 'image/png', 'application/pdf'], images: ['image/jpeg', 'image/png'], documents: ['application/pdf'], altMaxLength: 160 };
    it('a vendor owner and a team member with the website area read the limits; one without it is refused', async () => {
      for (const p of ['owner-1', 'member-web']) { const r = await request(app.getHttpServer()).get('/v3/me/media/limits').set(as(p)); expect(r.status).toBe(200); expect(r.body.data).toMatchObject(expected); }
      expect((await request(app.getHttpServer()).get('/v3/me/media/limits').set(as('member-none'))).status).toBe(403);
      expect([401, 403]).toContain((await request(app.getHttpServer()).get('/v3/me/media/limits')).status);
    });
    it('every staff role that may upload reads the same limits; SUPPORT and nobody signed in are refused', async () => {
      for (const p of ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'MARKETING']) { const r = await request(app.getHttpServer()).get('/v3/admin/media/limits').set(as(p)); expect([p, r.status]).toEqual([p, 200]); expect(r.body.data).toMatchObject(expected); }
      expect((await request(app.getHttpServer()).get('/v3/admin/media/limits').set(as('SUPPORT'))).status).toBe(403); expect([401, 403]).toContain((await request(app.getHttpServer()).get('/v3/admin/media/limits')).status);
    });
    it('while uploads are not switched on the answer is 200 with configured false (the screen says so before anyone picks a file), and the upload itself still answers 503 UPLOAD_NOT_CONFIGURED', async () => {
      current = caps({ mediaUploadMaxBytes: null, mediaUploadMaxPixels: null, mediaUploadAllowedTypes: null });
      const r = await request(app.getHttpServer()).get('/v3/me/media/limits').set(as('owner-1')); expect(r.status).toBe(200); expect(r.body.data).toMatchObject({ configured: false, maxBytes: null, allowedTypes: [] });
      const up = await request(app.getHttpServer()).post('/v3/me/media').set(as('owner-1')).field('alt', 'x').attach('file', PNG(), { filename: 'a.png', contentType: 'image/png' }); expect(up.status).toBe(503); expect(JSON.stringify(up.body)).toContain('UPLOAD_NOT_CONFIGURED');
    });
    it('a change of a staff setting shows at once, and the answer carries no storage address, key or price', async () => {
      current = caps({ mediaUploadMaxBytes: 1234, mediaUploadMaxPixels: 99, mediaUploadAllowedTypes: ['image/webp'] });
      const r = await request(app.getHttpServer()).get('/v3/me/media/limits').set(as('owner-1')); expect(r.body.data).toMatchObject({ maxBytes: 1234, maxPixels: 99, allowedTypes: ['image/webp'], images: ['image/webp'], documents: [] });
      expect(JSON.stringify(r.body.data)).not.toMatch(/bucket|endpoint|secret|₹|paise|https?:/i);
    });
    it('the limits route does not swallow the id routes: DELETE /v3/me/media/limits is still an upload id (not found)', async () => {
      expect((await request(app.getHttpServer()).delete('/v3/me/media/limits').set(as('owner-1'))).status).toBe(404);
    });
  });
});
