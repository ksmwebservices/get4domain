'use strict';
/**
 * B4: the pure rules of withdraw-future-prices.js. No database, no clock. A row is withdrawn only when ALL of these hold:
 *   APPROVED, INR, its start is in the FUTURE (not started: never one in force), its plan and term are one of the nine, and its amount is EXACTLY the old amount of that plan and term.
 * Anything else (started, PROPOSED, WITHDRAWN, another amount, another term, another plan) is left alone, so a second run finds nothing to do.
 */
const REASON = 'Wrong amount, replaced by owner decision of 18 Nov 2026';
const TERMS = [3, 6, 12];
/** rupees before GST, per billing term total, by plan key: [3, 6, 12 months] */
const OLD_RUPEES = Object.freeze({ handyman_pro: [1497, 2695, 4790], professional_pro: [2997, 5395, 9590], ecommerce_pro: [4497, 8095, 14390] });
const PLAN_KEYS = Object.keys(OLD_RUPEES);
const oldPaise = (planKey, term) => { const r = OLD_RUPEES[planKey]; const i = TERMS.indexOf(term); return r && i >= 0 ? r[i] * 100 : null; };

/** plans: [{id,key}], prices: every row [{id,planId,termMonths,amountPaise,currency,status,effectiveFrom:Date}] */
function planWithdrawals(plans, prices, now) {
  const out = { withdraw: [], leftAlone: 0, missingPlans: [] };
  for (const key of PLAN_KEYS) if (!plans.some((p) => p.key === key)) out.missingPlans.push(key);
  for (const p of plans.filter((x) => PLAN_KEYS.includes(x.key))) {
    for (const r of prices.filter((x) => x.planId === p.id)) {
      const hit = r.status === 'APPROVED' && r.currency === 'INR' && r.effectiveFrom.getTime() > now.getTime() && TERMS.includes(r.termMonths) && r.amountPaise === oldPaise(p.key, r.termMonths);
      if (hit) out.withdraw.push({ planKey: p.key, termMonths: r.termMonths, amountPaise: r.amountPaise, effectiveFrom: r.effectiveFrom, priceId: r.id });
      else out.leftAlone += 1;
    }
  }
  out.withdraw.sort((a, b) => a.planKey.localeCompare(b.planKey) || a.termMonths - b.termMonths || a.effectiveFrom - b.effectiveFrom);
  return out;
}

/** For the closing summary: per plan and term, the price in force (latest APPROVED INR row that has started) and the PROPOSED rows. */
function summarise(plans, prices, now) {
  const rows = [];
  for (const key of PLAN_KEYS) {
    const p = plans.find((x) => x.key === key);
    if (!p) continue;
    for (const term of TERMS) {
      const mine = prices.filter((r) => r.planId === p.id && r.termMonths === term);
      const inForce = mine.filter((r) => r.status === 'APPROVED' && r.currency === 'INR' && r.effectiveFrom.getTime() <= now.getTime()).sort((a, b) => b.effectiveFrom - a.effectiveFrom)[0] ?? null;
      rows.push({ planKey: key, termMonths: term, inForce: inForce ? inForce.amountPaise : null, proposed: mine.filter((r) => r.status === 'PROPOSED').map((r) => r.amountPaise).sort((a, b) => a - b) });
    }
  }
  return rows;
}
module.exports = { REASON, OLD_RUPEES, PLAN_KEYS, TERMS, oldPaise, planWithdrawals, summarise };
