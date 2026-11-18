import * as fs from 'fs';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const lib = require('../scripts/live/propose-v3-prices-lib.js') as { wantedRows: () => Array<{ planKey: string; termMonths: number; amountPaise: number }>; planWrites: (plans: unknown[], prices: unknown[]) => Record<string, Array<Record<string, unknown>>> };

/** B2.3: the nine owner prices and the rules of the propose script. */
const plans = [{ id: 'H', key: 'handyman_pro' }, { id: 'P', key: 'professional_pro' }, { id: 'E', key: 'ecommerce_pro' }];

describe('the nine owner prices', () => {
  it('are exactly the amounts the owner gave, in paise, per term total, before GST', () => {
    const rows = lib.wantedRows();
    const get = (k: string, m: number) => rows.find((r) => r.planKey === k && r.termMonths === m)?.amountPaise;
    expect(rows).toHaveLength(9);
    expect([get('handyman_pro', 3), get('handyman_pro', 6), get('handyman_pro', 12)]).toEqual([224700, 377400, 598800]);
    expect([get('professional_pro', 3), get('professional_pro', 6), get('professional_pro', 12)]).toEqual([449700, 749400, 1198800]);
    expect([get('ecommerce_pro', 3), get('ecommerce_pro', 6), get('ecommerce_pro', 12)]).toEqual([584700, 977400, 1558800]);
  });
});

describe('planWrites', () => {
  it('nothing existing: nine creates', () => {
    const w = lib.planWrites(plans, []);
    expect(w.create).toHaveLength(9);
    expect(w.supersede).toHaveLength(0);
  });
  it('an older pending proposal with another amount is superseded; the same amount is kept (a second run changes nothing)', () => {
    const prices = [
      { id: 'old', planId: 'H', termMonths: 3, amountPaise: 100000, status: 'PROPOSED' },
      { id: 'same', planId: 'H', termMonths: 6, amountPaise: 377400, status: 'PROPOSED' },
    ];
    const w = lib.planWrites(plans, prices);
    expect(w.supersede.map((r) => r.priceId)).toEqual(['old']);
    expect(w.unchanged.map((r) => r.priceId)).toEqual(['same']);
    expect(w.create).toHaveLength(8);
    const again = lib.planWrites(plans, lib.wantedRows().map((r, i) => ({ id: `p${i}`, planId: plans.find((p) => p.key === r.planKey)!.id, termMonths: r.termMonths, amountPaise: r.amountPaise, status: 'PROPOSED' })));
    expect(again.create).toHaveLength(0);
    expect(again.supersede).toHaveLength(0);
  });
  it('an APPROVED price is never superseded or changed, whatever its amount; the proposal is added beside it', () => {
    const w = lib.planWrites(plans, [{ id: 'live', planId: 'P', termMonths: 12, amountPaise: 999900, status: 'APPROVED' }]);
    expect(w.supersede).toHaveLength(0);
    expect(w.approvedKept.map((r) => r.priceId)).toEqual(['live']);
    expect(w.create.some((r) => r.planKey === 'professional_pro' && r.termMonths === 12)).toBe(true);
  });
  it('a missing plan is reported and nothing is written for it', () => {
    const w = lib.planWrites(plans.slice(0, 2), []);
    expect(w.missingPlans).toEqual(['ecommerce_pro']);
    expect(w.create).toHaveLength(6);
  });
});

describe('the runner script', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'live', 'propose-v3-prices.js'), 'utf8');
  it('goes through PlansAdminService, only ever creates PROPOSED rows, types LIVE before a live write, and defaults to a dry run', () => {
    expect(src).toContain("plans/admin/plans-admin.service");
    expect(src).toContain("status: 'PROPOSED'");
    expect(src).not.toMatch(/approvePrice|status: 'APPROVED'/);
    expect(src).toContain('Type LIVE to continue');
    expect(src).toContain('const apply = flags.includes(\'--apply\')');
  });
});
