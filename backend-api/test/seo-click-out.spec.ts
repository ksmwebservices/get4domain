import * as fs from 'fs';
import * as path from 'path';
import { NotFoundException } from '@nestjs/common';
import { canonicalHostFor } from '../src/site-domains/core/canonical';
import { ClickOutController } from '../src/seo-directory/api/click-out.controller';
import { clickContext, safeSubdomainUrl } from '../src/seo-directory/click-out/click-out';
import { ClickKey, SeoClickStore } from '../src/seo-directory/click-out/click-store';
import { ClickOutService } from '../src/seo-directory/click-out/click-out.service';
import { directoryWorld, DirectoryWorld } from './support/directory-world';

class MemClicks extends SeoClickStore {
  rows = new Map<string, { key: ClickKey; count: number }>(); failNext = false;
  async increment(k: ClickKey) { if (this.failNext) { this.failNext = false; throw new Error('db down'); } const id = JSON.stringify(k); const r = this.rows.get(id); if (r) r.count++; else this.rows.set(id, { key: k, count: 1 }); }
}

let prevBase: string | undefined;
beforeEach(() => { prevBase = process.env.SITE_BASE_DOMAIN; process.env.SITE_BASE_DOMAIN = 'get4domain.com'; });
afterEach(() => { if (prevBase === undefined) delete process.env.SITE_BASE_DOMAIN; else process.env.SITE_BASE_DOMAIN = prevBase; });

async function setup(): Promise<{ w: DirectoryWorld; svc: ClickOutService; clicks: MemClicks }> {
  const w = await directoryWorld(); const clicks = new MemClicks(); const svc = new ClickOutService(w.visits, clicks); svc.clock = () => new Date(w.now.t);
  return { w, svc, clicks };
}

describe('safeSubdomainUrl', () => {
  it('accepts only https, one DNS label, on our own base domain', () => {
    expect(safeSubdomainUrl('https://ranjith.get4domain.com/?src=dir&ref=abc', 'get4domain.com')).toBe('https://ranjith.get4domain.com/?src=dir&ref=abc');
    expect(safeSubdomainUrl('https://ranjith.get4domain.com', 'get4domain.com')).toBe('https://ranjith.get4domain.com/');
    expect(safeSubdomainUrl('https://my-shop-2.get4domain.com/', 'get4domain.com')).not.toBeNull();
  });
  it.each([
    'https://evil.com/', 'https://get4domain.com/', 'https://a.b.get4domain.com/', 'http://x.get4domain.com/', 'https://user@x.get4domain.com/', 'https://user:pw@x.get4domain.com/', 'https://x.get4domain.com:8443/',
    'https://x.get4domain.com.evil.com/', 'https://evilget4domain.com/', 'https://-x.get4domain.com/', 'https://x-.get4domain.com/', 'javascript:alert(1)', '//x.get4domain.com/', '/x', '', 'not a url', 'https://x.get4domain.com/#frag',
    'https://myclientsite.com/',
  ])('refuses %s', (u) => { expect(safeSubdomainUrl(u, 'get4domain.com')).toBeNull(); });
  it('refuses when the base domain itself is not a hostname', () => { expect(safeSubdomainUrl('https://x.get4domain.com/', 'evil.com/path')).toBeNull(); expect(safeSubdomainUrl('https://x.get4domain.com/', '')).toBeNull(); });
});

describe('clickContext', () => {
  it('keeps a known page type and a keyword target id that looks like one', () => { expect(clickContext('localityCategory', 'ckabc_123')).toEqual({ pageType: 'localityCategory', keywordTargetId: 'ckabc_123' }); });
  it('records anything else as "other" and drops a bad keyword id', () => {
    expect(clickContext('https://evil.com', 'http://evil.com')).toEqual({ pageType: 'other', keywordTargetId: null });
    expect(clickContext(undefined, undefined)).toEqual({ pageType: 'other', keywordTargetId: null });
    expect(clickContext(['home'], { a: 1 })).toEqual({ pageType: 'other', keywordTargetId: null });
    expect(clickContext('home', 'x'.repeat(41)).keywordTargetId).toBeNull();
  });
});

describe('the click-out service', () => {
  it('sends the visitor to the subdomain, counts the visit, and adds the aggregate click', async () => {
    const { w, svc, clicks } = await setup();
    const b = await w.biz({ name: 'Ranjith Plumber', vendorId: 'v1', status: 'CLAIMED' }); w.repo.sites.set('v1', { subdomain: 'ranjith', proActive: false });
    const url = await svc.go(b.id, 'localityCategory', 'kt_1', '203.0.113.9');
    expect(url).toMatch(/^https:\/\/ranjith\.get4domain\.com\/\?src=dir&ref=[A-Za-z0-9_-]{32}$/);
    const days = await w.repo.visitDays(b.id, '2026-11-05', '2026-11-05'); expect(days).toEqual([{ day: '2026-11-05', count: 1, searchCount: 0 }]);
    expect([...clicks.rows.values()]).toEqual([{ key: { day: '2026-11-05', pageType: 'localityCategory', categoryId: b.categoryId, locationId: b.locationId, keywordTargetId: 'kt_1' }, count: 1 }]);
    await svc.go(b.id, 'localityCategory', 'kt_1', '203.0.113.9');
    expect([...clicks.rows.values()][0].count).toBe(2);
  });
  it('goes to the subdomain even when the vendor has an active custom domain and the add-on (the canonical switch is untouched)', async () => {
    const { w, svc } = await setup();
    const b = await w.biz({ name: 'Ranjith Plumber', vendorId: 'v1', status: 'CLAIMED' }); w.repo.sites.set('v1', { subdomain: 'ranjith', proActive: true });
    const plan = canonicalHostFor({ rows: [{ id: '1', hostname: 'ranjith.get4domain.com', kind: 'SUBDOMAIN', status: 'ACTIVE', isPrimary: false }, { id: '2', hostname: 'ranjithplumber.com', kind: 'CUSTOM', status: 'ACTIVE', isPrimary: true }], legacyHost: null, addonActive: true });
    expect(plan.canonicalHost).toBe('ranjithplumber.com');   // the existing logic: the subdomain will 301 to the custom domain
    const url = (await svc.go(b.id, 'home', null, null))!;
    expect(new URL(url).hostname).toBe('ranjith.get4domain.com'); expect(url).not.toContain('ranjithplumber');
  });
  it('is the same uniform null for an unknown id, a malformed id, no vendor, no subdomain, removed, draft', async () => {
    const { w, svc, clicks } = await setup();
    const noVendor = await w.biz({ name: 'No Vendor' }); const noSub = await w.biz({ name: 'No Sub', vendorId: 'v2' }); w.repo.sites.set('v2', { subdomain: null, proActive: false });
    const gone = await w.biz({ name: 'Gone', vendorId: 'v3', status: 'REMOVED' }); w.repo.sites.set('v3', { subdomain: 'gone', proActive: false });
    const draft = await w.biz({ name: 'Draft', vendorId: 'v4', status: 'DRAFT' }); w.repo.sites.set('v4', { subdomain: 'draft', proActive: false });
    for (const id of ['nope', '', 'a b', '../x', 'x'.repeat(65), noVendor.id, noSub.id, gone.id, draft.id]) expect(await svc.go(id, 'home', null, null)).toBeNull();
    expect(clicks.rows.size).toBe(0);
  });
  it('a suspended listing is still visited (it is listed as a listing, and keeps its subdomain)', async () => {
    const { w, svc } = await setup(); const b = await w.biz({ name: 'Paused', vendorId: 'v5', status: 'SUSPENDED' }); w.repo.sites.set('v5', { subdomain: 'paused', proActive: false });
    expect(await svc.go(b.id, 'home', null, null)).toMatch(/^https:\/\/paused\.get4domain\.com\//);
  });
  it('nothing in the query string can change where it goes (no open redirect)', async () => {
    const { w, svc, clicks } = await setup(); const b = await w.biz({ name: 'Ranjith', vendorId: 'v1' }); w.repo.sites.set('v1', { subdomain: 'ranjith', proActive: false });
    for (const [src, kw] of [['https://evil.com', 'https://evil.com'], ['//evil.com', '//evil.com'], ['home\r\nLocation: https://evil.com', 'x\ny']] as const) {
      const url = (await svc.go(b.id, src, kw, null))!; expect(new URL(url).hostname).toBe('ranjith.get4domain.com'); expect(url).not.toContain('evil');
    }
    expect([...clicks.rows.values()].every((r) => r.key.pageType === 'other' && r.key.keywordTargetId === null)).toBe(true);
  });
  it('a stored subdomain that is not a single DNS label is refused', async () => {
    const { w, svc } = await setup(); const b = await w.biz({ name: 'Odd', vendorId: 'v6' });
    for (const sub of ['a.b', 'evil.com/', 'x@evil.com', '-x', 'x:8080']) { w.repo.sites.set('v6', { subdomain: sub, proActive: false }); expect(await svc.go(b.id, 'home', null, null)).toBeNull(); }
  });
  it('a failed aggregate never blocks the visitor', async () => {
    const { w, svc, clicks } = await setup(); const b = await w.biz({ name: 'Ranjith', vendorId: 'v1' }); w.repo.sites.set('v1', { subdomain: 'ranjith', proActive: false });
    clicks.failNext = true; expect(await svc.go(b.id, 'home', null, null)).toMatch(/^https:\/\/ranjith\./);
  });
  it('keeps no personal data: the aggregate key has no ip, user agent or business id, and the table has no such column', async () => {
    const { w, svc, clicks } = await setup(); const b = await w.biz({ name: 'Ranjith', vendorId: 'v1' }); w.repo.sites.set('v1', { subdomain: 'ranjith', proActive: false });
    await svc.go(b.id, 'home', null, '198.51.100.77');
    expect(Object.keys([...clicks.rows.values()][0].key).sort()).toEqual(['categoryId', 'day', 'keywordTargetId', 'locationId', 'pageType']);
    expect(JSON.stringify([...clicks.rows.values()])).not.toContain('198.51.100.77'); expect(JSON.stringify([...clicks.rows.values()])).not.toContain(b.id);
    const schema = fs.readFileSync(path.resolve(__dirname, '../prisma/schema.prisma'), 'utf8');
    const model = schema.slice(schema.indexOf('model V3SeoClickDaily'), schema.indexOf('@@map("g4d_seo_click_daily")'));
    expect(model).not.toMatch(/\b(ip|ipHash|userAgent|ua|businessId|vendorId|email|phone)\b/i);
  });
});

describe('the click-out controller', () => {
  const fakeRes = () => { const r = { headers: {} as Record<string, string>, redirected: null as null | [number, string], set(h: Record<string, string>) { Object.assign(r.headers, h); return r; }, redirect(code: number, url: string) { r.redirected = [code, url]; } }; return r; };
  it('answers 302 with X-Robots-Tag noindex and no-store', async () => {
    const c = new ClickOutController({ go: async () => 'https://ranjith.get4domain.com/?src=dir&ref=x' } as never); const res = fakeRes();
    await c.go('b1', { src: 'home' }, { ip: '1.2.3.4' } as never, res as never);
    expect(res.redirected).toEqual([302, 'https://ranjith.get4domain.com/?src=dir&ref=x']); expect(res.headers['X-Robots-Tag']).toBe('noindex, nofollow'); expect(res.headers['Cache-Control']).toBe('no-store');
  });
  it('answers one uniform 404, still with the noindex header', async () => {
    const c = new ClickOutController({ go: async () => null } as never); const res = fakeRes();
    await expect(c.go('nope', {}, {} as never, res as never)).rejects.toBeInstanceOf(NotFoundException);
    expect(res.headers['X-Robots-Tag']).toBe('noindex, nofollow'); expect(res.redirected).toBeNull();
  });
  it('is public, rate limited per IP, and does not take the address from the request', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../src/seo-directory/api/click-out.controller.ts'), 'utf8');
    expect(src).toMatch(/@Public\(\) @Throttle\(RATE\.directoryGo\) @Get\(':businessId'\)/);
    expect(src).not.toMatch(/req\.(query|headers|body)|@Headers|@Body/);
  });
});
