import { FieldDef } from '../../src/v3-pack-records/core/record-core';
import { PackRecordStore, PackTabFieldStore, RecordQuery, StoredRecord, WhoWrote } from '../../src/v3-pack-records/pack-records.store';
import { buildFieldSeed, SeedField } from '../../src/v3-pack-records/seed/tab-field-seed';

/** An in-memory field store with the same contract as the Prisma one. */
export class MemoryFieldStore extends PackTabFieldStore {
  rows = new Map<string, SeedField>();
  async listFields(ownerKey: string, tabKey: string): Promise<FieldDef[]> {
    return [...this.rows.values()].filter((r) => r.ownerKey === ownerKey && r.tabKey === tabKey && (r as { active?: boolean }).active !== false).sort((a, b) => a.sortOrder - b.sortOrder)
      .map((r) => ({ key: r.fieldKey, label: r.label, type: r.type, required: r.required, options: r.options, sortOrder: r.sortOrder, listColumn: r.listColumn, searchable: r.searchable }));
  }
  async listForTab(ownerKey: string, tabKey: string) { return [...this.rows.values()].filter((r) => r.ownerKey === ownerKey && r.tabKey === tabKey).sort((a, b) => a.sortOrder - b.sortOrder).map((r) => ({ key: r.fieldKey, label: r.label, type: r.type, required: r.required, options: r.options, sortOrder: r.sortOrder, listColumn: r.listColumn, searchable: r.searchable, active: (r as { active?: boolean }).active !== false })); }
  async upsertField(row: SeedField & { active: boolean }) { this.rows.set(`${row.ownerKey}|${row.tabKey}|${row.fieldKey}`, row as never); }
  async listAll(): Promise<Array<{ ownerKey: string; tabKey: string; fieldKey: string }>> { return [...this.rows.values()].map((r) => ({ ownerKey: r.ownerKey, tabKey: r.tabKey, fieldKey: r.fieldKey })); }
  async createFields(rows: SeedField[]): Promise<void> { for (const r of rows) { const k = `${r.ownerKey}|${r.tabKey}|${r.fieldKey}`; if (!this.rows.has(k)) this.rows.set(k, r); } }
}

/** The real seed loaded into the memory field store. */
export function seededFieldStore(tabs: ReadonlyArray<{ scope: string; ownerKey: string; key: string }>): MemoryFieldStore {
  const s = new MemoryFieldStore();
  for (const f of buildFieldSeed(tabs).fields) s.rows.set(`${f.ownerKey}|${f.tabKey}|${f.fieldKey}`, f);
  return s;
}

/** An in-memory record store: every method takes the vendor and keeps one vendor's rows apart from another's, as the Prisma store does. */
export class MemoryRecordStore extends PackRecordStore {
  rows = new Map<string, StoredRecord>(); private n = 0;
  async list(vendorId: string, packKey: string, tabKey: string, q: RecordQuery): Promise<{ items: StoredRecord[]; total: number }> {
    const all = [...this.rows.values()].filter((r) => r.vendorId === vendorId && r.packKey === packKey && r.tabKey === tabKey && (q.archived ? r.deletedAt !== null : r.deletedAt === null) && (!q.status || r.status === q.status)
      && (!q.q || JSON.stringify(r.data).toLowerCase().includes(q.q))).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id));
    return { items: all.slice(q.skip, q.skip + q.take), total: all.length };
  }
  async countInTab(packKey: string, tabKey: string) { return [...this.rows.values()].filter((r) => r.packKey === packKey && r.tabKey === tabKey).length; }
  async get(vendorId: string, packKey: string, tabKey: string, id: string): Promise<StoredRecord | null> {
    const r = this.rows.get(id); return r && r.vendorId === vendorId && r.packKey === packKey && r.tabKey === tabKey ? r : null;
  }
  async create(vendorId: string, packKey: string, tabKey: string, row: { data: Record<string, unknown>; searchText: string; status: StoredRecord['status'] }, by: WhoWrote): Promise<StoredRecord> {
    this.n += 1; const now = new Date(1_700_000_000_000 + this.n * 1000);
    const r: StoredRecord = { id: `rec_${String(this.n).padStart(8, '0')}`, vendorId, packKey, tabKey, data: row.data, status: row.status, createdByType: by.type, createdById: by.id, updatedById: by.id, createdAt: now, updatedAt: now, deletedAt: null };
    this.rows.set(r.id, r); return r;
  }
  async update(vendorId: string, packKey: string, tabKey: string, id: string, patch: { data?: Record<string, unknown>; status?: StoredRecord['status'] }, by: WhoWrote): Promise<StoredRecord | null> {
    const r = await this.get(vendorId, packKey, tabKey, id); if (!r || r.deletedAt) return null;
    const next = { ...r, ...(patch.data ? { data: patch.data } : {}), ...(patch.status ? { status: patch.status } : {}), updatedById: by.id, updatedAt: new Date(r.updatedAt.getTime() + 1000) };
    this.rows.set(id, next); return next;
  }
  async setArchived(vendorId: string, packKey: string, tabKey: string, id: string, archived: boolean, by: WhoWrote): Promise<StoredRecord | null> {
    const r = await this.get(vendorId, packKey, tabKey, id); if (!r) return null;
    const next = { ...r, deletedAt: archived ? new Date(0) : null, updatedById: by.id }; this.rows.set(id, next); return next;
  }
}
