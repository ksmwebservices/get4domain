import { Injectable, Optional } from '@nestjs/common';
import { ActivityService } from '../v3-activity/activity.service';
import { PackEngineService } from '../v3-packs/pack-engine.service';
import { checkFieldDefs, FieldDef, FIELD_TYPES, isFieldKey, isFieldType, LIMITS } from './core/record-core';
import { recordError } from './pack-records.errors';
import { PackRecordStore, PackTabFieldStore } from './pack-records.store';
import { COMMON_WITH_OWN_CONTRACT } from './seed/tab-field-seed';

export interface FieldEditInput { ownerKey?: unknown; tabKey?: unknown; fieldKey?: unknown; label?: unknown; type?: unknown; required?: unknown; options?: unknown; sortOrder?: unknown; listColumn?: unknown; searchable?: unknown; active?: unknown }
export type TabFieldView = FieldDef & { active: boolean };

/**
 * Staff edit the record fields of a pack tab (Wave 2 Part G). ADMIN and SUPER_ADMIN, audited; who may call it is data in admin-role-matrix.ts. The tab must be a real record tab (a seeded pack, capability or add-on
 * tab; a COMMON tab with its own contract has none). Nothing is ever deleted: `active: false` hides a field and every record keeps its value. A field's TYPE is not changed once any business has records on the tab
 * (the stored values would no longer fit it); a hidden field can be shown again. At most one status field and at most 40 fields a tab.
 */
@Injectable()
export class PackTabFieldsAdminService {
  constructor(private readonly fields: PackTabFieldStore, private readonly records: PackRecordStore, private readonly packs: PackEngineService, @Optional() private readonly activity?: ActivityService) {}

  private async mustBeRecordTab(ownerKey: string, tabKey: string): Promise<void> {
    const tabs = await this.packs.adminTabs();
    const t = tabs.find((x) => x.ownerKey === ownerKey && x.key === tabKey);
    if (!t || (t.scope === 'COMMON' && COMMON_WITH_OWN_CONTRACT.has(t.key))) throw recordError(404, 'PACK_TAB_UNKNOWN', 'That tab does not keep records.');
  }

  async list(ownerKey: string, tabKey: string): Promise<{ ownerKey: string; tabKey: string; types: readonly string[]; fields: TabFieldView[] }> {
    await this.mustBeRecordTab(ownerKey, tabKey);
    return { ownerKey, tabKey, types: FIELD_TYPES, fields: (await this.fields.listForTab(ownerKey, tabKey)).sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key)) };
  }

  async edit(input: FieldEditInput, staff: { id: string | null; ip: string | null }): Promise<TabFieldView> {
    const ownerKey = typeof input.ownerKey === 'string' ? input.ownerKey : ''; const tabKey = typeof input.tabKey === 'string' ? input.tabKey : '';
    await this.mustBeRecordTab(ownerKey, tabKey);
    const errors: Record<string, string> = {};
    if (!isFieldKey(input.fieldKey)) errors.fieldKey = 'Use lower case letters, digits and underscores, starting with a letter.';
    if (!isFieldType(input.type)) errors.type = 'Pick a field type from the list.';
    const options = Array.isArray(input.options) ? input.options.map((o) => (typeof o === 'string' ? o.trim() : '')) : [];
    for (const p of checkFieldDefs([{ key: input.fieldKey, label: input.label, type: input.type, options }])) errors._ = [errors._, p].filter(Boolean).join(' ');
    if (input.sortOrder !== undefined && (!Number.isInteger(input.sortOrder) || (input.sortOrder as number) < 0 || (input.sortOrder as number) > 100_000)) errors.sortOrder = 'The order is a whole number from 0 to 100000.';
    for (const k of ['required', 'listColumn', 'searchable', 'active'] as const) if (input[k] !== undefined && typeof input[k] !== 'boolean') errors[k] = 'Yes or no.';
    if (Object.keys(errors).length) throw recordError(400, 'PACK_FIELD_INVALID', 'The field needs fixing.', { details: { fields: errors } });
    const key = input.fieldKey as string; const type = input.type as FieldDef['type'];
    const have = await this.fields.listForTab(ownerKey, tabKey); const current = have.find((f) => f.key === key);
    const active = input.active !== false;
    if (current && current.type !== type && (await this.records.countInTab(ownerKey, tabKey)) > 0) throw recordError(409, 'PACK_FIELD_IN_USE', 'Businesses already keep records on this tab, so a field\'s type cannot change. Hide the field and add a new one instead.');
    const others = have.filter((f) => f.key !== key && f.active);
    if (active && others.length + 1 > LIMITS.fieldsPerTab) throw recordError(400, 'PACK_FIELD_INVALID', `A tab has at most ${LIMITS.fieldsPerTab} fields.`, { details: { fields: { _: `A tab has at most ${LIMITS.fieldsPerTab} fields.` } } });
    if (active && type === 'status' && others.some((f) => f.type === 'status')) throw recordError(400, 'PACK_FIELD_INVALID', 'A tab has one status field.', { details: { fields: { type: 'A tab has one status field.' } } });
    const row = {
      ownerKey, tabKey, fieldKey: key, label: String(input.label).trim(), type, required: input.required === true, options: type === 'select' || type === 'multiselect' ? options : [],
      sortOrder: input.sortOrder === undefined ? (current?.sortOrder ?? (have.length + 1) * 10) : (input.sortOrder as number),
      listColumn: input.listColumn === undefined ? (current?.listColumn ?? false) : input.listColumn === true, searchable: input.searchable === undefined ? (current?.searchable ?? false) : input.searchable === true, active,
    };
    await this.fields.upsertField(row, staff.id);
    await this.activity?.record({ vendorId: null, actor: { type: 'STAFF', id: staff.id, ip: staff.ip }, actionKey: 'pack.tab_field_edited', entityType: 'pack_tab_field', entityId: `${ownerKey}:${tabKey}:${key}`, summary: { type, required: row.required, active, created: !current } });
    return { key, label: row.label, type, required: row.required, options: row.options, sortOrder: row.sortOrder, listColumn: row.listColumn, searchable: row.searchable, active };
  }
}
