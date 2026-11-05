import * as fs from 'fs';
import * as path from 'path';
import { validateServiceInput } from '../src/v3-services/core/services-core';
import { ALLOWANCE_SERVICE_KEYS, allowanceFeatureKey, FeatureSeedPort, SERVICE_SEED, seedServices, THEME_SWITCH_PROPOSED_PAISE } from '../src/v3-services/seed/services-seed';
import { OPS, servicesWorld, ServicesWorld } from './support/services-world';

/**
 * The service seed: words only, ONE proposed price, never an approved one; a dry run writes nothing; running it twice changes nothing; a service staff already changed is left alone.
 */
class FakeFeatures implements FeatureSeedPort {
  rows = new Map<string, { key: string; kind: string; unit: string; group: string }>(); creates = 0;
  async existingKeys(keys: readonly string[]) { return keys.filter((k) => this.rows.has(k)); }
  async create(rows: Parameters<FeatureSeedPort['create']>[0]) { this.creates++; for (const r of rows) this.rows.set(r.key, { key: r.key, kind: r.kind, unit: r.unit, group: r.group }); }
}
const code = (f: string): string => fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const seedFile = path.resolve(__dirname, '../src/v3-services/seed/services-seed.ts');
let w: ServicesWorld; let features: FakeFeatures;
beforeEach(() => { w = servicesWorld(); features = new FakeFeatures(); });

describe('the seeded texts', () => {
  it('are the twelve services the owner named, with unique keys', () => {
    expect(SERVICE_SEED.map((s) => s.key)).toEqual(['THEME_SWITCH', 'CUSTOM_THEME', 'SETUP_HELP', 'DOMAIN_CONNECT_HELP', 'CONTENT_UPDATE', 'POSTER_DESIGN', 'REEL_PRODUCTION', 'DOCUMENT_DESIGN', 'SEO_TASK', 'GBP_SETUP', 'SOCIAL_MANAGEMENT_REQUEST', 'CUSTOM_DOMAIN_PROMOTION']);
    expect(new Set(SERVICE_SEED.map((s) => s.key)).size).toBe(12);
  });
  it('pass the same validation staff input passes', () => { for (const s of SERVICE_SEED) expect([s.key, validateServiceInput(s)]).toEqual([s.key, []]); });
  it('say what each service includes and how approval works, in plain words', () => { for (const s of SERVICE_SEED) { expect(s.includesText.length).toBeGreaterThan(30); expect(s.approvalText.length).toBeGreaterThan(30); expect(s.shortDescription.length).toBeGreaterThan(15); } });
  it('contain no price, no length of time and none of the retired product names (owner rules 5 and the stop-lines)', () => {
    for (const s of SERVICE_SEED) {
      const text = [s.name, s.shortDescription, s.includesText, s.approvalText].join(' ');
      expect([s.key, /₹|\bRs\.?\s*\d|\bINR\b|\bpaise\b|\d/.test(text)]).toEqual([s.key, false]);
      expect([s.key, /\b(days?|weeks?|months?|years?|hours?|minutes?|annual|annually|monthly|quarterly|daily|weekly|yearly|within)\b/i.test(text)]).toEqual([s.key, false]);
      expect([s.key, /\b(Workspace|BOS|LeadSpace)\b/i.test(text)]).toEqual([s.key, false]);
      expect([s.key, /[<>]/.test(text)]).toEqual([s.key, false]);
    }
  });
  it('THEME_SWITCH is instant and done by either; the team services are requests; the promotion is a team request', () => {
    const by = Object.fromEntries(SERVICE_SEED.map((s) => [s.key, s]));
    expect(by.THEME_SWITCH).toMatchObject({ doneBy: 'EITHER', deliveryKind: 'INSTANT' });
    for (const k of ['SETUP_HELP', 'DOMAIN_CONNECT_HELP', 'CONTENT_UPDATE', 'CUSTOM_DOMAIN_PROMOTION', 'POSTER_DESIGN']) expect(by[k]).toMatchObject({ doneBy: 'TEAM', deliveryKind: 'TEAM_REQUEST' });
  });
  it('the seed source never writes an APPROVED price (the word does not appear in its code)', () => { expect(code(seedFile)).not.toMatch(/APPROVED/); });
});

describe('the loader', () => {
  it('a dry run writes nothing and says what it would do', async () => {
    const r = await seedServices(w.services, features, { apply: false });
    expect(r.missingServices).toHaveLength(12); expect(r.createdServices).toEqual([]); expect(r.priceProposed).toBe(false); expect(r.priceRowsWritten).toEqual([]); expect(r.missingFeatures).toHaveLength(11); expect(r.createdFeatures).toEqual([]);
    expect(await w.services.services()).toEqual([]); expect(features.creates).toBe(0); expect(w.services.audits).toEqual([]);
  });
  it('apply creates the services, ONE proposed price for THEME_SWITCH and no approved price anywhere', async () => {
    const r = await seedServices(w.services, features, { apply: true });
    expect(r.createdServices).toHaveLength(12); expect(r.priceProposed).toBe(true);
    expect(r.priceRowsWritten).toEqual([{ serviceKey: 'THEME_SWITCH', amountPaise: 29_900, status: 'PROPOSED' }]); expect(THEME_SWITCH_PROPOSED_PAISE).toBe(29_900);
    const prices = await w.services.allServicePrices(); expect(prices).toHaveLength(1);
    expect(prices[0]).toMatchObject({ amountPaise: 29_900, status: 'PROPOSED', effectiveFrom: null, approvedBy: null, approvedAt: null, currency: 'INR', createdBy: 'seed' });
    expect(prices.filter((p) => p.status === 'APPROVED')).toEqual([]);
  });
  it('the proposal is not a price: the public catalogue is empty and a vendor sees "price not set"', async () => {
    await seedServices(w.services, features, { apply: true });
    expect((await w.catalogue.publicCatalogue()).items).toEqual([]);
    await w.open('v1');
    const t = (await w.catalogue.vendorServices('v1')).items.find((s) => s.key === 'THEME_SWITCH')!;
    expect(t).toMatchObject({ price: null, priceNote: 'Price not set', funding: { kind: 'NONE', reason: 'PRICE_NOT_SET' } });
  });
  it('the proposed price becomes real only when a SUPER_ADMIN approves it with a date', async () => {
    await seedServices(w.services, features, { apply: true });
    const [p] = await w.services.allServicePrices();
    await w.catalogue.approvePrice('service', p.id, { effectiveFrom: new Date(w.clock().getTime() + 1000).toISOString() }, { type: 'STAFF', id: 'super-1', ip: null });
    w.now.t = new Date(w.now.t.getTime() + 2000);
    expect((await w.catalogue.publicCatalogue()).items[0]).toMatchObject({ key: 'THEME_SWITCH', price: { amountPaise: 29_900 } });
  });
  it('runs twice without changing anything', async () => {
    await seedServices(w.services, features, { apply: true });
    const again = await seedServices(w.services, features, { apply: true });
    expect(again.createdServices).toEqual([]); expect(again.priceProposed).toBe(false); expect(again.priceAlreadyThere).toBe(true); expect(again.createdFeatures).toEqual([]);
    expect(await w.services.services()).toHaveLength(12); expect(await w.services.allServicePrices()).toHaveLength(1); expect(features.creates).toBe(1);
  });
  it('leaves a service staff already changed exactly as it is, and adds no proposal when THEME_SWITCH already has a price', async () => {
    await w.catalogue.createService({ ...SERVICE_SEED[0], name: 'Theme change (renamed by staff)', status: 'ACTIVE' } as never, OPS);
    await w.catalogue.proposePrice('service', 'THEME_SWITCH', { amountPaise: 11_111 }, OPS);
    const r = await seedServices(w.services, features, { apply: true });
    expect(r.createdServices).toHaveLength(11); expect(r.priceProposed).toBe(false);
    expect((await w.services.serviceByKey('THEME_SWITCH'))!.name).toBe('Theme change (renamed by staff)');
    expect((await w.services.allServicePrices()).map((p) => p.amountPaise)).toEqual([11_111]);
  });
  it('creates the plan-allowance features for every service except THEME_SWITCH, as limits, with no value for any plan', async () => {
    await seedServices(w.services, features, { apply: true });
    expect(ALLOWANCE_SERVICE_KEYS).toHaveLength(11); expect(ALLOWANCE_SERVICE_KEYS).not.toContain('THEME_SWITCH');
    expect([...features.rows.keys()].sort()).toEqual(ALLOWANCE_SERVICE_KEYS.map(allowanceFeatureKey).sort());
    for (const f of features.rows.values()) expect(f).toMatchObject({ kind: 'LIMIT', group: 'services' });
    expect(allowanceFeatureKey('POSTER_DESIGN')).toBe('services.included.POSTER_DESIGN');
  });
});

describe('the script', () => {
  const script = fs.readFileSync(path.resolve(__dirname, '../scripts/seed-v3-services.js'), 'utf8');
  it('is a dry run unless --apply is given, runs the staging guard, and reports that no approved price was written', () => {
    expect(script).toMatch(/const APPLY = process\.argv\.slice\(2\)\.includes\('--apply'\)/); expect(script).toMatch(/loadStagingEnv\(\)/);
    expect(script).toMatch(/price rows written with status APPROVED: 0/); expect(script).not.toMatch(/status:\s*'APPROVED'|'APPROVED'\s*\}/);
  });
});
