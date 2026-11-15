import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { memberHasArea } from '../team/team-access';
import { NextStep, NextStepFacts, nextSteps } from '../v3-vendor-gaps/core/gaps-core';

/** The real state the next-steps list is built from. Read only. */
export abstract class NextStepFactsPort {
  abstract facts(vendorId: string, now: Date): Promise<NextStepFacts>;
}

@Injectable()
export class PrismaNextStepFacts extends NextStepFactsPort {
  constructor(private readonly prisma: PrismaService) { super(); }
  async facts(vendorId: string, now: Date): Promise<NextStepFacts> {
    const [published, draftRow, latest, order, custom] = await Promise.all([
      this.prisma.v3SitePublication.findFirst({ where: { vendorId, currentVendorId: vendorId }, select: { id: true } }),
      this.prisma.v3SiteDraft.findUnique({ where: { vendorId }, select: { rev: true } }),
      this.prisma.v3SitePublication.findFirst({ where: { vendorId }, orderBy: { version: 'desc' }, select: { missingFieldsJson: true } }),
      this.prisma.v3PlanOrder.findFirst({ where: { vendorId, status: { in: ['CREATED', 'PENDING_PAYMENT'] }, expiresAt: { gt: now } }, select: { id: true } }),
      this.prisma.v3Domain.findFirst({ where: { vendorId, kind: 'CUSTOM', status: { in: ['PENDING', 'VERIFYING', 'FAILED'] }, removedAt: null }, orderBy: { createdAt: 'desc' }, select: { hostname: true } }),
    ]);
    const missing = Array.isArray(latest?.missingFieldsJson) ? (latest.missingFieldsJson as unknown[]).map((m) => (m && typeof m === 'object' ? (m as { label?: unknown }).label : null)).filter((l): l is string => typeof l === 'string') : [];
    return { sitePublished: !!published, draftStarted: (draftRow?.rev ?? 0) > 0, missingDetails: missing, unpaidPlanOrder: !!order, unconnectedDomain: custom?.hostname ?? null };
  }
}

/** The signed-in person, as the next-steps filter needs it. */
export interface StepCaller { kind?: string; modules?: string[] }

/**
 * The next steps shown on Home (B5): derived only from real state (site draft, missing site details, an unpaid plan order, an unconnected domain), never a number or an invented task. The owner sees every
 * step; a team member only sees the steps of an area they hold (money and domain steps are the owner's).
 */
@Injectable()
export class NextStepsService {
  clock: () => Date = () => new Date();
  constructor(private readonly facts: NextStepFactsPort) {}

  async forCaller(vendorId: string, who: StepCaller): Promise<Array<Pick<NextStep, 'id' | 'text' | 'route'>>> {
    const steps = nextSteps(await this.facts.facts(vendorId, this.clock()));
    const member = who.kind === 'team_member';
    return steps.filter((s) => !member || (s.area !== 'OWNER' && memberHasArea(who.modules, s.area))).map(({ id, text, route }) => ({ id, text, route }));
  }
}
