import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { advisoryXactLock } from '../common/db-lock';
import { Actor, AuditService } from '../plans/admin/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  DomainListQuery, DomainPatch, DomainRecord, DomainRepository, DomainTx, DuplicateHostError, NewDomain, RedirectRecord, VendorInfo, VerificationRecord,
} from './domain.repository';

type Db = Prisma.TransactionClient | PrismaService;
const isUnique = (e: unknown): boolean => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
const guard = async <T>(p: Promise<T>): Promise<T> => { try { return await p; } catch (e) { if (isUnique(e)) throw new DuplicateHostError(); throw e; } };

const toRecord = (r: { id: string; vendorId: string; hostname: string; kind: string; status: string; isPrimary: boolean; verifiedAt: Date | null; sslStatus: string; createdByType: string; createdById: string | null; createdAt: Date; updatedAt: Date; removedAt: Date | null }): DomainRecord => ({
  id: r.id, vendorId: r.vendorId, hostname: r.hostname, kind: r.kind as DomainRecord['kind'], status: r.status as DomainRecord['status'], isPrimary: r.isPrimary, verifiedAt: r.verifiedAt,
  sslStatus: r.sslStatus as DomainRecord['sslStatus'], createdByType: r.createdByType, createdById: r.createdById, createdAt: r.createdAt, updatedAt: r.updatedAt, removedAt: r.removedAt,
});

/** The reads and writes against a client (the pool, or the open transaction). Only the transaction object exposes the write half to services. */
class Ops implements DomainTx {
  constructor(protected readonly db: Db, private readonly audits?: AuditService, private readonly tx?: Prisma.TransactionClient) {}

  async findByHostname(hostname: string): Promise<DomainRecord | null> { const r = await this.db.v3Domain.findUnique({ where: { hostname } }); return r ? toRecord(r) : null; }
  async findById(id: string): Promise<DomainRecord | null> { const r = await this.db.v3Domain.findUnique({ where: { id } }); return r ? toRecord(r) : null; }
  async listForVendor(vendorId: string): Promise<DomainRecord[]> { return (await this.db.v3Domain.findMany({ where: { vendorId }, orderBy: [{ createdAt: 'asc' }, { hostname: 'asc' }] })).map(toRecord); }
  async countNonRemovedCustom(vendorId: string): Promise<number> { return this.db.v3Domain.count({ where: { vendorId, kind: 'CUSTOM', status: { not: 'REMOVED' } } }); }
  async countSubdomainChangesSince(vendorId: string, since: Date): Promise<number> { return this.db.v3Domain.count({ where: { vendorId, kind: 'SUBDOMAIN', status: 'REMOVED', removedAt: { gte: since } } }); }
  async getVerification(domainId: string): Promise<VerificationRecord | null> { const v = await this.db.v3DomainVerification.findUnique({ where: { domainId } }); return v ? { domainId: v.domainId, vendorId: v.vendorId, method: v.method, expectedValue: v.expectedValue, lastCheckedAt: v.lastCheckedAt, attempts: v.attempts, result: v.result } : null; }
  async vendorInfo(vendorId: string): Promise<VendorInfo | null> { const v = await this.db.vendor.findUnique({ where: { id: vendorId }, select: { id: true, status: true, subdomain: true } }); return v ? { id: v.id, status: String(v.status), subdomain: v.subdomain ?? null } : null; }
  async vendorBySubdomain(subdomain: string): Promise<VendorInfo | null> { const v = await this.db.vendor.findUnique({ where: { subdomain }, select: { id: true, status: true, subdomain: true } }); return v ? { id: v.id, status: String(v.status), subdomain: v.subdomain ?? null } : null; }
  async findRedirect(fromHost: string, fromPath: string): Promise<RedirectRecord | null> {
    const r = await this.db.v3Redirect.findUnique({ where: { fromHost_fromPath: { fromHost, fromPath } } });
    return r && r.active ? { id: r.id, vendorId: r.vendorId, fromHost: r.fromHost, fromPath: r.fromPath, toHost: r.toHost, toPath: r.toPath, status: r.status, source: r.source, active: r.active } : null;
  }

  // writes
  create(d: NewDomain): Promise<DomainRecord> {
    return guard(this.db.v3Domain.create({ data: { vendorId: d.vendorId, hostname: d.hostname, kind: d.kind, status: d.status, verifiedAt: d.verifiedAt ?? null, createdByType: d.createdByType, createdById: d.createdById } }).then(toRecord));
  }
  update(id: string, p: DomainPatch): Promise<DomainRecord> {
    const data: Prisma.V3DomainUncheckedUpdateInput = { ...p };
    if (p.status === 'REMOVED') { data.isPrimary = false; data.primaryVendorId = null; data.subdomainVendorId = null; if (!p.removedAt) data.removedAt = new Date(); }
    return guard(this.db.v3Domain.update({ where: { id }, data }).then(toRecord));
  }
  async setPrimary(vendorId: string, domainId: string | null): Promise<void> {
    await this.db.v3Domain.updateMany({ where: { vendorId, isPrimary: true }, data: { isPrimary: false, primaryVendorId: null } });
    if (domainId) await guard(this.db.v3Domain.update({ where: { id: domainId }, data: { isPrimary: true, primaryVendorId: vendorId } }));
  }
  async setSubdomainSlot(domainId: string, on: boolean): Promise<void> {
    const r = await this.db.v3Domain.findUniqueOrThrow({ where: { id: domainId }, select: { vendorId: true } });
    await guard(this.db.v3Domain.update({ where: { id: domainId }, data: { subdomainVendorId: on ? r.vendorId : null } }));
  }
  async upsertVerification(domainId: string, vendorId: string, patch: Partial<Omit<VerificationRecord, 'domainId' | 'vendorId'>>): Promise<VerificationRecord> {
    const v = await this.db.v3DomainVerification.upsert({
      where: { domainId },
      create: { domainId, vendorId, method: patch.method ?? 'TXT', expectedValue: patch.expectedValue ?? '', lastCheckedAt: patch.lastCheckedAt ?? null, attempts: patch.attempts ?? 0, result: patch.result ?? 'PENDING' },
      update: { vendorId, ...patch },
    });
    return { domainId: v.domainId, vendorId: v.vendorId, method: v.method, expectedValue: v.expectedValue, lastCheckedAt: v.lastCheckedAt, attempts: v.attempts, result: v.result };
  }
  async setVendorSubdomain(vendorId: string, subdomain: string): Promise<void> { await guard(this.db.vendor.update({ where: { id: vendorId }, data: { subdomain } })); }
  async addRedirect(r: Omit<RedirectRecord, 'id' | 'active'>): Promise<void> {
    await this.db.v3Redirect.upsert({
      where: { fromHost_fromPath: { fromHost: r.fromHost, fromPath: r.fromPath } },
      create: { vendorId: r.vendorId, fromHost: r.fromHost, fromPath: r.fromPath, toHost: r.toHost, toPath: r.toPath, status: r.status, source: r.source, active: true },
      update: { vendorId: r.vendorId, toHost: r.toHost, toPath: r.toPath, status: r.status, source: r.source, active: true },
    });
  }
  async audit(actor: Actor, action: string, entityId: string | null, before: unknown, after: unknown): Promise<void> {
    if (!this.audits || !this.tx) throw new Error('audit is only available inside a transaction');
    await this.audits.record(this.tx, actor, action, 'domain', entityId, before, after);
  }
}

@Injectable()
export class PrismaDomainRepository extends DomainRepository {
  private readonly ops: Ops;
  constructor(private readonly prisma: PrismaService, private readonly audits: AuditService) { super(); this.ops = new Ops(prisma); }

  findByHostname(h: string) { return this.ops.findByHostname(h); }
  findById(id: string) { return this.ops.findById(id); }
  listForVendor(v: string) { return this.ops.listForVendor(v); }
  countNonRemovedCustom(v: string) { return this.ops.countNonRemovedCustom(v); }
  countSubdomainChangesSince(v: string, s: Date) { return this.ops.countSubdomainChangesSince(v, s); }
  getVerification(id: string) { return this.ops.getVerification(id); }
  vendorInfo(v: string) { return this.ops.vendorInfo(v); }
  vendorBySubdomain(s: string) { return this.ops.vendorBySubdomain(s); }
  findRedirect(h: string, p: string) { return this.ops.findRedirect(h, p); }

  async list(q: DomainListQuery): Promise<{ items: DomainRecord[]; total: number }> {
    const where: Prisma.V3DomainWhereInput = { ...(q.vendorId ? { vendorId: q.vendorId } : {}), ...(q.status ? { status: q.status } : {}), ...(q.kind ? { kind: q.kind } : {}), ...(q.q ? { hostname: { contains: q.q.toLowerCase() } } : {}) };
    const [rows, total] = await Promise.all([this.prisma.v3Domain.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: q.skip, take: q.take }), this.prisma.v3Domain.count({ where })]);
    return { items: rows.map(toRecord), total };
  }

  /** One transaction per vendor at a time (advisory lock); the audit row is written in the same transaction. The DNS lookup is never inside it. */
  transaction<T>(vendorId: string, fn: (tx: DomainTx) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await advisoryXactLock(tx, `domains:${vendorId}`);
      return fn(new Ops(tx, this.audits, tx));
    }, { timeout: 20_000 });
  }
}
