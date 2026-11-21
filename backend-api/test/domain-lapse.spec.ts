import { canonicalHostFor, planRedirect } from '../src/site-domains/core/canonical';
import { BASE, domainWorld, DomainWorld, OWNER, pro, withAddon } from './support/domain-world';

/** Owner answer Q11 (12 November 2026): after grace the custom domain stops serving and redirects to the subdomain; the canonical host returns to the subdomain; the domain stays the vendor's. */
const A = 'vendor-a';
let w: DomainWorld;
beforeEach(() => { w = domainWorld(); w.repo.addVendor(A); });
const makeCustomActive = async (): Promise<void> => {
  w.ents.set(A, pro()); w.settings.over = { domainDnsLiveChecks: true };
  await w.svc.setSubdomain(A, 'mine', OWNER(A));
  const r = await w.svc.requestCustom(A, 'shop.example.in', OWNER(A));
  w.txt.answers = [[(await w.repo.getVerification(r.id))!.expectedValue]];
  await w.svc.verify(A, r.id, OWNER(A)); w.dir.invalidate();
};

describe('the pure rule', () => {
  const rows = [{ id: 'a', hostname: 'mine.g4d.test', kind: 'SUBDOMAIN' as const, status: 'ACTIVE' as const, isPrimary: true }, { id: 'b', hostname: 'shop.example.in', kind: 'CUSTOM' as const, status: 'ACTIVE' as const, isPrimary: false }];
  it('a lapsed plan makes the subdomain canonical, even with the promotion add-on, and nothing serves on the custom host', () => {
    expect(canonicalHostFor({ rows, legacyHost: null, addonActive: true, customServing: false })).toMatchObject({ canonicalHost: 'mine.g4d.test', canonicalKind: 'SUBDOMAIN', serveHosts: [], customHost: 'shop.example.in' });
    expect(canonicalHostFor({ rows, legacyHost: null, addonActive: true })).toMatchObject({ canonicalHost: 'shop.example.in' });   // omitted = serving, the old behaviour
  });
  it('a temporary host redirects with 302, any other owned host with 301', () => {
    const i = { requestHost: 'shop.example.in', primaryHost: 'mine.g4d.test', ownedHosts: ['mine.g4d.test', 'shop.example.in'], wwwPolicy: 'apex' as const };
    expect(planRedirect({ ...i, temporaryHosts: ['shop.example.in'] })).toEqual({ action: 'REDIRECT', host: 'mine.g4d.test', status: 302 });
    expect(planRedirect(i)).toEqual({ action: 'REDIRECT', host: 'mine.g4d.test', status: 301 });
  });
});

describe('the host directory', () => {
  it('serves the custom domain while Pro, redirects it to the subdomain once the plan has lapsed, and serves it again when Pro returns', async () => {
    await makeCustomActive();
    expect(await w.dir.resolveHost('shop.example.in')).toMatchObject({ decision: { action: 'SERVE' } });
    w.ents.delete(A); w.dir.invalidate();
    expect(await w.dir.resolveHost('shop.example.in')).toMatchObject({ decision: { action: 'REDIRECT', host: `mine.${BASE}`, status: 302 } });
    expect(await w.dir.resolveHost(`mine.${BASE}`)).toMatchObject({ decision: { action: 'SERVE' } });   // the site stays viewable on the subdomain
    w.ents.set(A, pro()); w.dir.invalidate();
    expect(await w.dir.resolveHost('shop.example.in')).toMatchObject({ decision: { action: 'SERVE' } });
  });
  it('the promotion add-on does not keep the custom domain canonical after the plan lapsed; the render fact says so too', async () => {
    await makeCustomActive(); w.ents.set(A, withAddon(pro())); w.dir.invalidate();
    expect((await w.dir.canonicalPlan(A)).canonicalHost).toBe('shop.example.in');
    const lapsed = withAddon(pro()); lapsed.features['site.custom_domain'] = { ...lapsed.features['site.custom_domain'], state: 'LOCKED_PREVIEW' }; w.ents.set(A, lapsed); w.dir.invalidate();
    expect((await w.dir.canonicalPlan(A)).canonicalHost).toBe(`mine.${BASE}`);
    expect((await w.dir.canonicalPlan(A)).addonActive).toBe(false);
  });
  it('the domain itself stays the vendor\'s: the row is untouched and another vendor cannot take it', async () => {
    await makeCustomActive(); w.ents.delete(A); w.dir.invalidate();
    expect([...w.repo.rows.values()].find((r) => r.hostname === 'shop.example.in')).toMatchObject({ vendorId: A, status: 'ACTIVE' });
    w.repo.addVendor('vendor-b'); w.ents.set('vendor-b', pro());
    await expect(w.svc.requestCustom('vendor-b', 'shop.example.in', OWNER('vendor-b'))).rejects.toMatchObject({ response: { code: 'HOST_UNAVAILABLE' } });
  });
});
