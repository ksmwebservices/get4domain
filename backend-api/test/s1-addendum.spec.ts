import * as fs from 'fs';
import * as path from 'path';
import { HttpException } from '@nestjs/common';
import { AuthService } from '../src/auth/auth.service';
import { CmsService } from '../src/cms/cms.service';
import { PACK_ERROR_CODES } from '../src/v3-packs/pack.errors';

/** S1.6 GET /cms/site-state/:subdomain and S1.7 POST /auth/register accepts only a listed category. */

describe('S1.6 site state', () => {
  const world = (v: { id: string; isSandbox: boolean } | null, cms: { siteStatus: string } | null) => {
    const calls = { vendor: 0, cms: 0 };
    const prisma = { vendor: { findUnique: async () => { calls.vendor += 1; return v; } }, vendorCMS: { findUnique: async () => { calls.cms += 1; return cms; } } };
    const svc = new CmsService(prisma as never); let t = 1_000_000; svc.stateClock = () => t;
    return { svc, calls, tick: (ms: number) => { t += ms; } };
  };
  it('answers exactly { exists, status }: LIVE, DRAFT, and NOT_FOUND for an unknown name', async () => {
    expect(await world({ id: 'v1', isSandbox: false }, { siteStatus: 'LIVE' }).svc.siteState('plumberboy')).toEqual({ exists: true, status: 'LIVE' });
    expect(await world({ id: 'v1', isSandbox: false }, { siteStatus: 'DRAFT' }).svc.siteState('plumberboy')).toEqual({ exists: true, status: 'DRAFT' });
    expect(await world({ id: 'v1', isSandbox: false }, null).svc.siteState('plumberboy')).toEqual({ exists: true, status: 'LIVE' });   // no CMS row: the public site route serves it
    expect(await world(null, null).svc.siteState('nobody')).toEqual({ exists: false, status: 'NOT_FOUND' });
  });
  it('a sandbox vendor does not exist, and a name that cannot be an address is NOT_FOUND without a read', async () => {
    expect(await world({ id: 'v1', isSandbox: true }, { siteStatus: 'LIVE' }).svc.siteState('demo')).toEqual({ exists: false, status: 'NOT_FOUND' });
    const w = world({ id: 'v1', isSandbox: false }, { siteStatus: 'LIVE' });
    for (const bad of ['', 'A B', '../x', '-a', 'a_b', 'x'.repeat(70)]) expect(await w.svc.siteState(bad)).toEqual({ exists: false, status: 'NOT_FOUND' });
    expect(w.calls.vendor).toBe(0);
  });
  it('carries no name, e-mail, phone or id, whatever the row holds', async () => {
    const prisma = { vendor: { findUnique: async () => ({ id: 'secret-id', isSandbox: false, email: 'o@x.test', phone: '9840012345', businessName: 'Secret Co' }) }, vendorCMS: { findUnique: async () => ({ siteStatus: 'LIVE', phone: '9840012345' }) } };
    const out = await new CmsService(prisma as never).siteState('plumberboy');
    expect(Object.keys(out).sort()).toEqual(['exists', 'status']); expect(JSON.stringify(out)).not.toMatch(/secret|@|984/i);
  });
  it('is kept 30 seconds: a repeat costs no read, and after 30 seconds it reads again', async () => {
    const w = world({ id: 'v1', isSandbox: false }, { siteStatus: 'DRAFT' });
    await w.svc.siteState('plumberboy'); await w.svc.siteState('PlumberBoy'); expect(w.calls.vendor).toBe(1);
    w.tick(29_000); await w.svc.siteState('plumberboy'); expect(w.calls.vendor).toBe(1);
    w.tick(2_000); await w.svc.siteState('plumberboy'); expect(w.calls.vendor).toBe(2);
  });
  it('the route is public, throttled, sends a 30 second Cache-Control and is listed in the route baseline', () => {
    const c = fs.readFileSync(path.resolve(__dirname, '../src/cms/cms.controller.ts'), 'utf8');
    const at = c.indexOf("@Get('site-state/:subdomain')");
    const block = c.slice(c.lastIndexOf('@Public()', at), at + 700);
    expect(block).toContain('@Public()'); expect(block).toContain('@Throttle(RATE.siteRead)'); expect(block).toContain('max-age=30'); expect(block).toContain('@ApiOperation');
    const baseline = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'baselines/route-classification.json'), 'utf8')).routes as Array<{ route: string; cls: string }>;
    expect(baseline.find((r) => r.route === 'GET /cms/site-state/:subdomain')).toMatchObject({ cls: 'public' });
  });
});

describe('S1.7 the public signup accepts only a listed category', () => {
  const listed = new Set(['plumber', 'ac-appliance-repair']);
  const make = () => {
    const created: unknown[] = [];
    const prisma = {
      vendor: { findUnique: async () => null },
      v3PackCategory: { findFirst: async ({ where }: { where: { categoryKey: string; active: boolean } }) => (where.active === true && listed.has(where.categoryKey) ? { categoryKey: where.categoryKey } : null) },
    };
    const vendors = { create: async (d: unknown) => { created.push(d); return { id: 'v1', name: 'A', email: 'a@x.invalid', role: 'VENDOR', businessName: 'Biz', industry: 'plumber', subdomain: 'biz' }; } };
    return { svc: new AuthService(prisma as never, { sign: () => 't' } as never, vendors as never), created };
  };
  const body = (industry: unknown) => ({ name: 'A', email: 'a@x.invalid', password: 'Passw0rdX', businessName: 'Biz', industry });
  const refused = async (industry: unknown) => { const { svc, created } = make(); const e = await svc.register(body(industry) as never).catch((x) => x); return { e, created }; };

  it.each(['Home repair and trades', 'general', 'handyman', 'Plumber', ' plumber'])('unknown text "%s": 400, the plain sentence, a registered code, and no vendor made', async (text) => {
    const { e, created } = await refused(text);
    expect(e).toBeInstanceOf(HttpException); expect((e as HttpException).getStatus()).toBe(400);
    expect((e as HttpException).getResponse()).toMatchObject({ code: 'INDUSTRY_NOT_IN_LIST', message: 'Choose your business category from the list.' });
    expect(created).toHaveLength(0);
  });
  it.each(['', '   ', undefined, null, 42])('an empty or missing value (%p) gets the same refusal', async (v) => {
    const { e, created } = await refused(v);
    expect((e as HttpException).getStatus()).toBe(400); expect((e as HttpException).getResponse()).toMatchObject({ code: 'INDUSTRY_NOT_IN_LIST' }); expect(created).toHaveLength(0);
  });
  it('a known categoryKey registers', async () => {
    const { svc, created } = make();
    const r = await svc.register(body('ac-appliance-repair') as never);
    expect(r.accessToken).toBeDefined(); expect(created).toHaveLength(1);
  });
  it('only an ACTIVE category counts (the same filter as GET /v3/public/pack-categories)', async () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../src/auth/auth.service.ts'), 'utf8');
    expect(src).toMatch(/v3PackCategory\.findFirst\(\{ where: \{ categoryKey: key, active: true \}/);
  });
  it('the code is registered with the exception filter list', () => { expect((PACK_ERROR_CODES as readonly string[]).includes('INDUSTRY_NOT_IN_LIST')).toBe(true); });
  it('the check sits after the replay of an existing account and does not touch the vendor, partner, admin or import services', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../src/auth/auth.service.ts'), 'utf8');
    expect(src.indexOf('this.requireListedIndustry(')).toBeGreaterThan(src.indexOf('prior.businessName === dto.businessName'));
    expect(fs.readFileSync(path.resolve(__dirname, '../src/vendors/vendors.service.ts'), 'utf8')).not.toContain('requireListedIndustry');
  });
});
