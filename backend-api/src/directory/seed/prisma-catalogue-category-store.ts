import { PrismaClient } from '@prisma/client';
import { CatalogueCategoryRow, CatalogueCategoryStore } from './catalogue-category-loader';

/** The Prisma implementation of the catalogue category store. Used only by scripts/seed-v3-catalogue-categories.js (staging guard) and the staging tests. Create only. */
export class PrismaCatalogueCategoryStore implements CatalogueCategoryStore {
  constructor(private readonly prisma: PrismaClient) {}

  async listCategories(): Promise<CatalogueCategoryRow[]> {
    return (await this.prisma.v3DirectoryCategory.findMany({ select: { id: true, slug: true, parentId: true, name: true } }));
  }
  async createCategory(d: { parentId: string | null; name: string; slug: string; themeCategoryId: string | null; family: string | null; sortOrder: number }): Promise<string> {
    return (await this.prisma.v3DirectoryCategory.create({ data: { parentId: d.parentId, parentKey: d.parentId ?? 'ROOT', name: d.name, slug: d.slug, themeCategoryId: d.themeCategoryId, family: d.family, sortOrder: d.sortOrder, proposed: true }, select: { id: true } })).id;
  }
}
