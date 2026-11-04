import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_B3_SETTINGS } from '../src/b3-settings/b3-settings';
import { badgesOf, dayOf, daysBetween, dedupeKey, fillDays, hashVisitRef, looksLikeVisitRef, newVisitRef, siteStateOf, siteUrlOf, visitUrl } from '../src/directory/core/visits';
import { DirectoryVisitService } from '../src/directory/directory-visit.service';
import { advance, directoryWorld, DirectoryWorld } from './support/directory-world';

/**
 * Slice 5.7b: the directory is a search engine. Its only action is Visit site; there is no callback, no form, no lead. Visits are counted without any visitor data; the Visit link carries a
 * short-lived reference so a later request on a Pro site can be attributed to the Directory.
 */
const src = path.resolve(__dirname, '../src/directory');
const tsFiles = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? tsFiles(path.join(dir, e.name)) : e.name.endsWith('.ts') ? [path.join(dir, e.name)] : []));
const code = (f: string): string => fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('the directory has no callback, lead or form endpoint (owner rule 1)', () => {
  it('no route path or handler in the directory controllers is about a callback, a lead, an enquiry, a form or a contact request', () => {
    const controllers = tsFiles(path.join(src, 'api')).filter((f) => f.endsWith('.controller.ts'));
    expect(controllers.length).toBeGreaterThanOrEqual(3);
    for (const f of controllers) {
      const routes = [...code(f).matchAll(/@(?:Get|Post|Put|Delete|Patch)\(\s*'([^']*)'/g)].map((m) => m[1]);
      for (const r of routes) expect(r).not.toMatch(/call-?back|lead|enquir|contact|quote|booking|order|checkout/i);
    }
  });
  it('no directory source file reads or writes a request, lead, order or message table, and none sends a message other than the claim and removal codes', () => {
    for (const f of tsFiles(src)) expect(code(f)).not.toMatch(/v3Request|v3Order|v3MessageOutbox|v3Lead|\.lead\./);
  });
  it('the only public POST routes are the visit beacon and the removal requests', () => {
    const posts = [...code(path.join(src, 'api/directory-public.controller.ts')).matchAll(/@Post\(\s*'([^']*)'/g)].map((m) => m[1]).sort();
    expect(posts).toEqual(['businesses/:slug/visit', 'removal-requests', 'removal-requests/:token/confirm']);
  });
});

describe('pure helpers', () => {
  it('days and ranges', () => {
    expect(dayOf(new Date('2027-03-01T23:59:59Z'))).toBe('2027-03-01');
    expect(daysBetween('2027-02-27', '2027-03-02')).toEqual(['2027-02-27', '2027-02-28', '2027-03-01', '2027-03-02']);
    expect(daysBetween('2027-03-02', '2027-02-27')).toEqual([]); expect(daysBetween('nope', '2027-02-27')).toEqual([]);
    expect(daysBetween('2020-01-01', '2030-01-01')).toHaveLength(400);   // bounded
    const f = fillDays([{ day: '2027-03-01', count: 3, searchCount: 1 }], '2027-02-28', '2027-03-02');
    expect(f.days.map((d) => d.count)).toEqual([0, 3, 0]); expect(f.total).toBe(3); expect(f.searchTotal).toBe(1);
  });
  it('references are unguessable, URL safe, of the issued shape, and only their hash is derived', () => {
    const a = newVisitRef(); const b = newVisitRef();
    expect(a).not.toBe(b); expect(looksLikeVisitRef(a)).toBe(true);
    for (const bad of ['', 'short', 'x'.repeat(33), 'has space in it 12345678901234567', 123, null, '../../etc/passwd'.padEnd(32, 'a')]) expect(looksLikeVisitRef(bad)).toBe(false);
    expect(hashVisitRef(a)).toMatch(/^[0-9a-f]{64}$/); expect(hashVisitRef(a)).not.toContain(a); expect(hashVisitRef(a)).toBe(hashVisitRef(a));
  });
  it('the visit link goes to the subdomain with src=dir and ref', () => {
    expect(visitUrl('https://sri.get4domain.com', 'abc')).toBe('https://sri.get4domain.com?src=dir&ref=abc');
    expect(siteUrlOf({ subdomain: 'sri', proActive: false }, 'get4domain.com')).toBe('https://sri.get4domain.com'); expect(siteUrlOf(null, 'x.com')).toBeNull(); expect(siteUrlOf({ subdomain: null, proActive: true }, 'x.com')).toBeNull();
  });
  it('site state and badges: unclaimed is SEEDED, claimed is CLAIMED_FREE or PRO; only a claimed Pro business has the VERIFIED badge', () => {
    const pro = { subdomain: 's', proActive: true }; const free = { subdomain: 's', proActive: false };
    expect([siteStateOf('UNCLAIMED', pro), siteStateOf('CLAIMED', free), siteStateOf('CLAIMED', pro), siteStateOf('CLAIMED', null)]).toEqual(['SEEDED', 'CLAIMED_FREE', 'PRO', 'CLAIMED_FREE']);
    expect([badgesOf('CLAIMED', pro), badgesOf('CLAIMED', free), badgesOf('UNCLAIMED', pro)]).toEqual([['VERIFIED'], [], []]);
    expect(dedupeKey('h', 'b', '2027-01-01')).toBe('h|b|2027-01-01'); expect(dedupeKey(null, 'b', 'd')).toBe('noip|b|d');
  });
});

describe('public views, visits, attribution and stats', () => {
  let w: DirectoryWorld; let visits: DirectoryVisitService; let b3: { over: Partial<typeof DEFAULT_B3_SETTINGS> };
  beforeEach(() => {
    w = undefined as never;
  });
  const make = async () => {
    w = await directoryWorld(); b3 = { over: {} };
    visits = new DirectoryVisitService(w.repo, { get: async () => ({ ...DEFAULT_B3_SETTINGS, ...b3.over }) } as never, w.pepper);
    visits.clock = () => new Date(w.now.t); let n = 0; visits.newRef = () => `ref-${String(++n).padStart(28, '0')}`.slice(0, 32).padEnd(32, '0');
    w.read.clock = () => new Date(w.now.t);
  };

  it('every business returns siteUrl (the SUBDOMAIN), siteState and badges; sponsored items stay labelled; organic order is unchanged', async () => {
    await make();
    const a = await w.biz({ name: 'Alpha Plumbing', vendorId: 'va', status: 'CLAIMED' }); const bz = await w.biz({ name: 'Beta Plumbing', vendorId: 'vb', status: 'CLAIMED' }); const c = await w.biz({ name: 'Gamma Plumbing', vendorId: 'vc', status: 'UNCLAIMED' });
    w.repo.sites.set('va', { subdomain: 'alpha', proActive: true }); w.repo.sites.set('vb', { subdomain: 'beta', proActive: false }); w.repo.sites.set('vc', { subdomain: 'gamma', proActive: false });
    const before = (await w.read.list({ q: 'plumbing' })).items.map((i) => i.slug);
    expect(before).toEqual([a.slug, bz.slug, c.slug]);
    const view = (slug: string) => w.read.list({ q: 'plumbing' }).then((r) => r.items.find((i) => i.slug === slug)!);
    expect(await view(a.slug)).toMatchObject({ siteUrl: 'https://alpha.get4domain.com', siteState: 'PRO', badges: ['VERIFIED'] });
    expect(await view(bz.slug)).toMatchObject({ siteUrl: 'https://beta.get4domain.com', siteState: 'CLAIMED_FREE', badges: [] });
    expect(await view(c.slug)).toMatchObject({ siteUrl: 'https://gamma.get4domain.com', siteState: 'SEEDED', badges: [] });
    const one = await w.read.detail(a.slug); expect(one).toMatchObject({ gone: false, business: { siteUrl: 'https://alpha.get4domain.com', siteState: 'PRO' } });
    await w.admin.createPlacement(c.id, { startsAt: new Date(w.now.t.getTime() - 1000).toISOString(), endsAt: new Date(w.now.t.getTime() + 3_600_000).toISOString(), label: 'Sponsored' }, { type: 'STAFF', id: 's', ip: null });
    const after = await w.read.list({ q: '' });
    expect(after.items.filter((i) => i.sponsored).every((i) => (i as { label: string }).label === 'Sponsored')).toBe(true);
    expect(after.items.filter((i) => !i.sponsored).map((i) => i.slug)).toEqual(expect.arrayContaining([a.slug, bz.slug]));
    expect((await w.read.list({ q: 'plumbing' })).items.filter((i) => !i.sponsored).map((i) => i.slug)).toEqual(before);
  });

  it('a visit counts once per day-bucket, returns an opaque reference and the link with src=dir&ref; the response holds nothing else', async () => {
    await make();
    const a = await w.biz({ name: 'Alpha Plumbing', vendorId: 'va' }); w.repo.sites.set('va', { subdomain: 'alpha', proActive: false });
    const r = (await visits.visit(a.slug, '203.0.113.5', true))!;
    expect(Object.keys(r).sort()).toEqual(['expiresAt', 'ref', 'url']);
    expect(r.url).toBe(`https://alpha.get4domain.com?src=dir&ref=${r.ref}`); expect(new Date(r.expiresAt).getTime()).toBe(w.now.t.getTime() + DEFAULT_B3_SETTINGS.directoryVisitRefExpiryMinutes * 60_000);
    expect([...w.repo.visits.values()]).toEqual([{ businessId: a.id, day: '2026-11-05', count: 1, searchCount: 1 }]);
    expect(JSON.stringify([...w.repo.visits.values()])).not.toContain('203.0.113.5');
    expect(JSON.stringify([...w.repo.visitRefs.entries()])).not.toContain(r.ref);   // only the hash is stored
  });

  it('the same network clicking again inside the dedupe window is not counted twice but still gets a link; after the window, or from another network, it counts', async () => {
    await make();
    const a = await w.biz({ name: 'Alpha Plumbing', vendorId: 'va' }); w.repo.sites.set('va', { subdomain: 'alpha', proActive: false });
    await visits.visit(a.slug, '203.0.113.5', false); const again = await visits.visit(a.slug, '203.0.113.5', false);
    expect(again!.url).toContain('ref='); expect([...w.repo.visits.values()][0].count).toBe(1);
    await visits.visit(a.slug, '203.0.113.6', false); expect([...w.repo.visits.values()][0].count).toBe(2);
    advance(w, 31); await visits.visit(a.slug, '203.0.113.5', false); expect([...w.repo.visits.values()][0].count).toBe(3);
    b3.over = { directoryVisitDedupeSeconds: 0 }; await visits.visit(a.slug, '203.0.113.5', false); await visits.visit(a.slug, '203.0.113.5', false); expect([...w.repo.visits.values()][0].count).toBe(5);
  });

  it('counters under concurrency: 60 parallel visits from 60 networks count exactly 60, searchCount exactly the ones from search', async () => {
    await make();
    const a = await w.biz({ name: 'Alpha Plumbing', vendorId: 'va' }); w.repo.sites.set('va', { subdomain: 'alpha', proActive: false });
    await Promise.all(Array.from({ length: 60 }, (_, i) => visits.visit(a.slug, `198.51.100.${i}`, i % 3 === 0)));
    expect([...w.repo.visits.values()][0]).toMatchObject({ count: 60, searchCount: 20 });
  });

  it('anything that cannot be visited is the same null: unknown, malformed, draft, suspended, removed, no vendor, no site address', async () => {
    await make();
    const none = await w.biz({ name: 'No Vendor' }); const nosite = await w.biz({ name: 'No Site', vendorId: 'vx' });
    const draft = await w.biz({ name: 'Draft One', vendorId: 'vd', status: 'DRAFT' }); const sus = await w.biz({ name: 'Susp One', vendorId: 'vs', status: 'SUSPENDED' }); const rem = await w.biz({ name: 'Rem One', vendorId: 'vr', status: 'REMOVED' });
    for (const id of ['vd', 'vs', 'vr']) w.repo.sites.set(id, { subdomain: id, proActive: false });
    w.repo.sites.set('vx', { subdomain: null, proActive: false });
    for (const s of ['nope', 'Bad Slug!', '', '../x', none.slug, nosite.slug, draft.slug, sus.slug, rem.slug]) expect(await visits.visit(s, '1.1.1.1', false)).toBeNull();
    expect(w.repo.visits.size).toBe(0); expect(w.repo.visitRefs.size).toBe(0);
  });

  it('attribution: a live reference works once for ITS business; replay, expiry, another business, garbage and a used one are all the same false', async () => {
    await make();
    const a = await w.biz({ name: 'Alpha Plumbing', vendorId: 'va' }); const other = await w.biz({ name: 'Beta Plumbing', vendorId: 'vb' });
    w.repo.sites.set('va', { subdomain: 'alpha', proActive: true }); w.repo.sites.set('vb', { subdomain: 'beta', proActive: true });
    const r1 = (await visits.visit(a.slug, '1.1.1.1', false))!;
    expect(await visits.attribute(r1.ref, other.id)).toBe(false);   // not this business
    expect(await visits.attribute(r1.ref, a.id)).toBe(true);
    expect(await visits.attribute(r1.ref, a.id)).toBe(false);       // replay
    const r2 = (await visits.visit(a.slug, '1.1.1.2', false))!;
    advance(w, DEFAULT_B3_SETTINGS.directoryVisitRefExpiryMinutes * 60 + 1);
    expect(await visits.attribute(r2.ref, a.id)).toBe(false);       // expired
    for (const bad of [undefined, null, '', 'x', 42, 'z'.repeat(32), '../etc/passwd']) expect(await visits.attribute(bad, a.id)).toBe(false);
    b3.over = { directoryVisitRefExpiryMinutes: 5 }; const r3 = (await visits.visit(a.slug, '1.1.1.3', false))!;
    advance(w, 4 * 60); expect(await visits.attribute(r3.ref, a.id)).toBe(true);   // the expiry comes from the setting
  });

  it('two requests racing on one reference: exactly one is attributed', async () => {
    await make();
    const a = await w.biz({ name: 'Alpha Plumbing', vendorId: 'va' }); w.repo.sites.set('va', { subdomain: 'alpha', proActive: true });
    const r = (await visits.visit(a.slug, '1.1.1.1', false))!;
    const results = await Promise.all(Array.from({ length: 10 }, () => visits.attribute(r.ref, a.id)));
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('the owner sees only their own counts, zero-filled by day (Free and Pro both); a vendor with no profile sees zeros; days are bounded', async () => {
    await make();
    const a = await w.biz({ name: 'Alpha Plumbing', vendorId: 'va' }); const bz = await w.biz({ name: 'Beta Plumbing', vendorId: 'vb' });
    w.repo.sites.set('va', { subdomain: 'alpha', proActive: false }); w.repo.sites.set('vb', { subdomain: 'beta', proActive: true });
    for (let i = 0; i < 3; i++) await visits.visit(a.slug, `10.0.0.${i}`, i === 0);
    for (let i = 0; i < 7; i++) await visits.visit(bz.slug, `10.0.1.${i}`, false);
    const sa = await visits.stats('va', 7); expect(sa).toMatchObject({ hasProfile: true, total: 3, searchTotal: 1 }); expect(sa.days).toHaveLength(7); expect(sa.days.at(-1)).toMatchObject({ day: '2026-11-05', count: 3 });
    expect(await visits.stats('vb', 7)).toMatchObject({ total: 7 });
    expect(await visits.stats('nobody', 7)).toMatchObject({ hasProfile: false, total: 0 });
    expect((await visits.stats('va', 5000)).days).toHaveLength(90); expect((await visits.stats('va', 'x')).days).toHaveLength(30);
  });

  it('the staff report totals per business over a range, busiest first, filterable by vendor; a bad range is refused', async () => {
    await make();
    const a = await w.biz({ name: 'Alpha Plumbing', vendorId: 'va' }); const bz = await w.biz({ name: 'Beta Plumbing', vendorId: 'vb' });
    w.repo.sites.set('va', { subdomain: 'alpha', proActive: false }); w.repo.sites.set('vb', { subdomain: 'beta', proActive: false });
    for (let i = 0; i < 2; i++) await visits.visit(a.slug, `10.0.0.${i}`, false);
    for (let i = 0; i < 5; i++) await visits.visit(bz.slug, `10.0.1.${i}`, true);
    const r = await visits.report({ skip: 0, take: 10 });
    expect(r.items.map((i) => [i.slug, i.count, i.searchCount])).toEqual([[bz.slug, 5, 5], [a.slug, 2, 0]]);
    expect((await visits.report({ vendorId: 'va', skip: 0, take: 10 })).items.map((i) => i.slug)).toEqual([a.slug]);
    expect((await visits.report({ from: '2030-01-01', to: '2030-01-02', skip: 0, take: 10 })).items).toEqual([]);
    await expect(visits.report({ from: '2027-02-01', to: '2027-01-01', skip: 0, take: 10 })).rejects.toMatchObject({ status: 400 });
  });

  it('visits never change the sitemap data', async () => {
    await make();
    const a = await w.biz({ name: 'Alpha Plumbing', vendorId: 'va' }); w.repo.sites.set('va', { subdomain: 'alpha', proActive: false });
    const before = JSON.stringify(await w.read.sitemapData(1, 50));
    for (let i = 0; i < 4; i++) await visits.visit(a.slug, `10.0.0.${i}`, false);
    expect(JSON.stringify(await w.read.sitemapData(1, 50))).toBe(before);
  });
});

describe('static guards for the beacon', () => {
  it('the visit route is public, rate limited and sets no cookie; nothing in the visit code reads or sets a cookie or stores an address', () => {
    const ctl = code(path.join(src, 'api/directory-public.controller.ts'));
    expect(ctl).toMatch(/@Public\(\) @Throttle\(RATE\.directoryVisit\) @Post\('businesses\/:slug\/visit'\)/);
    for (const f of ['directory-visit.service.ts', 'core/visits.ts']) expect(code(path.join(src, f))).not.toMatch(/cookie|Set-Cookie|req\.ip\b|\.ip\b.*(create|insert|upsert)/i);
  });
});
