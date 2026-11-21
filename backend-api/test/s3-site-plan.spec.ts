import { NotFoundException } from '@nestjs/common';
import { CmsService } from '../src/cms/cms.service';

/** S3.1 and S3.2: GET /cms/site/:subdomain says plan FREE or PRO, and nothing else about the plan. */
const SECRET = { email: 'owner@secret.test', phone: '9840012345', subId: 'sub-SECRET-1', planId: 'plan-SECRET-1', planKey: 'handyman_free_SECRET', price: 987654 };

function world(o: { plan?: { level: string } | null; sandbox?: boolean; vendor?: boolean } = {}) {
  const reads: string[] = [];
  const prisma = {
    vendor: { findUnique: async () => (o.vendor === false ? null : { id: 'v1', businessName: 'Plumber Boy', industry: 'plumber', subdomain: 'plumberboy', isSandbox: o.sandbox === true, email: SECRET.email, phone: SECRET.phone }) },
    vendorCMS: { findUnique: async () => ({ vendorId: 'v1', siteStatus: 'LIVE', businessName: 'Plumber Boy', tagline: 't', about: 'a', phone: null, email: null, draft: null, extras: null, testimonials: [], themeId: null, packKey: null }) },
    vendorProduct: { findMany: async () => [] },
    vendorAddon: { findUnique: async () => null },
    websiteTheme: { findUnique: async () => null },
    vendorPaymentConfig: { findUnique: async () => null },
    billingTerm: { findFirst: async () => null },
    v3PlanSubscription: { findUnique: async (a: { where: { currentVendorId?: string }; select: unknown }) => { reads.push(JSON.stringify(a)); return o.plan ? { id: SECRET.subId, planId: SECRET.planId, plan: { id: SECRET.planId, key: SECRET.planKey, level: o.plan.level, track: 'HANDYMAN', amountPaise: SECRET.price } } : null; } },
  };
  return { svc: new CmsService(prisma as never), reads };
}

describe('S3.1 the plan on the public site answer', () => {
  it('a Free plan gives plan FREE', async () => { expect((await world({ plan: { level: 'FREE' } }).svc.getSiteBySubdomain('plumberboy')).plan).toBe('FREE'); });
  it('the plan the trial site still uses is the track\'s Free plan (level FREE), so it gives FREE', async () => {
    // there is no separate TRIAL level in the plan table: a registered trial vendor holds <track>_free
    expect((await world({ plan: { level: 'FREE' } }).svc.getSiteBySubdomain('plumberboy')).plan).toBe('FREE');
  });
  it('any other plan (Pro, or an unfamiliar level) gives PRO', async () => {
    expect((await world({ plan: { level: 'PRO' } }).svc.getSiteBySubdomain('plumberboy')).plan).toBe('PRO');
    expect((await world({ plan: { level: 'ENTERPRISE' } }).svc.getSiteBySubdomain('plumberboy')).plan).toBe('PRO');
  });
  it('a vendor with no held plan (a legacy vendor) has no plan field at all', async () => {
    const r = await world({ plan: null }).svc.getSiteBySubdomain('plumberboy');
    expect('plan' in r).toBe(false);
  });
  it('a sandbox vendor is not served, so it never gets a plan field; an unknown one is a 404', async () => {
    await expect(world({ sandbox: true, plan: { level: 'FREE' } }).svc.getSiteBySubdomain('plumberboy')).rejects.toBeInstanceOf(NotFoundException);
    await expect(world({ vendor: false }).svc.getSiteBySubdomain('nobody')).rejects.toBeInstanceOf(NotFoundException);
  });
  it('reads only the CURRENT subscription of this vendor and selects only the plan level', async () => {
    const w = world({ plan: { level: 'FREE' } });
    await w.svc.getSiteBySubdomain('plumberboy');
    expect(w.reads).toHaveLength(1);
    expect(JSON.parse(w.reads[0])).toEqual({ where: { currentVendorId: 'v1' }, select: { plan: { select: { level: true } } } });
  });
});

describe('S3.2 this change adds no e-mail, phone, id, price or plan detail to the route', () => {
  it('the answer has exactly the old keys plus plan, and plan is the bare word', async () => {
    const withPlan = await world({ plan: { level: 'PRO' } }).svc.getSiteBySubdomain('plumberboy');
    const without = await world({ plan: null }).svc.getSiteBySubdomain('plumberboy');
    expect(Object.keys(withPlan).sort()).toEqual([...Object.keys(without), 'plan'].sort());
    expect(typeof withPlan.plan).toBe('string'); expect(['FREE', 'PRO']).toContain(withPlan.plan);
  });
  it('nothing of the owner or of the subscription is in the answer', async () => {
    const text = JSON.stringify(await world({ plan: { level: 'FREE' } }).svc.getSiteBySubdomain('plumberboy'));
    for (const secret of Object.values(SECRET)) expect(text).not.toContain(String(secret));
    expect(text).not.toMatch(/handyman_free|amountPaise|subscription|"track"/i);
    expect(text).not.toContain('@secret.test');
  });
  it('the vendor block still carries only id, name, industry and subdomain (no e-mail or phone was added)', async () => {
    const r = await world({ plan: { level: 'FREE' } }).svc.getSiteBySubdomain('plumberboy');
    expect(Object.keys(r.vendor).sort()).toEqual(['businessName', 'id', 'industry', 'subdomain']);
  });
});
