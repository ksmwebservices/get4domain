import * as fs from 'fs';
import * as path from 'path';
import { expandSeed, SeedFile, validateSeedFile } from '../src/plans/seed/seed-file';

/**
 * Amendment 06 point 2 as a decision table: Free is LOCKED_PREVIEW for the customer list, accounts, jobs, appointments and the store on the track that has the module (no LIMITED allowance for invoices
 * or stock for Free); a module that does not belong to a track is HIDDEN there; Pro turns on exactly the modules of its own track.
 */
const seed: SeedFile = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../prisma/seed/v3-plans.seed.json'), 'utf8'));
const table = expandSeed(seed).planFeatures;
const state = (plan: string, feature: string): string | undefined => table.find((r) => r.planKey === plan && r.featureKey === feature)?.state;

const EVERY_TRACK = ['handyman', 'professional', 'ecommerce'];
const EXPECT: Record<string, string[]> = {
  'crm.customers': EVERY_TRACK, 'accounts.books': EVERY_TRACK, 'accounts.items': ['handyman', 'professional'],
  'jobs.manage': ['handyman'], 'appointments.manage': ['professional'], 'store.manage': ['ecommerce'],
};

describe('the seed still validates with the Batch 13 features added', () => { it('has no problems', () => { expect(validateSeedFile(seed)).toEqual([]); }); });

describe('Free and Pro per track for every Batch 13 module', () => {
  for (const [feature, tracks] of Object.entries(EXPECT)) {
    for (const track of EVERY_TRACK) {
      const owns = tracks.includes(track);
      it(`${feature} on ${track}: Free ${owns ? 'LOCKED_PREVIEW' : 'HIDDEN'}, Pro ${owns ? 'ACTIVE' : 'HIDDEN'}`, () => {
        expect(state(`${track}_free`, feature)).toBe(owns ? 'LOCKED_PREVIEW' : 'HIDDEN');
        expect(state(`${track}_pro`, feature)).toBe(owns ? 'ACTIVE' : 'HIDDEN');
      });
    }
  }
  it('no Batch 13 module gives Free a limited allowance, and a locked preview always has upsell text', () => {
    const rows = table.filter((r) => r.featureKey in EXPECT);
    expect(rows.length).toBe(Object.keys(EXPECT).length * 6);
    expect(rows.filter((r) => r.state === 'LIMITED')).toEqual([]);
    expect(rows.filter((r) => r.state === 'LOCKED_PREVIEW' && !(r.upsellText ?? '').trim())).toEqual([]);
  });
  it('the upsell text names no price, timeframe or retired product name', () => {
    for (const r of table.filter((x) => x.featureKey in EXPECT && x.upsellText)) expect(r.upsellText).not.toMatch(/\b(Workspace|BOS|LeadSpace)\b|₹|Rs\.?\s*\d|\b\d+\s*(days?|months?|hours?)\b/i);
  });
});
