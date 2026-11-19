import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../src/auth/auth.service';
import { termsWorld } from './support/terms-world';
import { withCats } from './support/listed-industries';

/** The sign-in response carries termsAcceptanceRequired for a vendor session (slice 5.15). Staff sessions and a build without the terms module are unchanged. */
describe('terms flag in the session', () => {
  const jwt = new JwtService({ secret: 'unit-test-secret' });
  let hash: string;
  beforeAll(async () => { hash = await AuthService.hashPassword('Correct-horse-1'); });
  const vendor = { id: 'va', name: 'Asha', email: 'a@x.invalid', password: '', role: 'VENDOR', status: 'ACTIVE', businessName: 'Shop A', industry: 'retail', subdomain: 'shop-a', isSandbox: false };
  const prismaFor = (v: typeof vendor) => ({
    vendor: { findUnique: async ({ where }: { where: { email?: string; id?: string } }) => (where.email === v.email || where.id === v.id ? { ...v, password: hash } : null) },
    adminTeamMember: { findUnique: async () => null }, teamMember: { findFirst: async () => null },
  });
  const login = (svc: AuthService) => svc.login({ email: vendor.email, password: 'Correct-horse-1' } as never);

  it('false before anything is published, true while a published version waits, false again after acceptance, true for the next version', async () => {
    const w = await termsWorld();
    const svc = new AuthService(withCats(prismaFor(vendor)) as never, jwt, {} as never, undefined, w.svc);
    expect((await login(svc)).user.termsAcceptanceRequired).toBe(false);
    await w.publishRequired(); expect((await login(svc)).user.termsAcceptanceRequired).toBe(true); expect((await svc.me('va')).termsAcceptanceRequired).toBe(true);
    await w.acceptAll('va'); expect((await login(svc)).user.termsAcceptanceRequired).toBe(false);
    const v2 = await w.svc.createDraft('ACCEPTABLE_USE', { bodyMarkdown: 'A changed acceptable use policy for the platform.' }, { type: 'STAFF', id: 's', ip: null }); await w.svc.publish(v2.id, 'Changed the policy', { type: 'STAFF', id: 's', ip: null });
    expect((await login(svc)).user.termsAcceptanceRequired).toBe(true);
  });
  it('a staff session never carries the flag, and a build without the terms module is unchanged', async () => {
    const w = await termsWorld(); await w.publishRequired();
    const staff = { ...vendor, role: 'ADMIN' };
    expect((await login(new AuthService(withCats(prismaFor(staff)) as never, jwt, {} as never, undefined, w.svc))).user).not.toHaveProperty('termsAcceptanceRequired');
    const plain = await login(new AuthService(withCats(prismaFor(vendor)) as never, jwt, {} as never)); expect(plain.user).not.toHaveProperty('termsAcceptanceRequired');
    expect(await new AuthService(withCats(prismaFor(vendor)) as never, jwt, {} as never).me('va')).not.toHaveProperty('termsAcceptanceRequired');
  });
  it('a failure of the flag never blocks a sign-in', async () => {
    const broken = { acceptanceRequired: async () => { throw new Error('db down'); } };
    const r = await login(new AuthService(withCats(prismaFor(vendor)) as never, jwt, {} as never, undefined, broken as never));
    expect(r.accessToken).toBeTruthy(); expect(r.user).not.toHaveProperty('termsAcceptanceRequired');
  });
});

describe('the first registration answer carries the terms flag (Dispatch G1 B5, journeys 1 and 2)', () => {
  const jwt = new JwtService({ secret: 'unit-test-secret' });
  const dto = { name: 'Asha', email: 'new@x.invalid', password: 'Correct-horse-1', businessName: 'Shop New', industry: 'retail', track: 'ecommerce' };
  const make = (flag?: { acceptanceRequired: (id: string) => Promise<boolean> }) => {
    const vendors: Array<Record<string, unknown>> = [];
    const prisma = { vendor: { findUnique: async ({ where }: { where: { email?: string; id?: string; subdomain?: string } }) => vendors.find((v) => v.email === where.email || v.id === where.id || v.subdomain === where.subdomain) ?? null }, adminTeamMember: { findUnique: async () => null }, teamMember: { findFirst: async () => null }, vendorAddon: { upsert: async () => ({}) } };
    const vendorsService = { create: async (d: Record<string, unknown>) => { const v = { id: 'vnew', role: 'VENDOR', status: 'ACTIVE', isSandbox: false, ...d }; vendors.push(v); return v; } };
    return new AuthService(withCats(prisma) as never, jwt, vendorsService as never, undefined, flag as never);
  };
  it('says true while a published version waits, false when none does; the flag is a boolean, never a guess', async () => {
    const w = await termsWorld();
    expect((await make(w.svc).register(dto as never)).user.termsAcceptanceRequired).toBe(false);
    await w.publishRequired();
    expect((await make(w.svc).register({ ...dto, email: 'second@x.invalid' } as never)).user.termsAcceptanceRequired).toBe(true);
  });
  it('is left out (not false) when the terms module is absent or its check fails; registering still works', async () => {
    expect((await make().register(dto as never)).user).not.toHaveProperty('termsAcceptanceRequired');
    const broken = { acceptanceRequired: async () => { throw new Error('db down'); } };
    const r = await make(broken).register({ ...dto, email: 'third@x.invalid' } as never);
    expect(r.accessToken).toBeTruthy(); expect(r.user).not.toHaveProperty('termsAcceptanceRequired');
  });
});
