import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EntitlementsService } from '../src/plans/entitlements/entitlements.service';
import { Catalogue, PlansRepository, VendorState } from '../src/plans/entitlements/plans.repository';
import { FeatureGuard } from '../src/plans/entitlements/feature.guard';
import { REQUIRES_FEATURE, RequiresFeature } from '../src/plans/entitlements/requires-feature.decorator';
import { EngineCell } from '../src/plans/entitlements/entitlement-engine';

/** S51.4: the Nest layer around the pure core: cache (30 s), invalidation, request memo, the limit error and the feature guard. No database. */
class FakeRepo extends PlansRepository {
  catalogueLoads = 0;
  vendorLoads = 0;
  state: Record<string, VendorState> = {};
  matrixCell: EngineCell = { state: 'LIMITED', limitValue: 2, enumValue: null, upsellText: 'Upgrade for more.' };
  async loadCatalogue(): Promise<Catalogue> {
    this.catalogueLoads += 1;
    return {
      plans: [{ id: 'F', key: 'handyman_free', track: 'HANDYMAN', level: 'FREE', status: 'ACTIVE' }, { id: 'P', key: 'handyman_pro', track: 'HANDYMAN', level: 'PRO', status: 'ACTIVE' }],
      matrix: new Map([['F', new Map([['site.services', this.matrixCell], ['site.video', { state: 'LOCKED_PREVIEW', limitValue: null, enumValue: null, upsellText: 'Add video with Pro.' } as EngineCell]])], ['P', new Map([['site.video', { state: 'ACTIVE', limitValue: null, enumValue: null, upsellText: null } as EngineCell]])]]),
      featureKeys: ['site.services', 'site.video'],
      settings: { graceDays: 7, downgradeBehaviour: 'FALL_TO_FREE' },
    };
  }
  async loadVendorState(vendorId: string): Promise<VendorState> {
    this.vendorLoads += 1;
    return this.state[vendorId] ?? { flagOn: false, subscription: null, overrides: [] };
  }
}
const freeSub = { id: 's', planId: 'F', status: 'ACTIVE' as const, termMonths: null, startsAt: new Date('2027-01-01'), endsAt: null, graceEndsAt: null };

describe('EntitlementsService', () => {
  let repo: FakeRepo;
  let svc: EntitlementsService;
  let now: number;
  beforeEach(() => { repo = new FakeRepo(); repo.state.v1 = { flagOn: true, subscription: freeSub, overrides: [] }; now = Date.parse('2027-03-01T00:00:00Z'); svc = new EntitlementsService(repo, () => new Date(now)); });

  it('resolves a vendor from the repository', async () => {
    const r = await svc.resolve('v1');
    expect(r.mode).toBe('V3');
    expect(r.features['site.video'].state).toBe('LOCKED_PREVIEW');
  });

  it('caches for 30 seconds: one load for many resolves, a fresh load after the TTL', async () => {
    await svc.resolve('v1'); await svc.resolve('v1'); await svc.can('v1', 'site.video');
    expect(repo.vendorLoads).toBe(1);
    expect(repo.catalogueLoads).toBe(1);
    now += 31_000;
    await svc.resolve('v1');
    expect(repo.vendorLoads).toBe(2);
    expect(repo.catalogueLoads).toBe(2);
  });

  it('invalidate(vendor) drops one vendor; invalidateAll() drops the catalogue too (a plan, feature, matrix or setting changed)', async () => {
    await svc.resolve('v1');
    svc.invalidate('v1');
    await svc.resolve('v1');
    expect(repo.vendorLoads).toBe(2);
    expect(repo.catalogueLoads).toBe(1);
    svc.invalidateAll();
    await svc.resolve('v1');
    expect(repo.catalogueLoads).toBe(2);
  });

  it('a change is visible at once after invalidation (no stale 30-second window)', async () => {
    expect((await svc.resolve('v1')).features['site.video'].state).toBe('LOCKED_PREVIEW');
    repo.state.v1 = { flagOn: true, subscription: freeSub, overrides: [{ id: 'o', featureKey: 'site.video', state: 'ACTIVE', limitValue: null, enumValue: null, reason: 'x', expiresAt: null, createdAt: new Date(now) }] };
    expect((await svc.resolve('v1')).features['site.video'].state).toBe('LOCKED_PREVIEW');   // still cached
    svc.invalidate('v1');
    expect((await svc.resolve('v1')).features['site.video'].state).toBe('ACTIVE');
  });

  it('a request memo: the same request resolves once even without the cache', async () => {
    const req: Record<string, unknown> = {};
    const a = await svc.resolveForRequest(req, 'v1');
    svc.invalidateAll();
    const b = await svc.resolveForRequest(req, 'v1');
    expect(a).toBe(b);
    expect(repo.vendorLoads).toBe(1);
  });

  it('usage is passed to the engine (overLimit) and bypasses the cache', async () => {
    const r = await svc.resolve('v1', { usage: { 'site.services': 5 } });
    expect(r.features['site.services']).toMatchObject({ limit: 2, overLimit: true });
    const again = await svc.resolve('v1');
    expect(again.features['site.services'].overLimit).toBe(false);
  });

  it('assertWithinLimit throws 403 with a stable code and the upsell text', async () => {
    await expect(svc.assertWithinLimit('v1', 'site.services', 1)).resolves.toBeUndefined();
    const err = await svc.assertWithinLimit('v1', 'site.services', 2).catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect((err as ForbiddenException).getResponse()).toMatchObject({ code: 'LIMIT_REACHED', feature: 'site.services', limit: 2, upsellText: 'Upgrade for more.' });
    const locked = await svc.assertWithinLimit('v1', 'site.video', 0).catch((e) => e);
    expect((locked as ForbiddenException).getResponse()).toMatchObject({ code: 'FEATURE_LOCKED', upsellText: 'Add video with Pro.' });
  });

  it('toRender maps the resolved entitlements for the theme kit', async () => {
    expect(await svc.renderEntitlements('v1')).toEqual({ video: false, cart: false, booking: false, customDomain: false });
    repo.state.v2 = { flagOn: true, subscription: { ...freeSub, planId: 'P', endsAt: new Date(now + 86_400_000), termMonths: 3 }, overrides: [] };
    expect((await svc.renderEntitlements('v2')).video).toBe(true);
  });
});

describe('FeatureGuard and @RequiresFeature', () => {
  const makeCtx = (user: unknown, handler: () => void): ExecutionContext => ({
    switchToHttp: () => ({ getRequest: () => ({ user, memo: undefined }) }),
    getHandler: () => handler, getClass: () => class X {},
  }) as unknown as ExecutionContext;

  it('the decorator stores the feature key as metadata', () => {
    class C { @RequiresFeature('site.video') h(): void {} }
    expect(Reflect.getMetadata(REQUIRES_FEATURE, C.prototype.h)).toEqual({ key: 'site.video' });
  });

  it('allows when the feature is ACTIVE, refuses with FEATURE_LOCKED otherwise, and never trusts a vendor id from the request', async () => {
    const repo = new FakeRepo();
    repo.state.v1 = { flagOn: true, subscription: freeSub, overrides: [] };
    repo.state.v2 = { flagOn: true, subscription: { ...freeSub, planId: 'P' }, overrides: [] };
    const svc = new EntitlementsService(repo, () => new Date('2027-03-01'));
    const guard = new FeatureGuard(new Reflector(), svc);
    class C { @RequiresFeature('site.video') h(): void {} }
    const handler = C.prototype.h;
    await expect(guard.canActivate(makeCtx({ sub: 'v2', role: 'VENDOR' }, handler))).resolves.toBe(true);
    const err = await guard.canActivate(makeCtx({ sub: 'v1', role: 'VENDOR' }, handler)).catch((e) => e);
    expect((err as ForbiddenException).getResponse()).toMatchObject({ code: 'FEATURE_LOCKED', feature: 'site.video', upsellText: 'Add video with Pro.' });
  });

  it('a route without the decorator is not touched; a staff principal without a vendor is refused', async () => {
    const svc = new EntitlementsService(new FakeRepo(), () => new Date());
    const guard = new FeatureGuard(new Reflector(), svc);
    const plain = (): void => undefined;
    await expect(guard.canActivate(makeCtx({ sub: 'x', role: 'VENDOR' }, plain))).resolves.toBe(true);
    class C { @RequiresFeature('site.video') h(): void {} }
    await expect(guard.canActivate(makeCtx({ sub: 'a', role: 'ADMIN', kind: 'admin_member' }, C.prototype.h))).rejects.toBeInstanceOf(ForbiddenException);
  });
});
