import { Prisma } from '@prisma/client';
import { creditInTx } from './purse.service';

type Tx = Prisma.TransactionClient;

/**
 * LeadSpace credit that comes with a paid plan, like the AI Studio credit: Essentials (WORKSPACE) and Pro (BOS) carry a yearly amount in RUPEES
 * (not a number of leads) that lands in the LEADS wallet and pays for verified customers until the term ends. KSM decision, 2026-10-10.
 *
 *   - amount = yearly amount x months / 12, rounded to a whole rupee (halves up), so a half-year term gets half of it
 *   - once per paid term (idempotency key plan:<termId>); a plan or term change grants only the difference to what the last term year already gave
 *   - it expires with the term (ledger row has expiresAt; the expiry sweep writes off what is unspent) and is used before any refilled money
 *   - nothing is granted for a demo, a lapsed term or a free LeadSpace-only account, and nothing already given is ever taken back
 *
 * A plain function on a transaction, like the AI credit, so the settlement code can call it inside its own transaction without importing the LeadSpace module.
 * The yearly amounts are admin data (setting `planCreditPaise`); these are only the starting values.
 */
export const PLAN_CREDIT_DEFAULT: Record<string, number> = { WORKSPACE: 20000, BOS: 60000 };

export function prorate(annualPaise: number, months: number): number {
  if (!Number.isInteger(months) || months < 1 || annualPaise <= 0) return 0;
  const rupees = Math.floor((annualPaise * months + 600) / 1200);
  return Math.min(annualPaise, rupees * 100);
}

async function yearly(tx: Tx): Promise<Record<string, number>> {
  const row = await tx.leadspaceSetting.findUnique({ where: { key: 'planCreditPaise' } });
  const v = row?.value;
  return v && typeof v === 'object' && !Array.isArray(v) ? { ...PLAN_CREDIT_DEFAULT, ...(v as Record<string, number>) } : PLAN_CREDIT_DEFAULT;
}

export async function grantLeadspacePlanCredit(tx: Tx, vendorId: string, planKey: string, termId: string): Promise<number> {
  const term = await tx.billingTerm.findUnique({ where: { id: termId } });
  if (!term || (term.status !== 'ACTIVE' && term.status !== 'ACTIVE_PAYMENT_DUE')) return 0;
  const annual = (await yearly(tx))[planKey] ?? 0;
  const target = prorate(annual, term.cycleMonths);
  if (target <= 0) return 0;
  // serialise per vendor so two settlements at once cannot both read "nothing granted yet"
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ls-plan-credit:${vendorId}`}))`;
  const since = new Date(Date.now() - Math.max(30, term.cycleMonths * 30 - 30) * 86_400_000);
  const earlier = await tx.leadPurseEntry.findMany({ where: { vendorId, reason: 'PLAN_CREDIT', type: 'CREDIT', createdAt: { gte: since } }, select: { amountPaise: true } });
  const granted = earlier.reduce((a, r) => a + r.amountPaise, 0);
  const grant = Math.max(0, target - granted);
  if (grant === 0) return 0;
  const end = term.periodEnd ?? new Date(Date.now() + term.cycleMonths * 30 * 86_400_000);
  const name = planKey === 'BOS' ? 'Pro' : 'Essentials';
  const r = await creditInTx(tx, {
    vendorId, amountPaise: grant, reason: 'PLAN_CREDIT', idempotencyKey: `plan:${termId}`, refType: 'BillingTerm', refId: termId, expiresAt: end,
    note: `${name} plan LeadSpace credit for a ${term.cycleMonths}-month term (use it before the term ends)`,
  });
  return r.replayed ? 0 : grant;
}

/**
 * Write off plan credit whose term has ended and that was not used. Plan credit is spent first, so what is unspent is the grant minus the verified-customer
 * charges made since it was given, never more than the balance. One EXPIRY ledger row per grant (key plan-expiry:<entryId>), so running this twice changes nothing.
 */
export async function expirePlanCredits(tx: Tx, vendorId: string, now = new Date()): Promise<number> {
  const due = await tx.leadPurseEntry.findMany({ where: { vendorId, reason: 'PLAN_CREDIT', type: 'CREDIT', expiresAt: { lt: now } }, orderBy: { createdAt: 'asc' } });
  let written = 0;
  for (const g of due) {
    const done = await tx.leadPurseEntry.findUnique({ where: { idempotencyKey: `plan-expiry:${g.id}` } });
    if (done) continue;
    const spent = await tx.leadPurseEntry.aggregate({ where: { vendorId, reason: 'LEAD_CHARGE', type: 'DEBIT', createdAt: { gte: g.createdAt, lte: g.expiresAt ?? now } }, _sum: { amountPaise: true } });
    const purse = await tx.leadPurse.findUnique({ where: { vendorId_kind: { vendorId, kind: 'LEADS' } } });
    const unspent = Math.min(Math.max(0, g.amountPaise - (spent._sum.amountPaise ?? 0)), purse?.balancePaise ?? 0);
    if (unspent > 0) {
      const d = await tx.leadPurse.updateMany({ where: { vendorId, kind: 'LEADS', balancePaise: { gte: unspent } }, data: { balancePaise: { decrement: unspent }, totalDebited: { increment: unspent } } });
      if (d.count !== 1) continue;
      const after = await tx.leadPurse.findUniqueOrThrow({ where: { vendorId_kind: { vendorId, kind: 'LEADS' } } });
      await tx.leadPurseEntry.create({ data: { purseId: after.id, vendorId, type: 'DEBIT', amountPaise: unspent, balanceAfter: after.balancePaise, reason: 'EXPIRY', refType: 'LeadPurseEntry', refId: g.id, note: 'Plan credit expired with its term', idempotencyKey: `plan-expiry:${g.id}`, createdBy: 'system' } });
      written += unspent;
    }
  }
  return written;
}
