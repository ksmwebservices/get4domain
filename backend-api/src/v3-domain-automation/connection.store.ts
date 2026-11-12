import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CertStatus, ConnectionMode, ConnectionStatus } from './core/connection-core';

export interface ConnectionRow {
  id: string; vendorId: string; domainId: string; hostname: string; connectHost: string; bareDomain: boolean; mode: ConnectionMode; status: ConnectionStatus; certStatus: CertStatus;
  cfHostnameId: string | null; attempts: number; failureReason: string | null; registrar: string | null; lastCheckedAt: Date | null; activatedAt: Date | null; createdAt: Date; updatedAt: Date;
}
export type NewConnection = Pick<ConnectionRow, 'vendorId' | 'domainId' | 'hostname' | 'connectHost' | 'bareDomain' | 'mode' | 'registrar'>;
export type ConnectionPatch = Partial<Pick<ConnectionRow, 'mode' | 'status' | 'certStatus' | 'cfHostnameId' | 'attempts' | 'failureReason' | 'registrar' | 'lastCheckedAt' | 'activatedAt'>>;
export interface DomainFacts { id: string; vendorId: string; hostname: string; kind: 'SUBDOMAIN' | 'CUSTOM'; status: string }

/** The connection of one custom domain (slice 5.6c). Every read and write names the vendor. Prisma below; a memory twin lives in test/support. */
export abstract class ConnectionStore {
  abstract domain(vendorId: string, domainId: string): Promise<DomainFacts | null>;
  abstract subdomainHost(vendorId: string): Promise<string | null>;
  /** the public ownership value the vendor puts in DNS (null when the domain has none) */
  abstract txtValue(vendorId: string, domainId: string): Promise<string | null>;
  abstract forDomain(vendorId: string, domainId: string): Promise<ConnectionRow | null>;
  abstract get(vendorId: string, id: string): Promise<ConnectionRow | null>;
  /** null when the domain already has a connection (one per domain) */
  abstract create(n: NewConnection): Promise<ConnectionRow | null>;
  /** compare and set on the status */
  abstract update(vendorId: string, id: string, expected: ConnectionStatus[], patch: ConnectionPatch): Promise<ConnectionRow | null>;
  abstract listForVendor(vendorId: string): Promise<ConnectionRow[]>;
  abstract listForStaff(f: { status?: ConnectionStatus }, skip: number, take: number): Promise<{ items: ConnectionRow[]; total: number }>;
  /** the rows the watcher looks at: PENDING, VERIFYING, ACTIVE (re-checked for certificate loss) and LAPSED (looked at for the plan coming back); least recently checked first */
  abstract watchList(limit: number): Promise<ConnectionRow[]>;
}

type Db = Prisma.V3DomainConnectionGetPayload<Record<string, never>>;
const map = (r: Db): ConnectionRow => ({
  id: r.id, vendorId: r.vendorId, domainId: r.domainId, hostname: r.hostname, connectHost: r.connectHost, bareDomain: r.bareDomain, mode: r.mode as ConnectionMode, status: r.status as ConnectionStatus, certStatus: r.certStatus as CertStatus,
  cfHostnameId: r.cfHostnameId, attempts: r.attempts, failureReason: r.failureReason, registrar: r.registrar, lastCheckedAt: r.lastCheckedAt, activatedAt: r.activatedAt, createdAt: r.createdAt, updatedAt: r.updatedAt,
});

@Injectable()
export class PrismaConnectionStore extends ConnectionStore {
  constructor(private readonly prisma: PrismaService) { super(); }
  async domain(vendorId: string, domainId: string) { const d = await this.prisma.v3Domain.findFirst({ where: { id: domainId, vendorId } }); return d ? { id: d.id, vendorId: d.vendorId, hostname: d.hostname, kind: d.kind as DomainFacts['kind'], status: d.status } : null; }
  async subdomainHost(vendorId: string) { return (await this.prisma.v3Domain.findFirst({ where: { vendorId, kind: 'SUBDOMAIN', status: 'ACTIVE' }, select: { hostname: true } }))?.hostname ?? null; }
  async txtValue(vendorId: string, domainId: string) { return (await this.prisma.v3DomainVerification.findFirst({ where: { vendorId, domainId }, select: { expectedValue: true } }))?.expectedValue ?? null; }
  async forDomain(vendorId: string, domainId: string) { const r = await this.prisma.v3DomainConnection.findFirst({ where: { vendorId, domainId } }); return r ? map(r) : null; }
  async get(vendorId: string, id: string) { const r = await this.prisma.v3DomainConnection.findFirst({ where: { id, vendorId } }); return r ? map(r) : null; }
  async create(n: NewConnection) {
    try { return map(await this.prisma.v3DomainConnection.create({ data: n })); }
    catch (e) { if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return null; throw e; }
  }
  async update(vendorId: string, id: string, expected: ConnectionStatus[], patch: ConnectionPatch) {
    const done = await this.prisma.v3DomainConnection.updateMany({ where: { id, vendorId, status: { in: expected } }, data: { ...patch } });
    return done.count === 1 ? this.get(vendorId, id) : null;
  }
  async listForVendor(vendorId: string) { return (await this.prisma.v3DomainConnection.findMany({ where: { vendorId }, orderBy: { createdAt: 'desc' } })).map(map); }
  async listForStaff(f: { status?: ConnectionStatus }, skip: number, take: number) {
    const where = f.status ? { status: f.status } : {};
    const [items, total] = await Promise.all([this.prisma.v3DomainConnection.findMany({ where, orderBy: { updatedAt: 'desc' }, skip, take }), this.prisma.v3DomainConnection.count({ where })]);
    return { items: items.map(map), total };
  }
  async watchList(limit: number) { return (await this.prisma.v3DomainConnection.findMany({ where: { status: { in: ['PENDING', 'VERIFYING', 'ACTIVE', 'LAPSED'] } }, orderBy: [{ lastCheckedAt: { sort: 'asc', nulls: 'first' } }], take: limit })).map(map); }
}
