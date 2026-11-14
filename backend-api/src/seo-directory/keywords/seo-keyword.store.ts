import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { KeywordSet, StoredKeywordSet } from '../core/category-keywords';

export interface KeywordRow extends StoredKeywordSet { id: string; updatedByStaffId: string | null; updatedAt: Date }

/** The one port the keyword service uses. A Prisma implementation and an in-memory twin (tests) implement it. Platform-level table: no tenant column. */
export abstract class SeoKeywordStore {
  abstract list(q: { q?: string; skip: number; take: number }): Promise<{ items: KeywordRow[]; total: number }>;
  abstract all(): Promise<KeywordRow[]>;
  abstract get(slug: string): Promise<KeywordRow | null>;
  /** loader write: creates or refreshes DERIVED rows only; a STAFF row is never touched; synonyms are never written here */
  abstract upsertDerived(sets: KeywordSet[]): Promise<void>;
  abstract staffUpdate(slug: string, p: { singular?: string; plural?: string; synonyms?: string[] }, staffId: string | null): Promise<KeywordRow | null>;
}

type Db = { id: string; categorySlug: string; name: string; singular: string; plural: string; synonyms: unknown; specialisations: unknown; source: string; updatedByStaffId: string | null; updatedAt: Date };
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const toRow = (r: Db): KeywordRow => ({ id: r.id, categorySlug: r.categorySlug, name: r.name, singular: r.singular, plural: r.plural, synonyms: strings(r.synonyms), specialisations: strings(r.specialisations), source: r.source === 'STAFF' ? 'STAFF' : 'DERIVED', updatedByStaffId: r.updatedByStaffId, updatedAt: r.updatedAt });

@Injectable()
export class PrismaSeoKeywordStore extends SeoKeywordStore {
  constructor(private readonly prisma: PrismaService) { super(); }
  async list(q: { q?: string; skip: number; take: number }) {
    const where = q.q ? { OR: [{ categorySlug: { contains: q.q.toLowerCase() } }, { name: { contains: q.q, mode: 'insensitive' as const } }] } : {};
    const [items, total] = await Promise.all([this.prisma.v3SeoCategoryKeyword.findMany({ where, orderBy: { categorySlug: 'asc' }, skip: q.skip, take: q.take }), this.prisma.v3SeoCategoryKeyword.count({ where })]);
    return { items: items.map(toRow), total };
  }
  async all(): Promise<KeywordRow[]> { return (await this.prisma.v3SeoCategoryKeyword.findMany({ orderBy: { categorySlug: 'asc' } })).map(toRow); }
  async get(slug: string): Promise<KeywordRow | null> { const r = await this.prisma.v3SeoCategoryKeyword.findUnique({ where: { categorySlug: slug } }); return r ? toRow(r) : null; }
  async upsertDerived(sets: KeywordSet[]): Promise<void> {
    for (const s of sets) {
      const data = { name: s.name, singular: s.singular, plural: s.plural, specialisations: s.specialisations };
      const have = await this.prisma.v3SeoCategoryKeyword.findUnique({ where: { categorySlug: s.categorySlug } });
      if (!have) await this.prisma.v3SeoCategoryKeyword.create({ data: { categorySlug: s.categorySlug, ...data, synonyms: [], source: 'DERIVED' } });
      else if (have.source !== 'STAFF') await this.prisma.v3SeoCategoryKeyword.update({ where: { categorySlug: s.categorySlug }, data });
    }
  }
  async staffUpdate(slug: string, p: { singular?: string; plural?: string; synonyms?: string[] }, staffId: string | null): Promise<KeywordRow | null> {
    const have = await this.prisma.v3SeoCategoryKeyword.findUnique({ where: { categorySlug: slug } });
    if (!have) return null;
    return toRow(await this.prisma.v3SeoCategoryKeyword.update({ where: { categorySlug: slug }, data: { ...(p.singular !== undefined ? { singular: p.singular } : {}), ...(p.plural !== undefined ? { plural: p.plural } : {}), ...(p.synonyms !== undefined ? { synonyms: p.synonyms } : {}), source: 'STAFF', updatedByStaffId: staffId } }));
  }
}
