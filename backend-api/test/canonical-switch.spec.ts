import { BadRequestException } from '@nestjs/common';
import { canonicalHostFor, DomainRow, planRedirect } from '../src/site-domains/core/canonical';
import { CanonicalSwitchService } from '../src/site-domains/canonical-switch.service';
import { DEFAULT_B3_SETTINGS } from '../src/b3-settings/b3-settings';
import { BASE, domainWorld, DomainWorld, OWNER, pro, STAFF, withAddon } from './support/domain-world';
import { FakeRebuild, MemoryCanonicalStore } from './support/memory-canonical-store';
import { entitlements } from './support/site-fixtures';
import { siteWorld } from './support/site-world';
import { STAFF as SITE_STAFF } from './support/site-world';
import { VendorHosts } from '../src/site-publish/publish/vendor-hosts';

/** Slice 5.6b (owner rule 4): one canonical host per site. Pure rule, the controlled switch, the add-on routes' service and the sitemap. */
jest.setTimeout(120_000);
const row = (o: Partial<DomainRow> & { hostname: string }): DomainRow => ({ id: o.hostname, kind: 'CUSTOM', status: 'ACTIVE', isPrimary: false, ...o });
const sub = row({ hostname: `mine.${BASE}`, kind: 'SUBDOMAIN', isPrimary: true });

describe('canonicalHostFor (pure)', () => {
  const cust = row({ hostname: 'shop.example.in' });
  it('default: the subdomain is canonical; an ACTIVE custom domain serves the same site and does not redirect', () => {
    expect(canonicalHostFor({ rows: [sub, cust], legacyHost: null, addonActive: false })).toMatchObject({ canonicalHost: sub.hostname, canonicalKind: 'SUBDOMAIN', customHost: 'shop.example.in', serveHosts: ['shop.example.in'], reason: 'DEFAULT_SUBDOMAIN' });
  });
  it('with the add-on and an ACTIVE custom domain the custom domain is canonical and nothing serves alongside it', () => {
    expect(canonicalHostFor({ rows: [sub, cust], legacyHost: null, addonActive: true })).toMatchObject({ canonicalHost: 'shop.example.in', canonicalKind: 'CUSTOM', serveHosts: [], reason: 'ADDON_CUSTOM' });
  });
  it.each(['PENDING', 'VERIFYING', 'FAILED', 'REMOVED'] as const)('a %s custom domain is ignored even with the add-on', (status) => {
    expect(canonicalHostFor({ rows: [sub, { ...cust, status }], legacyHost: null, addonActive: true })).toMatchObject({ canonicalHost: sub.hostname, customHost: null, serveHosts: [] });
  });
  it('the legacy subdomain column is used when there is no subdomain row; no host at all gives null', () => {
    expect(canonicalHostFor({ rows: [], legacyHost: `old.${BASE}`, addonActive: true })).toMatchObject({ canonicalHost: `old.${BASE}` });
    expect(canonicalHostFor({ rows: [], legacyHost: null, addonActive: true })).toMatchObject({ canonicalHost: null, reason: 'NO_HOST' });
  });
  it('the choice does not depend on row order or on the isPrimary flag of the custom domain; ties break by host name', () => {
    const a = row({ hostname: 'a.example.in' }); const b = row({ hostname: 'b.example.in', isPrimary: true });
    expect(canonicalHostFor({ rows: [a, b, sub], legacyHost: null, addonActive: true }).canonicalHost).toBe('b.example.in');
    expect(canonicalHostFor({ rows: [sub, b, a], legacyHost: null, addonActive: true }).canonicalHost).toBe('b.example.in');
    expect(canonicalHostFor({ rows: [a, sub], legacyHost: null, addonActive: true }).canonicalHost).toBe('a.example.in');
  });
  it('planRedirect: a serve host answers SERVE, the canonical host SERVE, an owned non-canonical host 301, a stranger UNKNOWN', () => {
    const i = { primaryHost: sub.hostname, ownedHosts: [sub.hostname, 'shop.example.in'], wwwPolicy: 'apex' as const, serveHosts: ['shop.example.in'] };
    expect(planRedirect({ ...i, requestHost: 'shop.example.in' })).toEqual({ action: 'SERVE' });
    expect(planRedirect({ ...i, requestHost: sub.hostname })).toEqual({ action: 'SERVE' });
    expect(planRedirect({ ...i, requestHost: 'shop.example.in', serveHosts: [], primaryHost: 'x.get4domain.com' })).toEqual({ action: 'REDIRECT', host: 'x.get4domain.com', status: 301 });
    expect(planRedirect({ ...i, requestHost: 'nobody.example.org' })).toEqual({ action: 'UNKNOWN' });
  });
});

describe('the controlled switch', () => {
  const A = 'vendor-a'; const B = 'vendor-b';
  let w: DomainWorld; let store: MemoryCanonicalStore; let rebuild: FakeRebuild; let svc: CanonicalSwitchService; let tick: { on: boolean };
  const overrides = { createOverride: jest.fn(async (_v: string, _dto: unknown, _actor: unknown) => ({ id: 'ovr-1' })), expireOverride: jest.fn(async (_id: string, _actor?: unknown) => ({})) };
  beforeEach(async () => {
    w = domainWorld(); w.repo.addVendor(A); w.repo.addVendor(B); store = new MemoryCanonicalStore(); rebuild = new FakeRebuild(); tick = { on: false };
    svc = new CanonicalSwitchService(store, w.dir, rebuild, { get: async () => ({ ...DEFAULT_B3_SETTINGS, canonicalSwitchTickEnabled: tick.on }) } as never, overrides as never);
    svc.clock = () => new Date(w.now.t); overrides.createOverride.mockClear(); overrides.expireOverride.mockClear();
    w.ents.set(A, pro()); w.settings.over = { domainDnsLiveChecks: true };
    await w.svc.setSubdomain(A, 'mine', OWNER(A));
    const r = await w.svc.requestCustom(A, 'shop.example.in', OWNER(A));
    w.txt.answers = [[(await w.repo.getVerification(r.id))!.expectedValue]]; await w.svc.verify(A, r.id, OWNER(A)); w.dir.invalidate();
  });

  it('without the add-on the first look only remembers the subdomain: no rebuild, no event', async () => {
    expect(await svc.switchFor(A, STAFF)).toEqual({ changed: false, from: null, to: `mine.${BASE}` });
    expect(rebuild.calls).toEqual([]); expect(store.events).toEqual([]); expect(store.stored.get(A)).toBe(`mine.${BASE}`);
  });

  it('add-on starts: rebuild once, a site event with before and after, an audit row; running it twice is a no-op', async () => {
    await svc.switchFor(A, STAFF);
    w.ents.set(A, withAddon(pro()));
    const first = await svc.switchFor(A, STAFF, 'ADDON_STARTED');
    expect(first).toEqual({ changed: true, from: `mine.${BASE}`, to: 'shop.example.in' });
    expect(rebuild.calls).toEqual([A]); expect(store.events).toEqual([expect.objectContaining({ vendorId: A, before: `mine.${BASE}`, after: 'shop.example.in', reason: 'ADDON_STARTED' })]); expect(store.audits).toHaveLength(1);
    expect(await svc.switchFor(A, STAFF, 'ADDON_STARTED')).toEqual({ changed: false, from: 'shop.example.in', to: 'shop.example.in' });
    expect(rebuild.calls).toHaveLength(1); expect(store.events).toHaveLength(1);
  });

  it('add-on expiry: the same function moves the canonical back and records it; the cache is dropped so routing follows at once', async () => {
    await svc.switchFor(A, STAFF); w.ents.set(A, withAddon(pro())); await svc.switchFor(A, STAFF);
    w.ents.set(A, pro());   // the override's end date passed
    const back = await svc.switchFor(A, STAFF, 'ADDON_ENDED');
    expect(back).toEqual({ changed: true, from: 'shop.example.in', to: `mine.${BASE}` });
    expect(store.events.map((e) => [e.before, e.after, e.reason])).toEqual([[`mine.${BASE}`, 'shop.example.in', 'ADDON_STARTED'], ['shop.example.in', `mine.${BASE}`, 'ADDON_ENDED']]);
    expect(await w.dir.resolveHost(`mine.${BASE}`)).toMatchObject({ decision: { action: 'SERVE' } });
  });

  it('domain removed, plan downgrade and unverified domain: each gives the canonical host the rule gives, never a stale one', async () => {
    await svc.switchFor(A, STAFF); w.ents.set(A, withAddon(pro())); await svc.switchFor(A, STAFF);
    const custom = [...w.repo.rows.values()].find((r) => r.hostname === 'shop.example.in')!; custom.status = 'REMOVED';
    expect((await svc.switchFor(A, STAFF, 'DOMAIN_CHANGED')).to).toBe(`mine.${BASE}`);
    custom.status = 'VERIFYING'; w.ents.set(A, withAddon(pro()));
    expect(await svc.switchFor(A, STAFF)).toMatchObject({ changed: false, to: `mine.${BASE}` });
    custom.status = 'ACTIVE'; w.ents.delete(A);   // downgraded to Free: no add-on any more
    expect(await svc.switchFor(A, STAFF)).toMatchObject({ changed: false, to: `mine.${BASE}` });
  });

  it('a failed rebuild records nothing, so the next call retries and then records once', async () => {
    await svc.switchFor(A, STAFF); w.ents.set(A, withAddon(pro())); rebuild.failNext = true;
    await expect(svc.switchFor(A, STAFF)).rejects.toThrow('build failed');
    expect(store.events).toEqual([]); expect(store.stored.get(A)).toBe(`mine.${BASE}`);
    expect(await svc.switchFor(A, STAFF)).toMatchObject({ changed: true }); expect(store.events).toHaveLength(1);
  });

  it('cross-tenant: switching vendor A never touches vendor B', async () => {
    w.ents.set(B, pro()); await w.svc.setSubdomain(B, 'other', OWNER(B));
    await svc.switchFor(B, STAFF); await svc.switchFor(A, STAFF); w.ents.set(A, withAddon(pro())); await svc.switchFor(A, STAFF);
    expect(store.stored.get(B)).toBe(`other.${BASE}`); expect(store.events.every((e) => e.vendorId === A)).toBe(true);
  });

  it('the tick is OFF by default; on, it moves back every vendor whose add-on ended and leaves the others alone', async () => {
    await svc.switchFor(A, STAFF); w.ents.set(A, withAddon(pro())); await svc.switchFor(A, STAFF); w.ents.set(A, pro());
    expect(await svc.tick()).toEqual({ checked: 0, switched: 0 }); expect(store.stored.get(A)).toBe('shop.example.in');
    tick.on = true;
    expect(await svc.tick()).toEqual({ checked: 1, switched: 1 }); expect(store.stored.get(A)).toBe(`mine.${BASE}`);
    expect(await svc.tick()).toEqual({ checked: 1, switched: 0 });
  });

  it('grant: needs a reason and a future end date, goes through the override service as ACTIVE until the end date, then switches', async () => {
    await expect(svc.grantAddon(A, STAFF, '', '2027-01-01T00:00:00Z')).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.grantAddon(A, STAFF, 'owner paid for the add-on', 'not a date')).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.grantAddon(A, STAFF, 'owner paid for the add-on', '2020-01-01T00:00:00Z')).rejects.toBeInstanceOf(BadRequestException);
    w.ents.set(A, withAddon(pro()));   // the override service would invalidate the engine; the fake world sets it
    const r = await svc.grantAddon(A, STAFF, 'owner paid for the add-on', '2027-12-31T00:00:00Z');
    expect(overrides.createOverride).toHaveBeenCalledWith(A, { featureKey: 'promotion.custom_domain_addon', state: 'ACTIVE', reason: 'owner paid for the add-on', expiresAt: '2027-12-31T00:00:00.000Z' }, STAFF);
    expect(r.overrideId).toBe('ovr-1');
  });
  it('end: expires every live add-on override, then switches back', async () => {
    store.addonOverrides.set(A, ['o1', 'o2']); await svc.switchFor(A, STAFF); w.ents.set(A, withAddon(pro())); await svc.switchFor(A, STAFF); w.ents.set(A, pro());
    const r = await svc.endAddon(A, STAFF, 'owner ended the add-on');
    expect(overrides.expireOverride.mock.calls.map((c) => c[0])).toEqual(['o1', 'o2']); expect(r).toMatchObject({ ended: 2, switch: { changed: true, to: `mine.${BASE}` } });
    await expect(svc.endAddon(A, STAFF, 'no')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('state(): says what the rule gives, what the published pages were built for, and whether they are in sync', async () => {
    await svc.switchFor(A, STAFF); w.ents.set(A, withAddon(pro()));
    expect(await svc.state(A)).toMatchObject({ canonicalHost: 'shop.example.in', publishedFor: `mine.${BASE}`, inSync: false, promotionAddonActive: true, customHost: 'shop.example.in' });
    await svc.switchFor(A, STAFF);
    expect(await svc.state(A)).toMatchObject({ inSync: true });
  });
});

describe('the sitemap lists only the canonical host', () => {
  const hosts = (host: string, isCustom: boolean): VendorHosts => ({ primary: async () => ({ host, isCustom }), hasVerifiedCustomDomain: async () => isCustom });
  const sitemapOf = async (h: VendorHosts) => {
    const w = siteWorld({ kind: 'plumber', level: 'PRO', claimed: true, hosts: h });   // claimed: a noindex site has an empty sitemap by design
    const p = (await w.build.build('v-plumber', { actor: SITE_STAFF })).publication;
    return (await w.repo.pagesOf(p.id)).find((x) => x.path === '/sitemap.xml')!.html;
  };
  it('with the subdomain canonical every URL is on the subdomain; with the add-on every URL is on the custom domain and the subdomain appears nowhere', async () => {
    const onSub = await sitemapOf(hosts(`sri.${BASE}`, false));
    expect(onSub).toContain(`https://sri.${BASE}/`); expect(onSub).not.toContain('shop.example.in');
    const onCustom = await sitemapOf(hosts('shop.example.in', true));
    expect(onCustom).toContain('https://shop.example.in/'); expect(onCustom).not.toContain(`sri.${BASE}`);
  });
  it('entitlement fixture: the add-on is in no plan', () => {
    for (const lvl of ['FREE', 'PRO'] as const) expect(entitlements(lvl).features['promotion.custom_domain_addon'].state).toBe('HIDDEN');
  });
});
