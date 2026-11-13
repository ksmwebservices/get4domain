import { PrivateFilesService } from '../src/v3-storage/private-files.service';
import { ContentScanPort, FakePrivateStore, FakeScanner, NoScanner } from '../src/v3-storage/storage.ports';
import { DEFAULT_STORAGE_SETTINGS, StorageSettings, StorageSettingsService } from '../src/v3-storage/settings/storage-settings';
import { FakeImagePort } from '../src/v3-website/media/media.ports';
import { MemoryStorageAccess } from './support/memory-storage-access';

const staff = { type: 'STAFF' as const, id: 's1', ip: null }; const PDF = Buffer.from('%PDF-1.7 ok'); const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('px')]);
function make(over: Partial<StorageSettings> = {}, scanner: ContentScanPort = new FakeScanner()) {
  const settings = { get: async () => ({ ...DEFAULT_STORAGE_SETTINGS, storagePrivateMaxBytes: 1000, storagePrivateMaxPixels: 1_000_000, storageSignedUrlSeconds: 300, ...over }) } as unknown as StorageSettingsService;
  const store = new FakePrivateStore(); const access = new MemoryStorageAccess(); const image = new FakeImagePort();
  const svc = new PrivateFilesService(store, access, settings, image, scanner); svc.clock = () => new Date('2026-11-14T10:00:00Z');
  return { svc, store, access, image, scanner };
}

describe('private files', () => {
  it('refuses while the caps are unset', async () => {
    const { svc } = make({ storagePrivateMaxBytes: null }); await expect(svc.put('v1', 'identity', staff, { buffer: PDF, mimetype: 'application/pdf' })).rejects.toMatchObject({ response: { code: 'STORAGE_NOT_CONFIGURED' } });
  });
  it('stores a PDF after the scan, under the vendor key, with the retention date, and logs the put first', async () => {
    const { svc, store, access, scanner } = make();
    const f = await svc.put('v1', 'identity', staff, { buffer: PDF, mimetype: 'application/pdf' }, { retainUntil: new Date('2027-01-02T00:00:00Z') });
    expect(f.key).toMatch(/^private\/v1\/identity\/[0-9a-f-]{36}$/); expect((scanner as FakeScanner).scanned).toBe(1);
    expect(store.files.get(f.key)?.metadata).toEqual({ purpose: 'identity', 'retain-until': '2027-01-02' });
    expect(access.rows).toMatchObject([{ vendorId: 'v1', action: 'PUT', actorType: 'STAFF', actorId: 's1', objectKey: f.key }]);
  });
  it('a picture is re-encoded, not scanned', async () => {
    const { svc, image, scanner } = make(); await svc.put('v1', 'payment-proof', staff, { buffer: PNG, mimetype: 'image/png' });
    expect(image.calls).toBe(1); expect((scanner as FakeScanner).scanned).toBe(0);
  });
  it('a PDF is refused, not stored, when no scanner is bound or the scanner finds something', async () => {
    const a = make({}, new NoScanner()); await expect(a.svc.put('v1', 'identity', staff, { buffer: PDF, mimetype: 'application/pdf' })).rejects.toMatchObject({ response: { code: 'STORAGE_SCAN_UNAVAILABLE' } }); expect(a.store.files.size).toBe(0);
    const b = make(); (b.scanner as FakeScanner).infected = true; await expect(b.svc.put('v1', 'identity', staff, { buffer: PDF, mimetype: 'application/pdf' })).rejects.toMatchObject({ response: { code: 'STORAGE_TYPE_REFUSED' } }); expect(b.store.files.size).toBe(0);
  });
  it('wrong bytes, wrong label and too large are refused', async () => {
    const { svc } = make();
    await expect(svc.put('v1', 'identity', staff, { buffer: Buffer.from('<html>'), mimetype: 'application/pdf' })).rejects.toMatchObject({ response: { code: 'STORAGE_TYPE_REFUSED' } });
    await expect(svc.put('v1', 'identity', staff, { buffer: PDF, mimetype: 'image/png' })).rejects.toMatchObject({ response: { code: 'STORAGE_TYPE_REFUSED' } });
    await expect(svc.put('v1', 'identity', staff, { buffer: Buffer.concat([PDF, Buffer.alloc(2000)]), mimetype: 'application/pdf' })).rejects.toMatchObject({ response: { code: 'STORAGE_TOO_LARGE' } });
  });
  it('a failed access-log write stops the upload: nothing is stored', async () => {
    const { svc, store, access } = make(); access.failNext = true;
    await expect(svc.put('v1', 'identity', staff, { buffer: PDF, mimetype: 'application/pdf' })).rejects.toThrow('log down'); expect(store.files.size).toBe(0);
  });
  it('a signed link is short, logged with the reason, and never for another vendors file', async () => {
    const { svc, store, access } = make(); const f = await svc.put('v1', 'identity', staff, { buffer: PDF, mimetype: 'application/pdf' });
    const r = await svc.signedUrl('v1', f.key, staff, 'review', 99999); expect(r.expiresInSeconds).toBe(300); expect(store.signed).toEqual([{ key: f.key, ttl: 300 }]);
    expect(access.rows.map((x) => x.action)).toEqual(['PUT', 'SIGN']); expect(access.rows[1].purpose).toBe('review');
    await expect(svc.signedUrl('v2', f.key, staff, 'x')).rejects.toMatchObject({ response: { code: 'STORAGE_KEY_INVALID' } }); expect(store.signed).toHaveLength(1);
  });
  it('read and remove are logged first; another vendor cannot read or remove', async () => {
    const { svc, store, access } = make(); const f = await svc.put('v1', 'identity', staff, { buffer: PDF, mimetype: 'application/pdf' });
    expect((await svc.read('v1', f.key, staff, 'review'))?.equals(PDF)).toBe(true); await expect(svc.read('v2', f.key, staff, 'x')).rejects.toBeDefined(); await expect(svc.remove('v2', f.key, staff, 'x')).rejects.toBeDefined();
    await svc.remove('v1', f.key, staff, 'retention'); expect(store.files.size).toBe(0); expect(access.rows.map((x) => x.action)).toEqual(['PUT', 'GET', 'DELETE']);
    expect((await svc.accessLog('v1', 1, 10)).total).toBe(3); expect((await svc.accessLog('v2', 1, 10)).total).toBe(0);
  });
});
