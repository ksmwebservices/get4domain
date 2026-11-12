import { ConsentState, CustomerFields, CustomerSource } from './core/customer-core';

export interface CustomerRow extends CustomerFields {
  id: string; vendorId: string; firstSource: CustomerSource; consent: ConsentState; consentAt: Date | null; notes: string | null; tags: string[]; archivedAt: Date | null; createdAt: Date; updatedAt: Date;
}
export interface SourceRow { id: string; customerId: string; source: CustomerSource; refType: string; refId: string; at: Date }
export interface ListQuery { q?: string; source?: CustomerSource; includeArchived: boolean; skip: number; take: number }
export interface CustomerPatch { name?: string; phone?: string | null; phoneKey?: string | null; email?: string | null; emailKey?: string | null; notes?: string | null; tags?: string[]; consent?: ConsentState; consentAt?: Date | null; archivedAt?: Date | null }

/** Thrown by `update` when a change would make this person the same as another customer of the business. */
export class CustomerKeyTaken extends Error { constructor(readonly customerId: string) { super('CUSTOMER_KEY_TAKEN'); } }

/**
 * Everything the customer list stores, behind one port (a Prisma implementation and an in-memory twin). Every read and write carries the vendor id in its WHERE, so a row of another business can
 * never be seen or changed. `create` is safe under a race: when the database refuses a second copy of the same person it returns the first and says created false.
 */
export abstract class CustomersStore {
  /** The customer this person already is: by phone first, then by e-mail (archived ones included, so a restored person is never duplicated). */
  abstract findByKeys(vendorId: string, phoneKey: string | null, emailKey: string | null): Promise<CustomerRow | null>;
  abstract create(vendorId: string, f: CustomerFields & { firstSource: CustomerSource }): Promise<{ row: CustomerRow; created: boolean }>;
  abstract update(vendorId: string, id: string, patch: CustomerPatch): Promise<CustomerRow | null>;
  /** Idempotent: the same (customer, source, reference) stores one row and says created false the second time. */
  abstract addSource(vendorId: string, customerId: string, s: { source: CustomerSource; refType: string; refId: string; at: Date }): Promise<boolean>;
  abstract get(vendorId: string, id: string): Promise<{ row: CustomerRow; sources: SourceRow[] } | null>;
  abstract list(vendorId: string, q: ListQuery): Promise<{ items: CustomerRow[]; total: number }>;
  /** Customers per source (a customer counts once under each source that reached them), archived ones left out. */
  abstract summary(vendorId: string): Promise<{ total: number; bySource: Record<string, number> }>;
}
