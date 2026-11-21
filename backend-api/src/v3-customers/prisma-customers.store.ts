import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ConsentState, CustomerFields, CustomerSource, CUSTOMER_SOURCES } from './core/customer-core';
import { CustomerKeyTaken, CustomerPatch, CustomerRow, CustomersStore, ListQuery, SourceRow } from './customers.store';

type Db = Prisma.V3CustomerGetPayload<Record<string, never>>;
const map = (r: Db): CustomerRow => ({
  id: r.id, vendorId: r.vendorId, name: r.name, phone: r.phone, phoneKey: r.phoneKey, email: r.email, emailKey: r.emailKey, firstSource: r.firstSource as CustomerSource, consent: r.consent as ConsentState,
  consentAt: r.consentAt, notes: r.notes, tags: Array.isArray(r.tags) ? (r.tags as string[]) : [], archivedAt: r.archivedAt, createdAt: r.createdAt, updatedAt: r.updatedAt,
});
const isUnique = (e: unknown): boolean => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

@Injectable()
export class PrismaCustomersStore extends CustomersStore {
  constructor(private readonly prisma: PrismaService) { super(); }

  async findByKeys(vendorId: string, phoneKey: string | null, emailKey: string | null): Promise<CustomerRow | null> {
    if (phoneKey) { const r = await this.prisma.v3Customer.findFirst({ where: { vendorId, phoneKey } }); if (r) return map(r); }
    if (emailKey) { const r = await this.prisma.v3Customer.findFirst({ where: { vendorId, emailKey } }); if (r) return map(r); }
    return null;
  }

  async create(vendorId: string, f: CustomerFields & { firstSource: CustomerSource }): Promise<{ row: CustomerRow; created: boolean }> {
    try {
      const r = await this.prisma.v3Customer.create({ data: { vendorId, name: f.name, phone: f.phone, phoneKey: f.phoneKey, email: f.email, emailKey: f.emailKey, firstSource: f.firstSource } });
      return { row: map(r), created: true };
    } catch (e) {
      if (!isUnique(e)) throw e;
      const again = await this.findByKeys(vendorId, f.phoneKey, f.emailKey);   // a parallel capture of the same person won the race
      if (!again) throw e;
      return { row: again, created: false };
    }
  }

  async update(vendorId: string, id: string, p: CustomerPatch): Promise<CustomerRow | null> {
    const data: Prisma.V3CustomerUncheckedUpdateManyInput = {};
    for (const k of ['name', 'phone', 'phoneKey', 'email', 'emailKey', 'notes', 'consent', 'consentAt', 'archivedAt'] as const) if (p[k] !== undefined) (data as Record<string, unknown>)[k] = p[k];
    if (p.tags !== undefined) data.tags = p.tags as unknown as Prisma.InputJsonValue;
    try {
      const n = await this.prisma.v3Customer.updateMany({ where: { id, vendorId }, data });
      if (n.count === 0) return null;
    } catch (e) {
      if (isUnique(e)) { const other = await this.findByKeys(vendorId, p.phoneKey ?? null, p.emailKey ?? null); throw new CustomerKeyTaken(other?.id ?? ''); }
      throw e;
    }
    const r = await this.prisma.v3Customer.findFirst({ where: { id, vendorId } });
    return r ? map(r) : null;
  }

  async addSource(vendorId: string, customerId: string, s: { source: CustomerSource; refType: string; refId: string; at: Date }): Promise<boolean> {
    try { await this.prisma.v3CustomerSource.create({ data: { vendorId, customerId, source: s.source, refType: s.refType, refId: s.refId, at: s.at } }); return true; } catch (e) { if (isUnique(e)) return false; throw e; }
  }

  async get(vendorId: string, id: string): Promise<{ row: CustomerRow; sources: SourceRow[] } | null> {
    const r = await this.prisma.v3Customer.findFirst({ where: { id, vendorId }, include: { sources: { where: { vendorId }, orderBy: { at: 'asc' } } } });
    if (!r) return null;
    return { row: map(r), sources: r.sources.map((s) => ({ id: s.id, customerId: s.customerId, source: s.source as CustomerSource, refType: s.refType, refId: s.refId, at: s.at })) };
  }

  async list(vendorId: string, q: ListQuery): Promise<{ items: CustomerRow[]; total: number }> {
    const where: Prisma.V3CustomerWhereInput = { vendorId, ...(q.includeArchived ? {} : { archivedAt: null }) };
    if (q.source) where.sources = { some: { vendorId, source: q.source } };
    if (q.q) {
      const t = q.q.trim(); const digits = t.replace(/[^\d]/g, '');
      where.OR = [{ name: { contains: t, mode: 'insensitive' } }, { emailKey: { contains: t.toLowerCase() } }, ...(digits.length >= 3 ? [{ phoneKey: { contains: digits } }] : [])];
    }
    const [items, total] = await Promise.all([this.prisma.v3Customer.findMany({ where: { ...where, vendorId }, orderBy: { createdAt: 'desc' }, skip: q.skip, take: q.take }), this.prisma.v3Customer.count({ where: { ...where, vendorId } })]);
    return { items: items.map(map), total };
  }

  async summary(vendorId: string): Promise<{ total: number; bySource: Record<string, number> }> {
    const live = { vendorId, archivedAt: null };
    const total = await this.prisma.v3Customer.count({ where: { ...live, vendorId } });
    const bySource: Record<string, number> = {};
    for (const s of CUSTOMER_SOURCES) bySource[s] = await this.prisma.v3Customer.count({ where: { ...live, sources: { some: { vendorId, source: s } } } });
    return { total, bySource };
  }
}
