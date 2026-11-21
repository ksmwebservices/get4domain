import { HttpException, Logger } from '@nestjs/common';
import { AuthService } from '../src/auth/auth.service';
import { RegistrationHook } from '../src/plans/registration/registration.hook';
import { TrialSitePort } from '../src/plans/registration/trial-site.port';
import { MeSiteController } from '../src/site-publish/api/me-site.controller';
import { withCats } from './support/listed-industries';

/** B2.1: registration creates the site. Track defaulted from the category, the answer carries the site, a failure is recorded and retryable. */
function world(over: { tier?: string | null; setting?: unknown; plan?: () => Promise<unknown>; site?: () => Promise<unknown> } = {}) {
  const calls: string[] = [];
  const vendorRow: Record<string, unknown> = { id: 'v1', subdomain: 'carewell', industry: 'clinic', businessName: 'CareWell', phone: '98', siteProvisionStatus: null, siteProvisionCode: null };
  const prisma = {
    v3PlanSetting: { findUnique: async () => (over.setting === undefined ? { valueJson: true } : { valueJson: over.setting }) },
    v3PackCategory: { findUnique: async () => (over.tier === null ? null : { minTier: over.tier ?? 'PROFESSIONAL' }) },
    vendor: { findUnique: async () => ({ ...vendorRow }), update: async ({ data }: { data: Record<string, unknown> }) => { Object.assign(vendorRow, data); return vendorRow; } },
  };
  const subs = { provisionFreeSubscription: async (_v: string, track: string) => { calls.push(`plan:${track}`); await over.plan?.(); } };
  const site: TrialSitePort = { createLiveTrialSite: async (i) => { calls.push(`site:${i.track}`); await over.site?.(); return { siteId: 's1', published: true }; } };
  return { hook: new RegistrationHook(prisma as never, subs as never, site), calls, vendorRow };
}
const info = { industry: 'clinic', businessName: 'CareWell', phone: '98' };

describe('B2.1 (a) the track defaults from the category', () => {
  beforeEach(() => { jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined); });
  afterEach(() => jest.restoreAllMocks());
  it('no track sent: the category minimum tier is used, and the plan and the site are made', async () => {
    const w = world({ tier: 'ECOMMERCE' });
    await w.hook.afterRegister('v1', undefined, info);
    expect(w.calls).toEqual(['plan:ecommerce', 'site:ecommerce']);
  });
  it('a track that is not one of the three is treated as none', async () => {
    const w = world({ tier: 'HANDYMAN' });
    await w.hook.afterRegister('v1', 'banking', info);
    expect(w.calls).toEqual(['plan:handyman', 'site:handyman']);
  });
  it('a track that is sent wins over the category', async () => {
    const w = world({ tier: 'HANDYMAN' });
    await w.hook.afterRegister('v1', 'professional', info);
    expect(w.calls).toEqual(['plan:professional', 'site:professional']);
  });
  it('a category with no stored tier falls back to the lowest track', async () => {
    const w = world({ tier: null });
    await w.hook.afterRegister('v1', undefined, info);
    expect(w.calls).toEqual(['plan:handyman', 'site:handyman']);
  });
  it('the switch off: nothing is made and the answer says so', async () => {
    const w = world({ setting: false });
    const a = await w.hook.afterRegister('v1', undefined, info);
    expect(w.calls).toEqual([]);
    expect(a).toMatchObject({ status: 'NOT_SWITCHED_ON', published: false, url: null });
  });
});

describe('B2.1 (b) the answer tells the truth', () => {
  beforeEach(() => { jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined); });
  afterEach(() => jest.restoreAllMocks());
  it('LIVE answer: status, published, subdomain and url', async () => {
    process.env.SITE_BASE_DOMAIN = 'example.test';
    const a = await world().hook.afterRegister('v1', undefined, info);
    delete process.env.SITE_BASE_DOMAIN;
    expect(a).toEqual({ status: 'LIVE', published: true, subdomain: 'carewell', url: 'https://carewell.example.test' });
  });
  it('AuthService.register puts it in the result as `site`', async () => {
    const site = { status: 'LIVE', published: true, subdomain: 'biz', url: 'https://biz.get4domain.com' };
    const prisma = { vendor: { findUnique: jest.fn().mockResolvedValue(null) } };
    const vendors = { create: jest.fn().mockResolvedValue({ id: 'v1', name: 'A', email: 'a@x.invalid', role: 'VENDOR', businessName: 'Biz', industry: 'plumber', subdomain: 'biz' }) };
    const svc = new AuthService(withCats(prisma) as never, { sign: jest.fn().mockReturnValue('t') } as never, vendors as never, { afterRegister: jest.fn().mockResolvedValue(site) } as never);
    const out = await svc.register({ name: 'A', email: 'a@x.invalid', password: 'StrongPass1', businessName: 'Biz', industry: 'plumber' } as never);
    expect(out.site).toEqual(site);
  });
});

describe('B2.1 (c) a failure is recorded, never swallowed, and can be retried', () => {
  beforeEach(() => { jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined); });
  afterEach(() => jest.restoreAllMocks());
  it('a failing site: FAILED answer, FAILED + a code on the vendor, no error text anywhere', async () => {
    const w = world({ site: async () => { throw new Error('postgres://user:secret@host/db'); } });
    const a = await w.hook.afterRegister('v1', undefined, info);
    expect(a).toMatchObject({ status: 'FAILED', published: false, url: null });
    expect(w.vendorRow).toMatchObject({ siteProvisionStatus: 'FAILED', siteProvisionCode: 'SITE_FAILED' });
    expect(JSON.stringify([a, w.vendorRow])).not.toMatch(/secret|postgres/);
  });
  it('a coded error keeps its plain code; a failing plan is recorded too', async () => {
    const w = world({ site: async () => { throw new HttpException({ code: 'DUPLICATE_REVIEW_PENDING', message: 'x' }, 409); } });
    await w.hook.afterRegister('v1', undefined, info);
    expect(w.vendorRow.siteProvisionCode).toBe('DUPLICATE_REVIEW_PENDING');
    const p = world({ plan: async () => { throw new Error('db down'); } });
    expect((await p.hook.afterRegister('v1', undefined, info)).status).toBe('FAILED');
    expect(p.vendorRow.siteProvisionCode).toBe('PLAN_FAILED');
  });
  it('createMySite retries, works even with the switch off, and clears the failure', async () => {
    let fail = true;
    const w = world({ setting: false, site: async () => { if (fail) throw new Error('x'); } });
    expect((await w.hook.createMySite('v1')).status).toBe('FAILED');
    fail = false;
    const a = await w.hook.createMySite('v1');
    expect(a).toMatchObject({ status: 'LIVE', published: true });
    expect(w.vendorRow).toMatchObject({ siteProvisionStatus: null, siteProvisionCode: null });
  });
  it('the vendor route calls createMySite for the signed-in vendor only', async () => {
    const createMySite = jest.fn().mockResolvedValue({ status: 'LIVE' });
    const c = new MeSiteController({} as never, {} as never, {} as never, {} as never, { createMySite } as never);
    await c.create({ vendorId: 'v9' } as never);
    expect(createMySite).toHaveBeenCalledWith('v9');
  });
});
