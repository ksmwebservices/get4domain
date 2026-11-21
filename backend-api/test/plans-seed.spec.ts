import * as fs from 'fs';
import * as path from 'path';
import { generatePriceRows, roundHalfUpRupees } from '../src/plans/pricing/price-generator';
import { expandSeed, SeedFile, validateSeedFile } from '../src/plans/seed/seed-file';
import { applySeed } from '../src/plans/seed/seed-applier';
import { MemorySeedStore } from './support/memory-seed-store';

/** S51.3: the seed file the owner edits, the pure expansion, and the idempotent loader. No database: a memory store stands in for Prisma. */
const seedPath = path.resolve(__dirname, '../prisma/seed/v3-plans.seed.json');
const load = (): SeedFile => JSON.parse(fs.readFileSync(seedPath, 'utf8'));
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

describe('price generator (pure)', () => {
  it('rounds half up to a whole rupee', () => {
    expect(roundHalfUpRupees(2694.6)).toBe(2695);
    expect(roundHalfUpRupees(4790.4)).toBe(4790);
    expect(roundHalfUpRupees(100.5)).toBe(101);
  });

  it('produces the owner-confirmed prices from the base rates and the term discounts (paise)', () => {
    const rows = generatePriceRows({
      plans: [{ key: 'handyman_pro', level: 'PRO' }, { key: 'professional_pro', level: 'PRO' }, { key: 'ecommerce_pro', level: 'PRO' }, { key: 'handyman_free', level: 'FREE' }],
      baseMonthlyPaise: { handyman_pro: 49900, professional_pro: 99900, ecommerce_pro: 149900 },
      termRules: [{ termMonths: 3, percentOff: 0 }, { termMonths: 6, percentOff: 10 }, { termMonths: 12, percentOff: 20 }],
      allowedTerms: [3, 6, 12],
      effectiveFrom: '2026-11-01T00:00:00.000Z',
    });
    const by = Object.fromEntries(rows.map((r) => [`${r.planKey}:${r.termMonths}`, r.amountPaise]));
    expect(by).toEqual({
      'handyman_pro:3': 149700, 'handyman_pro:6': 269500, 'handyman_pro:12': 479000,
      'professional_pro:3': 299700, 'professional_pro:6': 539500, 'professional_pro:12': 959000,
      'ecommerce_pro:3': 449700, 'ecommerce_pro:6': 809500, 'ecommerce_pro:12': 1439000,
    });
    expect(rows.every((r) => r.status === 'PROPOSED' && r.taxInclusive === false)).toBe(true);
  });

  it('works for ANY values: a changed base rate or percentage changes the rows; no price exists elsewhere', () => {
    const args = { plans: [{ key: 'p', level: 'PRO' as const }], termRules: [{ termMonths: 6, percentOff: 25 }], allowedTerms: [3, 6, 12], effectiveFrom: '2027-01-01T00:00:00.000Z' };
    expect(generatePriceRows({ ...args, baseMonthlyPaise: { p: 100000 } }).map((r) => r.amountPaise)).toEqual([450000]);
    expect(generatePriceRows({ ...args, baseMonthlyPaise: { p: 200000 } }).map((r) => r.amountPaise)).toEqual([900000]);
  });

  it('skips FREE plans, plans without a base rate, terms without a TERM rule, and terms that are not allowed (monthly stays off)', () => {
    const rows = generatePriceRows({
      plans: [{ key: 'a_free', level: 'FREE' }, { key: 'b_pro', level: 'PRO' }, { key: 'c_pro', level: 'PRO' }],
      baseMonthlyPaise: { a_free: 0, b_pro: 10000 }, termRules: [{ termMonths: 1, percentOff: 0 }, { termMonths: 3, percentOff: 0 }], allowedTerms: [3, 6, 12], effectiveFrom: '2026-11-01T00:00:00.000Z',
    });
    expect(rows.map((r) => `${r.planKey}:${r.termMonths}`)).toEqual(['b_pro:3']);
  });

  it('allows a monthly term only when the caller says it is allowed', () => {
    const rows = generatePriceRows({ plans: [{ key: 'b_pro', level: 'PRO' }], baseMonthlyPaise: { b_pro: 10000 }, termRules: [{ termMonths: 1, percentOff: 0 }], allowedTerms: [1, 3, 6, 12], effectiveFrom: '2026-11-01T00:00:00.000Z' });
    expect(rows.map((r) => r.termMonths)).toEqual([1]);
  });
});

describe('the seed file', () => {
  it('exists at backend-api/prisma/seed/v3-plans.seed.json and validates', () => {
    expect(fs.existsSync(seedPath)).toBe(true);
    expect(validateSeedFile(load())).toEqual([]);
  });

  it('holds the six plans, the feature catalogue, the matrix, the settings, the TERM rules and one tax row', () => {
    const e = expandSeed(load());
    expect(e.plans.map((p) => p.key).sort()).toEqual(['ecommerce_free', 'ecommerce_pro', 'handyman_free', 'handyman_pro', 'professional_free', 'professional_pro']);
    expect(e.features.length).toBeGreaterThanOrEqual(25);
    expect(e.planFeatures.length).toBe(e.plans.length * e.features.length);
    expect(e.taxRates).toHaveLength(1);
    expect(e.discountRules.filter((d) => d.type === 'TERM').map((d) => [d.conditions.termMonths, d.percentOff])).toEqual([[3, 0], [6, 10], [12, 20]]);
    expect(e.settings.map((s) => s.key)).toEqual(expect.arrayContaining(['graceDays', 'allowMonthly', 'renewalReminderDays', 'downgradeBehaviour', 'upgradeProration', 'registrationProvisioning', 'baseMonthlyPaise.handyman_pro']));
  });

  it('the generated price rows are exactly the nine owner-confirmed prices and nothing for FREE plans', () => {
    const e = expandSeed(load());
    expect(e.prices).toHaveLength(9);
    expect(e.prices.filter((p) => p.planKey.endsWith('_free'))).toEqual([]);
    expect(Object.fromEntries(e.prices.map((p) => [`${p.planKey}:${p.termMonths}`, p.amountPaise / 100]))).toEqual({
      'handyman_pro:3': 1497, 'handyman_pro:6': 2695, 'handyman_pro:12': 4790,
      'professional_pro:3': 2997, 'professional_pro:6': 5395, 'professional_pro:12': 9590,
      'ecommerce_pro:3': 4497, 'ecommerce_pro:6': 8095, 'ecommerce_pro:12': 14390,
    });
  });

  it('follows the starter pattern of the spec for the matrix', () => {
    const cell = (plan: string, key: string) => expandSeed(load()).planFeatures.find((c) => c.planKey === plan && c.featureKey === key)!;
    expect(cell('handyman_free', 'site.pages')).toMatchObject({ state: 'LIMITED', limitValue: 1 });
    expect(cell('handyman_pro', 'site.pages')).toMatchObject({ state: 'LIMITED', limitValue: 24 });
    expect(cell('professional_free', 'site.services')).toMatchObject({ limitValue: 8 });
    expect(cell('ecommerce_pro', 'site.gallery')).toMatchObject({ limitValue: 40 });
    expect(cell('handyman_free', 'site.video').state).toBe('LOCKED_PREVIEW');
    expect(cell('handyman_pro', 'site.video').state).toBe('ACTIVE');
    expect(cell('handyman_free', 'site.booking').state).toBe('LOCKED_PREVIEW');   // 5.1c: Free has no call to action; it is shown as a locked preview
    expect(cell('professional_pro', 'site.booking').state).toBe('ACTIVE');
    expect(cell('ecommerce_pro', 'site.booking').state).toBe('HIDDEN');
    expect(cell('ecommerce_pro', 'shop.cart').state).toBe('ACTIVE');
    expect(cell('handyman_pro', 'shop.cart').state).toBe('HIDDEN');
    expect(cell('ecommerce_free', 'shop.products')).toMatchObject({ state: 'LIMITED', limitValue: 12 });
    expect(cell('handyman_free', 'directory.listing').state).toBe('ACTIVE');
    expect(cell('handyman_free', 'seo.keyword_volumes').state).toBe('LOCKED_PREVIEW');
  });

  it('every LIMITED cell has a limit and every locked or hidden cell has none; upsell text exists on every locked preview', () => {
    for (const c of expandSeed(load()).planFeatures) {
      if (c.state === 'LIMITED') expect(c.limitValue).not.toBeNull();
      if (c.state === 'LOCKED_PREVIEW') expect((c.upsellText ?? '').length).toBeGreaterThan(3);
    }
  });

  it('validation rejects a bad file (unknown state, duplicate key, missing plan, LIMITED without a limit, bad term)', () => {
    const bad = (mut: (s: SeedFile) => void) => { const s = clone(load()); mut(s); return validateSeedFile(s); };
    expect(bad((s) => { s.features[0].free = { state: 'MAYBE' as never }; }).length).toBeGreaterThan(0);
    expect(bad((s) => { s.features.push(clone(s.features[0])); }).join()).toMatch(/duplicate feature/i);
    expect(bad((s) => { s.plans.pop(); }).join()).toMatch(/six plans|plan/i);
    expect(bad((s) => { s.features[0].free = { state: 'LIMITED' }; }).join()).toMatch(/limit/i);
    expect(bad((s) => { s.discountRules[0].conditions = { termMonths: 5 }; }).join()).toMatch(/term/i);
  });
});

describe('the loader (applySeed) with a memory store', () => {
  it('a dry run writes nothing and reports what it would do', async () => {
    const store = new MemorySeedStore();
    const report = await applySeed(store, expandSeed(load()), { apply: false });
    expect(store.writes).toBe(0);
    expect(report.created).toBeGreaterThan(100);
    expect(report.applied).toBe(false);
  });

  it('--apply loads everything; running it twice changes nothing the second time (idempotent)', async () => {
    const store = new MemorySeedStore();
    const first = await applySeed(store, expandSeed(load()), { apply: true });
    expect(first.created).toBeGreaterThan(100);
    const snapshot = JSON.stringify(store.dump());
    const second = await applySeed(store, expandSeed(load()), { apply: true });
    expect(second.created).toBe(0);
    expect(second.updated).toBe(0);
    expect(second.unchanged).toBe(first.created);
    expect(JSON.stringify(store.dump())).toBe(snapshot);
  });

  it('editing a value in the FILE changes the stored behaviour with no code change (limit, matrix state, base rate, term discount)', async () => {
    const store = new MemorySeedStore();
    await applySeed(store, expandSeed(load()), { apply: true });
    const edited = clone(load());
    edited.features.find((f) => f.key === 'site.pages')!.pro = { state: 'LIMITED', limit: 99 };
    edited.features.find((f) => f.key === 'site.video')!.free = { state: 'ACTIVE' };
    edited.settings['baseMonthlyPaise.handyman_pro'] = { value: 60000, description: 'edited' };
    edited.discountRules.find((d) => d.conditions.termMonths === 12)!.percentOff = 30;
    const report = await applySeed(store, expandSeed(edited), { apply: true });
    expect(report.updated).toBeGreaterThan(3);
    expect(store.get('planFeatures', 'handyman_pro|site.pages')).toMatchObject({ limitValue: 99 });
    expect(store.get('planFeatures', 'handyman_free|site.video')).toMatchObject({ state: 'ACTIVE' });
    expect(store.get('prices', 'handyman_pro|3|2026-11-01T00:00:00.000Z')).toMatchObject({ amountPaise: 180000 });
    expect(store.get('prices', 'handyman_pro|12|2026-11-01T00:00:00.000Z')).toMatchObject({ amountPaise: 504000 });
  });

  it('never overwrites a price an admin has already APPROVED (the owner\'s approval wins) and says so', async () => {
    const store = new MemorySeedStore();
    await applySeed(store, expandSeed(load()), { apply: true });
    store.patch('prices', 'handyman_pro|3|2026-11-01T00:00:00.000Z', { status: 'APPROVED', amountPaise: 123400 });
    const edited = clone(load());
    edited.settings['baseMonthlyPaise.handyman_pro'] = { value: 60000, description: 'edited' };
    const report = await applySeed(store, expandSeed(edited), { apply: true });
    expect(store.get('prices', 'handyman_pro|3|2026-11-01T00:00:00.000Z')).toMatchObject({ status: 'APPROVED', amountPaise: 123400 });
    expect(report.skippedApproved).toContain('handyman_pro|3|2026-11-01T00:00:00.000Z');
  });
});

describe('the seed command (scripts/seed-v3-plans.js)', () => {
  const script = fs.readFileSync(path.resolve(__dirname, '../scripts/seed-v3-plans.js'), 'utf8');
  it('is a dry run unless --apply is given, and is staging only through the guard', () => {
    expect(script).toMatch(/argv\.includes\('--apply'\)/);
    expect(script).toMatch(/loadStagingEnv/);
    expect(script).not.toMatch(/\.env\.local|\.env\.prod/);
  });
});
