'use strict';
/**
 * B2.3: the nine owner plan prices (18 November 2026), and the pure rules that turn them into writes. Rupees, per billing term TOTAL, BEFORE GST; converted to whole paise here.
 * No database, no clock. The runner (propose-v3-prices.js) does the I/O through PlansAdminService, so every write has its audit row.
 */
const SOURCE = 'OWNER_DECISION_2026_11_18';
const TERM_MONTHS = { quarterly: 3, halfYearly: 6, annual: 12 };

/** plan key -> rupees per term total, before GST */
const OWNER_PLAN_PRICES = Object.freeze({
  handyman_pro: { quarterly: 2247, halfYearly: 3774, annual: 5988 },
  professional_pro: { quarterly: 4497, halfYearly: 7494, annual: 11988 },
  ecommerce_pro: { quarterly: 5847, halfYearly: 9774, annual: 15588 },
});

const toPaise = (rupees) => { const p = Math.round(rupees * 100); if (!Number.isInteger(p) || p <= 0) throw new Error(`bad amount ${rupees}`); return p; };

/** The nine wanted rows, in a fixed order. */
function wantedRows() {
  const rows = [];
  for (const [planKey, terms] of Object.entries(OWNER_PLAN_PRICES)) for (const [name, months] of Object.entries(TERM_MONTHS)) rows.push({ planKey, termMonths: months, amountPaise: toPaise(terms[name]) });
  return rows;
}

/**
 * What to do, given the plans (`{id,key}`) and every existing price row (`{id,planId,termMonths,amountPaise,status}`):
 *  - an APPROVED row is NEVER touched or listed for change (it is reported as `approvedKept`; the new proposal sits beside it and a super admin decides);
 *  - a PROPOSED row for the same plan and term with the same amount is kept (`unchanged`): running the script twice changes nothing;
 *  - a PROPOSED row with another amount is superseded (`supersede`, deleted through the audited admin service) and a new PROPOSED row is created;
 *  - a plan that does not exist is reported in `missingPlans` and nothing is written for it.
 */
function planWrites(plans, prices) {
  const byKey = new Map(plans.map((p) => [p.key, p]));
  const out = { create: [], supersede: [], unchanged: [], approvedKept: [], missingPlans: [] };
  for (const w of wantedRows()) {
    const plan = byKey.get(w.planKey);
    if (!plan) { if (!out.missingPlans.includes(w.planKey)) out.missingPlans.push(w.planKey); continue; }
    const rows = prices.filter((r) => r.planId === plan.id && r.termMonths === w.termMonths);
    for (const r of rows.filter((x) => x.status === 'APPROVED')) out.approvedKept.push({ planKey: w.planKey, termMonths: w.termMonths, priceId: r.id, amountPaise: r.amountPaise });
    const pending = rows.filter((x) => x.status === 'PROPOSED');
    const same = pending.find((x) => x.amountPaise === w.amountPaise);
    if (same) { out.unchanged.push({ ...w, planId: plan.id, priceId: same.id }); for (const x of pending.filter((y) => y !== same)) out.supersede.push({ planKey: w.planKey, termMonths: w.termMonths, priceId: x.id, amountPaise: x.amountPaise }); continue; }
    for (const x of pending) out.supersede.push({ planKey: w.planKey, termMonths: w.termMonths, priceId: x.id, amountPaise: x.amountPaise });
    out.create.push({ ...w, planId: plan.id });
  }
  return out;
}

module.exports = { SOURCE, OWNER_PLAN_PRICES, TERM_MONTHS, wantedRows, planWrites, toPaise };
