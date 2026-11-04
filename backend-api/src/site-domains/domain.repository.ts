import { Actor } from '../plans/admin/audit.service';

export type DomainKind = 'SUBDOMAIN' | 'CUSTOM';
export type DomainStatus = 'PENDING' | 'VERIFYING' | 'ACTIVE' | 'FAILED' | 'REMOVED';
export type SslStatus = 'NONE' | 'PENDING' | 'ACTIVE' | 'FAILED';

export interface DomainRecord {
  id: string; vendorId: string; hostname: string; kind: DomainKind; status: DomainStatus; isPrimary: boolean; verifiedAt: Date | null; sslStatus: SslStatus;
  createdByType: string; createdById: string | null; createdAt: Date; updatedAt: Date; removedAt: Date | null;
}
export interface NewDomain { vendorId: string; hostname: string; kind: DomainKind; status: DomainStatus; verifiedAt?: Date | null; createdByType: string; createdById: string | null }
export interface DomainPatch { vendorId?: string; status?: DomainStatus; verifiedAt?: Date | null; sslStatus?: SslStatus; removedAt?: Date | null; createdByType?: string; createdById?: string | null }
export interface VerificationRecord { domainId: string; vendorId: string; method: string; expectedValue: string; lastCheckedAt: Date | null; attempts: number; result: string }
export interface RedirectRecord { id: string; vendorId: string; fromHost: string; fromPath: string; toHost: string; toPath: string; status: number; source: string; active: boolean }
/** `removed` is true only for a business whose site was permanently removed (g4d_site_removals). Suspended and pending vendors are NOT removed: their site stays live (owner rule 9). */
export interface VendorInfo { id: string; status: string; subdomain: string | null; removed?: boolean }

/** Thrown by create/update when the unique rule on the host name (or the one-subdomain / one-primary rule) is hit; the service turns it into HOST_UNAVAILABLE. */
export class DuplicateHostError extends Error { constructor() { super('duplicate host'); } }

export interface DomainListQuery { vendorId?: string; status?: DomainStatus; kind?: DomainKind; q?: string; skip: number; take: number }

/** The port the domain services use. A Prisma implementation and an in-memory twin (tests) implement it; nothing else touches the tables. */
export abstract class DomainRepository {
  abstract findByHostname(hostname: string): Promise<DomainRecord | null>;
  abstract findById(id: string): Promise<DomainRecord | null>;
  abstract listForVendor(vendorId: string): Promise<DomainRecord[]>;
  abstract list(q: DomainListQuery): Promise<{ items: DomainRecord[]; total: number }>;
  abstract countNonRemovedCustom(vendorId: string): Promise<number>;
  /** subdomain rows that were replaced (REMOVED) since the given time: what counts against the change limit */
  abstract countSubdomainChangesSince(vendorId: string, since: Date): Promise<number>;

  abstract getVerification(domainId: string): Promise<VerificationRecord | null>;
  abstract vendorInfo(vendorId: string): Promise<VendorInfo | null>;
  abstract vendorBySubdomain(subdomain: string): Promise<VendorInfo | null>;
  abstract findRedirect(fromHost: string, fromPath: string): Promise<RedirectRecord | null>;

  /** Runs `fn` in one transaction holding a lock for this vendor (writes to one vendor's domains are serialised). The audit row is written in the same transaction. */
  abstract transaction<T>(vendorId: string, fn: (tx: DomainTx) => Promise<T>): Promise<T>;
}

/** The write side, only reachable inside DomainRepository.transaction. */
export interface DomainTx extends Pick<DomainRepository, 'findByHostname' | 'findById' | 'listForVendor' | 'countNonRemovedCustom' | 'countSubdomainChangesSince' | 'getVerification' | 'vendorInfo' | 'vendorBySubdomain'> {
  create(d: NewDomain): Promise<DomainRecord>;
  update(id: string, patch: DomainPatch): Promise<DomainRecord>;
  /** makes `domainId` the vendor's one primary (null clears it); the database allows only one */
  setPrimary(vendorId: string, domainId: string | null): Promise<void>;
  /** marks the row as the vendor's one ACTIVE free subdomain (or clears it) */
  setSubdomainSlot(domainId: string, on: boolean): Promise<void>;
  upsertVerification(domainId: string, vendorId: string, patch: Partial<Omit<VerificationRecord, 'domainId' | 'vendorId'>>): Promise<VerificationRecord>;
  /** keeps the vendor's existing subdomain column (read by the legacy site renderer) equal to the free subdomain */
  setVendorSubdomain(vendorId: string, subdomain: string): Promise<void>;
  addRedirect(r: Omit<RedirectRecord, 'id' | 'active'>): Promise<void>;
  audit(actor: Actor, action: string, entityId: string | null, before: unknown, after: unknown): Promise<void>;
}
