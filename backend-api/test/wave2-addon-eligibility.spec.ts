import * as fs from 'fs';
import * as path from 'path';
import { HttpException } from '@nestjs/common';
import { effectiveRolesFor } from '../src/auth/guards/admin-role-matrix';
import { checkEligibilityEdit, ELIGIBILITY_SEED, eligibilityRuleBroken, GOODS_PACKS, isEligible } from '../src/v3-packs/core/addon-eligibility-core';
import { BUSINESS_ERROR_CODES } from '../src/v3-business/business.errors';
import { loadPackEngine } from '../src/v3-packs/seed/pack-seed';
import { makeEngine, MemoryRefStore, realSeed } from './support/pack-fakes';

/** Wave 2 Part H2: add-on eligibility as data. Which add-on packs a pack may buy; seeded, staff-editable (ADMIN and SUPER_ADMIN, audited); the owner's fixed rules hold whatever the rows say. */
jest.setTimeout(120_000);
const codeOf = async (p: Promise<unknown>): Promise<{ status: number; code?: string; problems?: string[] }> => {
  try { await p; } catch (e) { if (e instanceof HttpException) { const b = e.getResponse() as { code?: string; problems?: string[] }; return { status: e.getStatus(), code: b.code, problems: b.problems }; } throw e; }
  return { status: 0 };
};
const owner = (v: string) => ({ type: 'VENDOR' as const, id: v });
const staff = { type: 'STAFF' as const, id: 'staff-1' };
const keysOf = async (svc: { myAddons: (v: string) => Promise<Array<{ key: string }>> }, v: string): Promise<string[]> => (await svc.myAddons(v)).map((a) => a.key).sort();

describe('the fixed owner rules and the seed (pure)', () => {
  it('SHOP and ONLINE_ORDERING_DELIVERY are never for PHARMACY; PHARMACY_COUNTER is only for PHARMACY; HOME_SAMPLE_COLLECTION has no fixed rule', () => {
    expect(eligibilityRuleBroken('SHOP', 'PHARMACY')).toMatch(/never/); expect(eligibilityRuleBroken('ONLINE_ORDERING_DELIVERY', 'PHARMACY')).toMatch(/never/);
    expect(eligibilityRuleBroken('PHARMACY_COUNTER', 'CLINIC')).toMatch(/only for the pharmacy pack/); expect(eligibilityRuleBroken('PHARMACY_COUNTER', 'PHARMACY')).toBeNull();
    expect(eligibilityRuleBroken('HOME_SAMPLE_COLLECTION', 'LAB')).toBeNull(); expect(eligibilityRuleBroken('HOME_SAMPLE_COLLECTION', 'CLINIC')).toBeNull();   // the "direct" case is just another row
  });
  it('the seed is exactly: goods packs for the two goods add-ons, PHARMACY_COUNTER for PHARMACY, HOME_SAMPLE_COLLECTION for LAB, and nothing breaks a fixed rule', () => {
    expect(GOODS_PACKS).not.toContain('PHARMACY');
    expect(ELIGIBILITY_SEED).toHaveLength(GOODS_PACKS.length * 2 + 2);
    expect(ELIGIBILITY_SEED.filter((e) => e.addonKey === 'PHARMACY_COUNTER')).toEqual([{ addonKey: 'PHARMACY_COUNTER', packKey: 'PHARMACY' }]);
    expect(ELIGIBILITY_SEED.filter((e) => e.addonKey === 'HOME_SAMPLE_COLLECTION')).toEqual([{ addonKey: 'HOME_SAMPLE_COLLECTION', packKey: 'LAB' }]);
    expect(ELIGIBILITY_SEED.filter((e) => eligibilityRuleBroken(e.addonKey, e.packKey))).toEqual([]);
  });
  it('the migration inserts exactly the seed rows (and carries the same rules as a CHECK)', () => {
    const sql = fs.readFileSync(path.resolve(__dirname, '..', 'prisma/migrations/20261219170000_v3_wave2_addon_eligibility/migration.sql'), 'utf8');
    const values = sql.slice(sql.indexOf('FROM (VALUES'), sql.indexOf(') AS v('));   // only the INSERT's list, not the CHECK's IN (...)
    const pairs = [...values.matchAll(/\('([A-Z0-9_]+)', '([A-Z0-9_]+)'\)/g)].map((m) => `${m[1]}|${m[2]}`).sort();
    expect(pairs).toEqual(ELIGIBILITY_SEED.map((e) => `${e.addonKey}|${e.packKey}`).sort());
    expect(sql).toContain('g4d_addon_eligibility_owner_rules_check'); expect(sql).not.toMatch(/DROP TABLE|DELETE FROM|ALTER TABLE "(?!g4d_addon_eligibility)/);
  });
  it('isEligible needs an active row, a pack, and the fixed rules; an unknown pack or no pack is no', () => {
    const rows = [{ addonKey: 'SHOP', packKey: 'RETAIL', active: true }, { addonKey: 'SHOP', packKey: 'CLINIC', active: false }, { addonKey: 'SHOP', packKey: 'PHARMACY', active: true }];
    expect(isEligible(rows, 'SHOP', 'RETAIL')).toBe(true); expect(isEligible(rows, 'SHOP', 'CLINIC')).toBe(false); expect(isEligible(rows, 'SHOP', 'PHARMACY')).toBe(false);   // a forced pharmacy row is still ignored
    expect(isEligible(rows, 'SHOP', null)).toBe(false); expect(isEligible(rows, 'SHOP', 'NOPE')).toBe(false);
  });
  it('checkEligibilityEdit names an unknown add-on, an unknown pack and a broken rule; switching a pairing OFF is always allowed', () => {
    const a = new Set(['SHOP', 'PHARMACY_COUNTER']); const p = new Set(['RETAIL', 'PHARMACY', 'CLINIC']);
    expect(checkEligibilityEdit({ addonKey: 'X', packKey: 'Y', active: true }, a, p)).toHaveLength(2);
    expect(checkEligibilityEdit({ addonKey: 'SHOP', packKey: 'PHARMACY', active: true }, a, p)).toEqual([expect.stringMatching(/never/)]);
    expect(checkEligibilityEdit({ addonKey: 'SHOP', packKey: 'PHARMACY', active: false }, a, p)).toEqual([]);
    expect(checkEligibilityEdit({ addonKey: 'SHOP', packKey: 'RETAIL', active: true }, a, p)).toEqual([]);
  });
  it('both new codes are registered with the exception filter', () => { expect(BUSINESS_ERROR_CODES).toEqual(expect.arrayContaining(['ADDON_NOT_ELIGIBLE', 'ADDON_ELIGIBILITY_INVALID'])); });
});

describe('what a business sees and can buy', () => {
  it('a goods pack sees SHOP and ONLINE_ORDERING_DELIVERY and nothing else; a field-service pack sees none', async () => {
    const { svc, plans } = await makeEngine(); for (const v of ['food', 'plumb']) plans.states.set(v, { mode: 'V3', level: 'PRO', track: 'PROFESSIONAL' });
    await svc.register('food', { categoryKey: 'juice-tea-snack-shop' }, owner('food')); await svc.register('plumb', { categoryKey: 'plumber' }, owner('plumb'));
    expect(await keysOf(svc, 'food')).toEqual(['ONLINE_ORDERING_DELIVERY', 'SHOP']); expect(await keysOf(svc, 'plumb')).toEqual([]);
  });
  it('the pharmacy pack sees PHARMACY_COUNTER only; never SHOP or ONLINE_ORDERING_DELIVERY, even when someone forces those rows', async () => {
    const { svc, refs, plans } = await makeEngine(); plans.states.set('rx', { mode: 'V3', level: 'PRO', track: 'ECOMMERCE' });
    await svc.register('rx', { categoryKey: 'pharmacy' }, owner('rx'));
    expect(await keysOf(svc, 'rx')).toEqual(['PHARMACY_COUNTER']);
    await refs.createEligibility([{ addonKey: 'SHOP', packKey: 'PHARMACY' }, { addonKey: 'ONLINE_ORDERING_DELIVERY', packKey: 'PHARMACY' }]); svc.invalidate();   // written behind the service's back
    expect(await keysOf(svc, 'rx')).toEqual(['PHARMACY_COUNTER']);
    expect(await codeOf(svc.refuseAddonPurchase('rx', 'SHOP'))).toMatchObject({ status: 409, code: 'ADDON_NOT_ELIGIBLE' });
  });
  it('PHARMACY_COUNTER is not offered to a clinic or a lab, even with a forced row; the lab sees HOME_SAMPLE_COLLECTION', async () => {
    const { svc, refs, plans } = await makeEngine(); plans.states.set('lab', { mode: 'V3', level: 'PRO', track: 'PROFESSIONAL' });
    await svc.register('lab', { categoryKey: 'diagnostics-lab' }, owner('lab'));
    expect(await keysOf(svc, 'lab')).toEqual(['HOME_SAMPLE_COLLECTION']);
    await refs.createEligibility([{ addonKey: 'PHARMACY_COUNTER', packKey: 'LAB' }]); svc.invalidate();
    expect(await keysOf(svc, 'lab')).toEqual(['HOME_SAMPLE_COLLECTION']);
  });
  it('a vendor with no pack yet sees nothing and cannot buy: ADDON_NOT_ELIGIBLE', async () => {
    const { svc } = await makeEngine();
    expect(await svc.myAddons('nobody')).toEqual([]); expect((await codeOf(svc.refuseAddonPurchase('nobody', 'SHOP'))).code).toBe('ADDON_NOT_ELIGIBLE');
  });
  it('an eligible add-on answers ADDON_PRICE_PENDING and no figure appears anywhere', async () => {
    const { svc, plans } = await makeEngine(); plans.states.set('food', { mode: 'V3', level: 'PRO', track: 'PROFESSIONAL' }); await svc.register('food', { categoryKey: 'juice-tea-snack-shop' }, owner('food'));
    expect((await codeOf(svc.refuseAddonPurchase('food', 'SHOP'))).code).toBe('ADDON_PRICE_PENDING');
    for (const a of await svc.myAddons('food')) { expect([a.priceStatus, a.price, a.priceNote]).toEqual(['PENDING', null, 'Price not set']); expect(JSON.stringify(a)).not.toMatch(/\d{2,}|₹|paise/i); }
  });
  it('registration offers only the add-ons the pack may buy', async () => {
    const { svc } = await makeEngine();
    expect((await svc.offer('juice-tea-snack-shop')).addonPacks.map((a) => a.key)).toEqual(['SHOP', 'ONLINE_ORDERING_DELIVERY']);
    expect((await svc.offer('pharmacy')).addonPacks).toEqual([]); expect((await svc.offer('plumber')).addonPacks).toEqual([]);
  });
});

describe('staff edit the table', () => {
  it('lists the rows, the keys to choose from and the fixed rules', async () => {
    const { svc } = await makeEngine(); const l = await svc.adminEligibility();
    expect(l.rows).toHaveLength(ELIGIBILITY_SEED.length); expect(l.addons).toContain('HOME_SAMPLE_COLLECTION'); expect(l.packs).toContain('LAB'); expect(l.fixedRules).toHaveLength(2);
  });
  it('adding the not-yet-defined second HOME_SAMPLE_COLLECTION case is one row: the clinic then sees it at once, audited', async () => {
    const { svc, plans, activity } = await makeEngine(); plans.states.set('c', { mode: 'V3', level: 'PRO', track: 'PROFESSIONAL' }); const clinic = (await svc.adminCategories()).find((x) => x.packKey === 'CLINIC')!; await svc.register('c', { categoryKey: clinic.categoryKey }, owner('c'));
    expect(await keysOf(svc, 'c')).toEqual([]);
    const row = await svc.setEligibility('HOME_SAMPLE_COLLECTION', 'CLINIC', true, staff); expect(row).toEqual({ addonKey: 'HOME_SAMPLE_COLLECTION', packKey: 'CLINIC', active: true });
    expect(await keysOf(svc, 'c')).toEqual(['HOME_SAMPLE_COLLECTION']);
    expect(activity.filter((a) => a.actionKey === 'pack.addon_eligibility.changed')).toHaveLength(1);
  });
  it('switching a pairing off hides it and keeps the row; switching it on again brings it back', async () => {
    const { svc, refs, plans } = await makeEngine(); plans.states.set('lab', { mode: 'V3', level: 'PRO', track: 'PROFESSIONAL' }); await svc.register('lab', { categoryKey: 'diagnostics-lab' }, owner('lab'));
    await svc.setEligibility('HOME_SAMPLE_COLLECTION', 'LAB', false, staff);
    expect(await keysOf(svc, 'lab')).toEqual([]); expect(refs.eligibility.get('HOME_SAMPLE_COLLECTION|LAB')).toEqual({ addonKey: 'HOME_SAMPLE_COLLECTION', packKey: 'LAB', active: false });
    await svc.setEligibility('HOME_SAMPLE_COLLECTION', 'LAB', true, staff); expect(await keysOf(svc, 'lab')).toEqual(['HOME_SAMPLE_COLLECTION']);
  });
  it('the audit row records who, what and the before and after', async () => {
    const records: Array<Record<string, unknown>> = [];
    const e = await makeEngine(); (e.svc as unknown as { activity: unknown }).activity = { record: async (i: Record<string, unknown>) => { records.push(i); return null; } };
    await e.svc.setEligibility('HOME_SAMPLE_COLLECTION', 'LAB', false, { type: 'STAFF', id: 'staff-9', ip: '1.2.3.4' });
    expect(records).toEqual([expect.objectContaining({ vendorId: null, actionKey: 'pack.addon_eligibility.changed', entityId: 'HOME_SAMPLE_COLLECTION:LAB', actor: { type: 'STAFF', id: 'staff-9', ip: '1.2.3.4' }, summary: { addonKey: 'HOME_SAMPLE_COLLECTION', packKey: 'LAB', before: true, after: false } })]);
  });
  it('a pairing that breaks a fixed rule, or names something unknown, is refused with ADDON_ELIGIBILITY_INVALID and nothing is written', async () => {
    const { svc, refs, activity } = await makeEngine(); const n = refs.eligibility.size;
    for (const [a, p] of [['SHOP', 'PHARMACY'], ['ONLINE_ORDERING_DELIVERY', 'PHARMACY'], ['PHARMACY_COUNTER', 'CLINIC'], ['NOPE', 'LAB'], ['SHOP', 'NOPE']] as const) {
      const r = await codeOf(svc.setEligibility(a, p, true, staff)); expect([r.status, r.code]).toEqual([400, 'ADDON_ELIGIBILITY_INVALID']); expect(r.problems!.length).toBeGreaterThan(0);
    }
    expect(refs.eligibility.size).toBe(n); expect(activity.filter((x) => x.actionKey === 'pack.addon_eligibility.changed')).toEqual([]);
  });
  it('a change is seen at once (the reference cache is dropped), not after the 15 seconds', async () => {
    const { svc, plans } = await makeEngine(); plans.states.set('lab', { mode: 'V3', level: 'PRO', track: 'PROFESSIONAL' }); await svc.register('lab', { categoryKey: 'diagnostics-lab' }, owner('lab'));
    expect(await keysOf(svc, 'lab')).toEqual(['HOME_SAMPLE_COLLECTION']); await svc.setEligibility('HOME_SAMPLE_COLLECTION', 'LAB', false, staff); expect(await keysOf(svc, 'lab')).toEqual([]);
  });
});

describe('the loader and the role matrix', () => {
  it('the pack loader creates the eligibility rows when missing, never changes a row staff edited, and a second run creates none', async () => {
    const s = new MemoryRefStore(); await loadPackEngine(s, realSeed(), { apply: true }); expect(s.eligibility.size).toBe(ELIGIBILITY_SEED.length);
    await s.setEligibility('HOME_SAMPLE_COLLECTION', 'LAB', false, null); await loadPackEngine(s, realSeed(), { apply: true });
    expect(s.eligibility.get('HOME_SAMPLE_COLLECTION|LAB')!.active).toBe(false); expect(s.eligibility.size).toBe(ELIGIBILITY_SEED.length);
  });
  it('who may call the routes (data): reading is OPERATIONS, ADMIN and SUPER_ADMIN; editing is ADMIN and SUPER_ADMIN only', () => {
    const r = 'GET /v3/admin/pack-engine/addon-eligibility'; const w = 'PUT /v3/admin/pack-engine/addon-eligibility';
    expect([...effectiveRolesFor(r)].sort()).toEqual(['ADMIN', 'OPERATIONS', 'SUPER_ADMIN']);
    expect([...effectiveRolesFor(w)].sort()).toEqual(['ADMIN', 'SUPER_ADMIN']);
    for (const role of ['MARKETING', 'SUPPORT', 'OPERATIONS']) expect(effectiveRolesFor(w)).not.toContain(role);
  });
});
