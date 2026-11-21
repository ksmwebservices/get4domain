import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isProfileType, MAP_KINDS, ProfileField, SiteMapRow } from './core/profile-core';
import { CategoryRef, OfferingsPort, ProfileFieldStore, ProfileValueStore } from './profile.store';

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

@Injectable()
export class PrismaProfileFieldStore extends ProfileFieldStore {
  constructor(private readonly prisma: PrismaService) { super(); }

  async listFields(): Promise<ProfileField[]> {
    const rows = await this.prisma.v3CategoryProfileField.findMany({ orderBy: [{ packKey: 'asc' }, { categorySlug: 'asc' }, { sortOrder: 'asc' }] });
    return rows.filter((r) => isProfileType(r.type)).map((r) => ({ packKey: r.packKey, categorySlug: r.categorySlug, fieldKey: r.fieldKey, label: r.label, type: r.type as ProfileField['type'], required: r.required, options: strings(r.options), sortOrder: r.sortOrder, siteSection: r.siteSection, active: r.active }));
  }
  async listMaps(): Promise<SiteMapRow[]> {
    const rows = await this.prisma.v3ProfileSiteMap.findMany();
    return rows.filter((r) => (MAP_KINDS as readonly string[]).includes(r.targetKind)).map((r) => ({ packKey: r.packKey, categorySlug: r.categorySlug, fieldKey: r.fieldKey, targetKind: r.targetKind as SiteMapRow['targetKind'], targetKey: r.targetKey, itemMap: obj(r.itemMap), active: r.active }));
  }
  async createFields(rows: ProfileField[]): Promise<void> {
    if (rows.length === 0) return;
    await this.prisma.v3CategoryProfileField.createMany({ data: rows.map((r) => ({ ...r, options: r.options as Prisma.InputJsonValue })), skipDuplicates: true });
  }
  async createMaps(rows: SiteMapRow[]): Promise<void> {
    if (rows.length === 0) return;
    await this.prisma.v3ProfileSiteMap.createMany({ data: rows.map((r) => ({ ...r, itemMap: r.itemMap as Prisma.InputJsonValue })), skipDuplicates: true });
  }
  async upsertField(row: ProfileField, staffId: string | null): Promise<ProfileField> {
    const data = { label: row.label, type: row.type, required: row.required, options: row.options as Prisma.InputJsonValue, sortOrder: row.sortOrder, siteSection: row.siteSection, active: row.active, updatedByStaffId: staffId };
    await this.prisma.v3CategoryProfileField.upsert({ where: { packKey_categorySlug_fieldKey: { packKey: row.packKey, categorySlug: row.categorySlug, fieldKey: row.fieldKey } }, update: data, create: { packKey: row.packKey, categorySlug: row.categorySlug, fieldKey: row.fieldKey, ...data } });
    return row;
  }
  async upsertMap(row: SiteMapRow, staffId: string | null): Promise<SiteMapRow> {
    const data = { targetKind: row.targetKind, targetKey: row.targetKey, itemMap: row.itemMap as Prisma.InputJsonValue, active: row.active, updatedByStaffId: staffId };
    await this.prisma.v3ProfileSiteMap.upsert({ where: { packKey_categorySlug_fieldKey: { packKey: row.packKey, categorySlug: row.categorySlug, fieldKey: row.fieldKey } }, update: data, create: { packKey: row.packKey, categorySlug: row.categorySlug, fieldKey: row.fieldKey, ...data } });
    return row;
  }
  async categoryByKey(categoryKey: string): Promise<CategoryRef | null> {
    const r = await this.prisma.v3PackCategory.findUnique({ where: { categoryKey }, select: { categoryKey: true, packKey: true } });
    return r ?? null;
  }
  async categoryOfVendor(vendorId: string): Promise<CategoryRef | null> {
    const r = await this.prisma.v3VendorPack.findFirst({ where: { vendorId }, select: { categoryKey: true, packKey: true } });
    return r ?? null;
  }
}

@Injectable()
export class PrismaProfileValueStore extends ProfileValueStore {
  constructor(private readonly prisma: PrismaService) { super(); }
  async get(vendorId: string): Promise<Record<string, unknown>> {
    const rows = await this.prisma.v3VendorProfileValue.findMany({ where: { vendorId } });
    return Object.fromEntries(rows.map((r) => [r.fieldKey, r.valueJson]));
  }
  async replace(vendorId: string, values: Record<string, unknown>, by: { type: string; id: string | null }): Promise<void> {
    const keys = Object.keys(values);
    await this.prisma.$transaction([
      this.prisma.v3VendorProfileValue.deleteMany({ where: { vendorId, fieldKey: { notIn: keys } } }),
      ...keys.map((fieldKey) => this.prisma.v3VendorProfileValue.upsert({
        where: { vendorId_fieldKey: { vendorId, fieldKey } }, update: { valueJson: values[fieldKey] as Prisma.InputJsonValue, updatedByType: by.type, updatedById: by.id },
        create: { vendorId, fieldKey, valueJson: values[fieldKey] as Prisma.InputJsonValue, updatedByType: by.type, updatedById: by.id },
      })),
    ]);
  }
  async vendorOfListing(seededSiteId: string): Promise<string | null> {
    const r = await this.prisma.v3SeededSite.findUnique({ where: { id: seededSiteId }, select: { vendorId: true, lifecycle: true } });
    return r && r.lifecycle !== 'REMOVED' ? r.vendorId : null;
  }
}

const key = (n: string): string => n.toLowerCase().replace(/\s+/g, ' ').trim();
const SOURCE = 'profile';
const sourceOf = (cf: unknown): string | null => (cf && typeof cf === 'object' && !Array.isArray(cf) ? ((cf as Record<string, unknown>).source as string | undefined) ?? null : null);

@Injectable()
export class PrismaOfferingsPort extends OfferingsPort {
  constructor(private readonly prisma: PrismaService) { super(); }
  async sync(vendorId: string, items: ReadonlyArray<{ name: string; description?: string }>): Promise<{ created: number; updated: number; retired: number }> {
    const have = await this.prisma.vendorProduct.findMany({ where: { vendorId }, select: { id: true, name: true, description: true, active: true, customFields: true } });
    const byKey = new Map(have.map((h) => [key(h.name), h] as const)); const wanted = new Set(items.map((i) => key(i.name)));
    const ops: Prisma.PrismaPromise<unknown>[] = []; let created = 0; let updated = 0; let retired = 0;
    for (const it of items) {
      const h = byKey.get(key(it.name));
      if (!h) { created += 1; ops.push(this.prisma.vendorProduct.create({ data: { vendorId, name: it.name, description: it.description ?? null, price: null, active: true, customFields: { source: SOURCE } } })); continue; }
      if (sourceOf(h.customFields) !== SOURCE) continue;   // the vendor's own service: never touched
      if (!h.active || (it.description !== undefined && it.description !== h.description)) { updated += 1; ops.push(this.prisma.vendorProduct.update({ where: { id: h.id }, data: { active: true, ...(it.description !== undefined ? { description: it.description } : {}) } })); }
    }
    for (const h of have) if (sourceOf(h.customFields) === SOURCE && h.active && !wanted.has(key(h.name))) { retired += 1; ops.push(this.prisma.vendorProduct.update({ where: { id: h.id }, data: { active: false } })); }
    if (ops.length) await this.prisma.$transaction(ops);
    return { created, updated, retired };
  }
}
