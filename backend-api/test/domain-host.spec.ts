import { advance, BASE, domainWorld, DomainWorld, OWNER, pro, withAddon } from './support/domain-world';

/** Slice 5.6: which host belongs to which vendor, which is canonical, and what a request for each host should do. */
const A = 'vendor-a';
let w: DomainWorld;
beforeEach(() => { w = domainWorld(); w.repo.addVendor(A); w.repo.addVendor('vendor-b'); });

const makeCustomActive = async (host = 'shop.example.in'): Promise<void> => {
  w.ents.set(A, pro()); w.settings.over = { domainDnsLiveChecks: true };
  await w.svc.setSubdomain(A, 'mine', OWNER(A));
  const r = await w.svc.requestCustom(A, host, OWNER(A));
  w.txt.answers = [[(await w.repo.getVerification(r.id))!.expectedValue]];
  await w.svc.verify(A, r.id, OWNER(A));
  w.dir.invalidate();
};

describe('resolveHost', () => {
  it('a free subdomain with a row is served', async () => {
    await w.svc.setSubdomain(A, 'mine', OWNER(A));
    expect(await w.dir.resolveHost(`mine.${BASE}`)).toEqual({ vendorId: A, host: `mine.${BASE}`, primaryHost: `mine.${BASE}`, decision: { action: 'SERVE' } });
  });
  it('a legacy vendor (only the subdomain column) is served too, so nothing breaks before any row exists', async () => {
    w.repo.addVendor('old', 'oldie');
    expect(await w.dir.resolveHost(`oldie.${BASE}`)).toMatchObject({ vendorId: 'old', decision: { action: 'SERVE' } });
  });
  it('case and port are ignored; invalid or foreign hosts give null', async () => {
    await w.svc.setSubdomain(A, 'mine', OWNER(A));
    expect(await w.dir.resolveHost(`MINE.${BASE}:443`)).toMatchObject({ vendorId: A });
    for (const h of ['', 'nothing.example.org', `unknown.${BASE}`, '10.0.0.1', 'a b', `${'x'.repeat(300)}.com`, null as never, undefined as never]) expect(await w.dir.resolveHost(h)).toBeNull();
  });
  // B3.0b (owner rule 9, supersedes Batch 2): a suspended or pending vendor is NOT hidden. Only a removed business is, and it looks exactly like an unknown host.
  it('a suspended vendor and a pending vendor are still served; only a removed business gives the unknown-host null', async () => {
    await w.svc.setSubdomain(A, 'mine', OWNER(A)); w.dir.invalidate();
    w.repo.vendors.get(A)!.status = 'SUSPENDED'; expect(await w.dir.resolveHost(`mine.${BASE}`)).toMatchObject({ vendorId: A });
    w.repo.vendors.get(A)!.status = 'PENDING'; w.dir.invalidate(); expect(await w.dir.resolveHost(`mine.${BASE}`)).toMatchObject({ vendorId: A });
    w.repo.vendors.get(A)!.removed = true; w.dir.invalidate();
    expect(await w.dir.resolveHost(`mine.${BASE}`)).toBeNull(); expect(await w.dir.resolveHost(`unknown.${BASE}`)).toBeNull();
  });
  it('a business removed AFTER the host was cached stops being served at once (removal is never cached), by every route to the vendor', async () => {
    await w.svc.setSubdomain(A, 'mine', OWNER(A)); await w.svc.setSubdomain(A, 'later', OWNER(A));
    expect(await w.dir.resolveHost(`later.${BASE}`)).toMatchObject({ vendorId: A }); expect(await w.dir.resolveHost(`mine.${BASE}`)).toMatchObject({ vendorId: A });   // both now cached
    w.repo.vendors.get(A)!.removed = true;   // no invalidate(): the removal flow does not tell this module
    expect(await w.dir.resolveHost(`later.${BASE}`)).toBeNull(); expect(await w.dir.resolveHost(`mine.${BASE}`)).toBeNull();
  });
  it('suspension changes nothing about serving, even right after the host was cached', async () => {
    await w.svc.setSubdomain(A, 'mine', OWNER(A));
    expect(await w.dir.resolveHost(`mine.${BASE}`)).toMatchObject({ vendorId: A });
    w.repo.vendors.get(A)!.status = 'SUSPENDED';
    expect(await w.dir.resolveHost(`mine.${BASE}`)).toMatchObject({ vendorId: A });
  });
  it('an old subdomain redirects (301) to the new one through the stored redirect; path handling stays with the caller', async () => {
    await w.svc.setSubdomain(A, 'before', OWNER(A)); await w.svc.setSubdomain(A, 'after', OWNER(A));
    expect(await w.dir.resolveHost(`before.${BASE}`)).toEqual({ vendorId: A, host: `before.${BASE}`, primaryHost: `after.${BASE}`, decision: { action: 'REDIRECT', host: `after.${BASE}`, status: 301 } });
    expect(await w.dir.resolveHost(`after.${BASE}`)).toMatchObject({ decision: { action: 'SERVE' } });
  });
  // B3 slice 5.6b (owner rule 4) supersedes the Batch 2 rule "an ACTIVE custom domain is canonical": the SUBDOMAIN is canonical unless the promotion add-on is active
  it('verified custom domain WITHOUT the add-on: it serves the same site, the subdomain stays canonical, and nobody is redirected', async () => {
    await makeCustomActive();
    expect(await w.dir.resolveHost('shop.example.in')).toMatchObject({ vendorId: A, primaryHost: `mine.${BASE}`, decision: { action: 'SERVE' } });
    expect(await w.dir.resolveHost(`mine.${BASE}`)).toMatchObject({ vendorId: A, primaryHost: `mine.${BASE}`, decision: { action: 'SERVE' } });
  });
  it('verified custom domain WITH the add-on: the custom domain is canonical and the subdomain redirects to it', async () => {
    await makeCustomActive(); w.ents.set(A, withAddon(pro())); w.dir.invalidate();
    expect(await w.dir.resolveHost('shop.example.in')).toMatchObject({ vendorId: A, primaryHost: 'shop.example.in', decision: { action: 'SERVE' } });
    expect(await w.dir.resolveHost(`mine.${BASE}`)).toMatchObject({ vendorId: A, decision: { action: 'REDIRECT', host: 'shop.example.in', status: 301 } });
  });
  it('no custom domain, or one that is not ACTIVE: the add-on changes nothing, the subdomain is canonical', async () => {
    w.ents.set(A, withAddon(pro())); await w.svc.setSubdomain(A, 'mine', OWNER(A));
    expect(await w.dir.resolveHost(`mine.${BASE}`)).toMatchObject({ primaryHost: `mine.${BASE}`, decision: { action: 'SERVE' } });
    const r = await w.svc.requestCustom(A, 'shop.example.in', OWNER(A));
    for (const status of ['PENDING', 'VERIFYING', 'FAILED'] as const) { w.repo.rows.get(r.id)!.status = status; w.dir.invalidate(); expect(await w.dir.resolveHost(`mine.${BASE}`)).toMatchObject({ primaryHost: `mine.${BASE}` }); expect(await w.dir.resolveHost('shop.example.in')).toBeNull(); }
  });
  it('the add-on ending (expiry), the domain being removed, or a plan downgrade: the canonical host returns to the subdomain and the custom domain keeps serving; nothing stored changes', async () => {
    await makeCustomActive(); w.ents.set(A, withAddon(pro())); w.dir.invalidate();
    expect((await w.dir.canonicalPlan(A)).canonicalHost).toBe('shop.example.in');
    w.ents.set(A, pro()); w.dir.invalidate();   // the override expired
    expect((await w.dir.canonicalPlan(A)).canonicalHost).toBe(`mine.${BASE}`);
    expect(await w.dir.resolveHost('shop.example.in')).toMatchObject({ primaryHost: `mine.${BASE}`, decision: { action: 'SERVE' } });
    w.ents.delete(A); w.dir.invalidate();   // and the plan fell to Free as well: the custom domain still serves (owner rule 9)
    expect(await w.dir.resolveHost('shop.example.in')).toMatchObject({ vendorId: A, decision: { action: 'SERVE' } });
    expect([...w.repo.rows.values()].find((r) => r.hostname === 'shop.example.in')).toMatchObject({ status: 'ACTIVE' });
    w.ents.set(A, withAddon(pro())); const custom = [...w.repo.rows.values()].find((r) => r.hostname === 'shop.example.in')!; custom.status = 'REMOVED'; w.dir.invalidate();
    expect((await w.dir.canonicalPlan(A)).canonicalHost).toBe(`mine.${BASE}`);
  });
  it('apex policy: www.<custom> redirects to the custom apex even though no row exists for www; not for a host the vendor does not own', async () => {
    await makeCustomActive(); w.ents.set(A, withAddon(pro())); w.dir.invalidate();
    expect(await w.dir.resolveHost('www.shop.example.in')).toMatchObject({ vendorId: A, decision: { action: 'REDIRECT', host: 'shop.example.in', status: 301 } });
    expect(await w.dir.resolveHost('www.other.example.in')).toBeNull();
  });
  it('a custom domain that is not ACTIVE is never served (PENDING, VERIFYING, FAILED, REMOVED all look like an unknown host)', async () => {
    w.ents.set(A, pro()); await w.svc.setSubdomain(A, 'mine', OWNER(A));
    const r = await w.svc.requestCustom(A, 'shop.example.in', OWNER(A));
    for (const status of ['PENDING', 'VERIFYING', 'FAILED', 'REMOVED'] as const) { w.repo.rows.get(r.id)!.status = status; w.dir.invalidate(); expect(await w.dir.resolveHost('shop.example.in')).toBeNull(); }
  });
  it('one vendor\'s custom host can never resolve to another vendor', async () => {
    await makeCustomActive();
    expect((await w.dir.resolveHost('shop.example.in'))!.vendorId).toBe(A);
  });
});

describe('hasVerifiedCustomDomain (the render fact: the custom domain is the site address)', () => {
  it('false with no domain, false while only PENDING, false for a verified domain WITHOUT the add-on, true only with the add-on, false again when the add-on ends', async () => {
    w.ents.set(A, pro()); w.repo.addVendor(A);
    expect(await w.dir.hasVerifiedCustomDomain(A)).toBe(false);
    await w.svc.setSubdomain(A, 'mine', OWNER(A)); await w.svc.requestCustom(A, 'shop.example.in', OWNER(A));
    w.ents.set(A, withAddon(pro())); w.dir.invalidate();
    expect(await w.dir.hasVerifiedCustomDomain(A)).toBe(false);   // the add-on is on but the domain is only PENDING
    await makeCustomActive('other.example.in');
    expect(await w.dir.hasVerifiedCustomDomain(A)).toBe(false);   // verified, add-on not on
    w.ents.set(A, withAddon(pro())); w.dir.invalidate();
    expect(await w.dir.hasVerifiedCustomDomain(A)).toBe(true);
    w.ents.set(A, pro()); w.dir.invalidate();
    expect(await w.dir.hasVerifiedCustomDomain(A)).toBe(false);
  });
});

describe('the resolver cache', () => {
  it('a second lookup inside the TTL does not touch the repository; a write or the TTL clears it', async () => {
    await w.svc.setSubdomain(A, 'mine', OWNER(A));
    let reads = 0; const orig = w.repo.findByHostname.bind(w.repo); w.repo.findByHostname = async (h) => { reads++; return orig(h); };
    await w.dir.resolveHost(`mine.${BASE}`); await w.dir.resolveHost(`mine.${BASE}`);
    expect(reads).toBe(1);
    advance(w, 61); await w.dir.resolveHost(`mine.${BASE}`);
    expect(reads).toBe(2);
    await w.svc.setSubdomain(A, 'renamed', OWNER(A));   // a write invalidates
    const r = await w.dir.resolveHost(`mine.${BASE}`);
    expect(r!.decision).toEqual({ action: 'REDIRECT', host: `renamed.${BASE}`, status: 301 });
  });
  it('unknown hosts are cached too, but the cache is bounded', async () => {
    for (let i = 0; i < 5200; i++) await w.dir.resolveHost(`junk${i}.${BASE}`);
    expect(w.dir.cacheSize()).toBeLessThanOrEqual(5000);
  });
});
