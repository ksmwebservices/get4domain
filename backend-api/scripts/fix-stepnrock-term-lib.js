'use strict';
// Pure decision logic for scripts/fix-stepnrock-term.js (separate so the verify suite can test it without a database).
//
// Why it exists (read-only production check, 2026-10-08): stepnrock has TWO activation invoices — INV-2026-0005 (VOID) and INV-2026-0006 (SENT) —
// and the CURRENT term (the one on INV-0006) was created with graceDays 2 and paymentDueAt = created + 2 days, instead of the agreed 7 + 7.
// This plans the smallest safe correction: current term -> paymentDueAt = now + 7 days, graceDays = 7 (and the open invoice's due date to match),
// and reports everything odd it sees. It never touches amounts, plan, period, credits or any other vendor.

const OPEN = ['DRAFT', 'SENT', 'PENDING', 'OVERDUE', 'PAYMENT_SUBMITTED', 'PARTIALLY_PAID'];
const DEAD = ['VOID', 'CANCELLED', 'EXPIRED'];
const DAY = 86_400_000;
const TARGET = { dueDays: 7, graceDays: 7 };
/** A due date already this close to (now + dueDays) is considered fixed — makes a same-day re-run a no-op. */
const TOLERANCE_DAYS = 0.5;

const iso = (d) => (d instanceof Date ? d.toISOString() : d ? String(d) : null);

/**
 * @param {{ now: Date,
 *           terms: {id:string,status:string,isCurrent:boolean,graceDays:number,paymentDueAt:Date|null,activationInvoiceId:string|null,createdAt?:Date}[],
 *           invoices: {id:string,invoiceNumber:string,kind:string|null,status:string,totalAmount:number,paidPaise?:number,dueDate:Date|null,termId:string|null}[],
 *           submissionsByInvoice?: Record<string, number>,
 *           alreadyFixedTermIds?: string[],
 *           force?: boolean }} i
 */
function planTermFix({ now, terms, invoices, submissionsByInvoice = {}, alreadyFixedTermIds = [], force = false }) {
  const activation = invoices.filter((x) => x.kind === 'ACTIVATION');
  const open = activation.filter((x) => OPEN.includes(x.status));
  const dead = activation.filter((x) => DEAD.includes(x.status));
  const paid = activation.filter((x) => x.status === 'PAID');
  const current = terms.find((t) => t.isCurrent) ?? null;
  const targetDue = new Date(now.getTime() + TARGET.dueDays * DAY);

  const report = {
    activationInvoices: activation.map((x) => ({ number: x.invoiceNumber, status: x.status, totalAmount: x.totalAmount, dueDate: iso(x.dueDate) })),
    open: open.map((x) => x.invoiceNumber),
    voided: dead.map((x) => x.invoiceNumber),
    paid: paid.map((x) => x.invoiceNumber),
    duplicates: activation.length > 1,
    terms: terms.map((t) => ({ id: t.id, status: t.status, current: t.isCurrent, graceDays: t.graceDays, paymentDueAt: iso(t.paymentDueAt), activationInvoiceId: t.activationInvoiceId })),
    orphanTerms: terms.filter((t) => !t.isCurrent && dead.some((x) => x.id === t.activationInvoiceId)).map((t) => t.id),
    targetDue: iso(targetDue),
  };
  const refuse = (...reasons) => ({ level: 'REFUSE', reasons, actions: [], report });
  const nothing = (...reasons) => ({ level: 'NOTHING', reasons, actions: [], report });

  if (!current) return refuse('there is no current billing term for this vendor');
  if (open.length > 1) return refuse(`more than one OPEN activation invoice (${open.map((x) => x.invoiceNumber).join(', ')}) — void the extras in Admin → Commerce → Invoices first; this script will not guess which to keep`);
  if (open.length === 0) {
    return paid.length > 0 && current.status === 'ACTIVE'
      ? nothing('the activation invoice is already paid and the term is ACTIVE — there is nothing to correct')
      : refuse('there is NO open activation invoice, so there is nothing to attach the corrected due date to — resolve the invoice first');
  }
  const inv = open[0];
  if (current.activationInvoiceId !== inv.id) {
    return refuse(`the current term belongs to a different invoice (${current.activationInvoiceId ?? 'none'}) than the one open invoice ${inv.invoiceNumber} — fix that mismatch in Admin first`);
  }
  if (current.status !== 'ACTIVE_PAYMENT_DUE') return nothing(`the current term is ${current.status}, not ACTIVE_PAYMENT_DUE — the due date no longer applies`);
  if (!force && alreadyFixedTermIds.includes(current.id)) return nothing('this term was already corrected by this script (audit entry exists) — use --force only if you really want to move the date again');
  if ((inv.paidPaise ?? 0) > 0 || (submissionsByInvoice[inv.id] ?? 0) > 0) {
    // A payment is in flight; moving a date under it is not this script's job.
    return refuse(`${inv.invoiceNumber} already has a payment or a payment proof — leave the dates to the normal confirmation flow`);
  }

  const dueOk = Boolean(current.paymentDueAt) && current.paymentDueAt.getTime() >= targetDue.getTime() - TOLERANCE_DAYS * DAY;
  const termOk = current.graceDays === TARGET.graceDays && dueOk;
  const invoiceOk = inv.dueDate && inv.dueDate.getTime() >= targetDue.getTime() - TOLERANCE_DAYS * DAY;
  if (termOk && invoiceOk) return nothing(`the term already has graceDays ${TARGET.graceDays} and a due date ≥ ${TARGET.dueDays} days away, and the invoice due date matches`);

  const actions = [];
  if (!termOk) actions.push({ type: 'SET_TERM', termId: current.id, paymentDueAt: targetDue, graceDays: TARGET.graceDays, before: { paymentDueAt: iso(current.paymentDueAt), graceDays: current.graceDays } });
  if (!invoiceOk) actions.push({ type: 'SET_INVOICE_DUE', invoiceId: inv.id, invoiceNumber: inv.invoiceNumber, dueDate: targetDue, before: { dueDate: iso(inv.dueDate) } });
  return { level: 'FIX', reasons: [`current term has graceDays ${current.graceDays} and paymentDueAt ${iso(current.paymentDueAt)}; target is graceDays ${TARGET.graceDays} and ${iso(targetDue)}`], actions, report };
}

/** After applying: exactly one open activation invoice, and it is the current term's. */
function verifyAfter({ terms, invoices, now }) {
  const open = invoices.filter((x) => x.kind === 'ACTIVATION' && OPEN.includes(x.status));
  const current = terms.find((t) => t.isCurrent);
  const checks = [
    ['exactly one OPEN activation invoice remains', open.length === 1],
    ['it is the current term\'s activation invoice', Boolean(current && open[0] && current.activationInvoiceId === open[0].id)],
    ['current term graceDays is 7', Boolean(current && current.graceDays === TARGET.graceDays)],
    [`current term payment is due about ${TARGET.dueDays} days from now`, Boolean(current && current.paymentDueAt && Math.abs(current.paymentDueAt.getTime() - (now.getTime() + TARGET.dueDays * DAY)) <= 1 * DAY)],
    ['the open invoice due date matches the term', Boolean(current && open[0] && open[0].dueDate && current.paymentDueAt && Math.abs(open[0].dueDate.getTime() - current.paymentDueAt.getTime()) <= 60_000)],
  ];
  return { ok: checks.every(([, v]) => v), checks };
}

module.exports = { planTermFix, verifyAfter, TARGET, OPEN, DEAD };
