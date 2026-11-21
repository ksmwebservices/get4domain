import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Actor, AuditService } from '../../plans/admin/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ALLOWANCE_TERMS, INCLUDED_GROUPS, validateAllowance } from './included-core';

/** What the catalogue and the request step ask: the quantities set for this vendor's plan and billing term, by group. Anything not set is simply absent. */
export abstract class IncludedAllowancePort {
  abstract groupLimits(vendorId: string): Promise<Record<string, number>>;
}
export class NoIncludedAllowance extends IncludedAllowancePort { async groupLimits(): Promise<Record<string, number>> { return {}; } }

@Injectable()
export class IncludedAllowanceService extends IncludedAllowancePort {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) { super(); }

  /** The current paid subscription's plan and term. A Free plan has no term, so nothing is included for it. */
  async groupLimits(vendorId: string): Promise<Record<string, number>> {
    const sub = await this.prisma.v3PlanSubscription.findUnique({ where: { currentVendorId: vendorId }, select: { planId: true, termMonths: true } });
    if (!sub || sub.termMonths === null) return {};
    const rows = await this.prisma.v3PlanServiceAllowance.findMany({ where: { planId: sub.planId, termMonths: sub.termMonths }, select: { groupKey: true, quantity: true } });
    return Object.fromEntries(rows.map((r) => [r.groupKey, r.quantity]));
  }

  /** Every paid plan x 3 terms x 6 groups, each a number or NOT_SET. */
  async matrix() {
    const [plans, rows] = await Promise.all([
      this.prisma.v3Plan.findMany({ where: { level: 'PRO' }, orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }], select: { id: true, key: true, name: true, track: true } }),
      this.prisma.v3PlanServiceAllowance.findMany({ select: { planId: true, termMonths: true, groupKey: true, quantity: true } }),
    ]);
    return {
      groups: INCLUDED_GROUPS.map((g) => ({ key: g.key, name: g.name, serviceKeys: g.serviceKeys })), terms: ALLOWANCE_TERMS,
      plans: plans.map((p) => ({
        key: p.key, name: p.name, track: p.track,
        terms: ALLOWANCE_TERMS.map((t) => ({
          termMonths: t,
          groups: INCLUDED_GROUPS.map((g) => { const r = rows.find((x) => x.planId === p.id && x.termMonths === t && x.groupKey === g.key); return r ? { key: g.key, state: 'INCLUDED', quantity: r.quantity } : { key: g.key, state: 'NOT_SET', quantity: null }; }),
        })),
      })),
    };
  }

  /** quantity null = clear it back to NOT_SET. Audited with before and after. */
  async set(planKey: string, termMonths: number, groupKey: string, quantity: number | null, actor: Actor & { id: string | null }) {
    const problem = validateAllowance(termMonths, groupKey, quantity);
    if (problem) throw new BadRequestException({ message: problem, code: 'ALLOWANCE_INVALID' });
    const plan = await this.prisma.v3Plan.findUnique({ where: { key: planKey }, select: { id: true, level: true, key: true } });
    if (!plan) throw new NotFoundException({ message: 'That plan does not exist.', code: 'UNKNOWN_PLAN' });
    if (plan.level !== 'PRO') throw new ConflictException({ message: 'Only a paid plan has billing terms; a Free plan includes no services.', code: 'ALLOWANCE_PLAN_NOT_PAID' });
    await this.prisma.$transaction(async (tx) => {
      const where = { planId_termMonths_groupKey: { planId: plan.id, termMonths, groupKey } };
      const before = await tx.v3PlanServiceAllowance.findUnique({ where });
      if (quantity === null) { if (before) await tx.v3PlanServiceAllowance.delete({ where }); }
      else await tx.v3PlanServiceAllowance.upsert({ where, create: { planId: plan.id, termMonths, groupKey, quantity, updatedByStaffId: actor.id }, update: { quantity, updatedByStaffId: actor.id } });
      if ((before?.quantity ?? null) !== quantity) await this.audit.record(tx, actor, quantity === null ? 'plan.allowance.clear' : 'plan.allowance.set', 'plan_service_allowance', plan.id, { termMonths, groupKey, quantity: before?.quantity ?? null }, { termMonths, groupKey, quantity });
    });
    return { planKey, termMonths, groupKey, state: quantity === null ? 'NOT_SET' : 'INCLUDED', quantity };
  }
}
