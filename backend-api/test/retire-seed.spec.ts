import * as fs from 'fs';
import * as path from 'path';
import { expandSeed, SeedFile, validateSeedFile } from '../src/plans/seed/seed-file';
import { featureKeyOf, INDUSTRY_MODULES } from '../src/v3-retire/core/retire-core';

/**
 * Slice 5.25 as an entitlement decision table: every retired industry module is HIDDEN on every plan of every track (Free and Pro), the seed still validates, and the earlier features were not changed.
 */
const seed: SeedFile = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../prisma/seed/v3-plans.seed.json'), 'utf8'));
const table = expandSeed(seed).planFeatures;
const plans = [...new Set(table.map((r) => r.planKey))];

describe('retired industry modules in the plan seed', () => {
  it('the seed still validates', () => { expect(validateSeedFile(seed)).toEqual([]); });
  it('there are six plans (three tracks, Free and Pro)', () => { expect(plans.sort()).toEqual(['ecommerce_free', 'ecommerce_pro', 'handyman_free', 'handyman_pro', 'professional_free', 'professional_pro']); });
  it.each(INDUSTRY_MODULES.map((m) => [m]))('industry.%s is HIDDEN on every plan', (m) => {
    const rows = table.filter((r) => r.featureKey === featureKeyOf(m));
    expect(rows).toHaveLength(plans.length); expect(rows.filter((r) => r.state !== 'HIDDEN')).toEqual([]);
  });
  it('the seed has no retired-module feature that the code does not know, and none is missing', () => {
    const inSeed = [...new Set(table.map((r) => r.featureKey).filter((k) => k.startsWith('industry.')))].sort();
    expect(inSeed).toEqual(INDUSTRY_MODULES.map(featureKeyOf).sort());
  });
  it('the text of these features names no price, timeframe or retired product name', () => {
    const text = JSON.stringify(seed.features.filter((f) => f.key.startsWith('industry.')));
    expect(text).not.toMatch(/\b(Workspace|BOS|LeadSpace)\b|₹|Rs\.?\s*\d|\b\d+\s*(days?|months?|hours?)\b/i);
  });
});
