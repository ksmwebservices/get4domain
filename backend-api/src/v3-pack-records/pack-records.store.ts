import { FieldDef, RecordStatus } from './core/record-core';
import { SeedField } from './seed/tab-field-seed';

export interface StoredRecord {
  id: string; vendorId: string; packKey: string; tabKey: string; data: Record<string, unknown>; status: RecordStatus; createdByType: string; createdById: string | null; updatedById: string | null;
  createdAt: Date; updatedAt: Date; deletedAt: Date | null;
}
export interface RecordQuery { q: string; status: RecordStatus | null; archived: boolean; skip: number; take: number }
export interface WhoWrote { type: string; id: string | null }

/** Platform data: the field list of each tab. No vendor id. */
export abstract class PackTabFieldStore {
  /** The ACTIVE fields of one tab, in order. Empty when the tab has no record store. */
  abstract listFields(ownerKey: string, tabKey: string): Promise<FieldDef[]>;
  abstract listAll(): Promise<Array<{ ownerKey: string; tabKey: string; fieldKey: string }>>;
  /** Every field of one tab, active or not (the staff edit screen). */
  abstract listForTab(ownerKey: string, tabKey: string): Promise<Array<FieldDef & { active: boolean }>>;
  /** Staff edit: add or change one field by its three-part key. Nothing is ever deleted: `active: false` hides a field. */
  abstract upsertField(row: SeedField & { active: boolean }, staffId: string | null): Promise<void>;
  /** Creates the rows that are missing; a row that exists is never touched. */
  abstract createFields(rows: SeedField[]): Promise<void>;
}

/** Tenant data: every method names the vendor, and the vendor is part of every where clause. */
export abstract class PackRecordStore {
  abstract list(vendorId: string, packKey: string, tabKey: string, q: RecordQuery): Promise<{ items: StoredRecord[]; total: number }>;
  abstract get(vendorId: string, packKey: string, tabKey: string, id: string): Promise<StoredRecord | null>;
  /** How many records exist in a tab across every business (archived ones included): a field's type is not changed once any exist. */
  abstract countInTab(packKey: string, tabKey: string): Promise<number>;
  abstract create(vendorId: string, packKey: string, tabKey: string, row: { data: Record<string, unknown>; searchText: string; status: RecordStatus }, by: WhoWrote): Promise<StoredRecord>;
  /** Null when the record is not this vendor's, is archived, or does not exist. */
  abstract update(vendorId: string, packKey: string, tabKey: string, id: string, patch: { data?: Record<string, unknown>; searchText?: string; status?: RecordStatus }, by: WhoWrote): Promise<StoredRecord | null>;
  abstract setArchived(vendorId: string, packKey: string, tabKey: string, id: string, archived: boolean, by: WhoWrote): Promise<StoredRecord | null>;
}
