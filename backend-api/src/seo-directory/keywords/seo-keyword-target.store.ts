import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TargetInput, TargetRow, TargetSource, TargetStatus } from '../core/keyword-target';

export interface TargetListQuery { q?: string; status?: string; path?: string; /** 'volume' = highest monthly searches first, unknown last */ sort?: 'priority' | 'volume'; skip: number; take: number }
export interface TargetImportWrite { create: TargetInput[]; update: Array<{ id: string; patch: Partial<TargetInput> }> }

/** The port of the keyword targets. A Prisma implementation and an in-memory twin (tests) implement it. Platform-level table: no tenant column, staff only. */
export abstract class SeoKeywordTargetStore {
  abstract list(q: TargetListQuery): Promise<{ items: TargetRow[]; total: number }>;
  /** every row, for the import comparison and the export (a staff tool: the table holds thousands, not millions) */
  abstract all(status?: string): Promise<TargetRow[]>;
  abstract get(id: string): Promise<TargetRow | null>;
  /** null when the keyword and path already exist */
  abstract create(t: TargetInput, staffId: string | null): Promise<TargetRow | null>;
  abstract update(id: string, patch: Partial<TargetInput>, staffId: string | null): Promise<TargetRow | null>;
  /** the targets of one exact path, any status (the caller picks the ACTIVE ones) */
  abstract forPath(path: string): Promise<TargetRow[]>;
  /** one transaction: either every row of an import is written or none */
  abstract importApply(w: TargetImportWrite, staffId: string | null): Promise<void>;
}

type Db = { id: string; keyword: string; path: string; pageType: string; status: string; priority: number; titleOverride: string | null; descriptionOverride: string | null; h1Override: string | null; notes: string | null; source: string; volume: number | null; competition: string | null; createdAt: Date; updatedAt: Date };
const toRow = (r: Db): TargetRow => ({ id: r.id, keyword: r.keyword, path: r.path, pageType: r.pageType, status: r.status as TargetStatus, priority: r.priority, titleOverride: r.titleOverride, descriptionOverride: r.descriptionOverride, h1Override: r.h1Override, notes: r.notes, source: (r.source === 'PLAN' ? 'PLAN' : 'STAFF') as TargetSource, volume: r.volume, competition: (r.competition === 'LOW' || r.competition === 'MEDIUM' || r.competition === 'HIGH' ? r.competition : null), createdAt: r.createdAt, updatedAt: r.updatedAt });
const isUnique = (e: unknown): boolean => typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002';

@Injectable()
export class PrismaSeoKeywordTargetStore extends SeoKeywordTargetStore {
  constructor(private readonly prisma: PrismaService) { super(); }

  async list(q: TargetListQuery) {
    const where = { ...(q.status ? { status: q.status } : {}), ...(q.path ? { path: q.path } : {}), ...(q.q ? { OR: [{ keyword: { contains: q.q.toLowerCase() } }, { path: { contains: q.q.toLowerCase() } }] } : {}) };
    const [items, total] = await Promise.all([this.prisma.v3SeoKeywordTarget.findMany({ where, orderBy: q.sort === 'volume' ? [{ volume: { sort: 'desc' as const, nulls: 'last' as const } }, { priority: 'asc' as const }, { keyword: 'asc' as const }] : [{ priority: 'asc' as const }, { path: 'asc' as const }, { keyword: 'asc' as const }], skip: q.skip, take: q.take }), this.prisma.v3SeoKeywordTarget.count({ where })]);
    return { items: items.map(toRow), total };
  }
  async all(status?: string): Promise<TargetRow[]> { return (await this.prisma.v3SeoKeywordTarget.findMany({ where: status ? { status } : {}, orderBy: [{ path: 'asc' }, { keyword: 'asc' }], take: 50_000 })).map(toRow); }
  async get(id: string): Promise<TargetRow | null> { const r = await this.prisma.v3SeoKeywordTarget.findUnique({ where: { id } }); return r ? toRow(r) : null; }

  async create(t: TargetInput, staffId: string | null): Promise<TargetRow | null> {
    try { return toRow(await this.prisma.v3SeoKeywordTarget.create({ data: { ...t, createdByStaffId: staffId, updatedByStaffId: staffId } })); }
    catch (e) { if (isUnique(e)) return null; throw e; }
  }
  async update(id: string, patch: Partial<TargetInput>, staffId: string | null): Promise<TargetRow | null> {
    const have = await this.prisma.v3SeoKeywordTarget.findUnique({ where: { id } });
    if (!have) return null;
    return toRow(await this.prisma.v3SeoKeywordTarget.update({ where: { id }, data: { ...patch, updatedByStaffId: staffId } }));
  }
  async forPath(path: string): Promise<TargetRow[]> { return (await this.prisma.v3SeoKeywordTarget.findMany({ where: { path }, orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }], take: 50 })).map(toRow); }

  async importApply(w: TargetImportWrite, staffId: string | null): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      for (const t of w.create) await tx.v3SeoKeywordTarget.create({ data: { ...t, createdByStaffId: staffId, updatedByStaffId: staffId } });
      for (const u of w.update) await tx.v3SeoKeywordTarget.update({ where: { id: u.id }, data: { ...u.patch, updatedByStaffId: staffId } });
    }, { timeout: 60_000 });
  }
}
