import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { originFor, RESERVED_NAMES, RESERVED_PLATFORM_NAMES, RESERVED_V2_CLIENT_NAMES, baseDomain, classifyHost, isReservedName, isVendorLabel, normalizeHost, readHostConfig } from '../hostnames';

// Sample names only (.invalid never resolves); the module has no host of its own.
const ENV = {
  MAIN_HOST: 'main.example.invalid', DIRECTORY_HOST: 'directory.main.example.invalid', APP_HOST: 'app.main.example.invalid',
  ADMIN_HOST: 'admin.main.example.invalid', API_HOST: 'api.main.example.invalid', MEDIA_HOST: 'media.main.example.invalid',
};
const cfg = readHostConfig(ENV);
const cls = (h: string | null) => classifyHost(h, cfg);

describe('reserved names are data', () => {
  test('the owner list is all there', () => {
    for (const n of ['www', 'app', 'admin', 'api', 'gapi', 'directory', 'media', 'mail', 'send']) assert.ok(RESERVED_NAMES.has(n), n);
    assert.deepEqual([...RESERVED_V2_CLIENT_NAMES].sort(), ['allwintours', 'deebiphotography', 'indianambulance', 'jscomputersmobiles', 'ksmquantum', 'mrtravels', 's2travels', 'stepnrock', 'unicatherapy']);
    assert.equal(RESERVED_NAMES.size, RESERVED_PLATFORM_NAMES.length + RESERVED_V2_CLIENT_NAMES.length, 'no name is listed twice');
  });
  test('every name is a valid lower case label', () => {
    for (const n of RESERVED_NAMES) assert.match(n, /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/);
  });
  test('isReservedName and isVendorLabel', () => {
    assert.equal(isReservedName('MrTravels'), true);
    assert.equal(isReservedName('sri-murugan'), false);
    assert.equal(isVendorLabel('sri-murugan'), true);
    assert.equal(isVendorLabel('api'), false);
    assert.equal(isVendorLabel('-bad'), false);
    assert.equal(isVendorLabel('a.b'), false);
  });
});

describe('the host names come from the environment only', () => {
  test('nothing set: nothing configured, nothing classified', () => {
    const none = readHostConfig({});
    assert.deepEqual(none, { main: null, directory: null, app: null, admin: null, api: null, media: null });
    assert.equal(baseDomain(none), null);
    assert.deepEqual(classifyHost('anything.example.invalid', none), { kind: 'unknown' });
    assert.deepEqual(classifyHost('', none), { kind: 'unknown' });
  });
  test('values are cleaned, bad values are not configured', () => {
    assert.equal(readHostConfig({ MAIN_HOST: ' Main.Example.Invalid:3000 ' }).main, 'main.example.invalid');
    assert.equal(readHostConfig({ MAIN_HOST: 'https://main.example.invalid' }).main, null, 'a URL is not a host name');
    assert.equal(readHostConfig({ MAIN_HOST: 'bad host' }).main, null);
  });
  test('normalizeHost', () => {
    assert.equal(normalizeHost('A.B.Example.INVALID.'), 'a.b.example.invalid');
    assert.equal(normalizeHost('x/y'), '');
    assert.equal(normalizeHost(null), '');
  });
  test('the base is the main host without www', () => {
    assert.equal(baseDomain(readHostConfig({ MAIN_HOST: 'www.main.example.invalid' })), 'main.example.invalid');
  });
});

describe('classifyHost', () => {
  test('main, and www as main but not canonical', () => {
    assert.deepEqual(cls('main.example.invalid'), { kind: 'main', canonical: true });
    assert.deepEqual(cls('MAIN.example.invalid:8080'), { kind: 'main', canonical: true });
    assert.deepEqual(cls('www.main.example.invalid'), { kind: 'main', canonical: false });
  });
  test('directory', () => {
    assert.deepEqual(cls('directory.main.example.invalid'), { kind: 'directory' });
  });
  test('app, admin, api and media are reserved', () => {
    assert.deepEqual(cls('app.main.example.invalid'), { kind: 'reserved', role: 'app' });
    assert.deepEqual(cls('admin.main.example.invalid'), { kind: 'reserved', role: 'admin' });
    assert.deepEqual(cls('api.main.example.invalid'), { kind: 'reserved', role: 'api' });
    assert.deepEqual(cls('media.main.example.invalid'), { kind: 'reserved', role: 'media' });
  });
  test('a vendor label is a vendor site', () => {
    assert.deepEqual(cls('sri-murugan.main.example.invalid'), { kind: 'vendor-site', label: 'sri-murugan' });
    assert.deepEqual(cls('Shop1.main.example.invalid'), { kind: 'vendor-site', label: 'shop1' });
  });
  test('every reserved name is reserved, including gapi, send and the V2 clients', () => {
    // www is the main site (non-canonical) and directory is the directory host; no vendor can take either label
    for (const n of RESERVED_NAMES) assert.equal(cls(`${n}.main.example.invalid`).kind, n === 'www' ? 'main' : n === 'directory' ? 'directory' : 'reserved', n);
  });
  test('two levels, other domains and look-alikes are unknown', () => {
    assert.deepEqual(cls('a.b.main.example.invalid'), { kind: 'unknown' });
    assert.deepEqual(cls('www.directory.main.example.invalid'), { kind: 'unknown' });
    assert.deepEqual(cls('other.example.invalid'), { kind: 'unknown' });
    assert.deepEqual(cls('evilmain.example.invalid'), { kind: 'unknown' });
    assert.deepEqual(cls('main.example.invalid.evil.invalid'), { kind: 'unknown' });
    assert.deepEqual(cls('bad host'), { kind: 'unknown' });
    assert.deepEqual(cls(null), { kind: 'unknown' });
  });
  test('a host class that is not configured is not guessed', () => {
    const partial = readHostConfig({ MAIN_HOST: 'main.example.invalid' });
    // no DIRECTORY_HOST: the directory label is a reserved name, never a vendor site
    assert.deepEqual(classifyHost('directory.main.example.invalid', partial), { kind: 'reserved', role: 'name' });
    assert.deepEqual(classifyHost('main.example.invalid', partial), { kind: 'main', canonical: true });
  });
  test('main host given with www still works', () => {
    const w = readHostConfig({ ...ENV, MAIN_HOST: 'www.main.example.invalid' });
    assert.deepEqual(classifyHost('main.example.invalid', w), { kind: 'main', canonical: true });
    assert.deepEqual(classifyHost('www.main.example.invalid', w), { kind: 'main', canonical: false });
  });
});

describe('originFor', () => {
  test('https for every configured host, http only for localhost', () => {
    assert.equal(originFor('Directory.Main.Example.Invalid'), 'https://directory.main.example.invalid');
    assert.equal(originFor('localhost'), 'http://localhost');
    assert.equal(originFor('directory.localhost'), 'http://directory.localhost');
    assert.equal(originFor('notlocalhost.example.invalid'), 'https://notlocalhost.example.invalid');
  });
});
