import { PrismaClient } from '@prisma/client';
import { RUN_ID } from './staging-env';

/**
 * Helpers for the plan billing staging suites. They never use a real payment provider: the app is built with the FAKE provider. To be independent of what the owner has approved so far, the
 * suite adds its OWN approved price for handyman_pro and its own active tax rate (both removed at the end), and switches paymentsMode to "test" (restored at the end).
 */
export interface BillingFixture { priceIds: string[]; taxId: string | null; previous: Map<string, { existed: boolean; value: unknown }> }
const KEYS = ['paymentsMode', 'renewalRemindersEnabled', 'upgradeProration'];

export async function setUpBilling(prisma: PrismaClient, opts: { reminders?: boolean } = {}): Promise<BillingFixture> {
  const fx: BillingFixture = { priceIds: [], taxId: null, previous: new Map() };
  for (const key of KEYS) { const row = await prisma.v3PlanSetting.findUnique({ where: { key } }); fx.previous.set(key, { existed: !!row, value: row?.valueJson ?? null }); }
  const set = (key: string, valueJson: unknown) => prisma.v3PlanSetting.upsert({ where: { key }, create: { key, valueJson: valueJson as never, description: 'v3test' }, update: { valueJson: valueJson as never } });
  await set('paymentsMode', 'test'); await set('renewalRemindersEnabled', opts.reminders === true); await set('upgradeProration', 'NONE');
  const plan = await prisma.v3Plan.findUniqueOrThrow({ where: { key: 'handyman_pro' } });
  fx.previous.set('plan:handyman_pro', { existed: true, value: { status: plan.status, isPublic: plan.isPublic } });
  await prisma.v3Plan.update({ where: { id: plan.id }, data: { status: 'ACTIVE', isPublic: true } });   // the plan must be sellable for the test; put back at the end
  const eff = new Date(Date.now() - 60_000);
  for (const [term, amount] of [[3, 300_000], [6, 540_000], [12, 960_000]] as const) {
    fx.priceIds.push((await prisma.v3PlanPrice.create({ data: { planId: plan.id, termMonths: term, amountPaise: amount, currency: 'INR', taxInclusive: false, status: 'APPROVED', effectiveFrom: new Date(eff.getTime() + term) } })).id);
  }
  fx.taxId = (await prisma.v3TaxRate.create({ data: { name: `V3TEST GST ${RUN_ID}`, ratePercent: 18, appliesTo: 'ALL', active: true, validFrom: new Date(eff.getTime() + 100) } })).id;
  return fx;
}

export async function tearDownBilling(prisma: PrismaClient, fx: BillingFixture): Promise<void> {
  if (fx.priceIds.length) await prisma.v3PlanPrice.deleteMany({ where: { id: { in: fx.priceIds } } });
  if (fx.taxId) await prisma.v3TaxRate.deleteMany({ where: { id: fx.taxId } });
  for (const [key, prev] of fx.previous) {
    if (key.startsWith('plan:')) { const p = prev.value as { status: 'DRAFT' | 'ACTIVE' | 'RETIRED'; isPublic: boolean }; await prisma.v3Plan.update({ where: { key: key.slice(5) }, data: p }); continue; }
    if (prev.existed) await prisma.v3PlanSetting.update({ where: { key }, data: { valueJson: prev.value as never } }); else await prisma.v3PlanSetting.deleteMany({ where: { key } });
  }
}

export const evId = (n: string): string => `evt_${RUN_ID}_${n}`;
