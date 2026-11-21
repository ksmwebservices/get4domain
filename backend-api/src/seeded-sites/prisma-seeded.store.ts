import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService, Actor } from '../plans/admin/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { DupKeys, OutreachStatus, SeededLifecycle, SourceKind } from './core/seeded';
import { BatchRow, NewSeededRow, OutreachLogRow, RegisterRow, SeededListFilter, SeededPatch, SeededRow, SeededStore } from './seeded.store';

const toRow = (r: Prisma.V3SeededSiteGetPayload<object>): SeededRow => ({
  id: r.id, vendorId: r.vendorId, directoryBusinessId: r.directoryBusinessId, lifecycle: r.lifecycle as SeededLifecycle, sourceKind: r.sourceKind as SourceKind, sourceNote: r.sourceNote,
  publicFactsConfirmed: r.publicFactsConfirmed, phoneHash: r.phoneHash, emailHash: r.emailHash, nameKey: r.nameKey, outreachStatus: r.outreachStatus as OutreachStatus,
  outreachOwnerStaffId: r.outreachOwnerStaffId, lastContactAt: r.lastContactAt, nextFollowUpAt: r.nextFollowUpAt, ownerAgreedToContact: r.ownerAgreedToContact, ownerAgreedAt: r.ownerAgreedAt,
  ownerAgreedBy: r.ownerAgreedBy, createdByStaffId: r.createdByStaffId, batchId: r.batchId, removedAt: r.removedAt, createdAt: r.createdAt, updatedAt: r.updatedAt,
});
const toBatch = (b: Prisma.V3SeededBatchGetPayload<object>): BatchRow => ({ ...b, mode: b.mode as BatchRow['mode'] });

@Injectable()
export class PrismaSeededStore extends SeededStore {
  constructor(private readonly prisma: PrismaService, private readonly audits: AuditService) { super(); }

  async create(r: NewSeededRow): Promise<SeededRow> { return toRow(await this.prisma.v3SeededSite.create({ data: r })); }
  async get(id: string) { const r = await this.prisma.v3SeededSite.findUnique({ where: { id } }); return r ? toRow(r) : null; }
  async getByVendor(vendorId: string) { const r = await this.prisma.v3SeededSite.findUnique({ where: { vendorId } }); return r ? toRow(r) : null; }
  async update(id: string, p: SeededPatch) { return toRow(await this.prisma.v3SeededSite.update({ where: { id }, data: p })); }

  async list(f: SeededListFilter) {
    const where: Prisma.V3SeededSiteWhereInput = {
      ...(f.lifecycle ? { lifecycle: f.lifecycle } : {}), ...(f.outreachStatus ? { outreachStatus: f.outreachStatus } : {}), ...(f.batchId ? { batchId: f.batchId } : {}),
      ...(f.q ? { OR: [{ business: { name: { contains: f.q, mode: 'insensitive' } } }, { nameKey: { contains: f.q.toLowerCase().replace(/[^a-z0-9]+/g, '') } }] } : {}),
    };
    const [items, total] = await Promise.all([this.prisma.v3SeededSite.findMany({ where, orderBy: { createdAt: 'desc' }, skip: f.skip, take: f.take }), this.prisma.v3SeededSite.count({ where })]);
    return { items: items.map(toRow), total };
  }

  async findKeyMatches(k: { phoneHashes: string[]; emailHashes: string[]; nameKeys: string[] }): Promise<DupKeys[]> {
    const or: Prisma.V3SeededSiteWhereInput[] = [];
    if (k.phoneHashes.length) or.push({ phoneHash: { in: k.phoneHashes } });
    if (k.emailHashes.length) or.push({ emailHash: { in: k.emailHashes } });
    if (k.nameKeys.length) or.push({ nameKey: { in: k.nameKeys } });
    if (!or.length) return [];
    return (await this.prisma.v3SeededSite.findMany({ where: { OR: or }, select: { phoneHash: true, emailHash: true, nameKey: true } }));
  }

  async createBatch(b: Omit<BatchRow, 'id' | 'createdAt'>) { return toBatch(await this.prisma.v3SeededBatch.create({ data: { ...b, reportJson: b.reportJson as Prisma.InputJsonValue } })); }
  async updateBatch(id: string, p: Partial<Pick<BatchRow, 'rowsCreated' | 'rowsRejected' | 'reportJson'>>) {
    await this.prisma.v3SeededBatch.update({ where: { id }, data: { ...(p.rowsCreated !== undefined ? { rowsCreated: p.rowsCreated } : {}), ...(p.rowsRejected !== undefined ? { rowsRejected: p.rowsRejected } : {}), ...(p.reportJson !== undefined ? { reportJson: p.reportJson as Prisma.InputJsonValue } : {}) } });
  }
  async getBatch(id: string) { const b = await this.prisma.v3SeededBatch.findUnique({ where: { id } }); return b ? toBatch(b) : null; }

  async addLog(l: Omit<OutreachLogRow, 'id' | 'at'>, at: Date): Promise<OutreachLogRow> { return (await this.prisma.v3SeededOutreachLog.create({ data: { ...l, at } })) as OutreachLogRow; }
  async listLogs(seededSiteId: string) { return (await this.prisma.v3SeededOutreachLog.findMany({ where: { seededSiteId }, orderBy: { at: 'desc' }, take: 200 })) as OutreachLogRow[]; }

  async onRegister(phoneHash: string) { return (await this.prisma.v3DncRegister.count({ where: { phoneHash } })) > 0; }
  async addToRegister(phoneHash: string, reason: string, source: string, addedBy: string | null) {
    const before = await this.prisma.v3DncRegister.count({ where: { phoneHash } });
    await this.prisma.v3DncRegister.upsert({ where: { phoneHash }, create: { phoneHash, reason, source, addedBy }, update: {} });   // never overwritten, never deleted
    return before === 0;
  }
  async listRegister(skip: number, take: number) {
    const [items, total] = await Promise.all([this.prisma.v3DncRegister.findMany({ orderBy: { addedAt: 'desc' }, skip, take }), this.prisma.v3DncRegister.count()]);
    return { items: items as RegisterRow[], total };
  }
  async registerHashesAmong(phoneHashes: string[]) {
    if (!phoneHashes.length) return new Set<string>();
    return new Set((await this.prisma.v3DncRegister.findMany({ where: { phoneHash: { in: phoneHashes } }, select: { phoneHash: true } })).map((r) => r.phoneHash));
  }

  async recordAudit(actor: Actor, action: string, entityType: string, entityId: string | null, before: unknown, after: unknown) {
    await this.prisma.$transaction((tx) => this.audits.record(tx, actor, action, entityType, entityId, before, after));
  }
}
