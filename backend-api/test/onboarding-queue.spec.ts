import { OnboardingQueueService } from '../src/v3-website/onboarding/onboarding-queue.service';

/** Slice 5.13b: the onboarding queue is a read model over tables that already exist (seeded sites, claim links, new vendors); nothing is copied or duplicated. Over a small fake of those tables. */
const NOW = new Date('2026-11-11T10:00:00Z');
interface V { id: string; businessName: string; createdAt: Date; status: string }
function fake(o: { vendors: V[]; seeded?: Array<{ vendorId: string; lifecycle: string; removedAt: Date | null; createdAt: Date }>; claims?: Array<{ vendorId: string; status: string; purpose: string; expiresAt: Date; createdAt: Date }>; published?: string[] }) {
  const byId = new Map(o.vendors.map((v) => [v.id, v]));
  const prisma = {
    v3SeededSite: { findMany: async ({ where }: { where: { lifecycle?: { in: string[] }; removedAt?: null; vendorId?: { in: string[] } } }) => (o.seeded ?? []).filter((s) => (!where.lifecycle || where.lifecycle.in.includes(s.lifecycle)) && (where.removedAt === undefined || s.removedAt === null) && (!where.vendorId || where.vendorId.in.includes(s.vendorId))).map((s) => ({ ...s, vendor: { businessName: byId.get(s.vendorId)?.businessName ?? '' } })) },
    v3ClaimToken: { findMany: async ({ where }: { where: { status: string; purpose: string; expiresAt: { gt: Date } } }) => (o.claims ?? []).filter((c) => c.status === where.status && c.purpose === where.purpose && c.expiresAt > where.expiresAt.gt).map((c) => ({ ...c, vendor: { businessName: byId.get(c.vendorId)?.businessName ?? '' } })) },
    vendor: { findMany: async () => o.vendors.filter((v) => !(o.published ?? []).includes(v.id)).map((v) => ({ id: v.id, businessName: v.businessName, createdAt: v.createdAt, status: v.status })) },
  };
  return new OnboardingQueueService(prisma as never);
}
const d = (iso: string) => new Date(iso);
const vendors: V[] = [{ id: 'v1', businessName: 'Seeded Plumbing', createdAt: d('2026-10-01T00:00:00Z'), status: 'PENDING' }, { id: 'v2', businessName: 'Claim Dental', createdAt: d('2026-10-02T00:00:00Z'), status: 'PENDING' }, { id: 'v3', businessName: 'New Salon', createdAt: d('2026-10-03T00:00:00Z'), status: 'PENDING' }, { id: 'v4', businessName: 'Live Studio', createdAt: d('2026-10-04T00:00:00Z'), status: 'ACTIVE' }];

describe('the onboarding queue', () => {
  const q = () => fake({
    vendors, published: ['v4'],
    seeded: [{ vendorId: 'v1', lifecycle: 'SEEDED', removedAt: null, createdAt: d('2026-10-05T00:00:00Z') }, { vendorId: 'v4', lifecycle: 'PRO', removedAt: null, createdAt: d('2026-10-06T00:00:00Z') }],
    claims: [{ vendorId: 'v2', status: 'ACTIVE', purpose: 'CLAIM', expiresAt: d('2026-12-01T00:00:00Z'), createdAt: d('2026-10-07T00:00:00Z') }, { vendorId: 'v3', status: 'ACTIVE', purpose: 'CLAIM', expiresAt: d('2026-10-30T00:00:00Z'), createdAt: d('2026-10-08T00:00:00Z') }],
  });
  it('lists seeded sites that are not yet claimed, claim links still waiting, and new vendors with nothing published, oldest first', async () => {
    const r = await q().list({ page: 1, pageSize: 20 }, NOW);
    expect(r.items.map((i) => `${i.vendorId}:${i.kind}`)).toEqual(['v3:NEW_VENDOR', 'v1:SEEDED', 'v2:CLAIM']); expect(r.counts).toEqual({ SEEDED: 1, CLAIM: 1, NEW_VENDOR: 1 }); expect(r.total).toBe(3);
  });
  it('leaves out a claimed or paying seeded site, an expired claim link and a vendor whose site is live', async () => {
    const ids = (await q().list({ page: 1, pageSize: 20 }, NOW)).items.map((i) => i.vendorId); expect(ids).not.toContain('v4');
    expect((await q().list({ page: 1, pageSize: 20, kind: 'CLAIM' }, NOW)).items.map((i) => i.vendorId)).toEqual(['v2']);
  });
  it('a vendor that is seeded AND has a claim link waiting is shown once, as the claim', async () => {
    const both = fake({ vendors, seeded: [{ vendorId: 'v2', lifecycle: 'INVITED', removedAt: null, createdAt: d('2026-10-05T00:00:00Z') }], claims: [{ vendorId: 'v2', status: 'ACTIVE', purpose: 'CLAIM', expiresAt: d('2026-12-01T00:00:00Z'), createdAt: d('2026-10-07T00:00:00Z') }], published: ['v1', 'v3', 'v4'] });
    expect((await both.list({ page: 1, pageSize: 20 }, NOW)).items.map((i) => `${i.vendorId}:${i.kind}`)).toEqual(['v2:CLAIM']);
  });
  it('a removed seeded business is never listed', async () => {
    const r = fake({ vendors, seeded: [{ vendorId: 'v1', lifecycle: 'SEEDED', removedAt: d('2026-10-20T00:00:00Z'), createdAt: d('2026-10-05T00:00:00Z') }], published: ['v2', 'v3', 'v4'] });
    expect((await r.list({ page: 1, pageSize: 20 }, NOW)).items.map((i) => i.kind)).not.toContain('SEEDED');
  });
  it('pages, and an item carries what the screen needs and no contact details', async () => {
    const r = await q().list({ page: 2, pageSize: 2 }, NOW); expect(r).toMatchObject({ page: 2, pageSize: 2, total: 3 }); expect(r.items).toHaveLength(1);
    const first = (await q().list({ page: 1, pageSize: 20 }, NOW)).items[0]; expect(Object.keys(first).sort()).toEqual(['businessName', 'detail', 'kind', 'since', 'state', 'vendorId']);
  });
});
