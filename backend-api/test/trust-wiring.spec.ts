import { PublishService } from '../src/site-publish/publish/publish.service';
import { SitePublicService } from '../src/site-publish/publish/site-public.service';
import { TAKEDOWN_NOTICE_HTML } from '../src/v3-trust/core/trust-core';
import { enquiry, HOST_A, requestsWorld } from './support/requests-world';
import { trustWorld } from './support/memory-trust-store';

/** Slice 5.21: how the trust ports meet the publisher, the public site and the public requests. Phrases are INVENTED test data. */
jest.setTimeout(60_000);
const SUPER = { id: 'staff-1', ip: null, role: 'SUPER_ADMIN' };
const page = (text: string) => ({ html: `<!doctype html><html><head><title>t</title><style>.x{}</style><script>var a=1</script></head><body><h1>${text}</h1></body></html>` });
const ents = { resolve: async () => ({ features: {} }) };
const STAFF = { type: 'STAFF' as const, id: 'staff-1', ip: null };

describe('the scan on publish', () => {
  const publisher = (w: ReturnType<typeof trustWorld>, texts: string[], scan?: unknown) => new PublishService({ publish: async () => ({ id: 'p1' }), pagesOf: async () => texts.map(page) } as never, {} as never, {} as never, ents as never, { hook: () => undefined } as never, undefined, scan as never);
  it('a match raises a PROHIBITED_TEXT alert and the publish still goes through with its normal result', async () => {
    const w = trustWorld(); await w.seedRules({ PROHIBITED_TEXT: { enabled: true } }); await w.terms.create(SUPER, { term: 'zeta powder', category: 'TEST_A' });
    const r = await publisher(w, ['We sell Zeta Powder here'], w.scan).publish('v1', 'p1', STAFF);
    expect(r).toMatchObject({ id: 'p1' }); expect(w.store.alerts).toHaveLength(1); expect(w.store.alerts[0]).toMatchObject({ vendorId: 'v1', ruleKey: 'PROHIBITED_TEXT' });
    expect(w.store.activity[0].summary).toMatchObject({ source: 'PUBLISH', count: 1 });
  });
  it('scripts and styles are not read as text; clean text raises nothing; with no scan wired it publishes as before', async () => {
    const w = trustWorld(); await w.seedRules({ PROHIBITED_TEXT: { enabled: true } }); await w.terms.create(SUPER, { term: 'a 1', category: 'TEST_A' }); await w.terms.create(SUPER, { term: 'x', category: 'TEST_A' }).catch(() => undefined);
    await publisher(w, ['A perfectly ordinary shop'], w.scan).publish('v1', 'p1', STAFF); expect(w.store.alerts).toHaveLength(0);
    expect(await publisher(w, ['Zeta Powder']).publish('v1', 'p1', STAFF)).toMatchObject({ id: 'p1' });
  });
  it('a scan that fails, or a page read that fails, never undoes or blocks the publish', async () => {
    const boom = { scan: async () => { throw new Error('scan down'); } };
    expect(await publisher(trustWorld(), ['x'], boom).publish('v1', 'p1', STAFF)).toMatchObject({ id: 'p1' });
    const broken = new PublishService({ publish: async () => ({ id: 'p1' }), pagesOf: async () => { throw new Error('read down'); } } as never, {} as never, {} as never, ents as never, { hook: () => undefined } as never, undefined, trustWorld().scan as never);
    expect(await broken.publish('v1', 'p1', STAFF)).toMatchObject({ id: 'p1' });
  });
});

describe('the public site under a legal takedown', () => {
  const reads: string[] = [];
  const repo = { currentPublication: async (v: string) => { reads.push(v); return null; } };
  const hosts = { resolve: async (h: string) => (h === 'shop.example.test' ? { vendorId: 'v1' } : null) };
  it('serves the plain notice (451) for a site in takedown, reads nothing of it, and an unrelated site is untouched', async () => {
    const w = trustWorld(); const site = new SitePublicService(repo as never, hosts as never, undefined, undefined, undefined, w.takedowns);
    reads.length = 0; expect(await site.lookup('shop.example.test', '/', 'en')).toBeNull(); expect(reads).toEqual(['v1']);    // before: the normal path
    await w.takedowns.create(SUPER, { vendorId: 'v1', reason: 'order of the court' });
    reads.length = 0; const n = await site.lookup('shop.example.test', '/', 'en');
    expect(n).toEqual({ status: 451, html: TAKEDOWN_NOTICE_HTML }); expect(reads).toEqual([]);                                // no page of the site is read
    expect(await site.byHost('shop.example.test', '/', 'en')).toBeNull();                                                      // the page-only reader gets nothing
    expect(await site.lookup('unknown.example.test', '/', 'en')).toBeNull();
  });
  it('the notice never shows the vendor\'s business or the reason', async () => {
    expect(TAKEDOWN_NOTICE_HTML).not.toMatch(/court|order|Murugan|<a |<form/i);
  });
  it('after a reversal the site is served the normal way again (nothing is cached)', async () => {
    const w = trustWorld(); const site = new SitePublicService(repo as never, hosts as never, undefined, undefined, undefined, w.takedowns);
    const t = await w.takedowns.create(SUPER, { vendorId: 'v1', reason: 'x' }); expect((await site.lookup('shop.example.test', '/', 'en'))).toMatchObject({ status: 451 });
    await w.takedowns.reverse(t.id, SUPER, { reason: 'withdrawn' }); reads.length = 0;
    expect(await site.lookup('shop.example.test', '/', 'en')).toBeNull(); expect(reads).toEqual(['v1']);
  });
  it('without the trust module a site is served exactly as before', async () => {
    const site = new SitePublicService(repo as never, hosts as never); reads.length = 0; expect(await site.lookup('shop.example.test', '/', 'en')).toBeNull(); expect(reads).toEqual(['v1']);
  });
});

describe('public requests', () => {
  const code = async (p: Promise<unknown>): Promise<string> => { try { await p; return 'OK'; } catch (e) { return (e as { response?: { code?: string } }).response?.code ?? (e as { status?: number }).status?.toString() ?? 'ERR'; } };
  it('a site under takedown takes no request: the same plain 404 as any hidden site', async () => {
    const t = trustWorld(); const w = await requestsWorld({ takedowns: t.takedowns });
    expect(await w.pub.submit(HOST_A, enquiry(), '203.0.113.1')).toMatchObject({ accepted: true });
    t.trust.vendors.set('va', { businessName: 'A', name: 'B' }); t.trust.listings.push({ id: 'la', vendorId: 'va', status: 'CLAIMED', indexable: true, removedAt: null });
    await t.takedowns.create(SUPER, { vendorId: 'va', reason: 'order of the court' });
    expect(await code(w.pub.submit(HOST_A, enquiry(), '203.0.113.2'))).toBe('404'); expect(w.store.requests.size).toBe(1);
  });
  it('the scan looks at what the customer wrote, after the request is accepted; a failing scan changes nothing', async () => {
    const seen: Array<{ source: string; texts: readonly string[] }> = [];
    const w = await requestsWorld({ scan: { scan: async (_v, source, texts) => { seen.push({ source, texts }); } } });
    expect(await w.pub.submit(HOST_A, enquiry(), '203.0.113.1')).toMatchObject({ accepted: true, status: 'DELIVERED' });
    expect(seen).toHaveLength(1); expect(seen[0].source).toBe('REQUEST'); expect(seen[0].texts.length).toBeGreaterThan(1);
    const w2 = await requestsWorld({ scan: { scan: async () => { throw new Error('scan down'); } } });
    expect(await w2.pub.submit(HOST_A, enquiry(), '203.0.113.1')).toMatchObject({ accepted: true, status: 'DELIVERED' });   // the request was accepted before the scan ran; a fault in it changes nothing
  });
});
