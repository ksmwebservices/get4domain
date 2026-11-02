import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AuthenticatedUser } from '../src/common/decorators/current-user.decorator';
import {
  resolveTenant, resolveTenantForStaff, scopeArgs, TenantGuard, TenantScopeError, VENDOR_SCOPED_MODELS,
} from '../src/common/tenant';

const A = 'vendor_A';
const B = 'vendor_B';
const owner: AuthenticatedUser = { sub: A, email: 'a@x.invalid', role: 'VENDOR' };
const member: AuthenticatedUser = { sub: A, email: 'm@x.invalid', role: 'VENDOR', kind: 'team_member', memberId: 'mem_1', modules: [] };
const adminVendorRow: AuthenticatedUser = { sub: 'adm', email: 'adm@x.invalid', role: 'ADMIN', adminRole: 'SUPER_ADMIN' };
const staffMember: AuthenticatedUser = { sub: 'staff_1', email: 's@x.invalid', role: 'ADMIN', kind: 'admin_member', adminRole: 'MARKETING' };

describe('resolveTenant', () => {
  it('maps an owner to their own vendor', () => {
    expect(resolveTenant(owner)).toEqual({ vendorId: A, actor: 'owner', memberId: undefined });
  });
  it('maps a team member to the PARENT vendor and records the member id', () => {
    expect(resolveTenant(member)).toEqual({ vendorId: A, actor: 'team_member', memberId: 'mem_1' });
  });
  it('maps a sandbox demo vendor', () => {
    expect(resolveTenant({ ...owner, kind: 'sandbox' }).actor).toBe('sandbox');
  });
  it.each([[undefined], [null], [{ ...owner, sub: '' }]])('rejects a missing principal with 401 (%#)', (u) => {
    expect(() => resolveTenant(u as unknown as AuthenticatedUser)).toThrow(UnauthorizedException);
  });
  it.each([[adminVendorRow], [staffMember]])('refuses staff with 403 (they must name a vendor) (%#)', (u) => {
    expect(() => resolveTenant(u)).toThrow(ForbiddenException);
  });
  it('refuses an unknown role', () => {
    expect(() => resolveTenant({ ...owner, role: 'SOMETHING' })).toThrow(ForbiddenException);
  });
});

describe('resolveTenantForStaff', () => {
  it('lets staff act on an explicitly named vendor', () => {
    expect(resolveTenantForStaff(staffMember, B)).toEqual({ vendorId: B, actor: 'staff', memberId: 'staff_1' });
  });
  it('refuses a vendor principal, an unnamed vendor, and no principal', () => {
    expect(() => resolveTenantForStaff(owner, B)).toThrow(ForbiddenException);
    expect(() => resolveTenantForStaff(staffMember, '')).toThrow(ForbiddenException);
    expect(() => resolveTenantForStaff(undefined, B)).toThrow(UnauthorizedException);
  });
});

describe('TenantGuard', () => {
  const ctx = (user?: AuthenticatedUser) => {
    const req: Record<string, unknown> = { user };
    return { req, context: { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext };
  };
  it('attaches the tenant for a vendor', () => {
    const { req, context } = ctx(owner);
    expect(new TenantGuard().canActivate(context)).toBe(true);
    expect(req.tenant).toMatchObject({ vendorId: A });
  });
  it('rejects staff and anonymous callers', () => {
    expect(() => new TenantGuard().canActivate(ctx(staffMember).context)).toThrow(ForbiddenException);
    expect(() => new TenantGuard().canActivate(ctx(undefined).context)).toThrow(UnauthorizedException);
  });
});

describe('VENDOR_SCOPED_MODELS (read from the Prisma data model)', () => {
  it('includes business tables and excludes models without a vendorId', () => {
    for (const m of ['Contact', 'CatalogItem', 'Record', 'CampaignLead', 'VendorProduct', 'StockMovement']) expect(VENDOR_SCOPED_MODELS.has(m)).toBe(true);
    // Notification is keyed by recipientId, Vendor is the tenant itself, CategoryPack is shared platform reference data.
    for (const m of ['Vendor', 'Notification', 'CategoryPack']) expect(VENDOR_SCOPED_MODELS.has(m)).toBe(false);
    // Category is vendor-owned (it has a vendorId), unlike CategoryPack.
    expect(VENDOR_SCOPED_MODELS.has('Category')).toBe(true);
  });
});

describe('scopeArgs', () => {
  const opts = { vendorId: A, vendorModels: new Set(['Contact', 'Record']), sharedModels: new Set(['Category']) };
  const scope = (model: string, op: string, args?: Record<string, unknown>) => scopeArgs(model, op, args, opts);

  it.each(['findFirst', 'findFirstOrThrow', 'findMany', 'findUnique', 'findUniqueOrThrow', 'count', 'aggregate', 'groupBy', 'delete', 'deleteMany'])(
    '%s: always adds the tenant to where', (op) => {
      expect(scope('Contact', op, { where: { id: 'x' } })).toEqual({ where: { id: 'x', vendorId: A } });
      expect(scope('Contact', op)).toEqual({ where: { vendorId: A } });
    });

  it('keeps OR/NOT filters from escaping the tenant (vendorId is ANDed at top level)', () => {
    const out = scope('Contact', 'findMany', { where: { OR: [{ name: 'a' }, { vendorId: B }] } }) as { where: Record<string, unknown> };
    expect(out.where.vendorId).toBe(A);
    expect(out.where.OR).toBeDefined();
  });

  it('refuses a where.vendorId that is not exactly the tenant (other id, filter object, null)', () => {
    for (const v of [B, { in: [A, B] }, { not: A }, null]) expect(() => scope('Contact', 'findMany', { where: { vendorId: v } })).toThrow(TenantScopeError);
  });

  it('accepts a where.vendorId equal to the tenant', () => {
    expect(scope('Contact', 'findMany', { where: { vendorId: A } })).toEqual({ where: { vendorId: A } });
  });

  it('create: stamps the tenant and refuses another tenant or a nested vendor relation', () => {
    expect(scope('Contact', 'create', { data: { name: 'n' } })).toEqual({ data: { name: 'n', vendorId: A } });
    expect(() => scope('Contact', 'create', { data: { name: 'n', vendorId: B } })).toThrow(TenantScopeError);
    expect(() => scope('Contact', 'create', { data: { name: 'n', vendor: { connect: { id: B } } } })).toThrow(TenantScopeError);
    expect(() => scope('Contact', 'create', {})).toThrow(TenantScopeError);
  });

  it('createMany: stamps every row and refuses if any row names another tenant', () => {
    expect(scope('Contact', 'createMany', { data: [{ name: 'a' }, { name: 'b' }] })).toEqual({ data: [{ name: 'a', vendorId: A }, { name: 'b', vendorId: A }] });
    expect(() => scope('Contact', 'createMany', { data: [{ name: 'a' }, { name: 'b', vendorId: B }] })).toThrow(TenantScopeError);
  });

  it('update / updateMany: scopes where and refuses moving a row to another tenant', () => {
    expect(scope('Contact', 'update', { where: { id: 'x' }, data: { name: 'n' } })).toEqual({ where: { id: 'x', vendorId: A }, data: { name: 'n' } });
    expect(scope('Contact', 'updateMany', { where: {}, data: { name: 'n' } })).toEqual({ where: { vendorId: A }, data: { name: 'n' } });
    expect(() => scope('Contact', 'update', { where: { id: 'x' }, data: { vendorId: B } })).toThrow(TenantScopeError);
    expect(() => scope('Contact', 'updateMany', { where: {}, data: { vendor: { connect: { id: B } } } })).toThrow(TenantScopeError);
  });

  it('upsert: scopes where, stamps create, and guards update', () => {
    expect(scope('Contact', 'upsert', { where: { id: 'x' }, create: { name: 'n' }, update: { name: 'm' } })).toEqual({
      where: { id: 'x', vendorId: A }, create: { name: 'n', vendorId: A }, update: { name: 'm' },
    });
    expect(() => scope('Contact', 'upsert', { where: { id: 'x' }, create: { name: 'n', vendorId: B }, update: {} })).toThrow(TenantScopeError);
    expect(() => scope('Contact', 'upsert', { where: { id: 'x' }, create: { name: 'n' }, update: { vendorId: B } })).toThrow(TenantScopeError);
  });

  it('refuses models without vendorId unless explicitly shared', () => {
    expect(() => scope('Vendor', 'findMany')).toThrow(/no vendorId/);
    expect(scope('Category', 'findMany', { where: { x: 1 } })).toEqual({ where: { x: 1 } });
  });

  it('fails closed on unknown operations and on a missing tenant', () => {
    expect(() => scope('Contact', 'somethingNew')).toThrow(TenantScopeError);
    expect(() => scopeArgs('Contact', 'findMany', {}, { ...opts, vendorId: '' })).toThrow(TenantScopeError);
  });

  it('does not mutate its input', () => {
    const args = { where: { id: 'x' }, data: { name: 'n' } };
    const copy = JSON.parse(JSON.stringify(args));
    scope('Contact', 'update', args);
    expect(args).toEqual(copy);
  });
});
