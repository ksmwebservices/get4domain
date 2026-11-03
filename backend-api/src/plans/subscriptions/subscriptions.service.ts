import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, V3PlanSubscription } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { addMonths, validateTerm } from '../admin/admin-validation';
import { Actor, AuditService } from '../admin/audit.service';
import { unknownPlan, unknownVendor } from '../admin/plans-admin.common';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { planError } from '../plans.errors';

export type SubscriptionSource = 'REGISTRATION' | 'SELF' | 'STAFF' | 'MIGRATION' | 'PROMO';
export interface AssignArgs {
  vendorId: string;
  planKey: string;
  termMonths?: number | null;
  endsAt?: Date | null;
  source: SubscriptionSource;
  actor: Actor;
  reason: string | null;
  now?: Date;
}

const DAY_MS = 86_400_000;

/**
 * Creates subscriptions and their ledger events. No payments: a subscription is created by staff (source STAFF) or by the registration hook (REGISTRATION).
 * The previous current subscription is closed in the same transaction; the database refuses a second current row (unique currentVendorId).
 */
@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly entitlements: EntitlementsService) {}

  async assignPlan(args: AssignArgs): Promise<V3PlanSubscription> {
    const sub = await this.prisma.$transaction((tx) => this.assignInTx(tx, args));
    this.entitlements.invalidate(args.vendorId);
    return sub;
  }

  async assignInTx(tx: Prisma.TransactionClient, a: AssignArgs): Promise<V3PlanSubscription> {
    const now = a.now ?? new Date();
    if (!(await tx.vendor.findUnique({ where: { id: a.vendorId }, select: { id: true } }))) throw unknownVendor();
    const plan = await tx.v3Plan.findUnique({ where: { key: a.planKey } });
    if (!plan) throw unknownPlan();
    if (plan.status === 'RETIRED') throw new BadRequestException('That plan is retired and cannot be given to a vendor.');

    let termMonths: number | null = null;
    let endsAt: Date | null = null;
    let graceEndsAt: Date | null = null;
    let snapshot: Prisma.InputJsonValue;
    if (plan.level === 'FREE') {
      if (a.termMonths !== undefined && a.termMonths !== null) throw new BadRequestException(planError('INVALID_TERM', 'A Free plan has no term.'));
      snapshot = { planKey: plan.key, termMonths: null, amountPaise: 0, currency: 'INR', capturedAt: now.toISOString() };
    } else {
      const allowMonthly = (await tx.v3PlanSetting.findUnique({ where: { key: 'allowMonthly' } }))?.valueJson === true;
      termMonths = validateTerm(a.termMonths, allowMonthly);
      endsAt = a.endsAt ?? addMonths(now, termMonths);
      if (endsAt.getTime() <= now.getTime()) throw new BadRequestException('The end date must be in the future.');
      const grace = (await tx.v3PlanSetting.findUnique({ where: { key: 'graceDays' } }))?.valueJson;
      graceEndsAt = new Date(endsAt.getTime() + (typeof grace === 'number' && grace >= 0 ? grace : 7) * DAY_MS);
      // the subscription keeps a COPY of the price it was sold at, so later price edits never change it
      const price = await tx.v3PlanPrice.findFirst({ where: { planId: plan.id, termMonths, status: 'APPROVED', effectiveFrom: { lte: now } }, orderBy: { effectiveFrom: 'desc' } });
      snapshot = price
        ? { planKey: plan.key, termMonths, amountPaise: price.amountPaise, currency: price.currency, taxInclusive: price.taxInclusive, priceId: price.id, capturedAt: now.toISOString() }
        : { planKey: plan.key, termMonths, amountPaise: null, note: 'assigned without an approved price', capturedAt: now.toISOString() };
    }

    const current = await tx.v3PlanSubscription.findUnique({ where: { currentVendorId: a.vendorId } });
    if (current) await tx.v3PlanSubscription.update({ where: { id: current.id }, data: { status: 'CANCELLED', currentVendorId: null } });

    const created = await tx.v3PlanSubscription.create({
      data: {
        vendorId: a.vendorId, planId: plan.id, status: 'ACTIVE', termMonths, startsAt: now, endsAt, graceEndsAt, source: a.source,
        priceSnapshotJson: snapshot, createdByType: a.actor.type, createdById: a.actor.id, currentVendorId: a.vendorId,
      },
    });
    await tx.v3SubscriptionEvent.create({
      data: {
        subscriptionId: created.id, vendorId: a.vendorId, type: a.source === 'REGISTRATION' ? 'FREE_PROVISIONED' : current ? 'CHANGED' : 'ASSIGNED',
        fromPlanId: current?.planId ?? null, toPlanId: plan.id, reason: a.reason, actorType: a.actor.type, actorId: a.actor.id,
      },
    });
    await this.audit.record(tx, a.actor, 'subscription.assign', 'subscription', created.id, current, created);
    return created;
  }
}
