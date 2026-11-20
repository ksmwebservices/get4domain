import { PrismaClient } from '@prisma/client';
import { LegacyCategory, LegacyMatch } from './taxonomy-core';
import { TaxonomyStore } from './taxonomy-loader';

/** Reference data (no vendor id), so none of it is tenant data. Takes a plain PrismaClient so the loader script can use it without the Nest container. Writes only the five new tables; the existing registration categories are only READ. */
export class PrismaTaxonomyStore extends TaxonomyStore {
  constructor(private readonly prisma: PrismaClient) { super(); }

  async listFamilies(): Promise<Array<{ slug: string; name: string; sortOrder: number; plannedPackKey: string }>> {
    return this.prisma.v3TaxonomyFamily.findMany({ select: { slug: true, name: true, sortOrder: true, plannedPackKey: true }, orderBy: { sortOrder: 'asc' } });
  }
  async listCategories(): Promise<Array<{ slug: string; name: string }>> {
    return this.prisma.v3TaxonomyCategory.findMany({ select: { slug: true, name: true }, orderBy: { slug: 'asc' } });
  }
  async listLinks(): Promise<Array<{ family: string; category: string }>> {
    const rows = await this.prisma.v3TaxonomyFamilyCategory.findMany({ select: { family: { select: { slug: true } }, category: { select: { slug: true } } } });
    return rows.map((r) => ({ family: r.family.slug, category: r.category.slug }));
  }
  async listRelated(): Promise<Array<{ a: string; b: string }>> {
    const rows = await this.prisma.v3TaxonomyRelatedFamily.findMany({ select: { familyA: { select: { slug: true } }, familyB: { select: { slug: true } } } });
    return rows.map((r) => { const [a, b] = [r.familyA.slug, r.familyB.slug].sort(); return { a, b }; });
  }
  async listLegacyMaps(): Promise<Array<{ legacyKey: string }>> {
    return (await this.prisma.v3TaxonomyLegacyMap.findMany({ select: { legacyCategoryKey: true } })).map((r) => ({ legacyKey: r.legacyCategoryKey }));
  }
  async listLegacyCategories(): Promise<LegacyCategory[]> {
    return this.prisma.v3PackCategory.findMany({ select: { categoryKey: true, name: true }, orderBy: { categoryKey: 'asc' } });
  }

  async createFamilies(rows: Array<{ slug: string; name: string; sortOrder: number; plannedPackKey: string; sourceTag: string }>): Promise<void> {
    if (rows.length) await this.prisma.v3TaxonomyFamily.createMany({ data: rows, skipDuplicates: true });
  }
  async createCategories(rows: Array<{ slug: string; name: string; sourceTag: string }>): Promise<void> {
    for (let i = 0; i < rows.length; i += 500) await this.prisma.v3TaxonomyCategory.createMany({ data: rows.slice(i, i + 500), skipDuplicates: true });
  }
  async createLinks(rows: Array<{ family: string; category: string; sortOrder: number }>): Promise<void> {
    if (!rows.length) return;
    const [fam, cat] = await Promise.all([this.prisma.v3TaxonomyFamily.findMany({ select: { id: true, slug: true } }), this.prisma.v3TaxonomyCategory.findMany({ select: { id: true, slug: true } })]);
    const f = new Map(fam.map((x) => [x.slug, x.id] as const)); const c = new Map(cat.map((x) => [x.slug, x.id] as const));
    const data = rows.map((r) => {
      const familyId = f.get(r.family); const categoryId = c.get(r.category);
      if (!familyId || !categoryId) throw new Error(`link ${r.family}|${r.category} has no parent`);
      return { familyId, categoryId, sortOrder: r.sortOrder };
    });
    for (let i = 0; i < data.length; i += 500) await this.prisma.v3TaxonomyFamilyCategory.createMany({ data: data.slice(i, i + 500), skipDuplicates: true });
  }
  async createRelated(rows: Array<{ a: string; b: string; reason: string }>): Promise<void> {
    if (!rows.length) return;
    const fam = await this.prisma.v3TaxonomyFamily.findMany({ select: { id: true, slug: true } });
    const f = new Map(fam.map((x) => [x.slug, x.id] as const));
    const data = rows.map((r) => {
      const x = f.get(r.a); const y = f.get(r.b);
      if (!x || !y) throw new Error(`related pair ${r.a}|${r.b} has no parent`);
      const [familyAId, familyBId] = x < y ? [x, y] : [y, x];   // the CHECK in the migration wants the smaller id first
      return { familyAId, familyBId, reason: r.reason };
    });
    await this.prisma.v3TaxonomyRelatedFamily.createMany({ data, skipDuplicates: true });
  }
  async createLegacyMaps(rows: Array<{ legacyKey: string; category: string; kind: LegacyMatch['kind']; sourceTag: string }>): Promise<void> {
    if (!rows.length) return;
    const cat = await this.prisma.v3TaxonomyCategory.findMany({ select: { id: true, slug: true } });
    const c = new Map(cat.map((x) => [x.slug, x.id] as const));
    const data = rows.map((r) => {
      const taxonomyCategoryId = c.get(r.category);
      if (!taxonomyCategoryId) throw new Error(`legacy map ${r.legacyKey} has no category ${r.category}`);
      return { legacyCategoryKey: r.legacyKey, taxonomyCategoryId, matchKind: r.kind, sourceTag: r.sourceTag };
    });
    await this.prisma.v3TaxonomyLegacyMap.createMany({ data, skipDuplicates: true });
  }
}
