'use strict';
// Pure decision logic for scripts/activate-stepnrock.js (kept separate so the verify suite can test it without a database).
//
// Why it exists: on 2026-10-07 a Deal-builder click created the deal and the ACTIVATION invoice but failed before
// activation (the Prisma "void" lock error), leaving an unpaid invoice with NO billing term. Re-running the script must
// finish that job — never create a second invoice (double-billing) and never crash.

const UNPAID = ['DRAFT', 'SENT', 'PENDING', 'OVERDUE', 'PAYMENT_SUBMITTED', 'PARTIALLY_PAID'];

/** The agreed stepnrock terms; an existing invoice is only reused if it matches ALL of them. */
const AGREED = { totalAmount: 599400, planKey: 'WORKSPACE', billingCycle: 'HALF_YEARLY', gstMode: 'NONE' };

function matchesAgreedDeal(inv) {
  return Boolean(inv) && inv.totalAmount === AGREED.totalAmount && inv.planKey === AGREED.planKey && inv.billingCycle === AGREED.billingCycle && inv.gstMode === AGREED.gstMode;
}

/**
 * @param {{ currentTerm: {status:string}|null, invoice: {status:string,totalAmount:number,planKey:string|null,billingCycle:string|null,gstMode:string,paidPaise:number}|null, submissionCount: number }} s
 * @returns {{ action: 'REFUSE_HAS_TERM'|'RESUME'|'VOID_AND_REPLACE'|'REFUSE_HAS_PAYMENTS'|'CREATE', reason: string }}
 */
function decideStepnrock({ currentTerm, invoice, submissionCount }) {
  if (currentTerm && currentTerm.status !== 'CANCELLED') return { action: 'REFUSE_HAS_TERM', reason: `stepnrock already has a billing term (${currentTerm.status})` };
  if (!invoice || !UNPAID.includes(invoice.status)) return { action: 'CREATE', reason: invoice ? `the last activation invoice is ${invoice.status}` : 'no activation invoice exists' };
  if (matchesAgreedDeal(invoice)) return { action: 'RESUME', reason: 'an unpaid activation invoice for the agreed deal exists but no billing term — finish activation on it' };
  if ((invoice.paidPaise ?? 0) > 0 || submissionCount > 0) return { action: 'REFUSE_HAS_PAYMENTS', reason: 'an unpaid invoice that does NOT match the agreed deal already has payments or payment proofs — resolve it in Admin → Commerce first' };
  return { action: 'VOID_AND_REPLACE', reason: 'an unpaid invoice that does NOT match the agreed deal exists with no payments — it will be voided and replaced' };
}

module.exports = { decideStepnrock, matchesAgreedDeal, UNPAID, AGREED };
