import { checkPrivateUpload, clampTtl, detectPrivateType, isPrivateKeyOf, isSafeMediaBaseUrl, privateKeyFor, publicUrlFor, retentionMetadata } from '../src/v3-storage/core/storage-core';
import { resolveStorageSettings, storageSettingProblem, validateStorageSetting } from '../src/v3-storage/settings/storage-settings';

const PDF = Buffer.from('%PDF-1.7 hello'); const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2]); const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('x')]);

describe('storage core', () => {
  it('the media domain is https and never r2.dev', () => {
    expect(isSafeMediaBaseUrl('https://media.get4domain.com')).toBe(true);
    for (const bad of ['http://media.get4domain.com', 'https://pub-abc.r2.dev', 'https://r2.dev', 'https://u:p@media.example.com', 'https://media.example.com/?x=1', 'nonsense']) expect(isSafeMediaBaseUrl(bad)).toBe(false);
  });
  it('the public URL is the media base plus the encoded path', () => { expect(publicUrlFor('https://media.example.com/', 'vendors/v 1/a.png')).toBe('https://media.example.com/vendors/v%201/a.png'); });
  it('a private key carries the vendor and purpose, and cannot climb out', () => {
    expect(privateKeyFor('v1', 'identity', 'abc-1')).toBe('private/v1/identity/abc-1');
    expect(privateKeyFor('v1', 'identity', '../x')).toBeNull(); expect(privateKeyFor('v/1', 'identity', 'x')).toBeNull(); expect(privateKeyFor('v1', 'public' as never, 'x')).toBeNull();
    expect(isPrivateKeyOf('v1', 'private/v1/identity/abc')).toBe(true); expect(isPrivateKeyOf('v1', 'private/v2/identity/abc')).toBe(false); expect(isPrivateKeyOf('v1', 'private/v1/identity/../../v2/x')).toBe(false);
  });
  it('the type comes from the bytes, not the label', () => {
    expect(detectPrivateType(PDF)).toEqual({ mime: 'application/pdf', image: false }); expect(detectPrivateType(JPG)?.mime).toBe('image/jpeg'); expect(detectPrivateType(PNG)?.mime).toBe('image/png');
    expect(detectPrivateType(Buffer.from('<html>'))).toBeNull(); expect(detectPrivateType(Buffer.alloc(0))).toBeNull();
  });
  it('upload checks: empty or unknown, too large, and a label that does not match', () => {
    expect(checkPrivateUpload(100, { size: 0, declared: '', detected: null })?.code).toBe('STORAGE_TYPE_REFUSED');
    expect(checkPrivateUpload(100, { size: 101, declared: 'application/pdf', detected: 'application/pdf' })?.code).toBe('STORAGE_TOO_LARGE');
    expect(checkPrivateUpload(100, { size: 10, declared: 'image/png', detected: 'application/pdf' })?.code).toBe('STORAGE_TYPE_REFUSED');
    expect(checkPrivateUpload(100, { size: 10, declared: 'application/pdf', detected: 'application/pdf' })).toBeNull();
  });
  it('a signed link is never longer than the setting or the cap', () => {
    expect(clampTtl(undefined, 300, 3600)).toBe(300); expect(clampTtl(900, 300, 3600)).toBe(300); expect(clampTtl(60, 300, 3600)).toBe(60); expect(clampTtl(5000, 7200, 3600)).toBe(3600); expect(clampTtl(0, 300, 3600)).toBe(1);
  });
  it('retention is written on the object only when there is a date', () => {
    expect(retentionMetadata(new Date('2027-03-04T10:00:00Z'), { purpose: 'identity' })).toEqual({ purpose: 'identity', 'retain-until': '2027-03-04' }); expect(retentionMetadata(null)).toEqual({});
  });
});

describe('storage settings', () => {
  it('nothing has a default: every value starts unset', () => { expect(Object.values(resolveStorageSettings(new Map())).every((v) => v === null)).toBe(true); });
  it('validates each kind of value', () => {
    expect(storageSettingProblem('storagePublicBaseUrl', 'https://x.r2.dev')).not.toBeNull(); expect(storageSettingProblem('storagePublicBaseUrl', 'https://media.example.com')).toBeNull();
    expect(storageSettingProblem('storagePrivateEndpoint', 'http://eu2.contabostorage.com')).not.toBeNull(); expect(storageSettingProblem('storagePrivateEndpoint', 'https://eu2.contabostorage.com')).toBeNull();
    expect(storageSettingProblem('storageSignedUrlSeconds', 3601)).not.toBeNull(); expect(storageSettingProblem('storageSignedUrlSeconds', 300)).toBeNull(); expect(storageSettingProblem('storagePrivateMaxBytes', 0)).not.toBeNull();
    expect(storageSettingProblem('storagePrivateBucket', 'ok-bucket.1')).toBeNull(); expect(storageSettingProblem('storagePrivateBucket', '../x')).not.toBeNull();
  });
  it('an unknown key or a bad value is refused with the key named; a bad stored value is ignored', () => {
    expect(() => validateStorageSetting('nope', 1)).toThrow('is not a known plan setting'); expect(() => validateStorageSetting('storageSignedUrlSeconds', 'x')).toThrow('storageSignedUrlSeconds');
    expect(resolveStorageSettings(new Map<string, unknown>([['storageSignedUrlSeconds', -1], ['storagePrivateMaxBytes', 5]])).storageSignedUrlSeconds).toBeNull();
  });
  it('the access keys are not settings', () => { expect(Object.keys(resolveStorageSettings(new Map())).some((k) => /secret|keyid|accesskey/i.test(k))).toBe(false); });
});
