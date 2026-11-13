import { AccessEntry, AccessRow, StorageAccessStore } from '../../src/v3-storage/storage.ports';

export class MemoryStorageAccess extends StorageAccessStore {
  rows: AccessRow[] = []; failNext = false;
  async record(e: AccessEntry, at: Date): Promise<void> { if (this.failNext) { this.failNext = false; throw new Error('log down'); } this.rows.push({ ...e, id: String(this.rows.length + 1), createdAt: at }); }
  async list(vendorId: string, skip: number, take: number) { const mine = this.rows.filter((r) => r.vendorId === vendorId); return { items: mine.slice(skip, skip + take), total: mine.length }; }
}
