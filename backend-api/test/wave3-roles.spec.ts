import { ExecutionContext, ForbiddenException, HttpException } from '@nestjs/common';
import { AdminGuard } from '../src/auth/guards/admin.guard';
import { ADMIN_ROLE_MATRIX, effectiveRolesFor, effectiveStaffRole, staffLabelOf } from '../src/auth/guards/admin-role-matrix';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { AuthenticatedUser } from '../src/common/decorators/current-user.decorator';
import { checkPartnerInput, isPartnerPath, partnerMayReach, phoneDigits } from '../src/v3-partners/core/partner-core';
import { PartnerGuard } from '../src/v3-partners/partner.guard';
import { PartnerScopeGuard } from '../src/v3-partners/partner-scope.guard';
import { PartnersService } from '../src/v3-partners/partners.service';
import { PartnerRow, PartnersStore, StaffMemberRef } from '../src/v3-partners/partners.store';

/** Wave 3 Part A: the two labels hold exactly SALES rights; a referral partner reaches /v3/partner/* and nothing else. */

const ctx = (user: AuthenticatedUser | undefined, method: string, route: string, path = route): ExecutionContext =>
  ({ switchToHttp: () => ({ getRequest: () => ({ user, method, route: { path: route }, path }) }) }) as unknown as ExecutionContext;
const staff = (role: string): AuthenticatedUser => ({ sub: 's', email: 's@x.invalid', role: 'ADMIN', kind: 'admin_member', adminRole: effectiveStaffRole(role) });
const allowed = (u: AuthenticatedUser | undefined, key: string): boolean => {
  const [m, ...rest] = key.split(' ');
  try { return new AdminGuard().canActivate(ctx(u, m, rest.join(' '))); } catch (e) { if (e instanceof ForbiddenException) return false; throw e; }
};

/** A JwtStrategy over a fake database that holds one admin-team member. */
function strategyFor(member: { id: string; email: string; role: string; status: string; passwordChangedAt: Date | null } | null): JwtStrategy {
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-created-inside-the-test';
  const prisma = { adminTeamMember: { findUnique: async () => member } };
  return new JwtStrategy(prisma as never);
}
const memberRow = (role: string) => ({ id: 'm1', email: 'm@x.invalid', role, status: 'active', passwordChangedAt: null });

describe('staff labels are SALES', () => {
  it('folds FIELD_EXECUTIVE and TELECALLER into the MARKETING value and leaves every other role alone', () => {
    expect(effectiveStaffRole('FIELD_EXECUTIVE')).toBe('MARKETING');
    expect(effectiveStaffRole('TELECALLER')).toBe('MARKETING');
    for (const r of ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'SUPPORT', 'MARKETING']) expect(effectiveStaffRole(r)).toBe(r);
    expect(effectiveStaffRole(undefined)).toBeUndefined();
    expect(staffLabelOf('TELECALLER')).toBe('TELECALLER');
    expect(staffLabelOf('MARKETING')).toBeUndefined();
  });

  it('the principal of a label carries adminRole MARKETING and the label beside it', async () => {
    for (const label of ['FIELD_EXECUTIVE', 'TELECALLER']) {
      const u = await strategyFor(memberRow(label)).validate({ sub: 'm1', email: 'm@x.invalid', role: 'ADMIN', kind: 'admin_member' });
      expect(u.adminRole).toBe('MARKETING');
      expect(u.staffLabel).toBe(label);
      expect(u.role).toBe('ADMIN');
    }
    const plain = await strategyFor(memberRow('MARKETING')).validate({ sub: 'm1', email: 'm@x.invalid', role: 'ADMIN', kind: 'admin_member' });
    expect(plain.staffLabel).toBeUndefined();
  });

  it('a label gets the SAME answer as SALES on EVERY admin route in the matrix (no extra right, no lost right)', async () => {
    const sales = staff('MARKETING');
    for (const label of ['FIELD_EXECUTIVE', 'TELECALLER']) {
      const u = await strategyFor(memberRow(label)).validate({ sub: 'm1', email: 'm@x.invalid', role: 'ADMIN', kind: 'admin_member' });
      const differs = Object.keys(ADMIN_ROLE_MATRIX).filter((k) => allowed(u, k) !== allowed(sales, k));
      expect(differs).toEqual([]);
    }
  });

  it('a label cannot do what SALES cannot: money, price book, firm profile, partners', async () => {
    const u = await strategyFor(memberRow('TELECALLER')).validate({ sub: 'm1', email: 'm@x.invalid', role: 'ADMIN', kind: 'admin_member' });
    for (const k of ['POST /v3/admin/billing/orders/:id/mark-paid', 'POST /v3/admin/plans/:id/prices', 'PUT /v3/admin/firm-profile', 'POST /v3/admin/partners', 'PUT /v3/admin/partners/:id', 'GET /v3/admin/partners', 'POST /v3/admin/vendors/:id/subscription']) expect(allowed(u, k)).toBe(false);
  });
});

describe('referral partner principal', () => {
  it('has the PARTNER role and the referral_partner kind, with no staff role', async () => {
    const u = await strategyFor(memberRow('REFERRAL_PARTNER')).validate({ sub: 'm1', email: 'm@x.invalid', role: 'PARTNER', kind: 'referral_partner' });
    expect(u).toEqual({ sub: 'm1', email: 'm@x.invalid', role: 'PARTNER', kind: 'referral_partner' });
  });

  it('an AdminGuard route refuses a partner on EVERY route in the matrix', async () => {
    const u = await strategyFor(memberRow('REFERRAL_PARTNER')).validate({ sub: 'm1', email: 'm@x.invalid', role: 'PARTNER', kind: 'referral_partner' });
    expect(Object.keys(ADMIN_ROLE_MATRIX).filter((k) => allowed(u, k))).toEqual([]);
  });

  it('PartnerScopeGuard confines a partner to /v3/partner/* and the two token routes', () => {
    const partner: AuthenticatedUser = { sub: 'm1', email: 'm@x.invalid', role: 'PARTNER', kind: 'referral_partner' };
    const g = new PartnerScopeGuard();
    for (const p of ['/v3/partner/me', '/v3/partner/commission', '/auth/me', '/auth/refresh', '/v3/partner/me/']) expect(g.canActivate(ctx(partner, 'GET', p))).toBe(true);
    for (const p of ['/v3/me/billing/orders', '/vendors', '/v3/admin/partners', '/team/members', '/v3/public/pricing', '/v3/partnerx/me', '/v3/me/wallet', '/leads', '/auth/login']) {
      let code = '';
      try { g.canActivate(ctx(partner, 'GET', p)); } catch (e) { code = ((e as HttpException).getResponse() as { code?: string }).code ?? ''; expect((e as HttpException).getStatus()).toBe(403); }
      expect(code).toBe('PARTNER_SCOPE_REFUSED');
    }
  });

  it('PartnerScopeGuard does not touch anyone else (vendor, staff, anonymous)', () => {
    const g = new PartnerScopeGuard();
    expect(g.canActivate(ctx({ sub: 'v', email: 'v@x.invalid', role: 'VENDOR' }, 'GET', '/v3/me/billing/orders'))).toBe(true);
    expect(g.canActivate(ctx(staff('SUPER_ADMIN'), 'GET', '/v3/admin/partners'))).toBe(true);
    expect(g.canActivate(ctx(undefined, 'GET', '/v3/public/pricing'))).toBe(true);
  });

  it('PartnerGuard lets only a referral partner into the partner routes', () => {
    const g = new PartnerGuard();
    expect(g.canActivate(ctx({ sub: 'm', email: 'm@x.invalid', role: 'PARTNER', kind: 'referral_partner' }, 'GET', '/v3/partner/me'))).toBe(true);
    for (const u of [undefined, { sub: 'v', email: 'v@x.invalid', role: 'VENDOR' }, { sub: 'v', email: 'v@x.invalid', role: 'VENDOR', kind: 'team_member' }, staff('SUPER_ADMIN'), staff('MARKETING'), { sub: 'x', email: 'x@x.invalid', role: 'PARTNER' }] as Array<AuthenticatedUser | undefined>) {
      expect(() => g.canActivate(ctx(u, 'GET', '/v3/partner/me'))).toThrow(HttpException);
    }
  });

  it('path helpers: only the /v3/partner prefix counts (no look-alike prefix)', () => {
    expect(isPartnerPath('/v3/partner')).toBe(true);
    expect(isPartnerPath('/v3/partner/link?x=1')).toBe(true);
    expect(isPartnerPath('/v3/partners')).toBe(false);
    expect(isPartnerPath('/v3/partner-admin/x')).toBe(false);
    expect(partnerMayReach('/auth/me')).toBe(true);
    expect(partnerMayReach('/auth/logout')).toBe(false);
  });
});

describe('role matrix for the partner admin routes', () => {
  const READS = ['GET /v3/admin/partners', 'GET /v3/admin/partners/:id'];
  const WRITES = ['POST /v3/admin/partners', 'PUT /v3/admin/partners/:id'];
  it('reads: OPERATIONS, ADMIN, SUPER_ADMIN; writes: ADMIN and SUPER_ADMIN; SALES and SUPPORT refused on all', () => {
    for (const k of READS) expect([...effectiveRolesFor(k)].sort()).toEqual(['ADMIN', 'OPERATIONS', 'SUPER_ADMIN']);
    for (const k of WRITES) expect([...effectiveRolesFor(k)].sort()).toEqual(['ADMIN', 'SUPER_ADMIN']);
    for (const k of [...READS, ...WRITES]) { expect(allowed(staff('MARKETING'), k)).toBe(false); expect(allowed(staff('SUPPORT'), k)).toBe(false); }
    for (const k of WRITES) expect(allowed(staff('OPERATIONS'), k)).toBe(false);
  });
});

describe('partner input checks', () => {
  it('a create needs type, name and email; every problem is named', () => {
    const r = checkPartnerInput({}, 'create');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.problems).sort()).toEqual(['email', 'name', 'type']);
  });
  it('cleans a good create and keeps only what was sent on an edit', () => {
    const c = checkPartnerInput({ type: 'FREELANCER', name: '  Asha   K ', email: ' Asha@Example.COM ', phone: '+91 98765 43210' }, 'create');
    expect(c).toEqual({ ok: true, value: { type: 'FREELANCER', name: 'Asha K', email: 'asha@example.com', phone: '+91 98765 43210' } });
    expect(checkPartnerInput({ status: 'DISABLED' }, 'edit')).toEqual({ ok: true, value: { status: 'DISABLED' } });
  });
  it('refuses a bad type, status, email, phone and staff link', () => {
    const r = checkPartnerInput({ type: 'AGENT', status: 'GONE', email: 'nope', phone: 'abc', staffUserId: '!' }, 'edit');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.problems).sort()).toEqual(['email', 'phone', 'staffUserId', 'status', 'type']);
  });
  it('phoneDigits drops the country prefix and punctuation so two forms of one number match', () => {
    expect(phoneDigits('+91 98765-43210')).toBe('9876543210');
    expect(phoneDigits('09876543210')).toBe('9876543210');
    expect(phoneDigits('9876543210')).toBe('9876543210');
    expect(phoneDigits(null)).toBe('');
  });
});

class MemoryPartners extends PartnersStore {
  rows: PartnerRow[] = []; staffRows = new Map<string, StaffMemberRef>(); n = 0;
  async list(i: { status?: string; type?: string; skip: number; take: number }) { const all = this.rows.filter((r) => (!i.status || r.status === i.status) && (!i.type || r.type === i.type)); return { items: all.slice(i.skip, i.skip + i.take), total: all.length }; }
  async get(id: string) { return this.rows.find((r) => r.id === id) ?? null; }
  async getByStaffUser(s: string) { return this.rows.find((r) => r.staffUserId === s) ?? null; }
  async getByEmail(e: string) { return this.rows.find((r) => r.email === e) ?? null; }
  async create(f: Parameters<PartnersStore['create']>[0], by: string | null) { const r: PartnerRow = { ...f, id: `p${++this.n}`, createdById: by, createdAt: new Date(), updatedAt: new Date() }; this.rows.push(r); return r; }
  async update(id: string, patch: Parameters<PartnersStore['update']>[1]) { const r = this.rows.find((x) => x.id === id); if (!r) return null; Object.assign(r, patch); return r; }
  async staffMember(id: string) { return this.staffRows.get(id) ?? null; }
}

describe('PartnersService', () => {
  const actor = { id: 'admin1' };
  const code = (e: unknown): string => ((e as HttpException).getResponse() as { code?: string }).code ?? '';
  const make = () => { const store = new MemoryPartners(); return { store, svc: new PartnersService(store) }; };

  it('creates, refuses a repeated email, and edits', async () => {
    const { svc } = make();
    const p = await svc.create({ type: 'SALES_TEAM', name: 'Chennai team', email: 'team@x.invalid' }, actor);
    expect(p).toMatchObject({ type: 'SALES_TEAM', status: 'ACTIVE', staffUserId: null });
    await expect(svc.create({ type: 'FREELANCER', name: 'Dup', email: 'TEAM@x.invalid' }, actor)).rejects.toMatchObject({ response: { code: 'PARTNER_EMAIL_TAKEN' } });
    const edited = await svc.update(p.id, { status: 'DISABLED' }, actor);
    expect(edited.status).toBe('DISABLED');
    await expect(svc.update('nope', { status: 'ACTIVE' }, actor)).rejects.toMatchObject({ response: { code: 'PARTNER_NOT_FOUND' } });
  });

  it('links only an existing, non-removed REFERRAL_PARTNER login, once', async () => {
    const { svc, store } = make();
    const a = await svc.create({ type: 'FREELANCER', name: 'A', email: 'a@x.invalid' }, actor);
    const b = await svc.create({ type: 'FREELANCER', name: 'B', email: 'b@x.invalid' }, actor);
    store.staffRows.set('login-partner-1', { id: 'login-partner-1', role: 'REFERRAL_PARTNER', email: 'a@x.invalid', status: 'active' });
    store.staffRows.set('login-sales-1', { id: 'login-sales-1', role: 'MARKETING', email: 's@x.invalid', status: 'active' });
    store.staffRows.set('login-gone-1', { id: 'login-gone-1', role: 'REFERRAL_PARTNER', email: 'g@x.invalid', status: 'removed' });
    for (const bad of ['login-sales-1', 'login-gone-1', 'login-missing-1']) {
      let c = ''; try { await svc.update(a.id, { staffUserId: bad }, actor); } catch (e) { c = code(e); }
      expect(c).toBe('PARTNER_STAFF_LINK_INVALID');
    }
    await svc.update(a.id, { staffUserId: 'login-partner-1' }, actor);
    await expect(svc.update(b.id, { staffUserId: 'login-partner-1' }, actor)).rejects.toMatchObject({ response: { code: 'PARTNER_STAFF_LINK_INVALID' } });
    expect((await svc.forLogin('login-partner-1'))?.id).toBe(a.id);
    await svc.update(a.id, { status: 'DISABLED' }, actor);
    expect(await svc.forLogin('login-partner-1')).toBeNull();
  });

  it('names every bad field in one PARTNER_INVALID answer', async () => {
    const { svc } = make();
    await expect(svc.create({ type: 'X', name: '', email: 'bad' }, actor)).rejects.toMatchObject({ response: { code: 'PARTNER_INVALID', details: { fields: { type: expect.any(String), name: expect.any(String), email: expect.any(String) } } } });
  });
});
