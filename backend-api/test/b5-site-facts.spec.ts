import { ArgumentsHost, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { duplicateError } from '../src/v3-duplicates/duplicate.errors';
import { AdminVendorSiteService, siteAddress } from '../src/v3-admin-vendor-site/admin-vendor-site.service';
import { SitesAdminController } from '../src/site-publish/api/sites-admin.controller';
import { MeSiteController } from '../src/site-publish/api/me-site.controller';
import { SiteProvisionFacts } from '../src/site-publish/publish/site-provision-facts.service';
import { AppShellService } from '../src/v3-packs/app-shell.service';

const run = (e: unknown) => {
  const json = jest.fn(); const status = jest.fn().mockReturnValue({ json });
  new HttpExceptionFilter().catch(e, { switchToHttp: () => ({ getResponse: () => ({ status }), getRequest: () => ({ method: 'POST', url: '/v3/admin/vendor-sites' }) }) } as unknown as ArgumentsHost);
  return { status: status.mock.calls[0][0] as number, body: json.mock.calls[0][0] as Record<string, unknown> };
};

describe('B5.2 the filter lets duplicate details through (public facts only)', () => {
  it('409 DUPLICATE_POSSIBLE keeps code, claim and candidates, and cuts every candidate to six public facts', () => {
    const { status, body } = run(new ConflictException(duplicateError('DUPLICATE_POSSIBLE', 'Looks like yours', {
      candidates: [{ slug: 's', name: 'N', category: 'c', city: 'Chennai', area: 'T Nagar', claimable: true, businessId: 'b-secret', phoneE164: '+91999', costPaise: 5 }],
      claim: { businessSlug: 's', startPath: '/v3/claim/start' }, matches: [{ vendorId: 'v-secret' }],
    })));
    expect(status).toBe(409); expect(body.code).toBe('DUPLICATE_POSSIBLE');
    expect(body.claim).toEqual({ businessSlug: 's', startPath: '/v3/claim/start' });
    expect(body.candidates).toEqual([{ slug: 's', name: 'N', category: 'c', city: 'Chennai', area: 'T Nagar', claimable: true }]);
    const t = JSON.stringify(body); for (const s of ['b-secret', '+91999', 'costPaise', 'v-secret']) expect(t).not.toContain(s);
  });
  it('a claim of null stays null (nothing to claim)', () => { expect(run(new ConflictException(duplicateError('DUPLICATE_BUSINESS', 'Exists', { claim: null }))).body).toMatchObject({ code: 'DUPLICATE_BUSINESS', claim: null }); });
  it('the 403 and 400 override refusals keep their code', () => {
    expect(run(new ForbiddenException(duplicateError('DUPLICATE_OVERRIDE_FORBIDDEN', 'Not allowed'))).body).toMatchObject({ statusCode: 403, code: 'DUPLICATE_OVERRIDE_FORBIDDEN' });
    expect(run(new BadRequestException(duplicateError('DUPLICATE_OVERRIDE_REASON_REQUIRED', 'Reason'))).body).toMatchObject({ statusCode: 400, code: 'DUPLICATE_OVERRIDE_REASON_REQUIRED' });
  });
  it('an unknown code still drops candidates', () => { expect(run(new ConflictException({ message: 'x', code: 'SOMETHING_ELSE', candidates: [{ slug: 's', name: 'N' }] })).body.candidates).toBeUndefined(); });
});

describe('B5.3 the address of a staff-made business', () => {
  it('siteAddress: full address, line + full, built from parts, or nothing', () => {
    expect(siteAddress({ address: '12 Bypass Road, Madurai 625010' } as never)).toBe('12 Bypass Road, Madurai 625010');
    expect(siteAddress({ address: 'Madurai 625010', addressLine: '12 Bypass Road' } as never)).toBe('12 Bypass Road, Madurai 625010');
    expect(siteAddress({ address: '12 Bypass Road, Madurai', addressLine: '12 bypass road' } as never)).toBe('12 Bypass Road, Madurai');
    expect(siteAddress({ addressLine: '12 Bypass Road', area: 'Anna Nagar', city: 'Madurai', pincode: '625010' } as never)).toBe('12 Bypass Road, Anna Nagar, Madurai, 625010');
    expect(siteAddress({ city: 'Madurai' } as never)).toBeNull();
  });
  it('create stores it on the site record BEFORE the site is made, and stores nothing when none was given', async () => {
    const calls: string[] = []; const upsert = jest.fn(async () => { calls.push('address'); });
    const svc = new AdminVendorSiteService({ create: async () => ({ id: 'v1' }) } as never, { createMySite: async () => { calls.push('site'); return { url: 'https://x' }; } } as never, { resolveSubdomain: async (s: string) => s } as never,
      { vendor: { update: async () => undefined }, vendorCMS: { upsert } } as never, { listableCategories: async () => ({ items: [{ key: 'plumber' }] }) } as never, { run: async (_s: string, f: () => Promise<unknown>) => f() } as never);
    const dto = { category: 'plumber', businessName: 'B', ownerName: 'O', phone: '+919876543210', email: 'a@b.invalid', city: 'Madurai', subdomain: 'b' };
    await svc.create({ ...dto, address: '12 Bypass Road, Madurai' }, { id: 's', role: 'ADMIN' });
    expect(upsert).toHaveBeenCalledWith({ where: { vendorId: 'v1' }, create: { vendorId: 'v1', address: '12 Bypass Road, Madurai' }, update: { address: '12 Bypass Road, Madurai' } });
    expect(calls).toEqual(['address', 'site']);
    upsert.mockClear(); await svc.create(dto, { id: 's', role: 'ADMIN' }); expect(upsert).not.toHaveBeenCalled();
  });
});

const prismaWith = (v: Record<string, unknown> | null) => ({ vendor: { findUnique: jest.fn(async () => v) } });
const FAILED = { status: 'ACTIVE', subdomain: 'murugan', siteProvisionStatus: 'FAILED', siteProvisionCode: 'SITE_BUILD_FAILED', siteProvisionFailedAt: new Date('2026-11-18T10:00:00Z'), cms: { address: '12 Bypass Road' } };

describe('B5.4 the admin site read', () => {
  it('sends status, subdomain, site address and the three provision fields with the site answer', async () => {
    const c = new SitesAdminController({} as never, { status: async () => ({ settings: {}, missing: [] }) } as never, {} as never, {} as never, {} as never, new SiteProvisionFacts(prismaWith(FAILED) as never));
    expect(await c.status('v1')).toMatchObject({ missing: [], status: 'ACTIVE', subdomain: 'murugan', address: '12 Bypass Road', siteProvisionStatus: 'FAILED', siteProvisionCode: 'SITE_BUILD_FAILED', siteProvisionFailedAt: '2026-11-18T10:00:00.000Z' });
  });
  it('a vendor with no failure and no address answers nulls, not missing keys', async () => {
    const f = await new SiteProvisionFacts(prismaWith({ status: 'ACTIVE', subdomain: null, siteProvisionStatus: null, siteProvisionCode: null, siteProvisionFailedAt: null, cms: null }) as never).forAdmin('v1');
    expect(f).toEqual({ status: 'ACTIVE', subdomain: null, address: null, siteProvisionStatus: null, siteProvisionCode: null, siteProvisionFailedAt: null });
  });
});

describe('B5.5 the vendor reads: failure code to the owner only', () => {
  const me = () => new MeSiteController({ status: async () => ({ settings: {} }) } as never, {} as never, {} as never, {} as never, {} as never, new SiteProvisionFacts(prismaWith(FAILED) as never));
  const t = { vendorId: 'v1' } as never;
  it('GET /v3/me/site: the owner gets the status and the code (no timestamp, no address)', async () => {
    const r = await me().status(t, { sub: 'o', kind: 'vendor' } as never);
    expect(r).toMatchObject({ siteProvisionStatus: 'FAILED', siteProvisionCode: 'SITE_BUILD_FAILED' }); expect(r).not.toHaveProperty('siteProvisionFailedAt');
  });
  it('GET /v3/me/site: a team member gets neither', async () => {
    const r = await me().status(t, { sub: 'm', kind: 'team_member' } as never);
    expect(r).not.toHaveProperty('siteProvisionStatus'); expect(r).not.toHaveProperty('siteProvisionCode');
  });
  const shell = (p: unknown) => new AppShellService({ navigation: async () => ({ tabs: [], pack: null, flags: {}, mode: 'x', level: null, tier: null, planState: null, paused: false }), myAddons: async () => [] } as never, undefined, undefined, p as never);
  it('the app shell: owner gets both, a team member gets neither key and the database is not even asked', async () => {
    const p = prismaWith({ siteProvisionStatus: 'FAILED', siteProvisionCode: 'SITE_BUILD_FAILED' });
    expect(await shell(p).get('v1', { kind: 'vendor' })).toMatchObject({ siteProvisionStatus: 'FAILED', siteProvisionCode: 'SITE_BUILD_FAILED' });
    p.vendor.findUnique.mockClear();
    const team = await shell(p).get('v1', { kind: 'team_member', modules: ['website'] }); expect(team).not.toHaveProperty('siteProvisionStatus'); expect(team).not.toHaveProperty('siteProvisionCode');
    expect(p.vendor.findUnique).not.toHaveBeenCalled();
  });
});
