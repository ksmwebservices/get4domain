/**
 * Pure argument rewriting behind forTenant(): given a Prisma operation and its args, return args that can only touch
 * rows of one tenant, or throw. No database access here, so it is unit-testable without Prisma.
 * Fails closed: an unknown operation, a model without `vendorId`, a conflicting vendorId, or a relation-style
 * `vendor: { connect }` write is an error, never a silent pass-through.
 */
export class TenantScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TenantScopeError';
  }
}

export interface ScopeOptions {
  vendorId: string;
  /** Model names that have a scalar `vendorId` column. */
  vendorModels: ReadonlySet<string>;
  /** Model names deliberately usable without a tenant (reference data). Default: none. */
  sharedModels?: ReadonlySet<string>;
}

type Args = Record<string, unknown> | undefined;
type Row = Record<string, unknown>;

const READ_LIKE = new Set(['findFirst', 'findFirstOrThrow', 'findMany', 'findUnique', 'findUniqueOrThrow', 'count', 'aggregate', 'groupBy', 'delete', 'deleteMany']);
const CREATE_LIKE = new Set(['create', 'createMany', 'createManyAndReturn']);
const UPDATE_LIKE = new Set(['update', 'updateMany', 'updateManyAndReturn']);

function scopeWhere(where: unknown, vendorId: string): Row {
  const w: Row = (where && typeof where === 'object' ? { ...(where as Row) } : {}) as Row;
  if ('vendorId' in w && w.vendorId !== vendorId) {
    throw new TenantScopeError('where.vendorId conflicts with the tenant (only an exact match to the tenant is allowed)');
  }
  w.vendorId = vendorId;
  return w;
}

function scopeCreateRow(data: unknown, vendorId: string): Row {
  if (!data || typeof data !== 'object') throw new TenantScopeError('create data is required');
  const d = { ...(data as Row) };
  if ('vendor' in d) throw new TenantScopeError('Use the scalar vendorId, not a nested vendor relation, for tenant-scoped writes');
  if ('vendorId' in d && d.vendorId !== vendorId) throw new TenantScopeError('data.vendorId conflicts with the tenant');
  d.vendorId = vendorId;
  return d;
}

function checkUpdateRow(data: unknown, vendorId: string): Row {
  if (!data || typeof data !== 'object') return {};
  const d = { ...(data as Row) };
  if ('vendor' in d) throw new TenantScopeError('A tenant-scoped update may not change the vendor relation');
  if ('vendorId' in d) {
    // Writing the same value is harmless; anything else would move the row to another tenant.
    if (d.vendorId !== vendorId) throw new TenantScopeError('data.vendorId would move the row to another tenant');
  }
  return d;
}

export function scopeArgs(model: string, operation: string, args: Args, opts: ScopeOptions): Record<string, unknown> {
  const { vendorId, vendorModels, sharedModels } = opts;
  if (typeof vendorId !== 'string' || vendorId.length === 0) throw new TenantScopeError('A tenant (vendorId) is required');
  const a: Row = { ...(args ?? {}) };

  if (!vendorModels.has(model)) {
    if (sharedModels?.has(model)) return a;
    throw new TenantScopeError(`Model ${model} has no vendorId; it is not available through forTenant()`);
  }

  if (READ_LIKE.has(operation)) {
    a.where = scopeWhere(a.where, vendorId);
    return a;
  }

  if (CREATE_LIKE.has(operation)) {
    if (operation === 'create') {
      a.data = scopeCreateRow(a.data, vendorId);
    } else {
      const rows = Array.isArray(a.data) ? (a.data as unknown[]) : [a.data];
      const scoped = rows.map((r) => scopeCreateRow(r, vendorId));
      a.data = Array.isArray(a.data) ? scoped : scoped[0];
    }
    return a;
  }

  if (UPDATE_LIKE.has(operation)) {
    a.where = scopeWhere(a.where, vendorId);
    a.data = checkUpdateRow(a.data, vendorId);
    return a;
  }

  if (operation === 'upsert') {
    a.where = scopeWhere(a.where, vendorId);
    a.create = scopeCreateRow(a.create, vendorId);
    a.update = checkUpdateRow(a.update, vendorId);
    return a;
  }

  throw new TenantScopeError(`Operation ${operation} is not supported through forTenant()`);
}
