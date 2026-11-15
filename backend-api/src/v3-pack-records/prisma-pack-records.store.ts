import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FieldDef, isFieldType, isRecordStatus, RecordStatus } from './core/record-core';
import { SeedField } from './seed/tab-field-seed';
import { PackRecordStore, PackTabFieldStore, RecordQuery, StoredRecord, WhoWrote } from './pack-records.store';

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

@Injectable()
export class PrismaPackTabFieldStore extends PackTabFieldStore {
  constructor(private readonly prisma: PrismaService) { super(); }

  async listFields(ownerKey: string, tabKey: string): Promise<FieldDef[]> {
    const rows = await this.prisma.v3PackTabField.findMany({ where: { ownerKey, tabKey, active: true }, orderBy: [{ sortOrder: 'asc' }, { fieldKey: 'asc' }] });
    return rows.filter((r) => isFieldType(r.type)).map((r) => ({ key: r.fieldKey, label: r.label, type: r.type as FieldDef['type'], required: r.required, options: strings(r.options), sortOrder: r.sortOrder, listColumn: r.listColumn, searchable: r.searchable }));
  }
  async listAll(): Promise<Array<{ ownerKey: string; tabKey: string; fieldKey: string }>> {
    return this.prisma.v3PackTabField.findMany({ select: { ownerKey: true, tabKey: true, fieldKey: true } });
  }
  async createFields(rows: SeedField[]): Promise<void> {
    if (rows.length === 0) return;
    await this.prisma.v3PackTabField.createMany({
      data: rows.map((r) => ({ ownerKey: r.ownerKey, tabKey: r.tabKey, fieldKey: r.fieldKey, label: r.label, type: r.type, required: r.required, options: r.options as Prisma.InputJsonValue, sortOrder: r.sortOrder, listColumn: r.listColumn, searchable: r.searchable })),
      skipDuplicates: true,
    });
  }
}

type Row = { id: string; vendorId: string; packKey: string; tabKey: string; data: unknown; status: string; createdByType: string; createdById: string | null; updatedById: string | null; createdAt: Date; updatedAt: Date; deletedAt: Date | null };
const shape = (r: Row): StoredRecord => ({
  id: r.id, vendorId: r.vendorId, packKey: r.packKey, tabKey: r.tabKey, data: obj(r.data), status: isRecordStatus(r.status) ? r.status : 'OPEN', createdByType: r.createdByType, createdById: r.createdById,
  updatedById: r.updatedById, createdAt: r.createdAt, updatedAt: r.updatedAt, deletedAt: r.deletedAt,
});

@Injectable()
export class PrismaPackRecordStore extends PackRecordStore {
  constructor(private readonly prisma: PrismaService) { super(); }

  async list(vendorId: string, packKey: string, tabKey: string, q: RecordQuery): Promise<{ items: StoredRecord[]; total: number }> {
    const where: Prisma.V3PackRecordWhereInput = {
      vendorId, packKey, tabKey, deletedAt: q.archived ? { not: null } : null, ...(q.status ? { status: q.status } : {}), ...(q.q ? { searchText: { contains: q.q } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.v3PackRecord.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: q.skip, take: q.take }),
      this.prisma.v3PackRecord.count({ where }),
    ]);
    return { items: items.map(shape), total };
  }
  async get(vendorId: string, packKey: string, tabKey: string, id: string): Promise<StoredRecord | null> {
    const r = await this.prisma.v3PackRecord.findFirst({ where: { id, vendorId, packKey, tabKey } });
    return r ? shape(r) : null;
  }
  async create(vendorId: string, packKey: string, tabKey: string, row: { data: Record<string, unknown>; searchText: string; status: RecordStatus }, by: WhoWrote): Promise<StoredRecord> {
    return shape(await this.prisma.v3PackRecord.create({
      data: { vendorId, packKey, tabKey, data: row.data as Prisma.InputJsonValue, searchText: row.searchText, status: row.status, createdByType: by.type, createdById: by.id, updatedById: by.id },
    }));
  }
  async update(vendorId: string, packKey: string, tabKey: string, id: string, patch: { data?: Record<string, unknown>; searchText?: string; status?: RecordStatus }, by: WhoWrote): Promise<StoredRecord | null> {
    const res = await this.prisma.v3PackRecord.updateMany({
      where: { id, vendorId, packKey, tabKey, deletedAt: null },
      data: { ...(patch.data ? { data: patch.data as Prisma.InputJsonValue } : {}), ...(patch.searchText !== undefined ? { searchText: patch.searchText } : {}), ...(patch.status ? { status: patch.status } : {}), updatedById: by.id },
    });
    return res.count === 1 ? this.get(vendorId, packKey, tabKey, id) : null;
  }
  async setArchived(vendorId: string, packKey: string, tabKey: string, id: string, archived: boolean, by: WhoWrote): Promise<StoredRecord | null> {
    const res = await this.prisma.v3PackRecord.updateMany({ where: { id, vendorId, packKey, tabKey }, data: { deletedAt: archived ? new Date() : null, updatedById: by.id } });
    return res.count === 1 ? this.get(vendorId, packKey, tabKey, id) : null;
  }
}
