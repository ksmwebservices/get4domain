import { PrismaClient } from '@prisma/client';
import { SubscriptionsService } from '../../src/plans/subscriptions/subscriptions.service';
import { SeededTenant } from './fixtures';

/** Helpers for the site staging suites. Everything created is synthetic (@v3test.invalid, V3TEST names) and removed by the repo's cleanup script. */
export const siteHost = (sub: string): string => `${sub}.get4domain.com`;

/** Turns a bare seeded tenant into a vendor with a site: a category, a subdomain, a Free plan, and a draft document with the facts the indexing rule needs. */
export async function makeSiteVendor(prisma: PrismaClient, subs: SubscriptionsService, t: SeededTenant, runId: string, opts: { pro?: boolean; complete?: boolean } = {}): Promise<{ vendorId: string; sub: string; host: string }> {
  const sub = `${t.label}-${runId}`.toLowerCase().replace(/[^a-z0-9-]/g, '');
  await prisma.vendor.update({ where: { id: t.vendorId }, data: { industry: 'plumber', subdomain: sub, phone: '+919876500000' } });
  await prisma.vendorCMS.create({
    data: {
      vendorId: t.vendorId, siteStatus: 'DRAFT', businessName: `V3TEST ${t.label} ${runId}`,
      ...(opts.complete === false ? {} : { tagline: 'Leaks fixed fast, every time.', about: 'We explain the work before we start. Fair and on time.', address: '12 Test Road, Chennai 600001', phone: '+919876500000' }),
    },
  });
  if (opts.complete !== false) await prisma.vendorProduct.create({ data: { vendorId: t.vendorId, name: 'V3TEST tap repair', description: 'Fix a leaking tap.', price: '300', active: true } });
  await subs.provisionFreeSubscription(t.vendorId, 'handyman', 'STAFF');
  if (opts.pro) await subs.assignPlan({ vendorId: t.vendorId, planKey: 'handyman_pro', termMonths: 3, source: 'STAFF', actor: { type: 'STAFF', id: null, ip: null }, reason: 'v3test pro' });
  return { vendorId: t.vendorId, sub, host: siteHost(sub) };
}

/**
 * Batch 3 (slice 5.1c, owner rule 5): a Free plan no longer includes AI credits (ai.credits_included is LOCKED_PREVIEW). The AI suites test credit counting, not the plan matrix, so their
 * vendors get the old Free allowance back as a time-limited staff override (the engine honours overrides; they cascade away with the vendor). The Free rule has its own test in ai-flow.
 */
export async function grantTestAiCredits(prisma: PrismaClient, vendorId: string, limit = 20): Promise<void> {
  await prisma.v3EntitlementOverride.create({ data: { vendorId, featureKey: 'ai.credits_included', state: 'LIMITED', limitValue: limit, reason: 'v3test: AI credit counting needs an allowance', createdByStaffId: 'v3test', expiresAt: new Date(Date.now() + 86_400_000) } });
}

/** Marks the owner as having claimed the business (a USED claim token with a hash no real token can match). */
export async function markClaimed(prisma: PrismaClient, vendorId: string): Promise<void> {
  await prisma.v3ClaimToken.create({ data: { vendorId, tokenHash: `v3test-used-${vendorId}`, status: 'USED', usedAt: new Date(), expiresAt: new Date(Date.now() + 86_400_000) } });
}
