import { Prisma, PrismaClient } from '@prisma/client';
import { scopeArgs, TenantScopeError } from './scope-args';

/** Models that carry a scalar `vendorId` column, read from Prisma's own data model so it can never drift from the schema. */
export const VENDOR_SCOPED_MODELS: ReadonlySet<string> = new Set(
  Prisma.dmmf.datamodel.models
    .filter((m) => m.fields.some((f) => f.name === 'vendorId' && f.kind === 'scalar'))
    .map((m) => m.name),
);

export interface ForTenantOptions {
  /** Models usable without a tenant (reference data). Default: none, i.e. any model without vendorId is refused. */
  sharedModels?: readonly string[];
}

/**
 * A Prisma client whose every model operation is confined to one tenant:
 *   const db = forTenant(this.prisma, tenant.vendorId);
 *   db.contact.findMany()                      -> only this vendor's contacts
 *   db.contact.findUnique({ where: { id } })   -> null when the id belongs to another vendor
 *   db.contact.update({ where: { id }, ... })  -> P2025 (not found) when the id belongs to another vendor
 *   db.contact.create({ data: { vendorId: OTHER } }) -> TenantScopeError
 * Covers model operations (also inside `$transaction(async (tx) => ...)` on the extended client).
 * It does NOT cover `$queryRaw` / `$executeRaw` (those must filter by vendorId themselves; verify:raw-sql tracks them).
 * New V3 code should use this; existing controllers are unchanged.
 */
export function forTenant(prisma: PrismaClient, vendorId: string, options: ForTenantOptions = {}) {
  if (typeof vendorId !== 'string' || vendorId.length === 0) throw new TenantScopeError('A tenant (vendorId) is required');
  const sharedModels = new Set(options.sharedModels ?? []);
  return prisma.$extends({
    name: 'tenant-scope',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          return query(scopeArgs(model, operation, args as Record<string, unknown>, { vendorId, vendorModels: VENDOR_SCOPED_MODELS, sharedModels }) as typeof args);
        },
      },
    },
  });
}
