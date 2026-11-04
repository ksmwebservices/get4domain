import { PrismaClient } from '@prisma/client';
import { DirectorySeedStore } from './seed-applier';

/** The Prisma implementation of the seed store. Used only by scripts/seed-v3-directory.js (staging guard) and the staging tests. */
export class PrismaDirectorySeedStore implements DirectorySeedStore {
  constructor(private readonly prisma: PrismaClient) {}

  async findLocation(parentKey: string, slug: string) {
    const r = await this.prisma.v3DirectoryLocation.findUnique({ where: { parentKey_slug: { parentKey, slug } } });
    return r ? { id: r.id, name: r.name, sortOrder: r.sortOrder, proposed: r.proposed } : null;
  }
  async createLocation(d: { parentId: string | null; parentKey: string; kind: string; name: string; slug: string; sortOrder: number; proposed: boolean }): Promise<string> {
    return (await this.prisma.v3DirectoryLocation.create({ data: { parentId: d.parentId, parentKey: d.parentId ?? 'ROOT', kind: d.kind as 'STATE' | 'DISTRICT' | 'CITY', name: d.name, slug: d.slug, sortOrder: d.sortOrder, proposed: d.proposed } })).id;
  }
  async updateLocation(id: string, d: { name: string; sortOrder: number }): Promise<void> { await this.prisma.v3DirectoryLocation.update({ where: { id }, data: d }); }

  async findCategory(parentKey: string, slug: string) {
    const r = await this.prisma.v3DirectoryCategory.findUnique({ where: { parentKey_slug: { parentKey, slug } } });
    return r ? { id: r.id, name: r.name, themeCategoryId: r.themeCategoryId, family: r.family, sortOrder: r.sortOrder, proposed: r.proposed } : null;
  }
  async createCategory(d: { parentId: string | null; parentKey: string; name: string; slug: string; themeCategoryId: string | null; family: string | null; sortOrder: number; proposed: boolean }): Promise<string> {
    return (await this.prisma.v3DirectoryCategory.create({ data: { parentId: d.parentId, parentKey: d.parentId ?? 'ROOT', name: d.name, slug: d.slug, themeCategoryId: d.themeCategoryId, family: d.family, sortOrder: d.sortOrder, proposed: d.proposed } })).id;
  }
  async updateCategory(id: string, d: { name: string; themeCategoryId: string | null; family: string | null; sortOrder: number }): Promise<void> { await this.prisma.v3DirectoryCategory.update({ where: { id }, data: d }); }
}
