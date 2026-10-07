import { ForbiddenException, Global, Injectable, Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type GatedAction = 'publish' | 'message' | 'ai_spend';

/**
 * A LAPSED vendor keeps login, data and read access, but cannot publish, send outbound messages or
 * spend AI Studio credit until they pay. A vendor with NO billing term (legacy / unmanaged) is never
 * gated. Nothing is ever deleted by lapsing.
 */
@Injectable()
export class BillingGateService {
  constructor(private readonly prisma: PrismaService) {}

  async isLapsed(vendorId: string): Promise<boolean> {
    const term = await this.prisma.billingTerm.findFirst({ where: { vendorId, isCurrent: true }, select: { status: true } });
    return term?.status === 'LAPSED';
  }

  async assertNotLapsed(vendorId: string, action: GatedAction): Promise<void> {
    if (!(await this.isLapsed(vendorId))) return;
    const what = action === 'publish' ? 'publish changes' : action === 'message' ? 'send messages' : 'use AI Studio credit';
    throw new ForbiddenException(`Your plan payment is overdue, so you can't ${what} right now. Your data and access are safe — pay your pending invoice from Billing and everything resumes instantly.`);
  }
}

@Global()
@Module({ providers: [BillingGateService], exports: [BillingGateService] })
export class BillingGateModule {}
