import { Injectable } from '@nestjs/common';
import {
  checkRecord, cleanSearch, FieldDef, isRecordStatus, pageOf, RecordStatus, schemaView, searchTextOf, titleOf,
} from './core/record-core';
import { packError } from '../v3-packs/pack.errors';
import { recordError } from './pack-records.errors';
import { PackRecordStore, PackTabFieldStore, StoredRecord, WhoWrote } from './pack-records.store';

export interface RecordView {
  id: string; packKey: string; tabKey: string; title: string | null; status: RecordStatus; data: Record<string, unknown>; archived: boolean; createdAt: string; updatedAt: string;
}
/** What the guard found about the tab: a locked preview can be read but never written. */
export interface TabLock { locked: boolean; state?: string; reason?: string | null; needsTier?: string | null }
export interface ListInput { q?: string; status?: string; archived?: boolean; page?: number; pageSize?: number }

const view = (r: StoredRecord, fields: readonly FieldDef[]): RecordView => ({
  id: r.id, packKey: r.packKey, tabKey: r.tabKey, title: titleOf(fields, r.data), status: r.status, data: r.data, archived: r.deletedAt !== null, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
});

/**
 * The generic record store of a pack tab (Wave 2 Part A). The tab's field list is platform data; a record is checked against it on every write (unknown fields, wrong types, oversize values and markup are
 * refused; money is minor units before GST). Nothing is hard deleted: archive sets deletedAt and restore clears it. The vendor always comes from the verified principal, never from the URL or body.
 */
@Injectable()
export class PackRecordsService {
  constructor(private readonly fieldStore: PackTabFieldStore, private readonly records: PackRecordStore) {}

  /** The fields of a tab; a tab with none has no record store. */
  private async fieldsOf(ownerKey: string, tabKey: string): Promise<FieldDef[]> {
    const fields = await this.fieldStore.listFields(ownerKey, tabKey);
    if (fields.length === 0) throw recordError(404, 'PACK_TAB_NO_RECORDS', 'This part of the dashboard does not keep records.');
    return fields;
  }
  /** A write on a locked preview is refused here as well as in the guard (the service is the last word, whoever calls it). */
  private mustBeOpen(lock: TabLock): void {
    if (lock.locked) throw packError(403, 'TAB_LOCKED', 'This part of the dashboard is not open on your plan.', { state: lock.state, reason: lock.reason, needsTier: lock.needsTier });
  }

  async schema(ownerKey: string, tabKey: string, lock: TabLock): Promise<ReturnType<typeof schemaView> & { packKey: string; tabKey: string; locked: boolean }> {
    return { packKey: ownerKey, tabKey, locked: lock.locked, ...schemaView(await this.fieldsOf(ownerKey, tabKey)) };
  }

  async list(vendorId: string, ownerKey: string, tabKey: string, input: ListInput, lock: TabLock): Promise<{ items: RecordView[]; total: number; page: number; pageSize: number; locked: boolean; lock: TabLock }> {
    const fields = await this.fieldsOf(ownerKey, tabKey);
    const { page, pageSize, skip } = pageOf(input.page, input.pageSize);
    const status = input.status === undefined || input.status === '' ? null : isRecordStatus(input.status) ? input.status : null;
    if (input.status && status === null) throw recordError(400, 'PACK_RECORD_INVALID', 'Pick a status from the list.', { details: { fields: { status: 'Pick a status from the list.' } } });
    const r = await this.records.list(vendorId, ownerKey, tabKey, { q: cleanSearch(input.q), status, archived: input.archived === true, skip, take: pageSize });
    return { items: r.items.map((x) => view(x, fields)), total: r.total, page, pageSize, locked: lock.locked, lock };
  }

  async get(vendorId: string, ownerKey: string, tabKey: string, id: string): Promise<RecordView> {
    const fields = await this.fieldsOf(ownerKey, tabKey);
    const r = await this.records.get(vendorId, ownerKey, tabKey, id);
    if (!r) throw recordError(404, 'PACK_RECORD_NOT_FOUND', 'That record was not found.');
    return view(r, fields);
  }

  async create(vendorId: string, ownerKey: string, tabKey: string, body: { data?: unknown; status?: string }, by: WhoWrote, lock: TabLock): Promise<RecordView> {
    this.mustBeOpen(lock);
    const fields = await this.fieldsOf(ownerKey, tabKey);
    const c = checkRecord(fields, body.data ?? {});
    const status = this.statusOf(body.status, c.status);
    if (!c.ok) throw recordError(400, 'PACK_RECORD_INVALID', 'Some fields need fixing.', { details: { fields: c.errors } });
    const row = await this.records.create(vendorId, ownerKey, tabKey, { data: c.data, searchText: searchTextOf(fields, c.data), status: status ?? 'OPEN' }, by);
    return view(row, fields);
  }

  async update(vendorId: string, ownerKey: string, tabKey: string, id: string, body: { data?: unknown; status?: string }, by: WhoWrote, lock: TabLock): Promise<RecordView> {
    this.mustBeOpen(lock);
    const fields = await this.fieldsOf(ownerKey, tabKey);
    const current = await this.records.get(vendorId, ownerKey, tabKey, id);
    if (!current || current.deletedAt !== null) throw recordError(404, 'PACK_RECORD_NOT_FOUND', 'That record was not found.');
    const c = checkRecord(fields, body.data ?? {}, current.data);
    const status = this.statusOf(body.status, c.status);
    if (!c.ok) throw recordError(400, 'PACK_RECORD_INVALID', 'Some fields need fixing.', { details: { fields: c.errors } });
    const row = await this.records.update(vendorId, ownerKey, tabKey, id, { data: c.data, searchText: searchTextOf(fields, c.data), ...(status ? { status } : {}) }, by);
    if (!row) throw recordError(404, 'PACK_RECORD_NOT_FOUND', 'That record was not found.');
    return view(row, fields);
  }

  async archive(vendorId: string, ownerKey: string, tabKey: string, id: string, archived: boolean, by: WhoWrote, lock: TabLock): Promise<RecordView> {
    this.mustBeOpen(lock);
    const fields = await this.fieldsOf(ownerKey, tabKey);
    const row = await this.records.setArchived(vendorId, ownerKey, tabKey, id, archived, by);
    if (!row) throw recordError(404, 'PACK_RECORD_NOT_FOUND', 'That record was not found.');
    return view(row, fields);
  }

  private statusOf(sent: string | undefined, lifted: RecordStatus | null): RecordStatus | null {
    if (sent === undefined) return lifted;
    if (!isRecordStatus(sent)) throw recordError(400, 'PACK_RECORD_INVALID', 'Pick a status from the list.', { details: { fields: { status: 'Pick a status from the list.' } } });
    return sent;
  }
}
