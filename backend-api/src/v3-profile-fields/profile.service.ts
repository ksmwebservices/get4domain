import { Injectable, Optional } from '@nestjs/common';
import { Actor } from '../plans/admin/audit.service';
import { ActivityService } from '../v3-activity/activity.service';
import { PackEngineService } from '../v3-packs/pack-engine.service';
import { checkFieldDefs, isFieldKey } from '../v3-pack-records/core/record-core';
import { WebsiteService } from '../v3-website/website.service';
import { checkProfile, isProfileType, ProfileField, resolveSchema, SiteMapRow, SITE_SECTIONS, toSiteOps } from './core/profile-core';
import { profileError } from './profile.errors';
import { CategoryRef, ProfileFieldStore, ProfileValueStore } from './profile.store';

export interface SchemaView { category: string; pack: string; gated: boolean; fields: Array<{ key: string; label: string; type: string; required: boolean; options: string[]; siteSection: string; inherited: boolean }> }
export interface SaveResult { saved: true; fields: string[]; site: { written: string[]; skipped: Array<{ target: string; reason: string }> } }

/**
 * The industry profile of a business (Wave 2 Part E). The field set of a category is the pack's fields with the category's own on top (data, staff editable); the values are checked against it, kept as given, and mapped into the
 * site content through the map table. A counsel-gated pack (health, legal and finance) serves no fields and accepts no values while SUPER_ADMIN has not opened it. The vendor always comes from the verified principal.
 */
@Injectable()
export class ProfileFieldsService {
  constructor(
    private readonly fields: ProfileFieldStore, private readonly values: ProfileValueStore, private readonly packs: PackEngineService,
    @Optional() private readonly website?: WebsiteService, @Optional() private readonly activity?: ActivityService,
  ) {}

  private async category(slug: string): Promise<CategoryRef> {
    const c = await this.fields.categoryByKey(String(slug).slice(0, 80));
    if (!c) throw profileError('PROFILE_CATEGORY_UNKNOWN', 'That category was not found.');
    return c;
  }
  private async gated(packKey: string): Promise<boolean> { const g = await this.packs.packGate(packKey); return g.counselGated && !g.open; }
  private async resolved(c: CategoryRef): Promise<{ schema: ProfileField[]; maps: SiteMapRow[] }> {
    const [rows, maps] = await Promise.all([this.fields.listFields(), this.fields.listMaps()]);
    return { schema: resolveSchema(rows, c.packKey, c.categoryKey), maps };
  }

  /** What a form for this category asks. A gated pack answers with no fields and says so. */
  async schemaFor(slug: string): Promise<SchemaView> {
    const c = await this.category(slug);
    if (await this.gated(c.packKey)) return { category: c.categoryKey, pack: c.packKey, gated: true, fields: [] };
    const { schema } = await this.resolved(c);
    return { category: c.categoryKey, pack: c.packKey, gated: false, fields: schema.map((f) => ({ key: f.fieldKey, label: f.label, type: f.type, required: f.required, options: f.options, siteSection: f.siteSection, inherited: f.categorySlug === '' })) };
  }
  async schemaForVendor(vendorId: string): Promise<SchemaView> {
    const c = await this.fields.categoryOfVendor(vendorId);
    if (!c) throw profileError('PROFILE_NO_CATEGORY', 'Pick your business category first.');
    return this.schemaFor(c.categoryKey);
  }

  /** Checks values against a category BEFORE anything is created (create-on-behalf and the bulk import call this first). Returns the checked values. */
  async validateForCategory(slug: string, input: unknown, existing: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    const c = await this.category(slug);
    if (await this.gated(c.packKey)) throw profileError('PROFILE_GATED', 'This kind of business is not open for profile details yet.');
    const { schema } = await this.resolved(c);
    const r = checkProfile(schema, input, existing);
    if (!r.ok) throw profileError('PROFILE_INVALID', 'Some profile details need fixing.', { fields: r.errors });
    return r.value;
  }

  async mine(vendorId: string): Promise<{ values: Record<string, unknown> }> { return { values: await this.values.get(vendorId) }; }

  /** Saves values for a business: checks them, keeps them, and writes what the map says into the site content. A site write the plan does not allow is reported, never silent, and does not undo the saved profile. */
  async save(vendorId: string, actor: Actor, input: unknown): Promise<SaveResult> {
    const c = await this.fields.categoryOfVendor(vendorId);
    if (!c) throw profileError('PROFILE_NO_CATEGORY', 'Pick your business category first.');
    const existing = await this.values.get(vendorId);
    const value = await this.validateForCategory(c.categoryKey, input, existing);
    await this.values.replace(vendorId, value, { type: actor.type, id: actor.id });
    const { schema, maps } = await this.resolved(c);
    const sent = new Set(Object.keys((input ?? {}) as Record<string, unknown>));
    const ops = toSiteOps(schema, maps, value, c.packKey, c.categoryKey).filter((op) => op.kind === 'list' || sent.size > 0);
    const written: string[] = []; const skipped: Array<{ target: string; reason: string }> = [];
    for (const op of ops) {
      const target = op.kind === 'field' ? op.key : `list:${op.name}`;
      if (!this.website) { skipped.push({ target, reason: 'WEBSITE_NOT_AVAILABLE' }); continue; }
      try { await this.website.save(vendorId, actor, op.kind === 'field' ? { kind: 'field', key: op.key, value: op.value } : { kind: 'list', name: op.name, items: op.items }); written.push(target); }
      catch (e) { skipped.push({ target, reason: String((e as { getResponse?: () => { code?: string } }).getResponse?.()?.code ?? 'REFUSED') }); }
    }
    if (actor.type === 'STAFF') await this.activity?.record({ vendorId, actor: { type: actor.type, id: actor.id, ip: actor.ip ?? null }, actionKey: 'profile.saved_on_behalf', entityType: 'profile', entityId: vendorId, summary: { fields: sent.size, written: written.length, skipped: skipped.length } });
    return { saved: true, fields: Object.keys(value), site: { written, skipped } };
  }

  async saveForListing(seededSiteId: string, actor: Actor, input: unknown): Promise<SaveResult> {
    const vendorId = await this.values.vendorOfListing(String(seededSiteId).slice(0, 64));
    if (!vendorId) throw profileError('PROFILE_LISTING_NOT_FOUND', 'That listing was not found.');
    return this.save(vendorId, actor, input);
  }
  async forListing(seededSiteId: string): Promise<{ values: Record<string, unknown> }> {
    const vendorId = await this.values.vendorOfListing(String(seededSiteId).slice(0, 64));
    if (!vendorId) throw profileError('PROFILE_LISTING_NOT_FOUND', 'That listing was not found.');
    return this.mine(vendorId);
  }

  // ── staff edits (ADMIN and SUPER_ADMIN; the role is data in admin-role-matrix.ts) ──
  async listAll(packKey?: string): Promise<{ fields: ProfileField[]; maps: SiteMapRow[] }> {
    const [f, m] = await Promise.all([this.fields.listFields(), this.fields.listMaps()]);
    return { fields: packKey ? f.filter((x) => x.packKey === packKey) : f, maps: packKey ? m.filter((x) => x.packKey === packKey || x.packKey === '') : m };
  }
  async editField(input: { packKey?: unknown; categorySlug?: unknown; fieldKey?: unknown; label?: unknown; type?: unknown; required?: unknown; options?: unknown; sortOrder?: unknown; siteSection?: unknown; active?: unknown }, staff: { id: string | null; ip: string | null }): Promise<ProfileField> {
    const errors: Record<string, string> = {};
    const packKey = typeof input.packKey === 'string' ? input.packKey : ''; const categorySlug = typeof input.categorySlug === 'string' ? input.categorySlug : '';
    if (!(await this.knownPack(packKey))) errors.packKey = 'Pick one of the packs.';
    if (categorySlug !== '') { const c = await this.fields.categoryByKey(categorySlug); if (!c || c.packKey !== packKey) errors.categorySlug = 'That category is not in this pack.'; }
    if (!isFieldKey(input.fieldKey)) errors.fieldKey = 'Use lower case letters, digits and underscores.';
    if (!isProfileType(input.type)) errors.type = 'Pick a field type from the list.';
    const defs = checkFieldDefs([{ key: input.fieldKey, label: input.label, type: isProfileType(input.type) && !['textlist', 'servicelist', 'imagelist'].includes(input.type) ? input.type : 'text', options: input.options }]);
    for (const d of defs) errors._ = [errors._, d].filter(Boolean).join(' ');
    const section = typeof input.siteSection === 'string' ? input.siteSection : 'details';
    if (!(SITE_SECTIONS as readonly string[]).includes(section)) errors.siteSection = 'Pick a site section from the list.';
    if (Object.keys(errors).length) throw profileError('PROFILE_FIELD_INVALID', 'The field needs fixing.', { fields: errors });
    const row: ProfileField = { packKey, categorySlug, fieldKey: input.fieldKey as string, label: String(input.label).trim(), type: input.type as ProfileField['type'], required: input.required === true, options: Array.isArray(input.options) ? input.options.map(String) : [], sortOrder: Number.isInteger(input.sortOrder) ? (input.sortOrder as number) : 500, siteSection: section, active: input.active !== false };
    await this.fields.upsertField(row, staff.id);
    await this.activity?.record({ vendorId: null, actor: { type: 'STAFF', id: staff.id, ip: staff.ip }, actionKey: 'profile.field_edited', entityType: 'profile_field', entityId: `${packKey}:${categorySlug}:${row.fieldKey}`, summary: { type: row.type, active: row.active, required: row.required } });
    return row;
  }
  async editMap(input: Partial<SiteMapRow>, staff: { id: string | null; ip: string | null }): Promise<SiteMapRow> {
    const errors: Record<string, string> = {};
    const packKey = typeof input.packKey === 'string' ? input.packKey : ''; const categorySlug = typeof input.categorySlug === 'string' ? input.categorySlug : '';
    if (packKey !== '' && !(await this.knownPack(packKey))) errors.packKey = 'Pick one of the packs.';
    if (categorySlug !== '' && packKey === '') errors.categorySlug = 'A category row also needs its pack.';
    if (!isFieldKey(input.fieldKey)) errors.fieldKey = 'Use lower case letters, digits and underscores.';
    if (input.targetKind !== 'FIELD' && input.targetKind !== 'LIST' && input.targetKind !== 'NONE') errors.targetKind = 'Pick FIELD, LIST or NONE.';
    if (input.targetKind === 'FIELD' && !/^[a-z]+\.[A-Za-z]+$/.test(String(input.targetKey ?? ''))) errors.targetKey = 'Name a site field such as about.text.';
    if (input.targetKind === 'LIST' && !['faqs', 'gallery', 'steps', 'trust', 'stats', 'team', 'credentials'].includes(String(input.targetKey ?? ''))) errors.targetKey = 'Name a site list such as credentials.';
    if (Object.keys(errors).length) throw profileError('PROFILE_FIELD_INVALID', 'The map row needs fixing.', { fields: errors });
    const row: SiteMapRow = { packKey, categorySlug, fieldKey: input.fieldKey as string, targetKind: input.targetKind as SiteMapRow['targetKind'], targetKey: input.targetKind === 'NONE' ? '' : String(input.targetKey), itemMap: input.itemMap && typeof input.itemMap === 'object' && !Array.isArray(input.itemMap) ? input.itemMap : {}, active: input.active !== false };
    await this.fields.upsertMap(row, staff.id);
    await this.activity?.record({ vendorId: null, actor: { type: 'STAFF', id: staff.id, ip: staff.ip }, actionKey: 'profile.map_edited', entityType: 'profile_map', entityId: `${packKey}:${categorySlug}:${row.fieldKey}`, summary: { kind: row.targetKind, target: row.targetKey } });
    return row;
  }
  private async knownPack(packKey: string): Promise<boolean> { return (await this.fields.listFields()).some((f) => f.packKey === packKey); }
}
