import * as fs from 'fs';
import * as path from 'path';
import { validateServiceInput } from '../src/v3-services/core/services-core';
import { ALLOWANCE_SERVICE_KEYS, allowanceFeatureKey, FeatureSeedPort, OWNER_PRICE_SEED, OWNER_PRICE_SOURCE, SERVICE_SEED, seedServices, THEME_SWITCH_PROPOSED_PAISE } from '../src/v3-services/seed/services-seed';
import { OPS, servicesWorld, ServicesWorld } from './support/services-world';

/**
 * The service seed: words only, the owner's prices of 5 November 2026 as PROPOSED rows, never an approved one; a dry run writes nothing; running it twice changes nothing; a service staff already
 * changed is left alone.
 */
class FakeFeatures implements FeatureSeedPort {
  rows = new Map<string, { key: string; kind: string; unit: string; group: string }>(); creates = 0;
  async existingKeys(keys: readonly string[]) { return keys.filter((k) => this.rows.has(k)); }
  async create(rows: Parameters<FeatureSeedPort['create']>[0]) { this.creates++; for (const r of rows) this.rows.set(r.key, { key: r.key, kind: r.kind, unit: r.unit, group: r.group }); }
}
const ALL_KEYS = ['THEME_SWITCH', 'CUSTOM_THEME', 'SETUP_HELP', 'DOMAIN_CONNECT_HELP', 'CONTENT_UPDATE', 'POSTER_DESIGN', 'LOGO_DESIGN', 'POST_DESIGN', 'REEL_SLIDESHOW', 'REEL_CORPORATE', 'REEL_CINEMATIC', 'DOCUMENT_DESIGN', 'SEO_TASK', 'SEO_MANAGER_HIRE', 'CONTENT_CREATOR_HIRE', 'BLOG_CREATOR_HIRE', 'GBP_SETUP', 'SOCIAL_MANAGEMENT_REQUEST', 'CUSTOM_DOMAIN_PROMOTION', 'CAMPAIGN', 'MESSAGE_SMS', 'MESSAGE_EMAIL', 'MESSAGE_WHATSAPP_MARKETING'];
const DRAFTS = ['CAMPAIGN', 'MESSAGE_SMS', 'MESSAGE_EMAIL', 'MESSAGE_WHATSAPP_MARKETING'];
/** the owner's list of 5 November 2026, in paise, excluding GST */
const OWNER: Record<string, number> = { THEME_SWITCH: 29_900, CAMPAIGN: 99_900, REEL_SLIDESHOW: 49_900, REEL_CORPORATE: 99_900, REEL_CINEMATIC: 299_900, LOGO_DESIGN: 29_900, POST_DESIGN: 9_900, SEO_MANAGER_HIRE: 99_900, CONTENT_CREATOR_HIRE: 99_900, BLOG_CREATOR_HIRE: 99_900, MESSAGE_SMS: 55, MESSAGE_EMAIL: 10, MESSAGE_WHATSAPP_MARKETING: 95 };
const code = (f: string): string => fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const seedFile = path.resolve(__dirname, '../src/v3-services/seed/services-seed.ts');
let w: ServicesWorld; let features: FakeFeatures;
beforeEach(() => { w = servicesWorld(); features = new FakeFeatures(); });
const priceCountFor = async (k: string): Promise<number> => (await w.services.servicePrices((await w.services.serviceByKey(k))!.id)).length;

describe('the seeded texts', () => {
  it('are the services the owner named (reels in three kinds, logo and post, the three hires, the campaign and the three messages), with unique keys', () => {
    expect(SERVICE_SEED.map((s) => s.key)).toEqual(ALL_KEYS);
    expect(new Set(SERVICE_SEED.map((s) => s.key)).size).toBe(23);
  });
  it('build nothing the owner marked TO CONFIRM (no POS campaign) and no plan price', () => {
    expect(SERVICE_SEED.filter((s) => /POS_|HANDYMAN|PROFESSIONAL|ECOMMERCE|PLAN/.test(s.key))).toEqual([]);
  });
  it('the campaign and the three messages are drafts (their modules come later); everything else is active', () => {
    for (const s of SERVICE_SEED) expect([s.key, s.status]).toEqual([s.key, DRAFTS.includes(s.key) ? 'DRAFT' : 'ACTIVE']);
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
      expect([s.key, /\bleads?\b/i.test(text)]).toEqual([s.key, false]);   // the owner's word is "enquiries"
      expect([s.key, /\bguarante/i.test(text) && !/no guarantee/i.test(text)]).toEqual([s.key, false]);   // no promise of results
    }
  });
  it('THEME_SWITCH is instant and done by either; the team services are requests; the promotion is a team request', () => {
    const by = Object.fromEntries(SERVICE_SEED.map((s) => [s.key, s]));
    expect(by.THEME_SWITCH).toMatchObject({ doneBy: 'EITHER', deliveryKind: 'INSTANT' });
    for (const k of ['SETUP_HELP', 'DOMAIN_CONNECT_HELP', 'CONTENT_UPDATE', 'CUSTOM_DOMAIN_PROMOTION', 'POSTER_DESIGN']) expect(by[k]).toMatchObject({ doneBy: 'TEAM', deliveryKind: 'TEAM_REQUEST' });
  });
  it('the reels, the designs and the three hires are team requests; the messages are instant and done by the vendor; the campaign names the three objectives and promises no result', () => {
    const by = Object.fromEntries(SERVICE_SEED.map((s) => [s.key, s]));
    for (const k of ['REEL_SLIDESHOW', 'REEL_CORPORATE', 'REEL_CINEMATIC', 'LOGO_DESIGN', 'POST_DESIGN', 'SEO_MANAGER_HIRE', 'CONTENT_CREATOR_HIRE', 'BLOG_CREATOR_HIRE']) expect(by[k]).toMatchObject({ doneBy: 'TEAM', deliveryKind: 'TEAM_REQUEST' });
    for (const k of ['MESSAGE_SMS', 'MESSAGE_EMAIL', 'MESSAGE_WHATSAPP_MARKETING']) expect(by[k]).toMatchObject({ kind: 'MESSAGING', doneBy: 'VENDOR', deliveryKind: 'INSTANT' });
    const c = [by.CAMPAIGN.shortDescription, by.CAMPAIGN.includesText].join(' ');
    expect(c).toMatch(/brand awareness/i); expect(c).toMatch(/website visits/i); expect(c).toMatch(/enquiries/i); expect(c).toMatch(/no guarantee/i);
  });
  it('the seed source never writes an APPROVED price (the word does not appear in its code)', () => { expect(code(seedFile)).not.toMatch(/APPROVED/); });
});

describe('the owner price list', () => {
  it('is exactly the owner list of 5 November 2026, in whole paise, with the source named', () => {
    expect(Object.fromEntries(OWNER_PRICE_SEED.map((p) => [p.serviceKey, p.amountPaise]))).toEqual(OWNER);
    expect(OWNER_PRICE_SEED).toHaveLength(13); expect(OWNER_PRICE_SOURCE).toBe('OWNER_DECISION_2026_11_05'); expect(THEME_SWITCH_PROPOSED_PAISE).toBe(29_900);
    for (const p of OWNER_PRICE_SEED) { expect(Number.isInteger(p.amountPaise)).toBe(true); expect(SERVICE_SEED.map((s) => s.key)).toContain(p.serviceKey); }
  });
});

describe('the loader', () => {
  it('a dry run writes nothing and says what it would do', async () => {
    const r = await seedServices(w.services, features, { apply: false });
    expect(r.missingServices).toHaveLength(23); expect(r.createdServices).toEqual([]); expect(r.priceProposed).toBe(false); expect(r.priceRowsWritten).toEqual([]); expect(r.missingFeatures).toHaveLength(18); expect(r.createdFeatures).toEqual([]);
    expect(await w.services.services()).toEqual([]); expect(features.creates).toBe(0); expect(w.services.audits).toEqual([]);
  });
  it('apply creates the services and the owner prices as PROPOSED rows (paise, excluding GST, source marked) and no approved price anywhere', async () => {
    const r = await seedServices(w.services, features, { apply: true });
    expect(r.createdServices).toHaveLength(23); expect(r.priceProposed).toBe(true);
    expect(Object.fromEntries(r.priceRowsWritten.map((p) => [p.serviceKey, p.amountPaise]))).toEqual(OWNER); expect(r.priceRowsWritten.every((p) => p.status === 'PROPOSED')).toBe(true);
    const prices = await w.services.allServicePrices(); expect(prices).toHaveLength(13);
    for (const p of prices) {
      expect(p).toMatchObject({ status: 'PROPOSED', effectiveFrom: null, approvedBy: null, approvedAt: null, currency: 'INR', taxInclusive: false, createdBy: OWNER_PRICE_SOURCE });
      expect(p.note).toContain(OWNER_PRICE_SOURCE);
    }
    expect(prices.filter((p) => p.status === 'APPROVED')).toEqual([]);
  });
  it('loads no price for a service the owner did not price', async () => {
    await seedServices(w.services, features, { apply: true });
    for (const k of ['POSTER_DESIGN', 'DOCUMENT_DESIGN', 'SEO_TASK', 'CONTENT_UPDATE', 'CUSTOM_THEME', 'SETUP_HELP', 'DOMAIN_CONNECT_HELP', 'GBP_SETUP', 'SOCIAL_MANAGEMENT_REQUEST', 'CUSTOM_DOMAIN_PROMOTION']) expect([k, await priceCountFor(k)]).toEqual([k, 0]);
  });
  it('the proposals are not prices: the public catalogue is empty and a vendor sees "price not set"', async () => {
    await seedServices(w.services, features, { apply: true });
    expect((await w.catalogue.publicCatalogue()).items).toEqual([]);
    await w.open('v1');
    const t = (await w.catalogue.vendorServices('v1')).items.find((s) => s.key === 'THEME_SWITCH')!;
    expect(t).toMatchObject({ price: null, priceNote: 'Price not set', funding: { kind: 'NONE', reason: 'PRICE_NOT_SET' } });
  });
  it('a proposed price becomes real only when a SUPER_ADMIN approves it with a date', async () => {
    await seedServices(w.services, features, { apply: true });
    const [p] = await w.services.servicePrices((await w.services.serviceByKey('THEME_SWITCH'))!.id);
    await w.catalogue.approvePrice('service', p.id, { effectiveFrom: new Date(w.clock().getTime() + 1000).toISOString() }, { type: 'STAFF', id: 'super-1', ip: null });
    w.now.t = new Date(w.now.t.getTime() + 2000);
    expect((await w.catalogue.publicCatalogue()).items).toEqual([expect.objectContaining({ key: 'THEME_SWITCH', price: expect.objectContaining({ amountPaise: 29_900 }) })]);
  });
  it('the draft services are never in the public catalogue, even with an approved price', async () => {
    await seedServices(w.services, features, { apply: true });
    const [p] = await w.services.servicePrices((await w.services.serviceByKey('CAMPAIGN'))!.id);
    await w.catalogue.approvePrice('service', p.id, { effectiveFrom: new Date(w.clock().getTime() + 1000).toISOString() }, { type: 'STAFF', id: 'super-1', ip: null });
    w.now.t = new Date(w.now.t.getTime() + 2000);
    expect((await w.catalogue.publicCatalogue()).items.map((i) => i.key)).not.toContain('CAMPAIGN');
  });
  it('runs twice without changing anything', async () => {
    await seedServices(w.services, features, { apply: true });
    const again = await seedServices(w.services, features, { apply: true });
    expect(again.createdServices).toEqual([]); expect(again.priceProposed).toBe(false); expect(again.priceAlreadyThere).toBe(true); expect(again.priceRowsWritten).toEqual([]); expect(again.createdFeatures).toEqual([]);
    expect(await w.services.services()).toHaveLength(23); expect(await w.services.allServicePrices()).toHaveLength(13); expect(features.creates).toBe(1);
  });
  it('leaves a service staff already changed exactly as it is, and adds no owner row next to a price that service already has', async () => {
    await w.catalogue.createService({ ...SERVICE_SEED[0], name: 'Theme change (renamed by staff)', status: 'ACTIVE' } as never, OPS);
    await w.catalogue.proposePrice('service', 'THEME_SWITCH', { amountPaise: 11_111 }, OPS);
    const r = await seedServices(w.services, features, { apply: true });
    expect(r.createdServices).toHaveLength(22); expect(r.priceProposed).toBe(true);
    expect((await w.services.serviceByKey('THEME_SWITCH'))!.name).toBe('Theme change (renamed by staff)');
    expect((await w.services.servicePrices((await w.services.serviceByKey('THEME_SWITCH'))!.id)).map((p) => p.amountPaise)).toEqual([11_111]);
    expect(r.priceRowsWritten.map((p) => p.serviceKey)).not.toContain('THEME_SWITCH'); expect(await w.services.allServicePrices()).toHaveLength(13);
  });
  it('creates the plan-allowance features for every team service (not THEME_SWITCH, the campaign or a message), as limits, with no value for any plan', async () => {
    await seedServices(w.services, features, { apply: true });
    expect(ALLOWANCE_SERVICE_KEYS).toHaveLength(18);
    for (const k of ['THEME_SWITCH', 'CAMPAIGN', 'MESSAGE_SMS', 'MESSAGE_EMAIL', 'MESSAGE_WHATSAPP_MARKETING']) expect(ALLOWANCE_SERVICE_KEYS).not.toContain(k);
    expect([...features.rows.keys()].sort()).toEqual(ALLOWANCE_SERVICE_KEYS.map(allowanceFeatureKey).sort());
    for (const f of features.rows.values()) expect(f).toMatchObject({ kind: 'LIMIT', group: 'services' });
    expect(allowanceFeatureKey('POSTER_DESIGN')).toBe('services.included.POSTER_DESIGN');
  });
});

describe('the script', () => {
  const script = fs.readFileSync(path.resolve(__dirname, '../scripts/seed-v3-services.js'), 'utf8');
  it('is a dry run unless --apply is given, runs the staging guard, names the owner source and reports that no approved price was written', () => {
    expect(script).toMatch(/const APPLY = process\.argv\.slice\(2\)\.includes\('--apply'\)/); expect(script).toMatch(/loadStagingEnv\(\)/);
    expect(script).toMatch(/price rows written with status APPROVED: 0/); expect(script).toMatch(/OWNER_PRICE_SOURCE/); expect(script).not.toMatch(/status:\s*'APPROVED'|'APPROVED'\s*\}/);
  });
});
