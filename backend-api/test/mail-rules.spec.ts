import * as fs from 'fs';
import * as path from 'path';
import { OPT_IN_PROOF_FIELDS, dailyAllowance, lanePromotionAllowed, mustPause, optInProofComplete, priceReady } from '../src/v3-mail/mail-rules/core/mail-rules-core';
import { DEFAULT_MAIL_RULES_SETTINGS, mailRulesSettingProblem, promoLimitsOf, resolveMailRulesSettings } from '../src/v3-mail/mail-rules/mail-rules-settings';
import { MailRulesService, SEED_LANES, SEED_PRICES } from '../src/v3-mail/mail-rules/mail-rules.service';

const STAFF = { type: 'STAFF' as const, id: 's1', ip: null };
const code = async (p: Promise<unknown>): Promise<string> => { try { await p; return 'OK'; } catch (e) { return (e as { response?: { code?: string } }).response?.code ?? 'ERR'; } };

/** A tiny in-memory stand-in for the two tables, enough for the service. */
function fakePrisma() {
  const lanes = new Map<string, Record<string, unknown>>(); const prices = new Map<string, Record<string, unknown>>(); let n = 0;
  return {
    lanes, prices,
    v3MailLane: { findMany: async () => [...lanes.values()], createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => { for (const d of data) if (!lanes.has(d.key as string)) lanes.set(d.key as string, d); } },
    v3MailboxPrice: {
      findMany: async () => [...prices.values()], findUnique: async ({ where }: { where: { id: string } }) => [...prices.values()].find((p) => p.id === where.id) ?? null,
      createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => { for (const d of data) if (!prices.has(d.key as string)) prices.set(d.key as string, { id: `p${++n}`, confirmedAt: null, confirmedBy: null, confirmNote: null, ...d }); },
      updateMany: async ({ where, data }: { where: { id: string; status: string }; data: Record<string, unknown> }) => { const p = [...prices.values()].find((x) => x.id === where.id && x.status === where.status); if (!p) return { count: 0 }; Object.assign(p, data); return { count: 1 }; },
    },
  };
}
const make = (settings = DEFAULT_MAIL_RULES_SETTINGS) => { const db = fakePrisma(); const svc = new MailRulesService(db as never, { get: async () => settings } as never); svc.clock = () => new Date('2026-11-14T10:00:00Z'); return { db, svc }; };

describe('the lanes recorded as data', () => {
  it('only the promotions lane may allow promotion; the seed agrees with the rule and nothing is switched on to send', () => {
    expect([...['SYSTEM', 'VENDOR_OFFICIAL', 'PROMOTIONS']].map((k) => lanePromotionAllowed(k as never))).toEqual([false, false, true]);
    expect(SEED_LANES.map((l) => [l.key, l.allowsPromotion, l.sendingEnabled])).toEqual([['SYSTEM', false, false], ['VENDOR_OFFICIAL', false, false], ['PROMOTIONS', true, false]]);
  });
  it('the database refuses lane 1 or lane 2 promotion and refuses switching sending on for lanes 2 and 3 (CHECKs in the migration)', () => {
    const sql = fs.readFileSync(path.resolve(__dirname, '../prisma/migrations/20261214150000_v3_mail_rules/migration.sql'), 'utf8');
    expect(sql).toMatch(/"allowsPromotion" = false OR "key" = 'PROMOTIONS'/); expect(sql).toMatch(/"sendingEnabled" = false OR "key" = 'SYSTEM'/); expect(sql).toMatch(/"status" = 'PENDING' OR \("confirmedAt" IS NOT NULL/);
  });
  it('the proposed mailbox prices are the amendment numbers: forwarding free, 1 included, 99 add-on, 79 extra, all excluding GST', () => {
    expect(SEED_PRICES.map((p) => [p.key, p.pricePaise, p.includedCount])).toEqual([['forwarding_any', 0, null], ['included_professional', null, 1], ['included_ecommerce', null, 1], ['addon_handyman', 9900, null], ['extra_any', 7900, null]]);
  });
  it('no sending code for lane 2 or lane 3 exists in the mail module (no transport, port or send function names a promotions or vendor-official send)', () => {
    const dir = path.resolve(__dirname, '../src/v3-mail'); const files: string[] = []; const walk = (d: string): void => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.isDirectory()) walk(path.join(d, e.name)); else files.push(path.join(d, e.name)); } }; walk(dir);
    for (const f of files.filter((x) => x.endsWith('.ts') && !/mail-rules/.test(x))) expect([f, /sendPromotion|sendCampaign|PromotionsTransport|sendBulk|lane:\s*'PROMOTIONS'/.test(fs.readFileSync(f, 'utf8'))]).toEqual([f, false]);
  });
});

describe('the limits are recorded settings and start unset', () => {
  it('every value starts unset, and unset means nothing is allowed', () => {
    const s = resolveMailRulesSettings(new Map()); expect(Object.values(s).every((v) => v === null)).toBe(true);
    expect(dailyAllowance(0, promoLimitsOf(s))).toBe(0); expect(dailyAllowance(null, promoLimitsOf(s))).toBe(0); expect(optInProofComplete({ source: 'form' }, s.promoOptInProofFields)).toEqual({ complete: false, missing: [] });
    expect(mustPause({ complaintPercent: 99, bouncePercent: 99 }, promoLimitsOf(s))).toEqual({ pause: false, because: [] });
  });
  it('validates each value', () => {
    expect(mailRulesSettingProblem('promoSendLimitPerDay', 0)).not.toBeNull(); expect(mailRulesSettingProblem('promoSendLimitPerDay', 200)).toBeNull();
    expect(mailRulesSettingProblem('promoWarmupDailyLimits', [])).not.toBeNull(); expect(mailRulesSettingProblem('promoWarmupDailyLimits', [20, 50, 100])).toBeNull(); expect(mailRulesSettingProblem('promoWarmupDailyLimits', [20, 0])).not.toBeNull();
    expect(mailRulesSettingProblem('promoComplaintPausePercent', 0)).not.toBeNull(); expect(mailRulesSettingProblem('promoComplaintPausePercent', 0.3)).toBeNull(); expect(mailRulesSettingProblem('promoBouncePausePercent', 101)).not.toBeNull();
    expect(mailRulesSettingProblem('promoOptInProofFields', ['source', 'consentedAt'])).toBeNull(); expect(mailRulesSettingProblem('promoOptInProofFields', ['source', 'source'])).not.toBeNull(); expect(mailRulesSettingProblem('promoOptInProofFields', ['colour'])).not.toBeNull();
    expect(resolveMailRulesSettings(new Map<string, unknown>([['promoSendLimitPerDay', -3]])).promoSendLimitPerDay).toBeNull();
  });
  it('the warm-up schedule holds a new business to its day, capped by the daily limit; past it the daily limit applies', () => {
    const l = { perDay: 100, perMonth: 2000, warmupDaily: [20, 50, 500], complaintPausePercent: null, bouncePausePercent: null };
    expect([null, 0, 1, 2, 3, 40].map((d) => dailyAllowance(d, l))).toEqual([20, 20, 50, 100, 100, 100]);
    expect(dailyAllowance(1, { ...l, warmupDaily: null })).toBe(100);
  });
  it('promotions pause by themselves when a complaint or bounce rate reaches its recorded limit', () => {
    const l = { complaintPausePercent: 0.3, bouncePausePercent: 5 };
    expect(mustPause({ complaintPercent: 0.1, bouncePercent: 1 }, l)).toEqual({ pause: false, because: [] }); expect(mustPause({ complaintPercent: 0.3, bouncePercent: 1 }, l)).toEqual({ pause: true, because: ['COMPLAINTS'] }); expect(mustPause({ complaintPercent: 0.5, bouncePercent: 6 }, l)).toEqual({ pause: true, because: ['COMPLAINTS', 'BOUNCES'] });
  });
  it('an opt-in proof is complete only when every recorded field is present and not blank', () => {
    const req = ['source', 'consentedAt', 'addressHash']; expect(OPT_IN_PROOF_FIELDS).toContain('source');
    expect(optInProofComplete({ source: 'form', consentedAt: 'x', addressHash: 'h' }, req)).toEqual({ complete: true, missing: [] }); expect(optInProofComplete({ source: 'form', consentedAt: '  ' }, req)).toEqual({ complete: false, missing: ['consentedAt', 'addressHash'] });
    expect(optInProofComplete({ source: 'form' }, [])).toEqual({ complete: false, missing: [] });
  });
});

describe('the service', () => {
  it('the loader is a dry run by default, creates what is missing once, never touches a row that exists, and leaves every price PENDING', async () => {
    const { svc, db } = make();
    expect(await svc.loadSeed(false)).toMatchObject({ applied: false, lanes: ['SYSTEM', 'VENDOR_OFFICIAL', 'PROMOTIONS'] }); expect(db.lanes.size).toBe(0);
    await svc.loadSeed(true); expect(db.lanes.size).toBe(3); expect(db.prices.size).toBe(5); expect([...db.prices.values()].every((p) => p.status === 'PENDING')).toBe(true);
    [...db.prices.values()][3].pricePaise = 12300; expect(await svc.loadSeed(true)).toMatchObject({ lanes: [], prices: [] }); expect([...db.prices.values()][3].pricePaise).toBe(12300);
  });
  it('the overview shows the lanes in order, the prices with whether they are ready, and the recorded rules', async () => {
    const { svc } = make({ ...DEFAULT_MAIL_RULES_SETTINGS, promoSendLimitPerDay: 100 }); await svc.loadSeed(true); const o = await svc.overview();
    expect(o.lanes.map((l) => l.key)).toEqual(['SYSTEM', 'VENDOR_OFFICIAL', 'PROMOTIONS']); expect(o.mailboxPrices.every((p) => p.status === 'PENDING' && p.ready)).toBe(true); expect(o.promotionRules).toMatchObject({ promoSendLimitPerDay: 100, recorded: true });
  });
  it('confirming a price needs a note, works once, and is refused for one that is not ready or does not exist', async () => {
    const { svc, db } = make(); await svc.loadSeed(true); const id = [...db.prices.values()][3].id as string;
    expect(await code(svc.confirmPrice(STAFF, id, 'no'))).toBe('MAIL_RULE_INVALID'); expect(await code(svc.confirmPrice(STAFF, 'nope', 'Checked in the panel'))).toBe('MAIL_RULE_NOT_FOUND');
    expect(await svc.confirmPrice(STAFF, id, 'Checked the cost in the panel')).toEqual({ id, key: 'addon_handyman', status: 'ACTIVE' }); expect([...db.prices.values()][3]).toMatchObject({ status: 'ACTIVE', confirmedBy: 's1', confirmNote: 'Checked the cost in the panel' });
    expect(await code(svc.confirmPrice(STAFF, id, 'Checked the cost in the panel'))).toBe('MAIL_RULE_STATE');
    const blank = [...db.prices.values()][4]; blank.pricePaise = null; expect(await code(svc.confirmPrice(STAFF, blank.id as string, 'Checked the cost in the panel'))).toBe('MAIL_RULE_INVALID'); expect(priceReady({ kind: 'EXTRA', scope: 'ANY', pricePaise: null, includedCount: null, status: 'PENDING' })).toBe(false);
  });
});
