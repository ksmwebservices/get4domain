import { capabilityTabRecords, checkPackConfig, checkTab, copyIssues, crossCheckMap, matrixRecords, normaliseCopy, PackEngineSettings, parseCategoryMaster, parseCsv, parsePackSummary, parseStages, slug, stableJson, tierFromText, validateSettings } from '../src/v3-packs/core/pack-core';
import { buildSeed } from '../src/v3-packs/seed/pack-seed';
import { readSeedSources } from '../src/v3-packs/seed/seed-files';

const src = readSeedSources();
const seed = buildSeed(src);
const clone = (): PackEngineSettings => JSON.parse(JSON.stringify(src.settings)) as PackEngineSettings;

describe('csv and small helpers', () => {
  it('reads quotes, doubled quotes, commas inside quotes, CRLF and a byte-order mark', () => {
    const rows = parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n1,2\r\n');
    expect(rows).toEqual([{ a: 'x, y', b: 'say "hi"' }, { a: '1', b: '2' }]);
  });
  it('keeps only the tier word of "Ecommerce (1,499)" and refuses anything else', () => {
    expect(tierFromText('Ecommerce (1,499)')).toBe('ECOMMERCE'); expect(tierFromText('Handyman (499)')).toBe('HANDYMAN'); expect(tierFromText('Professional (999)')).toBe('PROFESSIONAL');
    expect(tierFromText('Gold')).toBeNull(); expect(tierFromText('')).toBeNull();
  });
  it('slugs a label', () => { expect(slug('Projects and units')).toBe('projects_and_units'); expect(slug('Stock with batches/expiry!')).toBe('stock_with_batches_expiry'); });
  it('splits stage lists and keeps a part without a colon as a note, never a stage', () => {
    expect(parseStages('Order: Received, Verified; refill reminders')).toEqual({ lists: [{ name: 'Order', stages: ['Received', 'Verified'] }], notes: ['refill reminders'] });
  });
  it('stableJson ignores key order', () => { expect(stableJson({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe(stableJson({ a: [2, { c: 2, d: 1 }], b: 1 })); });
});

describe('copy rules', () => {
  it('swaps "leads" for "enquiries" and counts it', () => { expect(normaliseCopy('Leads from enquiries, new lead')).toEqual({ text: 'Enquiries from enquiries, new enquiry', rewrites: 2 }); });
  it('reports a retired name, a timeframe or a price and never rewrites it', () => {
    expect(copyIssues('open your ' + ['work', 'space'].join(''))).toEqual(['uses a retired product name']);
    expect(copyIssues('reply within 2 days')).toEqual(['names a timeframe']);
    expect(copyIssues('from ₹ 499')).toEqual(['carries a price']);
    expect(copyIssues('Site visits and quotes')).toEqual([]);
  });
});

describe('the settings file', () => {
  it('is valid', () => { expect(validateSettings(src.settings)).toEqual([]); });
  it('names the proposed tier rules: Handyman has services, Professional adds the workflow capabilities and no store, Ecommerce has everything', () => {
    const m = src.settings.tierMatrix;
    expect(m.HANDYMAN.SERVICES).toBe('AMENDMENT_13_V3'); expect(m.HANDYMAN.STORE).toBeUndefined(); expect(m.HANDYMAN.APPOINTMENTS).toBeUndefined();
    for (const k of ['APPOINTMENTS', 'MEMBERSHIPS', 'LISTINGS', 'BROKERAGE', 'RENTALS', 'MADE_TO_ORDER']) expect(m.PROFESSIONAL[k]).toBe('AMENDMENT_13_V3');
    expect(m.PROFESSIONAL.STORE).toBeUndefined();
    expect(Object.keys(m.ECOMMERCE)).toHaveLength(src.settings.capabilities.length);
  });
  it('marks every cell that Amendment 13 does not state as ASSUMED for the owner to review', () => {
    const assumed = Object.entries(src.settings.tierMatrix).flatMap(([t, row]) => Object.entries(row).filter(([, b]) => b === 'ASSUMED_FOR_OWNER_REVIEW').map(([c]) => `${t}/${c}`));
    expect(assumed.sort()).toEqual(['HANDYMAN/DISPATCH', 'PROFESSIONAL/DELIVERY', 'PROFESSIONAL/DISPATCH', 'PROFESSIONAL/FOOD_SERVICE', 'PROFESSIONAL/LAB', 'PROFESSIONAL/PHARMACY', 'PROFESSIONAL/VEHICLE_RENTAL']);
  });
  it('gives the grid one row per tier and capability', () => { expect(matrixRecords(src.settings)).toHaveLength(3 * src.settings.capabilities.length); });
  it('refuses a matrix that names an unknown capability or tier, a duplicate key, or a missing free-trial tab', () => {
    const a = clone(); a.tierMatrix.HANDYMAN.NOPE = 'AMENDMENT_13_V3'; expect(validateSettings(a).join()).toMatch(/unknown capability "NOPE"/);
    const b = clone(); b.tierMatrix.GOLD = {}; expect(validateSettings(b).join()).toMatch(/unknown tier "GOLD"/);
    const c = clone(); c.commonTabs.push({ ...c.commonTabs[0] }); expect(validateSettings(c).join()).toMatch(/listed twice/);
    const d = clone(); d.commonTabs = d.commonTabs.filter((t) => t.key !== 'plan'); expect(validateSettings(d).join()).toMatch(/plan must be open on a Free trial/);
  });
  it('carries the common tabs the amendment names, and website and industry management are open on a Free trial', () => {
    const keys = src.settings.commonTabs.map((t) => t.key);
    for (const k of ['promotion', 'crm', 'telecrm', 'billing', 'accounting', 'social', 'ai_studio', 'domain', 'support', 'plan', 'migration', 'website', 'industry']) expect(keys).toContain(k);
    expect(src.settings.commonTabs.filter((t) => t.freeTrial).map((t) => t.key).sort()).toEqual(['industry', 'plan', 'support', 'website']);
  });
  it('gives every capability a tab', () => { expect(capabilityTabRecords(src.settings).map((t) => t.ownerKey).sort()).toEqual(src.settings.capabilities.map((c) => c.key).sort()); });
});

describe('PACK_SUMMARY_V1: the 16 packs', () => {
  it('loads 16 packs with no problem and the owner draft status', () => {
    expect(seed.problems).toEqual([]); expect(seed.packs).toHaveLength(16); expect(seed.packs.every((p) => p.reviewStatus === 'DRAFT')).toBe(true);
  });
  it('every pack has tabs, CRM stage lists, TeleCRM lines, task templates and site sections as data', () => {
    for (const p of seed.packs) {
      expect([p.key, p.config.crmPipelines.length > 0]).toEqual([p.key, true]);
      expect(p.config.telecrm.length).toBeGreaterThan(0); expect(p.config.taskTemplates.length).toBeGreaterThan(0); expect(p.config.siteSections.length).toBeGreaterThan(0);
      expect(seed.tabs.filter((t) => t.scope === 'PACK' && t.ownerKey === p.key).length).toBeGreaterThan(0);
    }
  });
  it('invents nothing: entities, report sets and field hints stay empty until the pack wave', () => {
    for (const p of seed.packs) { expect(p.config.entities).toEqual([]); expect(p.config.reportSet).toEqual([]); expect(p.config.fieldHints).toEqual([]); }
  });
  it('the Pharmacy pack ships with online checkout OFF and a drug licence required; health packs are counsel gated', () => {
    const ph = seed.packs.find((p) => p.key === 'PHARMACY')!;
    expect(ph.config.flags.onlineCheckout).toBe(false); expect(ph.config.flags.drugLicenceRequired).toBe(true); expect(ph.config.flags.hasBatchExpiry).toBe(true);
    for (const k of ['CLINIC', 'LAB', 'PHARMACY', 'PRACTICE_LEGAL_FINANCE']) expect(seed.packs.find((p) => p.key === k)!.config.flags.counselGated).toBe(true);
    expect(seed.packs.find((p) => p.key === 'RETAIL')!.config.flags.counselGated).toBe(false);
  });
  it('rewrites the one "leads" in the draft and reports it', () => {
    expect(seed.rewrites).toBeGreaterThanOrEqual(1);
    // `source` keeps the sheet's own words on purpose, so it is left out of the check
    expect(JSON.stringify(seed.packs.map((p) => ({ ...p.config, source: undefined })))).not.toMatch(/\bleads?\b/i);
  });
  it('a pack row that breaks a rule is a problem, not a silent fix', () => {
    const rows = parseCsv(src.packSummaryCsv); rows[0].telecrm = 'Call within 2 days';
    expect(parsePackSummary(rows, src.settings).problems.join()).toMatch(/names a timeframe/);
    const dup = parseCsv(src.packSummaryCsv); dup.push({ ...dup[0] }); expect(parsePackSummary(dup, src.settings).problems.join()).toMatch(/listed twice/);
    const noKey = parseCsv(src.packSummaryCsv); noKey[1].pack = 'bad key'; expect(parsePackSummary(noKey, src.settings).problems.join()).toMatch(/not an UPPER_SNAKE key/);
  });
  it('no pack, tab or add-on carries a price', () => {
    expect(JSON.stringify([seed.packs, seed.tabs, seed.addons])).not.toMatch(/"(price|pricePaise|amount|amountPaise)"|₹/);
  });
});

describe('CATEGORY_MASTER_V3: the 196 categories', () => {
  const byId = (id: string) => seed.categories.find((c) => c.categoryKey === id)!;
  it('loads 196 categories with no problem; 53 stay marked as needing a blueprint wave', () => {
    expect(seed.categories).toHaveLength(196); expect(seed.needsBlueprint).toBe(53);
    expect(seed.categories.filter((c) => c.needsBlueprint).every((c) => c.starterServices.length === 0)).toBe(true);
  });
  it('keeps only the tier word and the owner tier moves of V3A', () => {
    for (const k of ['pharmacy', 'restaurant-cafe', 'cloud-kitchen', 'food-delivery-service', 'tiffin-meal-service']) expect([k, byId(k).minTier]).toEqual([k, 'ECOMMERCE']);
    expect(byId('caterer').minTier).toBe('PROFESSIONAL'); expect(byId('juice-tea-snack-shop').minTier).toBe('PROFESSIONAL'); expect(byId('diagnostics-lab').minTier).toBe('PROFESSIONAL');
    expect(JSON.stringify(seed.categories)).not.toMatch(/\(\d|1,499|₹/);
  });
  it('reads the add-on packs each category may buy, with the bundle discount flag', () => {
    expect(byId('plumber').addonPacks).toEqual([{ key: 'SHOP', bundleDiscount: false }]);
    expect(byId('juice-tea-snack-shop').addonPacks.map((a) => a.key)).toEqual(['SHOP', 'ONLINE_ORDERING_DELIVERY']);
    expect(byId('diagnostics-lab').addonPacks.map((a) => a.key)).toEqual(['SHOP', 'HOME_SAMPLE_COLLECTION']);
    const clinics = seed.categories.filter((c) => c.addonPacks.some((a) => a.key === 'PHARMACY_COUNTER'));
    expect(clinics).toHaveLength(11); expect(clinics.every((c) => c.packKey === 'CLINIC' && c.addonPacks.find((a) => a.key === 'PHARMACY_COUNTER')!.bundleDiscount)).toBe(true);
    expect(seed.categories.filter((c) => c.minTier === 'ECOMMERCE').every((c) => c.addonPacks.length === 0)).toBe(true);
  });
  it('keeps the medicine notes on the two pharmacy categories', () => { expect(seed.categories.filter((c) => /Online medicine checkout OFF/.test(c.statusNote ?? ''))).toHaveLength(2); });
  it('the three sheets agree on every pack', () => { expect(crossCheckMap(parseCsv(src.categoryMapCsv), seed.categories)).toEqual([]); });
  it('refuses an unknown pack, capability or add-on pack, a bad tier and a duplicate', () => {
    const packs = new Set(seed.packs.map((p) => p.key)); const caps = new Set(seed.capabilities.map((c) => c.key)); const addons = new Set(seed.addons.map((a) => a.key));
    const rows = parseCsv(src.categoryMasterCsv);
    const bad = rows.slice(0, 4).map((r) => ({ ...r }));
    bad[0].primary_pack = 'NOPE'; bad[1].optional_capabilities = 'FLY'; bad[2].addon_packs_available = 'MAGIC'; bad[3].minimum_tier = 'Gold (1)';
    const out = parseCategoryMaster([...bad, { ...bad[0] }], packs, caps, addons).problems.join('|');
    expect(out).toMatch(/unknown pack "NOPE"/); expect(out).toMatch(/unknown capability "FLY"/); expect(out).toMatch(/unknown add-on pack "MAGIC"/); expect(out).toMatch(/minimum tier "Gold \(1\)"/); expect(out).toMatch(/listed twice/);
  });
});

describe('add-on packs (V3A)', () => {
  it('are the four owner packs, with PENDING prices and no amount anywhere', () => {
    expect(seed.addons.map((a) => a.key).sort()).toEqual(['HOME_SAMPLE_COLLECTION', 'ONLINE_ORDERING_DELIVERY', 'PHARMACY_COUNTER', 'SHOP']);
    expect(seed.addons.every((a) => a.priceStatus === 'PENDING' && a.bundleDiscountStatus === 'PENDING')).toBe(true);
  });
  it('SHOP grants the store; the pharmacy counter dispenses to the clinic\'s own patients only and sells nothing online', () => {
    expect(seed.addons.find((a) => a.key === 'SHOP')!.grantsCapabilities).toEqual(['STORE']);
    expect(seed.addons.find((a) => a.key === 'PHARMACY_COUNTER')!.config).toMatchObject({ dispensing: 'OWN_PATIENTS_ONLY', onlineSale: false, stockWithBatchExpiry: true });
  });
  it('a price key in an add-on is refused', () => {
    const s = clone(); (s.addonPacks[0] as unknown as Record<string, unknown>).price = 99; expect(validateSettings(s).join()).toMatch(/carries a price/);
  });
});

describe('staff edits are checked', () => {
  const known = { packs: new Set(['CLINIC']), capabilities: new Set(['STORE']), addons: new Set(['SHOP']) };
  const ok = { scope: 'PACK', ownerKey: 'CLINIC', key: 'visits', label: 'Visits', route: '/pack/visits' };
  it('accepts a good tab and names every problem of a bad one', () => {
    expect(checkTab(ok, known)).toEqual([]);
    const p = checkTab({ scope: 'PACK', ownerKey: 'NOPE', key: 'Bad Key', label: '', route: 'x', minTier: 'GOLD', capabilityKey: 'FLY' }, known).join('|');
    for (const m of [/lower_snake/, /label is required/, /route must start/, /minimum tier/, /pack does not exist/, /capability the tab needs/]) expect(p).toMatch(m);
  });
  it('checks a pack config: shape, no price key, copy rules, "enquiries" not "leads"', () => {
    expect(checkPackConfig({ crmPipelines: [{ name: 'Order', stages: ['New'] }], flags: { hasStock: true, onlineCheckout: null } })).toEqual([]);
    expect(checkPackConfig({ crmPipelines: 'x' }).join()).toMatch(/crmPipelines must be a list/);
    expect(checkPackConfig({ telecrm: [{ key: 'a', label: 'A', price: 5 }] }).join()).toMatch(/no price/);
    expect(checkPackConfig({ siteSections: [{ key: 'a', label: 'Our leads' }] }).join()).toMatch(/enquiries/);
    expect(checkPackConfig({ flags: { hasStock: 'yes' } }).join()).toMatch(/yes or no/);
  });
});
